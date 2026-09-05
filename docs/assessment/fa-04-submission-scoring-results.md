# FA-04 - Secure Submission, Scoring and Results

Toronto Academy of Education
French Language Evaluation and Diagnostic Assessment
CEFR / CECRL Level A1

Migration: `supabase/migrations/20260905073000_fa_04_submission_scoring_results.sql`

Companion document: [`fa-04-answer-key-review.md`](./fa-04-answer-key-review.md)

---

## 1. Purpose of FA-04

FA-01 delivered the branding, landing page and student intake. FA-02 delivered
`students`, `assessments`, `assessment_attempts`, the registration and begin
RPCs and the opaque attempt token. FA-03 delivered the content tables, the
controlled content RPC, the full player and a Review Answers screen with a
disabled Submit Assessment button.

FA-04 closes the lifecycle:

```
registered  ->  in_progress  ->  submitted
```

It adds:

- protected, server-only answer-key storage
- a persistent final response snapshot, one row per question
- a controlled scoring RPC that is the sole authority on score and percentage
- a server-side submission action that validates in and validates out
- a real Submit Assessment action with an inline confirmation step
- a Toronto Academy completion screen

FA-04 does **not** add admin authentication, an admin dashboard, invitation
links, email, SMS, GoHighLevel, PDF results, answer explanations, per-question
correctness for the student, additional CEFR levels, or a resume/recovery
system. Those belong to FA-05 and later.

---

## 2. Private answer-key architecture

### The schema

```sql
create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon, authenticated;
```

Supabase exposes only the schemas listed in the PostgREST configuration
(`public` and `graphql_public` by default). A schema named `private` is
therefore unreachable over the REST and GraphQL endpoints no matter what a
client asks for. USAGE is revoked from `public`, `anon` and `authenticated` as
well, so even a future configuration mistake that exposed the schema would still
leave the answer keys unreadable.

### The table

`private.assessment_answer_keys`

| Column | Type | Notes |
| --- | --- | --- |
| `question_id` | `uuid` | primary key, FK -> `public.assessment_questions(id)` on delete cascade |
| `correct_option_key` | `text` | not null, `check (correct_option_key in ('A','B','C','D'))` |
| `created_at` | `timestamptz` | not null, `default now()` |

RLS is enabled with no policies, and `revoke all` is applied to `public`, `anon`
and `authenticated`. That is four independent barriers: the PostgREST schema
list, schema USAGE, table privileges and RLS.

### The keys are stored as option keys, not text

`correct_option_key` holds `A`, `B`, `C` or `D`. Re-wording an option in
`public.assessment_questions.options` therefore never silently changes what is
correct. Scoring never compares visible option text.

### Seeding by stable identity

The twenty keys are joined to questions by assessment slug plus
`question_number`:

```sql
join public.assessment_questions q
  on q.assessment_id = t.assessment_id
 and q.question_number = s.question_number
```

No question UUID is hardcoded anywhere in the migration, so the seed is correct
against any environment that has applied FA-03, whatever UUIDs it generated.

A post-seed assertion block fails the migration if the question count, the key
count or the keyed-question count is not exactly `assessments.total_questions`.
The migration will not commit a partial key.

### Source status

Question 1 is source confirmed. Questions 2 to 20 are the project's current
working key and require instructor review before production. This is recorded in
the migration comments and in full in
[`fa-04-answer-key-review.md`](./fa-04-answer-key-review.md).

### Nothing about the key reaches the browser

The answer key does not appear in `public.get_french_assessment_content`, in the
question JSON, in React props, in the client bundle, in any network response, in
`localStorage`, in `sessionStorage`, or in a URL parameter. There is no answer
key in TypeScript at all: the string `correct_option_key` appears in exactly one
place in the repository outside documentation, which is the SQL migration.

The FA-03 `assessment_questions_options_no_extra_fields` constraint still holds,
so an option object may carry only `key` and `text`. A correctness flag cannot be
smuggled into the content payload even by a future writer.

---

