-- FA-02 Supabase Student Persistence and Assessment Attempts
-- Toronto Academy of Education - French Language Evaluation and Diagnostic Assessment
--
-- This migration is the source of truth for the FA-02 database objects.
-- It creates:
--   public.students
--   public.assessments
--   public.assessment_attempts
--   a shared updated_at trigger function
--   row level security (deny by default, no anonymous table policies)
--   deliberate table and function privileges
--   public.start_french_assessment  (controlled registration RPC)
--   public.begin_french_assessment  (controlled begin RPC)
--   the seeded french-a1-diagnostic assessment
--
-- The migration is written to be safely re-runnable.
-- It does not create question, answer, answer key, scoring, result or admin objects.

-- ---------------------------------------------------------------------------
-- 0. Extension assumptions
-- ---------------------------------------------------------------------------
-- gen_random_uuid() is part of core PostgreSQL from version 13 onwards, which
-- covers every currently supported Supabase project. pgcrypto is only created
-- as a fallback for older servers, and only when the function is missing.
do $do$
begin
  if not exists (
    select 1
    from pg_catalog.pg_proc
    where proname = 'gen_random_uuid'
  ) then
    create extension if not exists pgcrypto;
  end if;
end
$do$;

-- ---------------------------------------------------------------------------
-- 1. Shared updated_at trigger function
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, pg_temp
as $fn$
begin
  new.updated_at := now();
  return new;
end;
$fn$;

comment on function public.set_updated_at() is
  'FA-02: keeps updated_at current on row updates. SECURITY INVOKER, fixed search_path.';

-- ---------------------------------------------------------------------------
-- 2. public.students
-- ---------------------------------------------------------------------------
create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  email_normalized text generated always as (lower(btrim(email))) stored,
  phone text not null,
  city text,
  status_in_canada text,
  current_french_level text,
  french_learning_goal text,
  source text not null default 'french-assessment-web',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint students_full_name_not_blank check (btrim(full_name) <> ''),
  constraint students_email_not_blank check (btrim(email) <> ''),
  constraint students_phone_not_blank check (btrim(phone) <> ''),
  constraint students_full_name_length check (char_length(full_name) <= 120),
  constraint students_email_length check (char_length(email) <= 254),
  constraint students_phone_length check (char_length(phone) <= 40),
  constraint students_city_length check (city is null or char_length(city) <= 120),
  constraint students_status_in_canada_length check (status_in_canada is null or char_length(status_in_canada) <= 60),
  constraint students_current_french_level_length check (current_french_level is null or char_length(current_french_level) <= 60),
  constraint students_french_learning_goal_length check (french_learning_goal is null or char_length(french_learning_goal) <= 60),
  constraint students_source_length check (char_length(source) <= 60)
);

-- One student record per normalized email. This is the duplicate protection and
-- the conflict target used by the registration RPC upsert.
create unique index if not exists students_email_normalized_key
  on public.students (email_normalized);

create index if not exists students_created_at_idx
  on public.students (created_at desc);

comment on table public.students is
  'FA-02: prospective French assessment students. Not readable by anon or authenticated roles.';
comment on column public.students.email_normalized is
  'FA-02: generated lower(btrim(email)). Enforces one student record per normalized email.';

drop trigger if exists students_set_updated_at on public.students;
create trigger students_set_updated_at
  before update on public.students
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. public.assessments
-- ---------------------------------------------------------------------------
create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  title_fr text,
  framework text not null,
  level text not null,
  total_questions integer not null,
  benchmark_percent integer not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assessments_total_questions_positive check (total_questions > 0),
  constraint assessments_benchmark_percent_range check (benchmark_percent >= 0 and benchmark_percent <= 100)
);

create index if not exists assessments_is_active_idx
  on public.assessments (is_active);

comment on table public.assessments is
  'FA-02: assessment definitions. FA-02 seeds only french-a1-diagnostic.';

drop trigger if exists assessments_set_updated_at on public.assessments;
create trigger assessments_set_updated_at
  before update on public.assessments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. public.assessment_attempts
-- ---------------------------------------------------------------------------
create table if not exists public.assessment_attempts (
  id uuid primary key default gen_random_uuid(),
  attempt_token uuid not null default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  assessment_id uuid not null references public.assessments (id) on delete restrict,
  status text not null default 'registered',
  started_at timestamptz,
  submitted_at timestamptz,
  score integer,
  percentage numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assessment_attempts_attempt_token_key unique (attempt_token),
  constraint assessment_attempts_status_check
    check (status in ('registered', 'in_progress', 'submitted')),
  constraint assessment_attempts_score_range
    check (score is null or score >= 0),
  constraint assessment_attempts_percentage_range
    check (percentage is null or (percentage >= 0 and percentage <= 100))
);

