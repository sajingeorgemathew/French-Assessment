-- FA-05 Admin Authentication and Dashboard Foundation
-- Toronto Academy of Education - French Language Evaluation and Diagnostic Assessment
--
-- This migration is the source of truth for the FA-05 database objects.
-- It creates:
--   public.admin_users                        (application administrator authorization records)
--   constraints, indexes, updated_at trigger, row level security, deliberate privileges
--   private.is_active_french_admin()          (protected authorization helper)
--   public.is_french_assessment_admin()       (controlled boolean authorization RPC)
--   public.get_french_admin_dashboard()       (controlled administrator dashboard RPC)
--
-- The migration is written to be safely re-runnable.
--
-- Authorization model:
--   Supabase Auth answers "who is this user".
--   public.admin_users answers "is this authenticated user a French Assessment admin".
--   Both are required. A valid auth.users account with no active admin_users row
--   receives nothing.
--
-- Identity is always derived from auth.uid(). No function in this migration
-- accepts a caller supplied user id, so a caller can never claim another
-- user's identity.
--
-- FA-02, FA-03 and FA-04 must be applied first. This migration depends on
-- public.students, public.assessments, public.assessment_attempts and the
-- private schema. It does not modify, drop or replace any FA-02, FA-03 or
-- FA-04 object, and it does not add any policy or privilege to an existing
-- protected table.

-- ---------------------------------------------------------------------------
-- 0. Dependency guard
-- ---------------------------------------------------------------------------
do $do$
begin
  if to_regclass('public.students') is null
     or to_regclass('public.assessments') is null
     or to_regclass('public.assessment_attempts') is null then
    raise exception
      'FA-05 requires the FA-02 tables public.students, public.assessments and public.assessment_attempts. Apply the FA-02 migration first.';
  end if;

  if to_regclass('auth.users') is null then
    raise exception
      'FA-05 requires Supabase Auth (auth.users). Apply this migration on a Supabase project.';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'set_updated_at'
  ) then
    raise exception
      'FA-05 requires the FA-02 helper public.set_updated_at(). Apply the FA-02 migration first.';
  end if;
end
$do$;

-- ---------------------------------------------------------------------------
-- 1. The private schema
-- ---------------------------------------------------------------------------
-- FA-04 already created this schema. The statements are repeated here so the
-- FA-05 authorization helper is protected even if the schema is ever recreated,
-- and so that USAGE stays revoked from anon and authenticated.
create schema if not exists private;

revoke all on schema private from public;
revoke all on schema private from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. public.admin_users
-- ---------------------------------------------------------------------------
-- One row per Toronto Academy staff member who is allowed into the French
-- Assessment administration area.
--
-- There is deliberately no password column, no password hash column and no
-- email column. Supabase Auth owns credentials and the email address; this
-- table owns application authorization only.
create table if not exists public.admin_users (
  user_id uuid primary key
    references auth.users (id) on delete cascade,
  display_name text not null,
  role text not null default 'admin',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_users_display_name_not_blank check (btrim(display_name) <> ''),
  constraint admin_users_display_name_length check (char_length(display_name) <= 120),
  -- FA-05 recognises exactly one role. A future role must be added by a new
  -- migration that also updates the authorization helper below.
  constraint admin_users_role_check check (role in ('admin'))
);

-- Serves the "list the active administrators" maintenance query.
create index if not exists admin_users_is_active_idx
  on public.admin_users (is_active);

comment on table public.admin_users is
  'FA-05: application authorization records for French Assessment administrators. Holds no credentials. Not readable by anon or authenticated roles.';
comment on column public.admin_users.user_id is
  'FA-05: the Supabase Auth user id. Authorization identity always comes from auth.uid(), never from a client supplied value.';
comment on column public.admin_users.role is
  'FA-05: application role. Only admin is recognised in FA-05.';
comment on column public.admin_users.is_active is
  'FA-05: false immediately removes administration access without deleting the auth account or the audit trail.';

drop trigger if exists admin_users_set_updated_at on public.admin_users;
create trigger admin_users_set_updated_at
  before update on public.admin_users
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Row level security
-- ---------------------------------------------------------------------------
-- Same deny by default posture as FA-02, FA-03 and FA-04: RLS is enabled and no
-- policies are created, so anon and authenticated cannot select, insert, update
-- or delete any row directly. The list of administrators is never exposed to a
-- browser. Access decisions are made only by the functions below.
alter table public.admin_users enable row level security;

-- Re-assert the deny by default posture if an earlier run added policies.
drop policy if exists admin_users_no_public_access on public.admin_users;
drop policy if exists admin_users_self_select on public.admin_users;

