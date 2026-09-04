# FA-02 - Student and Assessment Attempt Persistence

Toronto Academy of Education - French Language Evaluation and Diagnostic Assessment

Migration file (source of truth):

```
supabase/migrations/20260904181600_fa_02_student_assessment_persistence.sql
```

## 1. Purpose of FA-02

FA-01 delivered the branded landing page, the Student Information form, client
validation, the Instructions step and the Assessment Ready placeholder. All of
it was in-memory only.

FA-02 makes that flow persistent:

1. Student Information is validated again on the server.
2. The student is created or refreshed in the database.
3. A new French A1 assessment attempt is created with status `registered`.
4. Only an opaque attempt token is returned to the browser.
5. Begin Assessment moves that attempt to `in_progress` and stamps `started_at`.

FA-02 does not create question, answer, answer key, scoring, result, admin or
authentication objects. The FA-01 visual design is unchanged apart from the
loading, disabled and error states the new persistence requires.

## 2. Table: public.students

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | primary key, `default gen_random_uuid()` |
| `full_name` | `text` | not null, not blank, max 120 |
| `email` | `text` | not null, not blank, max 254 |
| `email_normalized` | `text` | `generated always as (lower(btrim(email))) stored` |
| `phone` | `text` | not null, not blank, max 40 |
| `city` | `text` | nullable, max 120 |
| `status_in_canada` | `text` | nullable, max 60 |
| `current_french_level` | `text` | nullable, max 60 |
| `french_learning_goal` | `text` | nullable, max 60 |
| `source` | `text` | not null, `default 'french-assessment-web'` |
| `created_at` | `timestamptz` | not null, `default now()` |
| `updated_at` | `timestamptz` | not null, `default now()`, maintained by trigger |

Indexes:

- `students_email_normalized_key` - unique index on `email_normalized`
- `students_created_at_idx` - `created_at desc`

Phone is deliberately not a unique identifier.

## 3. Table: public.assessments

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | primary key, `default gen_random_uuid()` |
| `slug` | `text` | not null, unique |
| `title` | `text` | not null |
| `title_fr` | `text` | nullable |
| `framework` | `text` | not null |
| `level` | `text` | not null |
| `total_questions` | `integer` | not null, check `> 0` |
| `benchmark_percent` | `integer` | not null, check `between 0 and 100` |
| `is_active` | `boolean` | not null, `default true` |
| `created_at` | `timestamptz` | not null, `default now()` |
| `updated_at` | `timestamptz` | not null, `default now()`, maintained by trigger |

Index: `assessments_is_active_idx` on `is_active`.

## 4. Table: public.assessment_attempts

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | primary key, `default gen_random_uuid()` |
| `attempt_token` | `uuid` | not null, unique, `default gen_random_uuid()` |
| `student_id` | `uuid` | not null, FK to `public.students(id)` on delete cascade |
| `assessment_id` | `uuid` | not null, FK to `public.assessments(id)` on delete restrict |
| `status` | `text` | not null, check in `registered`, `in_progress`, `submitted` |
| `started_at` | `timestamptz` | nullable |
| `submitted_at` | `timestamptz` | nullable, untouched by FA-02 |
| `score` | `integer` | nullable, untouched by FA-02 |
| `percentage` | `numeric` | nullable, untouched by FA-02 |
| `created_at` | `timestamptz` | not null, `default now()` |
| `updated_at` | `timestamptz` | not null, `default now()`, maintained by trigger |

Indexes on `student_id`, `assessment_id` and `status`.

`submitted` is allowed by the check constraint so that a later ticket does not
need a schema change, but FA-02 never writes it.

## 5. Normalized email duplicate strategy

`email_normalized` is a stored generated column, `lower(btrim(email))`, so
leading and trailing whitespace and letter case can never produce a second
student record. A unique index on that column enforces one student per
normalized email at the database level, which also makes concurrent
registrations safe rather than relying on a read-then-write race.

`public.start_french_assessment` writes the student with a single statement:

```sql
insert into public.students as s (...) values (...)
on conflict (email_normalized) do update
  set full_name = excluded.full_name,
      email = excluded.email,
      phone = excluded.phone,
      city = coalesce(excluded.city, s.city),
      status_in_canada = coalesce(excluded.status_in_canada, s.status_in_canada),
      current_french_level = coalesce(excluded.current_french_level, s.current_french_level),
      french_learning_goal = coalesce(excluded.french_learning_goal, s.french_learning_goal)
returning s.id into v_student_id;
```

Behaviour:

- Required fields (`full_name`, `email`, `phone`) are always refreshed from the
  latest submission.