## 3. Schema: public.assessment_answers

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | primary key, `default gen_random_uuid()` |
| `attempt_id` | `uuid` | not null, FK -> `public.assessment_attempts(id)` on delete cascade |
| `question_id` | `uuid` | not null, FK -> `public.assessment_questions(id)` |
| `selected_option_key` | `text` | nullable; null means unanswered |
| `is_correct` | `boolean` | not null, calculated in the database |
| `created_at` | `timestamptz` | not null, `default now()` |

Constraints:

- `unique (attempt_id, question_id)` - one final response per question per
  attempt. This is also what makes a double submission structurally unable to
  create duplicate rows.
- `check (selected_option_key is null or selected_option_key in ('A','B','C','D'))`
- `check (selected_option_key is not null or is_correct = false)` - an
  unanswered question can never be stored as correct, whatever writes it.

Index:

- `assessment_answers_question_id_idx` on `(question_id)`. The unique constraint
  already indexes `(attempt_id, question_id)`, which serves every per-attempt
  read, so no second index on `attempt_id` is created.

### Why all twenty rows

On successful submission the table receives exactly one row for every question
in the assessment, including the ones the student left blank
(`selected_option_key = null`, `is_correct = false`).

That gives the future FA-05 admin panel a complete response snapshot - 20
questions, 20 rows - and makes reporting a simple join rather than an
outer-join-and-fill exercise. It also means "unanswered" is a recorded fact
rather than an absence that has to be inferred.

The row set is driven by `public.assessment_questions`, not by the payload, so
the student cannot shorten or extend the snapshot.

---

## 4. Answer payload format

The browser sends a flat JSON object mapping question UUID to option key:

```json
{
  "1f0c...-...": "B",
  "2a4d...-...": "C"
}
```

Unanswered questions are simply **absent**. The browser is never asked to submit
a null entry, and never submits a score, a percentage, a correctness flag, a
question number or option text. The database builds the complete twenty row
snapshot itself.

---

## 5. Scoring RPC

```sql
public.submit_french_assessment(p_attempt_token uuid, p_answers jsonb)
  returns jsonb
  language plpgsql
  security definer
  set search_path = pg_catalog, public, pg_temp
```

### Validation order

1. `p_attempt_token` is a non-null uuid
2. a matching attempt exists - the row is locked `FOR UPDATE` before anything
   else
3. the linked assessment slug is `french-a1-diagnostic`
4. the linked assessment is active
5. an already submitted attempt returns its stored result unchanged, without
   looking at the payload
6. the attempt status is `in_progress` (a `registered` attempt was never started
   and is not submittable)
7. the payload is a JSON object
8. the payload holds at most 100 entries
9. every supplied key is uuid shaped
10. every supplied value is the JSON string `A`, `B`, `C` or `D`; a number, an
    object or a nested payload is rejected
11. every supplied question belongs to this assessment - unknown ids are
    rejected outright rather than ignored
12. the authoritative question count equals `assessments.total_questions`
13. every question has a protected answer key

Failures 1 to 6 all raise the same generic
`assessment_submission_unavailable`, so a caller cannot tell an unknown token
apart from an attempt that is not submittable. Failures 7 to 11 raise
`invalid_answer_payload` or `unknown_question_id`. Failures 12 and 13 raise
`assessment_scoring_unavailable`.

None of these messages ever reach the student. The server action maps every
outcome to one generic sentence.

### What is never trusted

- question numbering sent from the browser (the payload is keyed by UUID, and
  `question_number` is never read from it)
- a score sent from the browser (there is no such parameter)
- a percentage sent from the browser (there is no such parameter)
- an `is_correct` value sent from the browser (there is no such parameter)
- visible answer text (the comparison uses `correct_option_key` only)

The function signature accepts exactly two values. There is no parameter through
which a client could express a result.

### SECURITY DEFINER safeguards

- explicit `search_path` with `pg_temp` pinned last
- every object reference schema qualified, including `private.` ones, so the
  function does not depend on `private` being on the search path
- no dynamic SQL anywhere
- narrow, single purpose body
- returns only `status`, `score`, `percentage`, `total_questions`,
  `submitted_at` and `level`
- `EXECUTE` revoked from `public`, then granted only to `anon` and
  `authenticated`