-- ---------------------------------------------------------------------------
-- 4. Table privileges
-- ---------------------------------------------------------------------------
-- RLS is not treated as the only boundary. Supabase grants broad table
-- privileges to anon and authenticated by default, so they are revoked here.
revoke all on table public.admin_users from public;
revoke all on table public.admin_users from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. private.is_active_french_admin
-- ---------------------------------------------------------------------------
-- The single authorization predicate for the whole administration area.
--
-- It takes no arguments on purpose. The identity is read from auth.uid(), which
-- is derived from the verified request JWT, so no caller can ask the question
-- "is this other user an admin" or claim another user's identity.
--
-- SECURITY DEFINER safeguards:
--   - explicit search_path with pg_temp pinned last
--   - every object reference is schema qualified, including auth.uid()
--   - no dynamic SQL
--   - takes no input at all
--   - returns a bare boolean, never a row, a role name or an email
--   - lives in the private schema, which is not exposed over PostgREST and has
--     USAGE revoked from anon and authenticated
create or replace function private.is_active_french_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $fn$
  select auth.uid() is not null
     and exists (
       select 1
       from public.admin_users a
       where a.user_id = auth.uid()
         and a.is_active
         and a.role = 'admin'
     );
$fn$;

comment on function private.is_active_french_admin() is
  'FA-05: protected authorization predicate. True only for an authenticated auth.uid() with an active admin role row. Takes no arguments.';

revoke all on function private.is_active_french_admin() from public;
revoke all on function private.is_active_french_admin() from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. RPC 1: public.is_french_assessment_admin
-- ---------------------------------------------------------------------------
-- The browser facing authorization check used by the login flow and by the
-- server side route guard. It returns a bare boolean and nothing else: no role,
-- no display name, no email, no row.
--
-- EXECUTE is granted to authenticated only. anon cannot call it at all, so an
-- anonymous visitor cannot probe the administrator list.
create or replace function public.is_french_assessment_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $fn$
  select coalesce(private.is_active_french_admin(), false);
$fn$;

comment on function public.is_french_assessment_admin() is
  'FA-05: controlled authorization check. Returns true only for an active French Assessment administrator. Executable by authenticated only.';

revoke all on function public.is_french_assessment_admin() from public;
revoke all on function public.is_french_assessment_admin() from anon;
grant execute on function public.is_french_assessment_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- 7. RPC 2: public.get_french_admin_dashboard
-- ---------------------------------------------------------------------------
-- The FA-05 administrator dashboard payload.
--
-- The function verifies authorization itself, before reading anything. Route
-- protection in the application is a usability layer; this check is the real
-- boundary, and it holds even if a caller reaches PostgREST directly with a
-- valid non-admin access token.
--
-- Benchmark handling: every attempt is compared against the benchmark_percent
-- stored on its own assessment row, so the benchmark stays database owned and
-- is never hardcoded in the browser.
--
-- Returned data is deliberately limited to what Toronto Academy staff need for
-- an operational overview. The payload never contains:
--   - assessment_attempts.attempt_token
--   - private.assessment_answer_keys content or any correct_option_key
--   - public.assessment_answers rows or per question correctness
--   - public.admin_users content
--   - anything from Supabase Auth beyond the caller's own authorization result
create or replace function public.get_french_admin_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $fn$
declare
  v_summary jsonb;
  v_recent jsonb;
