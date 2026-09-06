-- FA-06 Admin Results Management and Individual Assessment Review
-- Toronto Academy of Education - French Language Evaluation and Diagnostic Assessment
--
-- This migration is the source of truth for the FA-06 database objects.
-- It creates:
--   public.get_french_admin_results()          (controlled, paginated results list RPC)
--   public.get_french_admin_attempt_detail()   (controlled single attempt review RPC)
--   one supporting partial index for the newest-first submitted attempt listing
--   deliberate function privileges and a final privilege assertion
--
-- The migration is written to be safely re-runnable.
--
-- It creates no table, no policy, no view and no new persistent result store.
-- FA-06 is a read-only reporting surface over the existing FA-02 to FA-05 data.
--
-- Authorization model, unchanged from FA-05:
--   Supabase Auth answers "who is this user".
--   public.admin_users answers "is this authenticated user a French Assessment admin".
--   Both are required, and both functions below verify the second question for
--   themselves, from auth.uid(), before they read a single protected row.
--   Route protection in the Next.js application is a usability layer only.
--
-- Answer-key boundary:
--   private.assessment_answer_keys stays in the private schema, with USAGE and
--   SELECT revoked from anon and authenticated. FA-06 joins it in exactly one
--   place: inside public.get_french_admin_attempt_detail, after the active
--   administrator check has passed, and only for the one submitted attempt that
--   was asked for. No function returns the key table, and no public or student
--   facing route gains any access to it.
--
-- FA-02, FA-03, FA-04 and FA-05 must be applied first. This migration does not
-- modify, drop or replace any object created by them, and it adds no policy or
-- table privilege to any existing table.

-- ---------------------------------------------------------------------------
-- 0. Dependency guard
-- ---------------------------------------------------------------------------
do $do$
begin
  if to_regclass('public.students') is null
     or to_regclass('public.assessments') is null
     or to_regclass('public.assessment_attempts') is null then
    raise exception
      'FA-06 requires the FA-02 tables public.students, public.assessments and public.assessment_attempts. Apply the FA-02 migration first.';
  end if;

  if to_regclass('public.assessment_sections') is null
     or to_regclass('public.assessment_passages') is null
     or to_regclass('public.assessment_questions') is null then
    raise exception
      'FA-06 requires the FA-03 content tables public.assessment_sections, public.assessment_passages and public.assessment_questions. Apply the FA-03 migration first.';
  end if;

  if to_regclass('public.assessment_answers') is null
     or to_regclass('private.assessment_answer_keys') is null then
    raise exception
      'FA-06 requires the FA-04 tables public.assessment_answers and private.assessment_answer_keys. Apply the FA-04 migration first.';
  end if;

  if to_regclass('public.admin_users') is null then
    raise exception
      'FA-06 requires the FA-05 table public.admin_users. Apply the FA-05 migration first.';
  end if;

  -- The authorization helper is the dependency that matters most. Without it
  -- the functions below would be an unauthorized reporting surface, so the
  -- migration refuses to install rather than weaken the boundary.
  if not exists (
    select 1
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'is_active_french_admin'
      and p.pronargs = 0
  ) then
    raise exception
      'FA-06 requires the FA-05 authorization helper private.is_active_french_admin(). Apply the FA-05 migration first.';
  end if;
end
$do$;

-- ---------------------------------------------------------------------------
-- 1. Private schema posture
-- ---------------------------------------------------------------------------
-- Re-asserted, never relaxed. FA-06 reads the answer keys only from inside a
-- SECURITY DEFINER function, so anon and authenticated keep no access at all.
revoke all on schema private from public;
revoke all on schema private from anon, authenticated;
revoke all on table private.assessment_answer_keys from public;
revoke all on table private.assessment_answer_keys from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Supporting index
-- ---------------------------------------------------------------------------
-- The results list is always "submitted attempts, newest first, one page at a
-- time". This partial index matches that access path exactly, keeps the sort
-- deterministic through the id tiebreaker, and stays small because it excludes
-- registered and in-progress attempts.
create index if not exists assessment_attempts_submitted_at_idx
  on public.assessment_attempts (submitted_at desc, id desc)
  where status = 'submitted';