create index if not exists assessment_attempts_student_id_idx
  on public.assessment_attempts (student_id);

create index if not exists assessment_attempts_assessment_id_idx
  on public.assessment_attempts (assessment_id);

create index if not exists assessment_attempts_status_idx
  on public.assessment_attempts (status);

comment on table public.assessment_attempts is
  'FA-02: one row per assessment attempt. One student can have many attempts. Not readable by anon or authenticated roles.';
comment on column public.assessment_attempts.attempt_token is
  'FA-02: opaque, non sequential, PII free browser facing session identifier.';

drop trigger if exists assessment_attempts_set_updated_at on public.assessment_attempts;
create trigger assessment_attempts_set_updated_at
  before update on public.assessment_attempts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. Row level security
-- ---------------------------------------------------------------------------
-- RLS is enabled on all three tables and no policies are created. That is a
-- deliberate deny by default posture: anon and authenticated cannot select,
-- insert, update or delete any row directly. All public access happens through
-- the two SECURITY DEFINER RPCs below, which run as the migration role and
-- therefore only expose the narrow statements written inside them.
alter table public.students enable row level security;
alter table public.assessments enable row level security;
alter table public.assessment_attempts enable row level security;

-- Re-assert the deny by default posture if an earlier run added policies.
drop policy if exists students_no_public_access on public.students;
drop policy if exists assessments_no_public_access on public.assessments;
drop policy if exists assessment_attempts_no_public_access on public.assessment_attempts;

-- ---------------------------------------------------------------------------
-- 6. Table privileges
-- ---------------------------------------------------------------------------
-- RLS is not treated as the only boundary. Supabase grants broad table
-- privileges to anon and authenticated by default, so they are revoked here.
revoke all on table public.students from public;
revoke all on table public.assessments from public;
revoke all on table public.assessment_attempts from public;

