-- FA-04 Secure Submission, Scoring and Results
-- Toronto Academy of Education - French Language Evaluation and Diagnostic Assessment
--
-- This migration is the source of truth for the FA-04 database objects.
-- It creates:
--   the private schema (not exposed to anon or authenticated)
--   private.assessment_answer_keys      (protected correct answers, 20 seeded rows)
--   public.assessment_answers           (final response snapshot, one row per question)
--   constraints, indexes, row level security and deliberate privileges
--   public.submit_french_assessment     (controlled, authoritative scoring RPC)
--
-- The migration is written to be safely re-runnable.
--
-- Scoring boundary: the correct answers live only in the private schema, are
-- read only by the SECURITY DEFINER function below, and are never projected
-- into any value the browser can receive. The application never computes a
-- score, a percentage or a correctness flag, and never accepts one from a
-- client.
--
-- FA-02 and FA-03 must be applied first. This migration depends on
-- public.assessments, public.assessment_attempts and public.assessment_questions.
-- It does not modify, drop or replace any FA-02 or FA-03 object.

-- ---------------------------------------------------------------------------
-- 0. Dependency guard
-- ---------------------------------------------------------------------------
do $do$
begin
  if to_regclass('public.assessments') is null
     or to_regclass('public.assessment_attempts') is null then
    raise exception
      'FA-04 requires the FA-02 tables public.assessments and public.assessment_attempts. Apply the FA-02 migration first.';
  end if;

  if to_regclass('public.assessment_questions') is null then
    raise exception
      'FA-04 requires the FA-03 table public.assessment_questions. Apply the FA-03 migration first.';
  end if;
end
$do$;

-- ---------------------------------------------------------------------------
-- 1. The private schema
-- ---------------------------------------------------------------------------
-- Supabase exposes only the schemas listed in the PostgREST configuration
-- (public and graphql_public by default). A schema named private is therefore
-- unreachable over the REST and GraphQL endpoints no matter what a client asks
-- for. USAGE is revoked from public, anon and authenticated as well, so even a
-- future configuration mistake leaves the answer keys unreadable.
create schema if not exists private;

revoke all on schema private from public;
revoke all on schema private from anon, authenticated;

comment on schema private is
  'FA-04: server-only schema. Never added to the PostgREST exposed schema list. No anon or authenticated access.';

-- ---------------------------------------------------------------------------
-- 2. private.assessment_answer_keys
-- ---------------------------------------------------------------------------
-- One row per question. The correct option is stored as the stable option key
-- (A/B/C/D), never as the visible option text, so re-wording an option never
-- silently changes what is correct.
create table if not exists private.assessment_answer_keys (
  question_id uuid primary key
    references public.assessment_questions (id) on delete cascade,
  correct_option_key text not null,
  created_at timestamptz not null default now(),
  constraint assessment_answer_keys_correct_option_key_check
    check (correct_option_key in ('A', 'B', 'C', 'D'))
);

comment on table private.assessment_answer_keys is
  'FA-04: protected correct answers. Read only by public.submit_french_assessment. Never returned to any client.';
comment on column private.assessment_answer_keys.correct_option_key is
  'FA-04: stable option key A, B, C or D. Never the visible option text.';

-- RLS is enabled with no policies, matching the FA-02 and FA-03 deny by default
-- posture. Combined with the schema and table revokes below, anon and
-- authenticated have no path to this table at all.
alter table private.assessment_answer_keys enable row level security;

revoke all on table private.assessment_answer_keys from public;
revoke all on table private.assessment_answer_keys from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. public.assessment_answers
-- ---------------------------------------------------------------------------
-- The final response snapshot for a submitted attempt: exactly one row for each
-- question in the assessment, including the questions the student left blank.
--
-- The table lives in public because a future FA-05 admin surface will report on
-- it, but it carries no anonymous access of any kind: the only writer is the
-- scoring function below.
create table if not exists public.assessment_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null
    references public.assessment_attempts (id) on delete cascade,
  question_id uuid not null
    references public.assessment_questions (id),
  -- null means the student left the question unanswered.
  selected_option_key text,
  is_correct boolean not null,
  created_at timestamptz not null default now(),
  -- One final response per question per attempt. This is also what makes a
  -- double submission unable to create duplicate rows.
  constraint assessment_answers_attempt_id_question_id_key
    unique (attempt_id, question_id),
  constraint assessment_answers_selected_option_key_check
    check (selected_option_key is null or selected_option_key in ('A', 'B', 'C', 'D')),
  -- An unanswered question can never be stored as correct, whatever writes it.
  constraint assessment_answers_unanswered_is_incorrect_check
    check (selected_option_key is not null or is_correct = false)
);