comment on index public.assessment_attempts_submitted_at_idx is
  'FA-06: serves the newest-first paginated administrator results list.';

-- ---------------------------------------------------------------------------
-- 3. RPC 1: public.get_french_admin_results
-- ---------------------------------------------------------------------------
-- The paginated, searchable administrator results list.
--
-- Scope: submitted french-a1-diagnostic attempts only. Registered and
-- in-progress attempts are deliberately excluded, because there is no finalized
-- response snapshot to review for them; the FA-05 dashboard reports their
-- counts instead.
--
-- Input handling. Every parameter is normalized into a PL/pgSQL variable before
-- it reaches the query, and the query itself is one static statement:
--   p_search            trimmed, truncated to 120 characters, then turned into
--                       a LIKE pattern whose escape, percent and underscore
--                       characters are escaped, so a search term can never act
--                       as a wildcard. There is no dynamic SQL, no EXECUTE and
--                       no concatenation of input into a statement anywhere in
--                       this function, so a search term cannot alter the query.
--   p_benchmark_filter  lowercased and matched against an allow list of
--                       'all', 'met' and 'below'. Anything else, including
--                       null, is normalized to 'all' rather than rejected, so a
--                       tampered URL degrades to the safe default.
--   p_limit             clamped to the range 1 to 100, defaulting to 25.
--   p_offset            clamped to a minimum of 0.
--
-- Benchmark comparisons always use public.assessments.benchmark_percent from
-- the attempt's own assessment row. The value is never hardcoded here or in the
-- browser.
--
-- The payload never contains:
--   - assessment_attempts.attempt_token
--   - private.assessment_answer_keys content or any correct_option_key
--   - public.assessment_answers rows or per question correctness
--   - public.admin_users content or any administrator identity
--   - anything from Supabase Auth
create or replace function public.get_french_admin_results(
  p_search text default null,
  p_benchmark_filter text default 'all',
  p_limit integer default 25,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $fn$
declare
  v_search text;
  v_pattern text;
  v_digits text;
  v_filter text;
  v_limit integer;
  v_offset integer;
  v_payload jsonb;
begin
  -- 1. authorization first. Nothing is read before this passes.
  if not coalesce(private.is_active_french_admin(), false) then
    raise exception 'admin_authorization_required' using errcode = '42501';
  end if;

  -- 2. search term. Blank and whitespace-only input means "no search".
  v_search := nullif(btrim(coalesce(p_search, '')), '');

  if v_search is not null and char_length(v_search) > 120 then
    v_search := left(v_search, 120);
  end if;

  if v_search is not null then
    -- Escape the LIKE metacharacters. An explicit ESCAPE character is used
    -- below, and it is escaped first so the two later replacements cannot
    -- double-escape their own output.
    v_pattern := '%'
      || replace(replace(replace(v_search, '!', '!!'), '%', '!%'), '_', '!_')
      || '%';

    -- Digits-only form of the search term, used for phone matching so that
    -- "416 555 0123", "4165550123" and "(416) 555-0123" all find each other.
    -- The value holds digits only, so it contains no LIKE metacharacter.
    v_digits := nullif(regexp_replace(v_search, '[^0-9]', '', 'g'), '');
  end if;

  -- 3. benchmark filter allow list.
  v_filter := lower(btrim(coalesce(p_benchmark_filter, 'all')));

  if v_filter not in ('all', 'met', 'below') then
    v_filter := 'all';
  end if;

  -- 4. paging bounds.
  v_limit := least(greatest(coalesce(p_limit, 25), 1), 100);
  v_offset := greatest(coalesce(p_offset, 0), 0);

  -- 5. one static statement. The base CTE is the single definition of "which
  --    attempts match", so the returned page and the total count can never
  --    disagree, including when the offset runs past the end of the set.
  with base as (
    select a.id as attempt_id,
           st.full_name as student_full_name,
           st.email as student_email,
           st.phone as student_phone,
           st.city as city,
           st.status_in_canada as status_in_canada,
           st.current_french_level as current_french_level,
           st.french_learning_goal as french_learning_goal,
           asm.title as assessment_title,
           asm.level as assessment_level,
           a.score as score,
           asm.total_questions as total_questions,
           a.percentage as percentage,
           asm.benchmark_percent as benchmark_percent,
           (a.percentage is not null and a.percentage >= asm.benchmark_percent)
             as benchmark_met,
           a.started_at as started_at,
           a.submitted_at as submitted_at
    from public.assessment_attempts a
    join public.students st on st.id = a.student_id
    join public.assessments asm on asm.id = a.assessment_id
    where a.status = 'submitted'
      and a.submitted_at is not null
      and asm.slug = 'french-a1-diagnostic'
      and (
        v_search is null
        or st.full_name ilike v_pattern escape '!'
        or st.email ilike v_pattern escape '!'
        or st.phone ilike v_pattern escape '!'
        or (
          v_digits is not null
          and regexp_replace(st.phone, '[^0-9]', '', 'g')
                like '%' || v_digits || '%'
        )
      )
      and (
        v_filter = 'all'
        or (
          v_filter = 'met'
          and a.percentage is not null
          and a.percentage >= asm.benchmark_percent
        )
        or (
          v_filter = 'below'
          and a.percentage is not null
          and a.percentage < asm.benchmark_percent
        )
      )
  ),
  page as (
    select b.*
    from base b
    order by b.submitted_at desc, b.attempt_id desc
    limit v_limit
    offset v_offset
  )
  select jsonb_build_object(
           'results', coalesce(
             (
               select jsonb_agg(
                        to_jsonb(p)
                        order by p.submitted_at desc, p.attempt_id desc
                      )
               from page p
             ),
             '[]'::jsonb
           ),
           'total_count', (select count(*)::integer from base),
           'limit', v_limit,
           'offset', v_offset
         )
    into v_payload;

  return v_payload;
end;
$fn$;

comment on function public.get_french_admin_results(text, text, integer, integer) is
  'FA-06: controlled administrator results list. Verifies private.is_active_french_admin() before reading anything. Submitted french-a1-diagnostic attempts only, newest first, with server side search, benchmark filter and pagination. Never returns attempt tokens, answer keys or per question correctness.';

revoke all on function public.get_french_admin_results(text, text, integer, integer) from public;
revoke all on function public.get_french_admin_results(text, text, integer, integer) from anon;
grant execute on function public.get_french_admin_results(text, text, integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. RPC 2: public.get_french_admin_attempt_detail
-- ---------------------------------------------------------------------------
-- The individual assessment review payload for one submitted attempt.
--
-- The attempt is addressed by public.assessment_attempts.id, the internal UUID.
-- assessment_attempts.attempt_token is the student's browser facing secret; it
-- is neither accepted as input nor returned in any field.
--
-- Preconditions, all checked before any student data is read:
--   1. the caller is an active French Assessment administrator
--   2. p_attempt_id is present
--   3. the attempt exists
--   4. the attempt belongs to the french-a1-diagnostic assessment
--   5. the attempt is submitted, with a submitted_at timestamp
--
-- Failing 2 to 5 all return SQL NULL, one indistinguishable answer, so the
-- administrator UI can render a clean not-found without the response revealing
-- whether an inaccessible attempt exists. Failing 1 raises 42501.
--
-- This is the one place in the project where correct answers leave the private
-- schema, and they leave it only as part of the authorized administrator's
-- response for that one submitted attempt. The whole key table is never
-- returned, and no function returns it.
--
-- The response snapshot is public.assessment_answers exactly as FA-04 finalized
-- it. Nothing is recomputed, nothing is fabricated for a missing row, and
-- nothing is written: the function is STABLE and performs no mutation.
create or replace function public.get_french_admin_attempt_detail(
  p_attempt_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $fn$
declare
  v_attempt_id uuid;
  v_payload jsonb;
  v_responses jsonb;
  v_stored_answer_count integer;
  v_correct_answer_count integer;
begin
  -- 1. authorization first. Nothing is read before this passes.
  if not coalesce(private.is_active_french_admin(), false) then
    raise exception 'admin_authorization_required' using errcode = '42501';
  end if;

  if p_attempt_id is null then
    return null;
  end if;

  -- 2. existence, assessment scope and submitted state, resolved together so
  --    that an unknown id, a different assessment and an attempt that has not
  --    been submitted all produce the same answer.
  select a.id
    into v_attempt_id
  from public.assessment_attempts a
  join public.assessments asm on asm.id = a.assessment_id
  where a.id = p_attempt_id
    and a.status = 'submitted'
    and a.submitted_at is not null
    and asm.slug = 'french-a1-diagnostic'
  limit 1;

  if v_attempt_id is null then
    return null;
  end if;

  -- 3. attempt summary, student information and assessment configuration.
  --    Benchmark status is decided here, against the assessment's own
  --    benchmark_percent, and is never recalculated in the application.
  select jsonb_build_object(
           'attempt', jsonb_build_object(
             'attempt_id', a.id,
             'status', a.status,
             'score', a.score,
             'percentage', a.percentage,
             'started_at', a.started_at,
             'submitted_at', a.submitted_at
           ),
           'student', jsonb_build_object(
             'full_name', st.full_name,
             'email', st.email,
             'phone', st.phone,
             'city', st.city,
             'status_in_canada', st.status_in_canada,
             'current_french_level', st.current_french_level,
             'french_learning_goal', st.french_learning_goal
           ),
           'assessment', jsonb_build_object(
             'slug', asm.slug,
             'title', asm.title,
             'title_fr', asm.title_fr,
             'framework', asm.framework,
             'level', asm.level,
             'total_questions', asm.total_questions,
             'benchmark_percent', asm.benchmark_percent
           ),
           'benchmark_met',
             (a.percentage is not null and a.percentage >= asm.benchmark_percent)
         )
    into v_payload
  from public.assessment_attempts a
  join public.students st on st.id = a.student_id
  join public.assessments asm on asm.id = a.assessment_id
  where a.id = v_attempt_id;

  -- 4. the finalized response snapshot, in question order.
  --
  --    The row set is driven by public.assessment_answers, so the review shows
  --    exactly what was stored at submission: no question is invented for a
  --    missing row, and no stored row is dropped. Question presentation content
  --    comes from FA-03, the correct option key from the FA-04 private key
  --    table, and both option texts are resolved from the question's own
  --    options array so that a key is always shown next to the wording the
  --    student actually saw.
  select coalesce(jsonb_agg(to_jsonb(r) order by r.question_number), '[]'::jsonb)
    into v_responses
  from (
    select q.id as question_id,
           q.question_number as question_number,
           sec.section_key as section_key,
           sec.title as section_title,
           sec.title_fr as section_title_fr,
           sec.position as section_position,
           q.category as category,
           q.instruction as instruction,
           q.prompt as prompt,
           q.note as note,
           psg.title as passage_title,
           psg.body as passage_body,
           ans.selected_option_key as selected_option_key,
           sel.option_text as selected_option_text,
           k.correct_option_key as correct_option_key,
           cor.option_text as correct_option_text,
           ans.is_correct as is_correct
    from public.assessment_answers ans
    join public.assessment_questions q on q.id = ans.question_id
    join public.assessment_sections sec on sec.id = q.section_id
    left join public.assessment_passages psg on psg.id = q.passage_id
    left join private.assessment_answer_keys k on k.question_id = q.id
    left join lateral (
      select opt.item ->> 'text' as option_text
      from jsonb_array_elements(q.options) as opt(item)
      where opt.item ->> 'key' = ans.selected_option_key
      limit 1
    ) sel on true
    left join lateral (
      select opt.item ->> 'text' as option_text
      from jsonb_array_elements(q.options) as opt(item)
      where opt.item ->> 'key' = k.correct_option_key
      limit 1
    ) cor on true
    where ans.attempt_id = v_attempt_id
  ) r;

  -- 5. integrity counters. These are reported, never acted on: FA-06 does not
  --    repair, backfill or overwrite a historical result.
  select count(*)::integer,
         count(*) filter (where ans.is_correct)::integer
    into v_stored_answer_count, v_correct_answer_count
  from public.assessment_answers ans
  where ans.attempt_id = v_attempt_id;

  return v_payload || jsonb_build_object(
    'responses', v_responses,
    'integrity', jsonb_build_object(
      'stored_answer_count', coalesce(v_stored_answer_count, 0),
      'correct_answer_count', coalesce(v_correct_answer_count, 0)
    )
  );
end;
$fn$;

comment on function public.get_french_admin_attempt_detail(uuid) is
  'FA-06: controlled administrator review of one submitted french-a1-diagnostic attempt. Verifies private.is_active_french_admin() before reading anything, returns NULL for unknown, unsubmitted or out of scope attempts, and never returns attempt_token. Correct answers are joined from private.assessment_answer_keys for this one attempt only.';

revoke all on function public.get_french_admin_attempt_detail(uuid) from public;
revoke all on function public.get_french_admin_attempt_detail(uuid) from anon;
grant execute on function public.get_french_admin_attempt_detail(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Final privilege assertion
-- ---------------------------------------------------------------------------
-- Proves the FA-06 boundaries hold before the migration is allowed to commit.
do $do$
declare
  v_role text;
  v_privilege text;
begin
  foreach v_role in array array['anon', 'authenticated'] loop
    if not exists (select 1 from pg_catalog.pg_roles where rolname = v_role) then
      continue;
    end if;

    -- The answer keys, the response snapshot and the PII tables all stay
    -- unreachable by direct table access for both roles. FA-06 widened none of
    -- them: it added no policy and no table grant.
    foreach v_privilege in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE'] loop
      if has_table_privilege(v_role, 'private.assessment_answer_keys', v_privilege) then
        raise exception
          'FA-06 privilege check failed: % still has % on private.assessment_answer_keys.',
          v_role, v_privilege;
      end if;

      if has_table_privilege(v_role, 'public.assessment_answers', v_privilege) then
        raise exception
          'FA-06 privilege check failed: % still has % on public.assessment_answers.',
          v_role, v_privilege;
      end if;

      if has_table_privilege(v_role, 'public.assessment_attempts', v_privilege) then
        raise exception
          'FA-06 privilege check failed: % still has % on public.assessment_attempts.',
          v_role, v_privilege;
      end if;

      if has_table_privilege(v_role, 'public.students', v_privilege) then
        raise exception
          'FA-06 privilege check failed: % still has % on public.students.',
          v_role, v_privilege;
      end if;
    end loop;

    if has_schema_privilege(v_role, 'private', 'USAGE') then
      raise exception
        'FA-06 privilege check failed: % still has USAGE on schema private.', v_role;
    end if;
  end loop;

  if exists (select 1 from pg_catalog.pg_roles where rolname = 'anon') then
    if has_function_privilege(
         'anon',
         'public.get_french_admin_results(text, text, integer, integer)',
         'EXECUTE'
       ) then
      raise exception
        'FA-06 privilege check failed: anon still has EXECUTE on public.get_french_admin_results.';
    end if;

    if has_function_privilege(
         'anon',
         'public.get_french_admin_attempt_detail(uuid)',
         'EXECUTE'
       ) then
      raise exception
        'FA-06 privilege check failed: anon still has EXECUTE on public.get_french_admin_attempt_detail.';
    end if;
  end if;

  if exists (select 1 from pg_catalog.pg_roles where rolname = 'authenticated') then
    if not has_function_privilege(
             'authenticated',
             'public.get_french_admin_results(text, text, integer, integer)',
             'EXECUTE'
           ) then
      raise exception
        'FA-06 privilege check failed: authenticated is missing EXECUTE on public.get_french_admin_results.';
    end if;

    if not has_function_privilege(
             'authenticated',
             'public.get_french_admin_attempt_detail(uuid)',
             'EXECUTE'
           ) then
      raise exception
        'FA-06 privilege check failed: authenticated is missing EXECUTE on public.get_french_admin_attempt_detail.';
    end if;
  end if;
end
$do$;