---

## 6. Server-side scoring boundary

`src/lib/actions/assessment.ts` gains `submitFrenchAssessment()`:

```ts
export async function submitFrenchAssessment(
  attemptToken: string,
  answers: AssessmentSubmissionAnswers,
): Promise<AssessmentActionResult<AssessmentResultData>>
```

It is a **transport** boundary, not a scoring boundary:

1. validates the attempt token with `attemptTokenSchema` (`z.uuid()`)
2. validates the answer map with `submissionAnswersSchema`
   (`z.record(z.uuid(), z.enum(["A","B","C","D"]))`, at most 50 entries)
3. calls `public.submit_french_assessment`
4. validates the returned payload with `submissionRpcResultSchema`
5. maps it to the camelCase `AssessmentResultData` and returns it

It never calculates a score or a percentage, never decides whether an answer is
correct, never imports or reads an answer key, and never accepts a score,
percentage or correctness flag from the browser. The only client-supplied values
that leave the function are the opaque token and a map of question id to
A/B/C/D.

The Supabase client is the same one FA-02 introduced: the public URL and the
publishable (anon) key. There is no service-role credential anywhere in the
project.

Failures are logged as short, PII-free markers
(`[assessment] submission failed: rpc error code <code>`) and returned to the
browser as one generic sentence.

### Client payload validation summary

| Field | Rule |
| --- | --- |
| `attemptToken` | UUID |
| `answers` | plain object, at most 50 entries (browser), at most 100 (database) |
| answer keys | UUID-shaped strings, must exist in this assessment |
| answer values | exactly one of `A`, `B`, `C`, `D` |

Arbitrary nested JSON is rejected at both layers: Zod rejects a non-enum value,
and the RPC rejects anything whose `jsonb_typeof` is not `string`.

---

## 7. Transaction behaviour

A PL/pgSQL function body runs inside a single transaction. Within one call the
function:

1. validates the attempt (under a row lock)
2. validates the answer payload
3. determines the authoritative question set
4. determines the protected correct answers
5. inserts all twenty response rows
6. counts the score back from the stored rows
7. calculates the percentage
8. updates the attempt to `status = 'submitted'`, `submitted_at = now()`,
   `score`, `percentage`
9. returns the minimal result

Either all of that commits or none of it does. A raised exception at any step
rolls the whole call back, leaving the attempt exactly as it was: still
`in_progress`, still without answers, still without a score. There is no state
in which a partially submitted attempt can be observed.

The score is deliberately read **back from the stored rows** rather than counted
in a variable during the insert:

```sql
select count(*)::integer,
       count(*) filter (where ans.is_correct)::integer
  into v_written, v_score
from public.assessment_answers ans
where ans.attempt_id = v_attempt_id;

if v_written <> v_total_questions then
  raise exception 'assessment_scoring_unavailable' using errcode = 'P0002';
end if;
```

So the returned result always describes what was actually persisted, and a row
count that does not match the authoritative total aborts the submission.

---

## 8. Idempotency

The idempotency check happens before the payload is even looked at:

```sql
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
```

For an attempt that is already submitted the function:

- does not delete existing answers
- does not overwrite answers
- does not rescore using the new payload
- does not change `submitted_at`
- does not change `score`
- does not change `percentage`

It returns the already stored result and nothing else changes. A second payload
carrying twenty different answers is discarded without being read.

Two further layers back this up. The `unique (attempt_id, question_id)`
constraint makes a duplicate answer row impossible, and the insert uses
`on conflict (attempt_id, question_id) do nothing`.

On the client, the Submit control is disabled while a submission is in flight,
and `handleSubmit` returns immediately if `isSubmitting` or `result` is already
set. A double click cannot send a second request, and even if it did the
database would return the same result.

---

## 9. Concurrency protection

The attempt row is locked before any validation runs:

```sql
select a.id, a.assessment_id, a.status, a.submitted_at, a.score, a.percentage
  into v_attempt_id, v_assessment_id, v_status, v_submitted_at, v_score, v_percentage
from public.assessment_attempts a
where a.attempt_token = p_attempt_token
for update;
```