-- The unique constraint already indexes (attempt_id, question_id), which serves
-- every per-attempt read. Only the reverse lookup needs its own index.
create index if not exists assessment_answers_question_id_idx
  on public.assessment_answers (question_id);

comment on table public.assessment_answers is
  'FA-04: final response snapshot, one row per attempt per question. Written only by public.submit_french_assessment. Not readable by anon or authenticated roles.';
comment on column public.assessment_answers.selected_option_key is
  'FA-04: A, B, C, D, or null for an unanswered question.';
comment on column public.assessment_answers.is_correct is
  'FA-04: calculated in the database against private.assessment_answer_keys. Never accepted from a client.';

-- ---------------------------------------------------------------------------
-- 4. Row level security
-- ---------------------------------------------------------------------------
-- Same deny by default posture as FA-02 and FA-03: RLS is enabled and no
-- policies are created, so anon and authenticated cannot select, insert, update
-- or delete any row directly. Nothing here relaxes an existing FA-02 or FA-03
-- policy or privilege.
alter table public.assessment_answers enable row level security;

-- Re-assert the deny by default posture if an earlier run added policies.
drop policy if exists assessment_answers_no_public_access on public.assessment_answers;

-- ---------------------------------------------------------------------------
-- 5. Table privileges
-- ---------------------------------------------------------------------------
-- RLS is not treated as the only boundary. Supabase grants broad table
-- privileges to anon and authenticated by default, so they are revoked here.
revoke all on table public.assessment_answers from public;
revoke all on table public.assessment_answers from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Seed guard
-- ---------------------------------------------------------------------------
do $do$
begin
  if not exists (
    select 1
    from public.assessments a
    where a.slug = 'french-a1-diagnostic'
  ) then
    raise exception
      'FA-04 requires the FA-02 french-a1-diagnostic assessment row. Apply the FA-02 migration first.';
  end if;

  if not exists (
    select 1
    from public.assessment_questions q
    join public.assessments a on a.id = q.assessment_id
    where a.slug = 'french-a1-diagnostic'
  ) then
    raise exception
      'FA-04 requires the FA-03 seeded french-a1-diagnostic questions. Apply the FA-03 migration first.';
  end if;
end
$do$;

-- ---------------------------------------------------------------------------
-- 7. Seed the twenty answer keys
-- ---------------------------------------------------------------------------
-- The keys are joined to questions by assessment slug plus question_number, the
-- stable identity of a question. No question UUID is hardcoded, so this seed
-- stays correct against any environment that has applied FA-03.
--
-- SOURCE STATUS, recorded here and in docs/assessment/fa-04-answer-key-review.md:
--
--   Question 1  -> source confirmed by the supplied answer-key content.
--   Questions 2 to 20 -> the project's current working key, inferred from the
--   supplied question content. They require instructor review before the
--   assessment is used in production.
--
-- Correcting a key later is a one row UPDATE of this table. Re-running this
-- migration refreshes all twenty rows, so review outcomes should be applied in
-- a new migration rather than by editing this file.
with target as (
  select a.id as assessment_id
  from public.assessments a
  where a.slug = 'french-a1-diagnostic'
),
key_seed(question_number, correct_option_key) as (
  values
    (1, 'B'),   -- source confirmed
    (2, 'C'),   -- working key, instructor review required
    (3, 'B'),   -- working key, instructor review required
    (4, 'A'),   -- working key, instructor review required
    (5, 'B'),   -- working key, instructor review required
    (6, 'D'),   -- working key, instructor review required
    (7, 'A'),   -- working key, instructor review required
    (8, 'B'),   -- working key, instructor review required
    (9, 'C'),   -- working key, instructor review required
    (10, 'C'),  -- working key, instructor review required
    (11, 'B'),  -- working key, instructor review required
    (12, 'A'),  -- working key, instructor review required
    (13, 'C'),  -- working key, instructor review required
    (14, 'B'),  -- working key, instructor review required
    (15, 'B'),  -- working key, instructor review required
    (16, 'C'),  -- working key, instructor review required
    (17, 'B'),  -- working key, instructor review required
    (18, 'B'),  -- working key, instructor review required
    (19, 'B'),  -- working key, instructor review required
    (20, 'B')   -- working key, instructor review required
)
insert into private.assessment_answer_keys (question_id, correct_option_key)
select q.id, s.correct_option_key
from key_seed s
cross join target t
join public.assessment_questions q
  on q.assessment_id = t.assessment_id
 and q.question_number = s.question_number