begin
  -- 1. authorization first. Nothing is read before this passes.
  if not coalesce(private.is_active_french_admin(), false) then
    raise exception 'admin_authorization_required' using errcode = '42501';
  end if;

  -- 2. aggregate summary. Counts come from the attempt table joined to its own
  --    assessment so the benchmark comparison always uses the right value.
  select jsonb_build_object(
           'total_students', (select count(*)::integer from public.students),
           'total_attempts', coalesce(s.total_attempts, 0),
           'registered_attempts', coalesce(s.registered_attempts, 0),
           'in_progress_attempts', coalesce(s.in_progress_attempts, 0),
           'submitted_attempts', coalesce(s.submitted_attempts, 0),
           -- null, never NaN, when nothing has been submitted yet.
           'average_percentage', s.average_percentage,
           'benchmark_met_count', coalesce(s.benchmark_met_count, 0),
           'benchmark_below_count', coalesce(s.benchmark_below_count, 0)
         )
    into v_summary
  from (
    select count(*)::integer as total_attempts,
           count(*) filter (where a.status = 'registered')::integer as registered_attempts,
           count(*) filter (where a.status = 'in_progress')::integer as in_progress_attempts,
           count(*) filter (where a.status = 'submitted')::integer as submitted_attempts,
           round(
             avg(a.percentage) filter (
               where a.status = 'submitted' and a.percentage is not null
             ),
             2
           ) as average_percentage,
           count(*) filter (
             where a.status = 'submitted'
               and a.percentage is not null
               and a.percentage >= asm.benchmark_percent
           )::integer as benchmark_met_count,
           count(*) filter (
             where a.status = 'submitted'
               and a.percentage is not null
               and a.percentage < asm.benchmark_percent
           )::integer as benchmark_below_count
    from public.assessment_attempts a
    join public.assessments asm on asm.id = a.assessment_id
  ) s;

  -- 3. the ten most recent submitted attempts, newest first. Student contact
  --    details are included because staff need them to follow up, and this
  --    payload is only ever produced for a verified active administrator.
  select coalesce(
           jsonb_agg(to_jsonb(r) order by r.submitted_at desc, r.attempt_id desc),
           '[]'::jsonb
         )
    into v_recent
  from (
    select a.id as attempt_id,
           st.full_name as student_full_name,
           st.email as student_email,
           st.phone as student_phone,
           st.status_in_canada as status_in_canada,
           asm.level as assessment_level,
           a.score as score,
           asm.total_questions as total_questions,
           a.percentage as percentage,
           a.submitted_at as submitted_at
    from public.assessment_attempts a
    join public.students st on st.id = a.student_id
    join public.assessments asm on asm.id = a.assessment_id
    where a.status = 'submitted'
      and a.submitted_at is not null
    order by a.submitted_at desc, a.id desc
    limit 10
  ) r;

  return jsonb_build_object(
    'summary', v_summary,
    'recent_submissions', v_recent
  );
end;
$fn$;

comment on function public.get_french_admin_dashboard() is
  'FA-05: controlled administrator dashboard. Verifies private.is_active_french_admin() before reading anything. Returns aggregate counts plus up to ten recent submitted attempts. Never returns attempt tokens, answer keys or per question correctness.';

revoke all on function public.get_french_admin_dashboard() from public;
revoke all on function public.get_french_admin_dashboard() from anon;
grant execute on function public.get_french_admin_dashboard() to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Final privilege assertion
-- ---------------------------------------------------------------------------
-- Proves the FA-05 boundaries hold before the migration is allowed to commit.
do $do$
declare
  v_role text;
  v_privilege text;
begin
  foreach v_role in array array['anon', 'authenticated'] loop
    if not exists (select 1 from pg_catalog.pg_roles where rolname = v_role) then
      continue;
    end if;

    foreach v_privilege in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE'] loop
      if has_table_privilege(v_role, 'public.admin_users', v_privilege) then
        raise exception
          'FA-05 privilege check failed: % still has % on public.admin_users.',
          v_role, v_privilege;
      end if;
    end loop;

    if has_schema_privilege(v_role, 'private', 'USAGE') then
      raise exception
        'FA-05 privilege check failed: % still has USAGE on schema private.', v_role;
    end if;

    if has_function_privilege(v_role, 'private.is_active_french_admin()', 'EXECUTE') then
      raise exception
        'FA-05 privilege check failed: % still has EXECUTE on private.is_active_french_admin().', v_role;
    end if;
  end loop;

  if exists (select 1 from pg_catalog.pg_roles where rolname = 'anon') then
    if has_function_privilege('anon', 'public.is_french_assessment_admin()', 'EXECUTE') then
      raise exception
        'FA-05 privilege check failed: anon still has EXECUTE on public.is_french_assessment_admin().';
    end if;

    if has_function_privilege('anon', 'public.get_french_admin_dashboard()', 'EXECUTE') then
      raise exception
        'FA-05 privilege check failed: anon still has EXECUTE on public.get_french_admin_dashboard().';
    end if;
  end if;

  if exists (select 1 from pg_catalog.pg_roles where rolname = 'authenticated') then
    if not has_function_privilege('authenticated', 'public.is_french_assessment_admin()', 'EXECUTE') then
      raise exception
        'FA-05 privilege check failed: authenticated is missing EXECUTE on public.is_french_assessment_admin().';
    end if;

    if not has_function_privilege('authenticated', 'public.get_french_admin_dashboard()', 'EXECUTE') then
      raise exception
        'FA-05 privilege check failed: authenticated is missing EXECUTE on public.get_french_admin_dashboard().';
    end if;
  end if;
end
$do$;