Two simultaneous submissions of the same token behave like this:

| | Transaction A | Transaction B |
| --- | --- | --- |
| 1 | acquires the row lock | blocks on the lock |
| 2 | validates, writes 20 rows, marks submitted | still blocked |
| 3 | commits, releases the lock | |
| 4 | | re-reads the committed row, sees `submitted` |
| 5 | | returns A's stored result, changes nothing |

Under READ COMMITTED, `SELECT ... FOR UPDATE` re-evaluates the row after the
lock is granted, so B sees A's committed `status = 'submitted'` rather than the
stale `in_progress` it started with. The first successful final submission wins,
and the same attempt is never scored twice with conflicting payloads.

---

## 10. Unanswered question behaviour

An unanswered question is simply absent from the payload. The insert is driven
by the question table and uses a left lookup into the payload:

```sql
select v_attempt_id,
       q.id,
       (v_answers ->> (q.id::text)),
       coalesce((v_answers ->> (q.id::text)) = k.correct_option_key, false)
from public.assessment_questions q
join private.assessment_answer_keys k on k.question_id = q.id
where q.assessment_id = v_assessment_id
```

For an absent question id, `v_answers ->> ...` yields SQL NULL, so
`selected_option_key` is stored as `null` and the comparison yields NULL, which
`coalesce(..., false)` turns into `false`.

The result: `selected_option_key = null`, `is_correct = false`. The
`assessment_answers_unanswered_is_incorrect_check` constraint enforces the same
rule independently of the writer.

Students are never forced to answer all twenty questions. Unanswered questions
score as incorrect, and the confirmation panel says so before submission.

---

## 11. Score calculation

```
score = count of assessment_answers rows for the attempt where is_correct = true
```

Correctness is decided in one place only:

```sql
coalesce((v_answers ->> (q.id::text)) = k.correct_option_key, false)
```

`k` is `private.assessment_answer_keys`. The comparison is between two stable
option keys. Possible values: 0 through 20.

---

## 12. Percentage calculation

```sql
v_percentage := round((v_score::numeric * 100) / v_total_questions, 2);
```

The denominator is `assessments.total_questions`, the assessment's authoritative
question count. It is never the number of answers the student happened to
submit, and the function aborts if the seeded question count does not match it.

For a twenty question assessment every possible value is exact:

| Score | Percentage |
| --- | --- |
| 20 | 100 |
| 15 | 75 |
| 12 | 60 |
| 10 | 50 |
| 0 | 0 |

`formatPercentage()` in `src/lib/assessment-result.ts` renders an integer value
without decimals, and keeps up to two decimal places if a future assessment
length ever produced one.

---

## 13. Result payload

The RPC returns, and the server action forwards, exactly:

| Field | Example |
| --- | --- |
| `status` | `"submitted"` |
| `score` | `14` |
| `percentage` | `70` |
| `total_questions` | `20` |
| `submitted_at` | `"2026-09-05T13:04:22.918+00:00"` |
| `level` | `"A1"` |

It does **not** return the answer key, correct answers, individual `is_correct`
values, the student record, the student's name, email, phone or city, the
attempt id, the benchmark, or any private table content.

`submissionRpcResultSchema` re-validates the payload on the server before it is
handed to the client, so a malformed or unexpected response becomes a generic
failure rather than reaching React.

---

## 14. Result screen

`src/components/assessment/player/AssessmentResult.tsx`, rendered inside the
existing `PlayerShell` so the Toronto Academy identity line, the assessment
title and the `CEFR / CECRL Level A1` subtitle are unchanged.

It shows:

- **Assessment Complete**
- a confirmation that the assessment was submitted and recorded
- **Score** `X / 20`
- **Percentage** `Y%`
- **Level assessed** `A1`
- the next-step message: "Thank you for completing your French Language
  Assessment. The Toronto Academy team will review your assessment and use the
  results to help determine the appropriate French learning pathway for you."
- a note that the answers are now final

It deliberately does not show: PASS, FAIL, Passed, Failed, a benchmark
comparison, a large red or green state, the answer key, per-question
correctness, or the student's personal information. The styling is the same calm
academy palette used everywhere else - no celebratory or alarming treatment.