on conflict (question_id) do update
  set correct_option_key = excluded.correct_option_key;

-- ---------------------------------------------------------------------------
-- 8. Seed assertions
-- ---------------------------------------------------------------------------
-- Fail loudly rather than leave the assessment scorable against a partial key.
do $do$
declare
  v_assessment_id uuid;
  v_total_questions integer;
  v_questions integer;
  v_keys integer;
  v_unkeyed integer;
begin
  select a.id, a.total_questions
    into v_assessment_id, v_total_questions
  from public.assessments a
  where a.slug = 'french-a1-diagnostic';

  select count(*) into v_questions
  from public.assessment_questions q
  where q.assessment_id = v_assessment_id;

  select count(*) into v_keys
  from private.assessment_answer_keys k
  join public.assessment_questions q on q.id = k.question_id
  where q.assessment_id = v_assessment_id;

  select count(*) into v_unkeyed
  from public.assessment_questions q
  where q.assessment_id = v_assessment_id
    and not exists (
      select 1
      from private.assessment_answer_keys k
      where k.question_id = q.id
    );

  if v_questions <> v_total_questions then
    raise exception
      'FA-04 seed check failed: expected % seeded questions, found %.',
      v_total_questions, v_questions;
  end if;

  if v_keys <> v_total_questions then
    raise exception
      'FA-04 seed check failed: expected % seeded answer keys, found %.',
      v_total_questions, v_keys;
  end if;

  if v_unkeyed <> 0 then
    raise exception
      'FA-04 seed check failed: % question(s) have no answer key.', v_unkeyed;
  end if;
end
$do$;