revoke all on table public.students from anon, authenticated;
revoke all on table public.assessments from anon, authenticated;
revoke all on table public.assessment_attempts from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. RPC 1: public.start_french_assessment
-- ---------------------------------------------------------------------------
-- Registers or refreshes a student by normalized email and creates exactly one
-- new attempt with status 'registered'.
--
-- SECURITY DEFINER safeguards:
--   - explicit search_path with pg_temp pinned last
--   - every table reference is schema qualified
--   - no dynamic SQL anywhere
--   - narrow, single purpose body
--   - returns only attempt_token and status, never a student row or PII
--   - EXECUTE revoked from public, then granted only to anon and authenticated
create or replace function public.start_french_assessment(
  p_full_name text,
  p_email text,
  p_phone text,
  p_city text default null,
  p_status_in_canada text default null,
  p_current_french_level text default null,
  p_french_learning_goal text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $fn$
declare
  v_full_name text := btrim(coalesce(p_full_name, ''));
  v_email text := btrim(coalesce(p_email, ''));
  v_phone text := btrim(coalesce(p_phone, ''));
  v_city text := nullif(btrim(coalesce(p_city, '')), '');
  v_status_in_canada text := nullif(btrim(coalesce(p_status_in_canada, '')), '');
  v_current_french_level text := nullif(btrim(coalesce(p_current_french_level, '')), '');
  v_french_learning_goal text := nullif(btrim(coalesce(p_french_learning_goal, '')), '');
  v_assessment_id uuid;
  v_student_id uuid;
  v_attempt_token uuid;
  v_status text;
begin
  -- 1. required input must not be blank
  if v_full_name = '' or v_email = '' or v_phone = '' then
    raise exception 'invalid_student_information' using errcode = '22023';
  end if;

  -- 2. reject clearly invalid oversized input
  if char_length(v_full_name) > 120
     or char_length(v_email) > 254
     or char_length(v_phone) > 40
     or char_length(coalesce(v_city, '')) > 120
     or char_length(coalesce(v_status_in_canada, '')) > 60
     or char_length(coalesce(v_current_french_level, '')) > 60
     or char_length(coalesce(v_french_learning_goal, '')) > 60 then
    raise exception 'invalid_student_information' using errcode = '22023';
  end if;

  -- 3. minimal email shape guard. The application layer runs the full check.
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then
    raise exception 'invalid_student_information' using errcode = '22023';
  end if;

  -- 4. the assessment must exist and be active
  select a.id
    into v_assessment_id
  from public.assessments a
  where a.slug = 'french-a1-diagnostic'
    and a.is_active
  limit 1;

  if v_assessment_id is null then
    raise exception 'assessment_unavailable' using errcode = 'P0002';
  end if;

  -- 5. create or refresh the student by normalized email.
  --    Optional fields are only overwritten by a meaningful non empty value,
  --    so a blank optional answer never erases useful existing information.
  --    ON CONFLICT makes concurrent registrations safe.
  insert into public.students as s (
    full_name,
    email,
    phone,
    city,
    status_in_canada,
    current_french_level,
    french_learning_goal
  )
  values (
    v_full_name,
    v_email,
    v_phone,
    v_city,
    v_status_in_canada,
    v_current_french_level,
    v_french_learning_goal
  )
  on conflict (email_normalized) do update
    set full_name = excluded.full_name,
        email = excluded.email,
        phone = excluded.phone,
        city = coalesce(excluded.city, s.city),
        status_in_canada = coalesce(excluded.status_in_canada, s.status_in_canada),
        current_french_level = coalesce(excluded.current_french_level, s.current_french_level),
        french_learning_goal = coalesce(excluded.french_learning_goal, s.french_learning_goal)
  returning s.id into v_student_id;

  -- 6. every successful registration creates one new attempt
  insert into public.assessment_attempts (student_id, assessment_id, status)
  values (v_student_id, v_assessment_id, 'registered')
  returning assessment_attempts.attempt_token, assessment_attempts.status
    into v_attempt_token, v_status;

  -- 7. minimal response only
  return jsonb_build_object(
    'attempt_token', v_attempt_token,
    'status', v_status
  );
end;
$fn$;

comment on function public.start_french_assessment(text, text, text, text, text, text, text) is
  'FA-02: controlled public registration. Returns only attempt_token and status.';

revoke all on function public.start_french_assessment(text, text, text, text, text, text, text) from public;
grant execute on function public.start_french_assessment(text, text, text, text, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 8. RPC 2: public.begin_french_assessment
-- ---------------------------------------------------------------------------
-- Moves an existing attempt from 'registered' to 'in_progress'. Safe to call
-- more than once: started_at is only set when it is currently null, no second
-- attempt is created, and submitted_at, score and percentage are never touched.
create or replace function public.begin_french_assessment(
  p_attempt_token uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $fn$
declare
  v_attempt_token uuid;
  v_status text;
  v_started_at timestamptz;
begin
  if p_attempt_token is null then
    raise exception 'invalid_attempt_token' using errcode = '22023';
  end if;

  update public.assessment_attempts a
     set status = 'in_progress',
         started_at = coalesce(a.started_at, now())
   where a.attempt_token = p_attempt_token
     and a.status in ('registered', 'in_progress')
     and exists (
       select 1
       from public.assessments s
       where s.id = a.assessment_id
         and s.slug = 'french-a1-diagnostic'
         and s.is_active
     )
  returning a.attempt_token, a.status, a.started_at
    into v_attempt_token, v_status, v_started_at;

  if v_attempt_token is null then
    raise exception 'attempt_not_startable' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'attempt_token', v_attempt_token,
    'status', v_status,
    'started_at', v_started_at
  );
end;
$fn$;

comment on function public.begin_french_assessment(uuid) is
  'FA-02: controlled public begin. Idempotent. Returns only attempt_token, status and started_at.';

revoke all on function public.begin_french_assessment(uuid) from public;
grant execute on function public.begin_french_assessment(uuid) to anon, authenticated;

-- The updated_at helper is internal, no public execution is needed.
revoke all on function public.set_updated_at() from public;
revoke all on function public.set_updated_at() from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 9. Seed the French A1 diagnostic assessment
-- ---------------------------------------------------------------------------
-- Idempotent: re-running this migration refreshes the row instead of creating
-- a duplicate, because slug is unique.
insert into public.assessments (
  slug,
  title,
  title_fr,
  framework,
  level,
  total_questions,
  benchmark_percent,
  is_active
)
values (
  'french-a1-diagnostic',
  'French Language Evaluation and Diagnostic Assessment',
  'Evaluation Diagnostique de Francais',
  'CEFR / CECRL',
  'A1',
  20,
  60,
  true
)
on conflict (slug) do update
  set title = excluded.title,
      title_fr = excluded.title_fr,
      framework = excluded.framework,
      level = excluded.level,
      total_questions = excluded.total_questions,
      benchmark_percent = excluded.benchmark_percent,
      is_active = excluded.is_active;