- Optional fields are only overwritten when the new submission carries a
  meaningful, non-empty value. The RPC converts blank optional answers to
  `null` first, so `coalesce(excluded.x, s.x)` keeps useful existing data
  instead of erasing it.
- `source` and `created_at` are set once on first insert and are not rewritten.
- `updated_at` is refreshed by the shared trigger.

## 6. One student, many attempts

The relationship is deliberately:

```
public.students (1) ------< (many) public.assessment_attempts
```

A returning student who submits Student Information again matches the existing
row by normalized email and gets a brand new attempt. The application never
produces one duplicate student per sitting.

## 7. Attempt lifecycle

| Event | status | started_at | submitted_at / score / percentage |
| --- | --- | --- | --- |
| Registration succeeds | `registered` | `null` | `null` |
| Begin Assessment succeeds | `in_progress` | set to `now()` if it was `null` | untouched |
| Begin Assessment repeated | stays `in_progress` | keeps the original value | untouched |
| Submission (FA-04 or later) | `submitted` | unchanged | out of scope for FA-02 |

`public.begin_french_assessment` is a single guarded `UPDATE`:

- it matches on `attempt_token`
- it only accepts an attempt whose status is `registered` or `in_progress`
- it requires the linked assessment to be `french-a1-diagnostic` and active
- it sets `started_at = coalesce(started_at, now())`, so a repeated call never
  moves the timestamp forward
- it never inserts, so a repeated call cannot create a second attempt
- it never touches `submitted_at`, `score` or `percentage`

If no row matches, the function raises and the server action maps that to the
generic retryable message.

## 8. attempt_token

`attempt_token` is the only assessment identifier the browser ever holds.

- opaque random UUID, not sequential, not guessable in practice
- carries no PII
- separate from `assessment_attempts.id`, so the internal primary key is never
  exposed
- the browser never receives `student_id` or `assessment_id`
- it is kept in React flow state only, never written to the URL, the query
  string, or `localStorage`

## 9. RLS strategy

RLS is enabled on all three tables:

```sql
alter table public.students enable row level security;
alter table public.assessments enable row level security;
alter table public.assessment_attempts enable row level security;
```

No policies are created. That is deliberate: with RLS on and zero policies, the
`anon` and `authenticated` roles can select, insert, update and delete exactly
nothing. Students are not anonymously listable, and neither are attempts.

All public access happens through the two `SECURITY DEFINER` RPCs, which run as
the owning role and therefore expose only the narrow statements written inside
them.

`FORCE ROW LEVEL SECURITY` is intentionally not used, because the RPCs must be
able to perform their own controlled writes as the table owner.

## 10. Privileges

RLS is not treated as the only boundary. Supabase grants broad table privileges
to `anon` and `authenticated` by default, so the migration revokes them:

```sql
revoke all on table public.students from public;
revoke all on table public.assessments from public;
revoke all on table public.assessment_attempts from public;

revoke all on table public.students from anon, authenticated;
revoke all on table public.assessments from anon, authenticated;
revoke all on table public.assessment_attempts from anon, authenticated;
```

Function privileges are set explicitly. PostgreSQL grants `EXECUTE` to `PUBLIC`
by default, so each function is revoked first and then granted only where it is
needed:

```sql
revoke all on function public.start_french_assessment(text, text, text, text, text, text, text) from public;
grant execute on function public.start_french_assessment(text, text, text, text, text, text, text) to anon, authenticated;

revoke all on function public.begin_french_assessment(uuid) from public;
grant execute on function public.begin_french_assessment(uuid) to anon, authenticated;

revoke all on function public.set_updated_at() from public;
revoke all on function public.set_updated_at() from anon, authenticated;
```

Result: no public DELETE, no public arbitrary UPDATE, no public student list,
and exactly two callable public entry points.

## 11. RPC strategy

### public.start_french_assessment

```sql
start_french_assessment(
  p_full_name text,
  p_email text,
  p_phone text,
  p_city text default null,
  p_status_in_canada text default null,
  p_current_french_level text default null,
  p_french_learning_goal text default null
) returns jsonb
```

Steps: reject blank required input, reject oversized input, apply a minimal
email shape guard, resolve the active `french-a1-diagnostic` assessment (fail
safely if it is missing or inactive), upsert the student by normalized email,
insert one new `registered` attempt.

Returns only:

```json
{ "attempt_token": "...", "status": "registered" }
```

It never returns `student_id`, `assessment_id`, a student row, a name, an email,
a phone number, or any other student's data.

### public.begin_french_assessment

```sql
begin_french_assessment(p_attempt_token uuid) returns jsonb
```

Returns only:

```json
{ "attempt_token": "...", "status": "in_progress", "started_at": "..." }
```

### SECURITY DEFINER safeguards

Both RPCs are `SECURITY DEFINER` because anonymous students must perform a
tightly controlled write while the tables stay locked. The safeguards applied:

- `set search_path = pg_catalog, public, pg_temp` is declared on each function,
  with `pg_temp` pinned last so a temporary object cannot shadow a real one
- every table reference is schema qualified (`public.students`, and so on)
- no dynamic SQL anywhere, so no injection surface
- each function is narrow and single purpose, with no general table access
- return payloads are minimal and PII free
- `EXECUTE` is revoked from `PUBLIC` and granted only to `anon` and
  `authenticated`
- the shared `set_updated_at()` trigger function is `SECURITY INVOKER`, not
  definer, and is not executable by public roles

No service-role key is used or required.

## 12. updated_at handling

One shared trigger function, `public.set_updated_at()`, is attached with a
`before update ... for each row` trigger to all three tables.

## 13. Server-side validation

`src/lib/student-information.ts` holds the single Zod schema used by both the
browser form and the server action, so the rules cannot drift apart. FA-02 added
shared maximum lengths (`STUDENT_FIELD_LIMITS`) that also match the database
check constraints.

Validation happens in three layers:

1. Browser - `validateStudentInformation()` for inline field messages.
2. Server - `studentInformationSchema.safeParse()` inside the server action.
   Server Actions are reachable by direct POST, so this layer never assumes the
   browser ran first.
3. Database - the RPC re-trims, re-checks blank and oversized input, and the
   table check constraints back it up.

The RPC responses are themselves parsed with Zod
(`src/lib/assessment-session.ts`) before being handed to the UI.

## 14. Application flow integration

| File | Role |
| --- | --- |
| `src/lib/supabase/server.ts` | the only place a Supabase client is constructed; URL plus publishable/anon key, no service role, no session persistence |
| `src/lib/assessment-session.ts` | shared session types, RPC response parsers, the single generic error string |
| `src/lib/actions/assessment.ts` | `"use server"` boundary: `registerFrenchAssessmentStudent()` and `beginFrenchAssessment()` |
| `src/components/assessment/StudentInformationForm.tsx` | submitting state, double-submit guard, retryable error, advances only after persistence |
| `src/components/assessment/AssessmentInstructions.tsx` | Begin Assessment loading state, repeat-click guard, retryable error |
| `src/components/assessment/AssessmentFlow.tsx` | holds the attempt token in flow state |
| `src/components/ui/InlineAlert.tsx` | shared generic error presentation |

Flow after FA-02:

```
Landing page
  -> Student Information
  -> client validation
  -> server validation
  -> student created or refreshed
  -> registered attempt created
  -> Instructions
  -> Begin Assessment
  -> attempt becomes in_progress
  -> Assessment Ready placeholder
```

Continue never advances before the database write succeeds. On failure the
student stays on Student Information with every entered value preserved, the
button restored, and one generic retryable message.

## 15. Security and privacy decisions

- Students and attempts are not readable by anonymous callers, by policy and by
  privilege.
- Public RPCs return no PII and no internal identifiers other than the opaque
  attempt token.
- No PII appears in URLs, query parameters or browser storage.
- Server logs record a short operation marker and a PostgreSQL error code only.
  Full student submissions are never logged.
- The browser only ever sees the fixed message
  "We could not start your assessment right now. Please try again."
  (or a "check your details" variant when server validation rejects input).
  Raw Supabase error objects, SQL, stack traces and environment values are never
  forwarded.
- No service-role key is present, referenced, or required.

## 16. A1 assessment seed

Seeded by the migration, idempotently, keyed on the unique `slug`:

| Field | Value |
| --- | --- |
| `slug` | `french-a1-diagnostic` |
| `title` | French Language Evaluation and Diagnostic Assessment |
| `title_fr` | Evaluation Diagnostique de Francais |
| `framework` | CEFR / CECRL |
| `level` | A1 |
| `total_questions` | 20 |
| `benchmark_percent` | 60 |
| `is_active` | true |

Re-running the migration refreshes the existing row through
`on conflict (slug) do update` rather than inserting a duplicate.

No assessment questions are seeded in FA-02.

## 17. Manual Supabase migration steps

1. Open the Supabase dashboard for the project and go to **SQL Editor**.
2. Open a new query.
3. Copy the entire contents of
   `supabase/migrations/20260904181600_fa_02_student_assessment_persistence.sql`
   and paste it in.
4. Run it. The script is safely re-runnable.
5. Confirm the migration succeeded with the verification queries below.
6. In **Table Editor**, confirm `students`, `assessments` and
   `assessment_attempts` all show RLS as enabled.