The benchmark (`benchmark_percent = 60`) is stored and can be derived for future
admin use. It is not part of the student-facing message.

### The screen is terminal

`AssessmentPlayer` returns the result screen instead of the player as soon as
`result` is set:

```tsx
if (result) {
  return (
    <PlayerShell ...>
      <div ref={resultRegion} tabIndex={-1}>
        <AssessmentResult result={result} />
      </div>
    </PlayerShell>
  );
}
```

The progress bar, the question screens, the review screen and every navigation
control are gone. There is no route back into editing, and the database would
refuse a rescore in any case.

---

## 15. Review Answers changes

Everything FA-03 built is preserved: the answered/unanswered counters, the list
of all twenty questions with the selected option letter, and the ability to
click any question to go back and change the answer.

What changed:

- the disabled Submit Assessment button is now a real action
- the "submission will be enabled in the next step" note is replaced by a note
  explaining what submitting does
- an inline confirmation panel was added
- a generic retryable error is rendered above the confirmation when a submission
  fails

### Confirmation step

Submit Assessment does not submit. It opens an inline confirmation panel, so a
single stray click while reviewing can never end the assessment. A modal system
was not introduced: an inline panel in the existing card language is simpler and
matches the rest of the flow.

**With unanswered questions** the panel warns explicitly:

> Submit with unanswered questions?
>
> You have 3 unanswered questions. You can return to complete them, or submit
> the assessment as it is. Unanswered questions are recorded as they stand. Once
> you submit, your answers are final and cannot be changed.

Actions: **Review Questions** and **Submit Anyway**.

**With all questions answered:**

> Submit your assessment?
>
> You have answered all 20 questions. Once you submit, your answers are final
> and cannot be changed.

Actions: **Review Questions** and **Submit Assessment**.

**Review Questions** jumps straight to the first question that is still missing
an answer when there is one, since that is the reason the student opened the
warning. When everything is answered it simply closes the panel.

Students are never forced to answer all twenty questions.

---

## 16. Loading and failure behaviour

### Submitting

When submission begins:

- `isSubmitting` becomes true
- the confirmation's submit control is disabled and shows
  `Submitting assessment...` with a spinner and `aria-busy`
- the outer Submit Assessment button, the Back button and every question link
  are disabled
- `handleSubmit` returns immediately if `isSubmitting` or `result` is set, so a
  repeated click cannot start a second request
- the answer state is untouched

On success `isSubmitting` is deliberately not cleared. The result screen
replaces the review screen, so there is no moment where the button flickers back
to enabled.

### Failure

If the submission fails the student stays on Review Answers with every selection
intact, the submit action is restored, and one generic message appears:

> We could not submit your assessment right now. Your answers are still here.
> Please try again.

Answers are never cleared on failure, and the student can retry immediately. No
PostgreSQL error, no Supabase error code, no SQL and no stack trace is ever
shown. The raw error code is logged server-side only, without PII.

---

## 17. RLS and privilege decisions

Nothing in FA-04 weakens an existing FA-02 or FA-03 policy or privilege. The
migration creates no policy on any pre-existing table and revokes nothing that
was previously granted to the application.

| Object | RLS | anon / authenticated |
| --- | --- | --- |
| `private.assessment_answer_keys` | enabled, no policies | no schema USAGE, `revoke all` on the table |
| `public.assessment_answers` | enabled, no policies | `revoke all` on the table |
| `public.submit_french_assessment` | n/a | `EXECUTE` granted (the only entry point) |

The posture is the same deny-by-default one FA-02 and FA-03 established: RLS on,
no policies, and table privileges revoked so RLS is not the only barrier.
Supabase grants broad table privileges to `anon` and `authenticated` by default,
which is why the explicit revokes matter.

There are no anonymous SELECT, INSERT, UPDATE or DELETE policies on
`assessment_answers`. The browser cannot insert into it, read it, or change it.
Student submission happens only through the controlled scoring RPC.