-- ---------------------------------------------------------------------------
-- 9. RPC: public.submit_french_assessment
-- ---------------------------------------------------------------------------
-- The authoritative scoring boundary for the French A1 diagnostic.
--
-- Input:
--   p_attempt_token  the opaque FA-02 attempt token held by the browser
--   p_answers        a flat JSON object of question uuid -> option key,
--                    for example {"<question-uuid>":"B","<question-uuid>":"C"}
--                    Unanswered questions are simply absent. The browser never
--                    sends nulls, a score, a percentage or a correctness flag,
--                    and any such extra field would be rejected as an unknown
--                    question id or an invalid option value.
--
-- Validation, in order:
--   1.  the attempt token is a non null uuid
--   2.  a matching attempt exists (row locked FOR UPDATE)
--   3.  the linked assessment slug is 'french-a1-diagnostic'
--   4.  the linked assessment is active
--   5.  an already submitted attempt returns its stored result unchanged
--   6.  the attempt status is 'in_progress'
--   7.  the answers payload is a JSON object
--   8.  the payload holds a sane number of entries
--   9.  every supplied key is uuid shaped
--   10. every supplied value is the JSON string 'A', 'B', 'C' or 'D'
--   11. every supplied question belongs to this assessment (unknown ids rejected)
--   12. the authoritative question count matches assessments.total_questions
--   13. every question has a protected answer key, otherwise the submission
--       fails rather than producing an unreliable score
--
-- Atomicity: a PL/pgSQL function body runs inside a single transaction. Either
-- all twenty response rows are written and the attempt is marked submitted, or
-- the whole call is rolled back and the attempt stays exactly as it was.
--
-- Concurrency: the attempt row is locked with SELECT ... FOR UPDATE before any
-- validation. A second concurrent submission blocks on that lock, then reads
-- the committed row, sees status 'submitted' and returns the stored result. The
-- first successful final submission wins.
--
-- SECURITY DEFINER safeguards:
--   - explicit search_path with pg_temp pinned last
--   - every object reference is schema qualified, including private ones
--   - no dynamic SQL anywhere
--   - narrow, single purpose body
--   - returns only status, score, percentage, total_questions, submitted_at and
--     level: no answer key, no per-question correctness, no student row, no
--     name, email, phone or city, no attempt id and no private table content
--   - EXECUTE revoked from public, then granted only to anon and authenticated
create or replace function public.submit_french_assessment(
  p_attempt_token uuid,
  p_answers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $fn$
declare
  v_answers jsonb := coalesce(p_answers, '{}'::jsonb);
  v_attempt_id uuid;
  v_assessment_id uuid;
  v_status text;
  v_submitted_at timestamptz;
  v_score integer;
  v_percentage numeric;
  v_total_questions integer;
  v_level text;
  v_supplied integer;
  v_questions integer;
  v_unkeyed integer;
  v_written integer;
begin
  -- 1. attempt token must be present
  if p_attempt_token is null then
    raise exception 'assessment_submission_unavailable' using errcode = '22023';
  end if;

  -- 2. lock the attempt before anything else, so two concurrent submissions of
  --    the same token are serialised rather than racing.
  select a.id, a.assessment_id, a.status, a.submitted_at, a.score, a.percentage
    into v_attempt_id, v_assessment_id, v_status, v_submitted_at, v_score, v_percentage
  from public.assessment_attempts a
  where a.attempt_token = p_attempt_token
  for update;

  if v_attempt_id is null then
    -- One generic failure for every rejected case, so a caller cannot tell an
    -- unknown token apart from an attempt that is not submittable.
    raise exception 'assessment_submission_unavailable' using errcode = 'P0002';
  end if;

  -- 3 and 4. the attempt must belong to the active french-a1-diagnostic
  select s.total_questions, s.level
    into v_total_questions, v_level
  from public.assessments s
  where s.id = v_assessment_id
    and s.slug = 'french-a1-diagnostic'
    and s.is_active;

  if v_total_questions is null then
    raise exception 'assessment_submission_unavailable' using errcode = 'P0002';
  end if;

  -- 5. idempotency. An already submitted attempt is final: the stored answers,
  --    score, percentage and submitted_at are returned untouched and the
  --    supplied payload is discarded without being scored.
  if v_status = 'submitted' then
    return jsonb_build_object(
      'status', v_status,
      'score', v_score,
      'percentage', v_percentage,
      'total_questions', v_total_questions,
      'submitted_at', v_submitted_at,
      'level', v_level
    );
  end if;

  -- 6. only an in-progress attempt can be scored. A 'registered' attempt has
  --    never been started and is not submittable.
  if v_status <> 'in_progress' then
    raise exception 'assessment_submission_unavailable' using errcode = 'P0002';
  end if;

  -- 7. the payload must be a flat JSON object
  if jsonb_typeof(v_answers) <> 'object' then
    raise exception 'invalid_answer_payload' using errcode = '22023';
  end if;

  -- 8. reject an oversized payload before doing any per-entry work
  select count(*) into v_supplied
  from jsonb_object_keys(v_answers) as supplied(question_id);

  if v_supplied > 100 then
    raise exception 'invalid_answer_payload' using errcode = '22023';
  end if;

  -- 9. every key must be uuid shaped
  if exists (
    select 1
    from jsonb_object_keys(v_answers) as supplied(question_id)
    where supplied.question_id !~
      '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  ) then
    raise exception 'invalid_answer_payload' using errcode = '22023';
  end if;

  -- 10. every value must be a JSON string holding a valid option key. Anything
  --     else, including a number, an object or a nested payload, is rejected.
  if exists (
    select 1
    from jsonb_each(v_answers) as supplied(question_id, option_value)
    where jsonb_typeof(supplied.option_value) <> 'string'
       or (supplied.option_value #>> '{}') not in ('A', 'B', 'C', 'D')
  ) then
    raise exception 'invalid_answer_payload' using errcode = '22023';
  end if;

  -- 11. unknown question ids are rejected outright rather than ignored
  if exists (
    select 1
    from jsonb_object_keys(v_answers) as supplied(question_id)
    where not exists (
      select 1
      from public.assessment_questions q
      where q.id = supplied.question_id::uuid
        and q.assessment_id = v_assessment_id
    )
  ) then
    raise exception 'unknown_question_id' using errcode = '22023';
  end if;

  -- 12. the authoritative question set. The percentage denominator comes from
  --     the assessment definition, never from how many answers arrived.
  select count(*) into v_questions
  from public.assessment_questions q
  where q.assessment_id = v_assessment_id;

  if v_total_questions is null
     or v_total_questions <= 0
     or v_questions <> v_total_questions then
    raise exception 'assessment_scoring_unavailable' using errcode = 'P0002';
  end if;

  -- 13. every question must have a protected key. A partial key would produce
  --     an unreliable score, so the submission fails instead.
  select count(*) into v_unkeyed
  from public.assessment_questions q
  where q.assessment_id = v_assessment_id
    and not exists (
      select 1
      from private.assessment_answer_keys k
      where k.question_id = q.id
    );

  if v_unkeyed > 0 then
    raise exception 'assessment_scoring_unavailable' using errcode = 'P0002';
  end if;

  -- Write exactly one row for every question in the assessment. The row set is
  -- driven by public.assessment_questions, not by the payload, so the student
  -- cannot shorten or extend the snapshot. Correctness is decided here, by
  -- comparing the stable option key against the protected key.
  --
  -- ON CONFLICT DO NOTHING is defensive only: the attempt is in_progress and
  -- holds the row lock, so no earlier snapshot can exist. It guarantees that a
  -- duplicate row is impossible even if that ever changed.
  insert into public.assessment_answers (
    attempt_id,
    question_id,
    selected_option_key,
    is_correct
  )
  select v_attempt_id,
         q.id,
         (v_answers ->> (q.id::text)),
         coalesce((v_answers ->> (q.id::text)) = k.correct_option_key, false)
  from public.assessment_questions q
  join private.assessment_answer_keys k
    on k.question_id = q.id
  where q.assessment_id = v_assessment_id
  on conflict (attempt_id, question_id) do nothing;

  -- Score and completeness are read back from the stored rows, so the returned
  -- result always describes what was actually persisted.
  select count(*)::integer,
         count(*) filter (where ans.is_correct)::integer
    into v_written, v_score
  from public.assessment_answers ans
  where ans.attempt_id = v_attempt_id;

  if v_written <> v_total_questions then
    raise exception 'assessment_scoring_unavailable' using errcode = 'P0002';
  end if;

  -- score / total * 100, to two decimal places. For a twenty question
  -- assessment every possible value is exact: 12 -> 60, 15 -> 75, 20 -> 100.
  v_percentage := round((v_score::numeric * 100) / v_total_questions, 2);

  update public.assessment_attempts a
     set status = 'submitted',
         submitted_at = now(),
         score = v_score,
         percentage = v_percentage
   where a.id = v_attempt_id
  returning a.status, a.submitted_at
    into v_status, v_submitted_at;

  if v_status is null then
    raise exception 'assessment_scoring_unavailable' using errcode = 'P0002';
  end if;

  -- Minimal result only.
  return jsonb_build_object(
    'status', v_status,
    'score', v_score,
    'percentage', v_percentage,
    'total_questions', v_total_questions,
    'submitted_at', v_submitted_at,
    'level', v_level
  );
end;
$fn$;

comment on function public.submit_french_assessment(uuid, jsonb) is
  'FA-04: controlled final submission and authoritative scoring. Atomic, idempotent, concurrency safe. Returns only status, score, percentage, total_questions, submitted_at and level.';

revoke all on function public.submit_french_assessment(uuid, jsonb) from public;
grant execute on function public.submit_french_assessment(uuid, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 10. Final privilege assertion
-- ---------------------------------------------------------------------------
-- Proves that the two new tables are unreachable for anon and authenticated
-- before the migration is allowed to commit.
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
      if has_table_privilege(v_role, 'private.assessment_answer_keys', v_privilege) then
        raise exception
          'FA-04 privilege check failed: % still has % on private.assessment_answer_keys.',
          v_role, v_privilege;
      end if;

      if has_table_privilege(v_role, 'public.assessment_answers', v_privilege) then
        raise exception
          'FA-04 privilege check failed: % still has % on public.assessment_answers.',
          v_role, v_privilege;
      end if;
    end loop;

    if has_schema_privilege(v_role, 'private', 'USAGE') then
      raise exception
        'FA-04 privilege check failed: % still has USAGE on schema private.', v_role;
    end if;
  end loop;
end
$do$;