The migration assumes the Supabase roles `anon` and `authenticated` exist, which
is true for every Supabase project. On a plain PostgreSQL server those roles
would need to be created first.

## 18. Verification SQL

Tables, RLS and privileges:

```sql
-- RLS must be enabled on all three tables.
select relname, relrowsecurity
from pg_class
where relnamespace = 'public'::regnamespace
  and relname in ('students', 'assessments', 'assessment_attempts');

-- Should return zero rows: no anon or authenticated table privileges.
select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('students', 'assessments', 'assessment_attempts')
  and grantee in ('anon', 'authenticated');

-- Should return zero rows: deny by default, no policies.
select schemaname, tablename, policyname
from pg_policies
where schemaname = 'public'
  and tablename in ('students', 'assessments', 'assessment_attempts');
```

Seed:

```sql
select slug, title, title_fr, framework, level,
       total_questions, benchmark_percent, is_active
from public.assessments
where slug = 'french-a1-diagnostic';
-- expect exactly 1 row, total_questions 20, benchmark_percent 60, is_active true
```

Registration and begin, end to end:

```sql
-- 1. register
select public.start_french_assessment(
  'Test Student',
  '  Test.Student@Example.COM  ',
  '+1 416 555 0199',
  'Toronto',
  'Study Permit',
  'Complete beginner',
  'Immigration / PR'
);
-- returns {"status": "registered", "attempt_token": "<token>"}

-- 2. begin (paste the token from step 1)
select public.begin_french_assessment('<token>'::uuid);
-- returns status in_progress with a started_at timestamp

-- 3. begin again with the same token: idempotent
select public.begin_french_assessment('<token>'::uuid);
-- same started_at, still in_progress
```

Duplicate protection and the one-to-many relationship:

```sql
-- Register the same email again with different casing and spacing.
select public.start_french_assessment(
  'Test Student Updated',
  'test.student@example.com',
  '+1 416 555 0100'
);

-- Exactly one student, two attempts.
select s.email_normalized,
       count(a.id) as attempts
from public.students s
join public.assessment_attempts a on a.student_id = s.id
where s.email_normalized = 'test.student@example.com'
group by s.email_normalized;
-- expect 1 row, attempts = 2

-- Optional fields survived the second submission that omitted them.
select city, status_in_canada, current_french_level, french_learning_goal
from public.students
where email_normalized = 'test.student@example.com';
-- expect Toronto / Study Permit / Complete beginner / Immigration / PR
```

Clean up the test data when finished:

```sql
delete from public.students
where email_normalized = 'test.student@example.com';
-- attempts cascade
```

## 19. Known limitations

1. **No refresh recovery.** The attempt token lives in React flow state only. A
   hard browser refresh loses it and the student restarts at Student
   Information. This is intentional for FA-02 and is not solved with PII in the
   URL. A later ticket can add a signed, HTTP-only cookie.
2. **Repeated registration creates repeated attempts.** Going Back from
   Instructions and pressing Continue again creates another `registered`
   attempt, by design. Housekeeping for abandoned `registered` attempts belongs
   to a later ticket.
3. **No rate limiting.** The registration RPC is anonymous and callable by
   anyone who has the publishable key. Nothing is exposed by doing so, but a
   later ticket should add abuse protection such as a CAPTCHA or per-IP limits.
4. **No email verification.** An email address is accepted on shape alone. A
   student who mistypes an existing student's email would update that record's
   contact fields.
5. **No admin visibility.** There is no way to read students or attempts from
   the application. Use the Supabase dashboard until the admin ticket lands.
6. **RPC failures are indistinguishable in the UI.** A configuration problem, a
   network problem and an inactive assessment all produce the same generic
   message. That is deliberate; the PostgreSQL error code is recorded in the
   server log.
7. **Assessments are not readable by the client.** Assessment facts shown in the
   UI still come from the `src/lib/assessment.ts` constants, not the database.
   FA-03 can add a narrow read path if the question engine needs it.

## 20. What FA-03 will add

- `assessment_sections`, `assessment_passages`, `assessment_questions` and
  answer option tables
- the A1 question seed (20 questions across Grammar, Vocabulary and Reading)
- question navigation in place of the Assessment Ready placeholder
- `assessment_answers`, keyed by attempt
- a controlled RPC to load questions for a valid `in_progress` attempt token,
  without leaking answer keys to the browser

Scoring, `submitted` status, `submitted_at`, `score`, `percentage`, benchmark
evaluation, the result page, admin and authentication all remain out of scope
until their own tickets.