The migration ends with an assertion block that fails the migration if `anon` or
`authenticated` still holds SELECT, INSERT, UPDATE or DELETE on either table, or
USAGE on the `private` schema. The privilege posture is proven before the
migration is allowed to commit.

The attempt token remains the only student session credential used for
submission. There is no student login and no service-role key.

---

## 18. Migration instructions

Claude created the migration file only. No SQL was run against Supabase, no
dashboard was opened, no environment secret was read, and `.env.local` was not
read or modified.

Apply the migration manually:

1. Confirm FA-02 and FA-03 are already applied. FA-04 raises a clear exception
   naming the missing ticket if `public.assessments`,
   `public.assessment_attempts` or `public.assessment_questions` is absent, and
   it never creates replacement FA-02 or FA-03 tables.
2. Open the Supabase dashboard for the project, then **SQL Editor**.
3. Open
   `supabase/migrations/20260905073000_fa_04_submission_scoring_results.sql`,
   copy the whole file, and paste it into a new query.
4. Run it. It is safely re-runnable: tables use `create table if not exists`,
   the seed uses `on conflict ... do update`, and the function uses
   `create or replace`.
5. Confirm it reported success. The seed assertion block and the privilege
   assertion block both raise rather than commit a half-applied state.
6. Run the verification queries in section 19.

If the project uses the Supabase CLI instead, `supabase db push` picks the file
up from `supabase/migrations/` in timestamp order.

---

## 19. Verification SQL

Run these in the Supabase SQL editor, which connects as a privileged role.

**1. The private schema and the answer-key table exist**

```sql
select n.nspname as schema, c.relname as table, c.relrowsecurity as rls_enabled
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where (n.nspname, c.relname) in (
  ('private', 'assessment_answer_keys'),
  ('public', 'assessment_answers')
);
-- expect 2 rows, rls_enabled = true for both
```

**2. Exactly twenty answer keys, all valid option keys**

```sql
select count(*) as key_rows,
       count(*) filter (where k.correct_option_key in ('A','B','C','D')) as valid_keys
from private.assessment_answer_keys k
join public.assessment_questions q on q.id = k.question_id
join public.assessments a on a.id = q.assessment_id
where a.slug = 'french-a1-diagnostic';
-- expect key_rows = 20, valid_keys = 20
```

**3. Every question has a key**

```sql
select q.question_number
from public.assessment_questions q
join public.assessments a on a.id = q.assessment_id
where a.slug = 'french-a1-diagnostic'
  and not exists (
    select 1 from private.assessment_answer_keys k where k.question_id = q.id
  )
order by q.question_number;
-- expect 0 rows
```

**4. The seeded key matches the working key**

```sql
select q.question_number, k.correct_option_key
from private.assessment_answer_keys k
join public.assessment_questions q on q.id = k.question_id
join public.assessments a on a.id = q.assessment_id
where a.slug = 'french-a1-diagnostic'
order by q.question_number;
-- expect: 1 B, 2 C, 3 B, 4 A, 5 B, 6 D, 7 A, 8 B, 9 C, 10 C,
--         11 B, 12 A, 13 C, 14 B, 15 B, 16 C, 17 B, 18 B, 19 B, 20 B
```

**5. anon and authenticated cannot reach the answer keys**

```sql
select r.rolname,
       has_schema_privilege(r.rolname, 'private', 'USAGE') as private_usage,
       has_table_privilege(r.rolname, 'private.assessment_answer_keys', 'SELECT') as key_select,
       has_table_privilege(r.rolname, 'public.assessment_answers', 'SELECT') as answers_select,
       has_table_privilege(r.rolname, 'public.assessment_answers', 'INSERT') as answers_insert,
       has_table_privilege(r.rolname, 'public.assessment_answers', 'UPDATE') as answers_update,
       has_table_privilege(r.rolname, 'public.assessment_answers', 'DELETE') as answers_delete
from pg_catalog.pg_roles r
where r.rolname in ('anon', 'authenticated');
-- expect false in every column, for both roles
```

**6. No policies were created on the new tables**

```sql
select schemaname, tablename, policyname
from pg_catalog.pg_policies
where (schemaname, tablename) in (
  ('private', 'assessment_answer_keys'),
  ('public', 'assessment_answers')
);
-- expect 0 rows
```

**7. Only anon and authenticated may execute the scoring RPC**

```sql
select p.proname,
       p.prosecdef as security_definer,
       p.proconfig,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'submit_french_assessment';
-- expect security_definer = true,
--        proconfig = {search_path=pg_catalog, public, pg_temp},
--        both execute flags true
```

**8. The FA-03 content RPC still returns no correct-answer data**

```sql
select pg_catalog.pg_get_functiondef(p.oid) ilike '%answer_key%'
    or pg_catalog.pg_get_functiondef(p.oid) ilike '%correct_option%' as leaks_key
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'get_french_assessment_content';
-- expect false
```

**9. After one browser submission: exactly twenty stored rows**

Replace the token with the one from the attempt you just submitted.

```sql
select a.status,
       a.submitted_at is not null as has_submitted_at,
       a.score,
       a.percentage,
       count(ans.id) as answer_rows,
       count(ans.id) filter (where ans.selected_option_key is null) as unanswered_rows,
       count(ans.id) filter (where ans.is_correct) as correct_rows
from public.assessment_attempts a
left join public.assessment_answers ans on ans.attempt_id = a.id
where a.attempt_token = '00000000-0000-0000-0000-000000000000'
group by a.status, a.submitted_at, a.score, a.percentage;
-- expect status = 'submitted', has_submitted_at = true,
--        answer_rows = 20, score = correct_rows,
--        percentage = round(score * 100.0 / 20, 2)
```

**10. Unanswered rows are stored as incorrect**

```sql
select count(*) as bad_rows
from public.assessment_answers ans
where ans.selected_option_key is null
  and ans.is_correct;
-- expect 0
```

**11. Repeat submission changes nothing**

Run the RPC twice with the same token and compare. The second call must return
the same score, percentage and `submitted_at`.

```sql
select public.submit_french_assessment(
  '00000000-0000-0000-0000-000000000000'::uuid,
  '{}'::jsonb
);
-- expect the SAME score, percentage and submitted_at as the browser submission,
-- even though the payload here is empty
```

Then confirm nothing moved:

```sql
select count(*) as answer_rows
from public.assessment_answers ans
join public.assessment_attempts a on a.id = ans.attempt_id
where a.attempt_token = '00000000-0000-0000-0000-000000000000';
-- expect 20, not 40
```

**12. An unknown question id is rejected**

```sql
select public.submit_french_assessment(
  '00000000-0000-0000-0000-000000000000'::uuid,
  '{"11111111-1111-1111-1111-111111111111":"A"}'::jsonb
);
-- against an in_progress attempt: expect ERROR unknown_question_id
```

**13. An invalid option value is rejected**

```sql
select public.submit_french_assessment(
  '00000000-0000-0000-0000-000000000000'::uuid,
  '{"<a-real-question-uuid>":"Z"}'::jsonb
);
-- against an in_progress attempt: expect ERROR invalid_answer_payload
```

---

## 20. Browser testing steps

1. `npm run dev`, open the assessment page.
2. Complete the student information form. The attempt is created with status
   `registered`.
3. Click **Begin Assessment**. The attempt moves to `in_progress`.
4. Walk through the three sections and answer some but not all questions - leave
   three blank on purpose.
5. Reach **Review your answers**. Confirm the counters read `17 of 20` answered
   and `3` unanswered, and that the three blank questions are highlighted.
6. Click a question, change the answer, and confirm the review list updates.
7. Click **Submit Assessment**. Confirm nothing is submitted yet and the
   confirmation panel appears saying "You have 3 unanswered questions".
8. Click **Review Questions**. Confirm it jumps to the first unanswered question
   and the panel closes.
9. Return to review, click **Submit Assessment**, then **Submit Anyway**.
10. Confirm the button shows `Submitting assessment...` and is disabled, and
    that a second click does nothing.
11. Confirm the result screen appears: **Assessment Complete**, `Score X / 20`,
    `Percentage Y%`, `Level assessed A1`, and the Toronto Academy next-step
    message.
12. Confirm the result screen shows no PASS, FAIL, Passed or Failed wording, no
    answer key, and no per-question correctness.
13. Confirm there is no way back into the questions from the result screen.
14. Open DevTools, network tab, and inspect the submission request and response.
    The request must contain only the attempt token and question id to A/B/C/D
    pairs. The response must contain only status, score, percentage,
    total_questions, submitted_at and level. Neither carries an answer key.
15. Inspect `localStorage` and `sessionStorage`. Both must be empty of assessment
    data.
16. Run verification query 9 for that attempt and confirm 20 stored rows, three
    of them with `selected_option_key = null` and `is_correct = false`.
17. Answer all twenty questions on a fresh attempt and confirm the confirmation
    panel switches to "You have answered all 20 questions."
18. To exercise the failure path, temporarily stop the network (DevTools offline
    mode) and submit. Confirm the student stays on Review Answers, every
    selection is intact, the generic retry message appears, and submitting again
    once the network is back succeeds.

---

## 21. Known limitations

### Pre-submission refresh

Answer state lives in `AssessmentPlayer` React state until the student submits.
Answers are not written to Supabase question by question, so a hard browser
refresh, a closed tab or a crash **before** submission loses the current
selections and the student restarts the flow.

This is deliberate for FA-04. The ticket scoped out a full resume/recovery
system, and per-question persistence would have needed its own write RPC, its
own RLS story and its own conflict rules.

After a successful submission the database result is authoritative and the
attempt is immutable, so nothing is at risk from that point on.

A future ticket can add per-question autosave and a resume path without changing
the scoring boundary: the RPC would still receive the same answer map, just
assembled from stored rows rather than from memory.

### The attempt token is memory-only

Inherited from FA-02. The token is held in React state, never in a URL,
`localStorage` or a cookie, so a refresh at any stage of the flow restarts it.
Same trade-off, same future ticket.

### Questions 2 to 20 of the answer key are unreviewed

Only Question 1 is source confirmed. Scores produced before the instructor
review in [`fa-04-answer-key-review.md`](./fa-04-answer-key-review.md) is
complete are provisional. Correcting a key after real students have submitted
does not retroactively change their stored results.

### No student-visible answer review

By design. FA-04 shows the score, the percentage and the level, and nothing
about individual questions.

---

## 22. FA-05 hand-off

FA-04 leaves the following ready to build on.

### Data now available

```
public.assessment_attempts
  status = 'submitted'
  submitted_at, score, percentage        -- authoritative, server calculated
    └── public.assessment_answers        -- exactly 20 rows per submitted attempt
          question_id, selected_option_key (null = unanswered), is_correct
```

Joined to FA-02 `students` and FA-03 `assessment_questions`, that is everything
an admin result view needs: who submitted, when, what they scored, what they
chose for each question, and which choices were right.

### The benchmark is available but unused

`assessments.benchmark_percent = 60`. FA-05 can derive
`percentage >= benchmark_percent` for admin reporting. It must stay out of the
student-facing screen.

### What FA-05 should add

- admin authentication (nothing in FA-01 to FA-04 has any auth)
- an admin dashboard listing submitted attempts
- a per-attempt result view using `assessment_answers`
- result search and filtering
- a per-question review UI, which is where `is_correct` finally becomes visible

### Rules FA-05 must not break

- the answer key stays inside `private`. An admin view can join to it, but only
  through a controlled server-side path, never through a browser-reachable
  table or a PostgREST-exposed schema.
- `anon` keeps no direct access to `assessment_answers`. Admin reads need an
  authenticated role and their own deliberate policy, not a relaxation of the
  current revokes.
- a submitted attempt stays immutable. Any rescore must be a new, separately
  reviewed operation, not an edit path bolted onto the submission RPC.
- the student experience keeps no PASS/FAIL messaging.

### Hand-off contract

`public.submit_french_assessment(uuid, jsonb)` is the only write path into
`public.assessment_answers` and the only writer of
`assessment_attempts.score` and `assessment_attempts.percentage`. FA-05 should
read those tables, not write them.
