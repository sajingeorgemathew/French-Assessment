# FA-02 - Supabase Student Persistence and Assessment Attempts

## Goal

Connect the existing Toronto Academy of Education French Assessment student intake flow to Supabase.

FA-01 created:

- Toronto Academy branded landing page
- student information form
- validation
- assessment instructions step
- assessment-ready placeholder

FA-02 makes that flow persistent.

When a student successfully submits Student Information:

1. validate the data on the server
2. create or update the student safely
3. create a new French A1 assessment attempt
4. return only an opaque attempt token to the active browser flow
5. continue to the existing Instructions step

When the student clicks Begin Assessment:

1. validate the attempt token
2. mark the attempt as in_progress
3. set started_at if it is not already set
4. continue to the existing assessment-ready placeholder

Do not implement assessment questions.

Do not implement answers.

Do not implement scoring.

Do not implement results.

Do not implement admin.

## Product context

This application belongs to Toronto Academy of Education.

It is intended for new or prospective students completing a French diagnostic assessment.

The first assessment is:

French Language Evaluation and Diagnostic Assessment

French title:

Evaluation Diagnostique de Francais

Framework:

CEFR / CECRL

Level:

A1

Total questions:

20

Diagnostic benchmark:

60 percent

Assessment areas:

- Grammar
- Vocabulary
- Reading comprehension

FA-02 creates the persistent student and attempt foundation required before the actual A1 question engine is built.

## Main student flow

After FA-02:

Landing Page
-> Student Information
-> server-side validation
-> student created or updated
-> registered assessment attempt created
-> Instructions
-> Begin Assessment
-> attempt becomes in_progress
-> Assessment Ready placeholder

The existing FA-01 visual flow should remain substantially unchanged.

## Database tables

Create exactly these new application tables in this ticket:

1. public.students
2. public.assessments
3. public.assessment_attempts

Do not create:

- assessment_sections
- assessment_questions
- assessment_passages
- assessment_answers
- answer keys
- admin profile tables

Those belong to later tickets.

## Table: students

Create:

public.students

Fields:

id
uuid
primary key
default gen_random_uuid()

full_name
text
not null

email
text
not null

email_normalized
text
generated always as a normalized lower-case version of email and stored

phone
text
not null

city
text
nullable

status_in_canada
text
nullable

current_french_level
text
nullable

french_learning_goal
text
nullable

source
text
not null
default 'french-assessment-web'

created_at
timestamptz
not null
default now()

updated_at
timestamptz
not null
default now()

Create a unique constraint or unique index on:

email_normalized

Normalization should account for leading/trailing spaces and email case.

Do not use phone as the unique identifier.

## Student duplicate strategy

Students may take the assessment more than once.

The same normalized email should not create unnecessary duplicate student records.

On successful student registration:

- trim input
- normalize email
- insert the student if no student with that normalized email exists
- if the normalized email already exists, update reasonable current student information
- always create a new assessment attempt

For an existing student:

Update:

- full_name
- email
- phone

For optional profile fields:

- update when the new submission contains a meaningful non-empty value
- do not unnecessarily erase useful existing values because an optional field was submitted blank

The intended relationship is:

one student
-> many assessment attempts

not:

one duplicate student
-> one attempt each time

Handle concurrency safely through database constraints/upsert behavior.

## Table: assessments

Create:

public.assessments

Fields:

id
uuid
primary key
default gen_random_uuid()

slug
text
not null
unique

title
text
not null

title_fr
text
nullable

framework
text
not null

level
text
not null

total_questions
integer
not null

benchmark_percent
integer
not null

is_active
boolean
not null
default true

created_at
timestamptz
not null
default now()

updated_at
timestamptz
not null
default now()

Add checks:

total_questions > 0

benchmark_percent >= 0 and benchmark_percent <= 100

## Seed French A1 assessment

Seed exactly one initial assessment.

slug:
french-a1-diagnostic

title:
French Language Evaluation and Diagnostic Assessment

title_fr:
Evaluation Diagnostique de Francais

framework:
CEFR / CECRL

level:
A1

total_questions:
20

benchmark_percent:
60

is_active:
true

Use an idempotent insert/upsert strategy.

Running safe seed logic again must not create a duplicate assessment row.

Do not seed assessment questions in FA-02.

## Table: assessment_attempts

Create:

public.assessment_attempts

Fields:

id
uuid
primary key
default gen_random_uuid()

attempt_token
uuid
not null
default gen_random_uuid()
unique

student_id
uuid
not null
foreign key to public.students(id)

assessment_id
uuid
not null
foreign key to public.assessments(id)

status
text
not null

started_at
timestamptz
nullable

submitted_at
timestamptz
nullable

score
integer
nullable

percentage
numeric
nullable

created_at
timestamptz
not null
default now()

updated_at
timestamptz
not null
default now()

Allowed status values for the current architecture:

registered
in_progress
submitted

FA-02 should use only:

registered
in_progress

Do not set:

submitted

Do not populate:

submitted_at
score
percentage

## Attempt lifecycle

When Student Information is successfully registered:

create a new assessment attempt for:

french-a1-diagnostic

with:

status = registered
started_at = null
submitted_at = null
score = null
percentage = null

When Begin Assessment succeeds:

status = in_progress

started_at = current timestamp if started_at was previously null

The operation must be safe if Begin Assessment is triggered more than once.

A second Begin Assessment request must not create a second attempt.

It must not reset started_at to a newer timestamp when the attempt is already in_progress.

## Attempt token

Use:

attempt_token

as the browser-facing assessment session identifier.

Requirements:

- opaque UUID
- unique
- no PII
- not sequential
- browser does not need internal student_id
- browser does not need internal assessment_id

Do not put:

student name
email
phone
city

into URLs or query parameters.

## Security model

The public French Assessment form is used by students who are not logged in.

Do not solve this by making application tables publicly readable or writable.

Enable RLS on:

public.students
public.assessments
public.assessment_attempts

Do not create anonymous broad SELECT access to students.

Do not create anonymous broad SELECT access to assessment_attempts.

Do not create anonymous unrestricted INSERT or UPDATE table policies.

Do not create anonymous DELETE access.

Use controlled PostgreSQL RPC functions for the two required public operations.

## RPC 1 - Register assessment

Create a controlled PostgreSQL function similar to:

public.start_french_assessment(...)

Suggested input parameters:

p_full_name text
p_email text
p_phone text
p_city text
p_status_in_canada text
p_current_french_level text
p_french_learning_goal text

The exact signature may use sensible defaults for optional parameters.

The function must:

1. validate required input is not blank
2. trim string input
3. normalize email
4. reject clearly invalid oversized input
5. find the active assessment with slug french-a1-diagnostic
6. create or update the student using normalized email
7. create one new registered assessment attempt
8. return only minimal data required by the application

Recommended return:

attempt_token
status

Do not return:

student row
email
phone
student_id
assessment_id
other students
internal administrative data

If no active french-a1-diagnostic assessment exists, fail safely.

## RPC 2 - Begin assessment

Create a controlled PostgreSQL function similar to:

public.begin_french_assessment(p_attempt_token uuid)

The function must:

1. find the attempt using attempt_token
2. confirm the associated assessment is french-a1-diagnostic
3. confirm the assessment is active
4. accept an attempt currently registered
5. safely accept an attempt already in_progress
6. change registered to in_progress
7. set started_at only when it is currently null
8. not create another attempt
9. not mark submitted
10. not alter score or percentage
11. return only minimal assessment-session information

Recommended return:

attempt_token
status
started_at

Do not return student PII.

## SECURITY DEFINER requirements

A SECURITY DEFINER function may be used because anonymous students must perform a tightly controlled operation while the underlying tables remain protected.

If SECURITY DEFINER is used:

- explicitly set search_path
- include pg_temp appropriately
- qualify table references where useful
- avoid dynamic SQL
- keep the function narrow
- return minimal data
- revoke default overly broad function execution where appropriate
- grant execution only to roles that need it
- do not expose arbitrary table operations

Do not use a service-role key in the browser.

Do not require a service-role key for this ticket.

## Database privileges

Review table and function grants deliberately.

RLS alone should not be treated as the only security boundary.

For anon/authenticated roles:

Do not grant unrestricted access to:

students
assessment_attempts

The public app should perform registration and begin operations through the controlled functions.

Grant execute on only the public RPC functions required for this flow.

No public DELETE access.

No public arbitrary UPDATE access.

No public student-list access.

## updated_at

Implement a reusable updated_at trigger/function if appropriate.

It may update:

students.updated_at
assessments.updated_at
assessment_attempts.updated_at

Keep this implementation simple.

## Migration

Create one version-controlled Supabase SQL migration.

Directory:

supabase/migrations/

Suggested filename:

20260904181600_fa_02_student_assessment_persistence.sql

If a timestamp collision already exists, use a later timestamp.

The migration is the source of truth.

It should include:

- required extension assumptions/setup where appropriate
- students table
- assessments table
- assessment_attempts table
- indexes
- constraints
- updated_at handling
- RLS enablement
- grants/revokes
- start_french_assessment RPC
- begin_french_assessment RPC
- A1 assessment seed

Do not create database objects only in the Supabase dashboard without preserving them in the migration.

## Environment variables

The local project already contains Supabase environment configuration.

Expected public environment naming for this application is:

NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

If the project uses the legacy anon-key naming instead, use the already-established project convention without printing the key value.

Do not read .env.local contents.

Do not print environment values.

Do not modify .env.local.

Do not commit .env.local.

Do not introduce a service-role environment variable for FA-02.

If the exact environment variable naming cannot be determined from existing safe source/configuration, report the required manual naming adjustment instead of reading secrets.

## Application Supabase foundation

Use the already installed Supabase packages.

Create a minimal reusable Supabase server-side utility needed for this ticket.

Do not overbuild authentication infrastructure yet.

The public server-side operations should use:

- Supabase URL
- publishable/anon credential
- controlled RPC functions
- no service role

Do not scatter Supabase client construction throughout unrelated components.

## Shared validation

FA-01 already contains student validation logic.

Refactor or centralize the Zod student-information schema where reasonable so server-side validation uses the same core rules.

Server validation is mandatory.

Never trust only browser validation.

Validate at minimum:

full_name:
- required
- trimmed
- reasonable maximum length

email:
- required
- trimmed
- valid email syntax
- reasonable maximum length

phone:
- required
- trimmed
- reasonable maximum length

city:
- optional
- trimmed
- reasonable maximum length

status_in_canada:
- optional
- accepted values should correspond to the existing FA-01 options

current_french_level:
- optional
- accepted values should correspond to the existing FA-01 options

french_learning_goal:
- optional
- accepted values should correspond to the existing FA-01 options

Do not accept extremely large arbitrary payloads.

## Server-side registration action

Create a Next.js server-side boundary for registration.

Suggested responsibility/name:

registerFrenchAssessmentStudent()

The exact name may differ for a good architectural reason.

It must:

1. receive only required form data
2. validate using Zod on the server
3. create a server-side Supabase client
4. call start_french_assessment
5. receive the opaque attempt token
6. map failures to a safe typed error
7. return minimal success data

Do not return raw Supabase errors to the client.

Do not log full student submissions.

## Student Information UI integration

Update the existing FA-01 Student Information form.

On Continue:

1. perform existing client validation
2. enter a loading/submitting state
3. disable Continue while submission is active
4. call the server registration operation
5. wait for success
6. retain the returned opaque attempt token
7. move to Instructions

Do not move to Instructions before successful registration.

Prevent accidental double submission.

If registration fails:

- stay on Student Information
- preserve the student's entered values
- stop the loading state
- display a generic retryable message
- allow the student to try again
- never display raw SQL/Supabase errors

Suggested user-facing message:

"We could not start your assessment right now. Please try again."

Exact wording may be polished to fit the existing design.

## Instructions state

The existing Instructions screen should remain visually consistent with FA-01.

When Instructions is visible:

the database must already contain:

- the student
- a registered assessment attempt

Keep the attempt token in the active assessment flow state.

Do not expose it unnecessarily in visible UI.

## Begin Assessment server operation

Create a second server-side operation.

Suggested responsibility/name:

beginFrenchAssessment()

It must:

1. receive attempt_token only
2. validate that it is a UUID
3. create the server-side Supabase client
4. call begin_french_assessment
5. return minimal success/error information

Do not pass student PII.

Do not expose raw database errors.

## Begin Assessment UI integration

When the student clicks Begin Assessment:

1. enter a loading state
2. disable Begin Assessment while processing
3. call the server begin operation
4. wait for successful database transition
5. only then move to the existing Assessment Ready placeholder

If the operation fails:

- remain on Instructions
- restore button state
- show a generic retryable error
- allow retry

Do not create another attempt.

## Attempt session state

For FA-02, keep the opaque attempt token in the active assessment flow.

Do not overengineer full session recovery yet.

An in-memory/client-flow token is acceptable for this ticket if that fits the existing FA-01 architecture.

If a hard browser refresh loses unsaved flow state, document that as a known limitation for a later ticket.

Do not solve refresh recovery using PII in URLs.

Do not put email, name, phone, or student_id into local URLs.

## Privacy

Student information is PII.

Requirements:

- do not log full student form data
- do not expose PII in URLs
- do not expose PII in query parameters
- do not expose PII through anonymous table reads
- do not return student rows from public RPCs
- do not expose other students' assessment attempts
- do not expose raw database messages in the UI

## Error handling

Database errors may be logged server-side only if necessary for development, but do not log PII or credentials.

Prefer a minimal safe diagnostic message.

Client-visible errors must remain generic.

Do not expose:

- SQL statements
- table names unnecessarily
- internal UUIDs unnecessarily
- Supabase error objects
- stack traces
- environment values

## UI changes

Do not redesign FA-01.

Only add UI required for:

- submitting state
- Begin Assessment state
- safe error messaging
- retry behavior

Keep:

- Toronto Academy branding
- current student intake layout
- current Instructions layout
- current Assessment Ready placeholder

## Admin

Do not build an admin panel.

Do not build admin authentication.

Do not add admin read policies.

Do not add student search UI.

Admin belongs to a later ticket.

## Assessment questions

Do not create:

- assessment_sections
- assessment_passages
- assessment_questions
- question navigation
- answer options
- answer keys
- answers

Those belong to FA-03.

## Scoring and results

Do not implement:

- correct answers
- correctness evaluation
- submitted state
- submitted_at changes
- score calculation
- percentage calculation
- benchmark evaluation
- pass/fail
- student result page

Those belong to later tickets.

## Manual Supabase steps

Claude must create the SQL migration only.

Claude must not:

- access the user's Supabase dashboard
- connect to the remote Supabase project manually
- run SQL remotely
- read credentials
- use service-role credentials

The user will manually apply the migration through Supabase SQL Editor after Claude finishes.

## Documentation

Create:

docs/database/fa-02-student-assessment-persistence.md

Document:

1. purpose of FA-02
2. students table
3. assessments table
4. assessment_attempts table
5. normalized email duplicate strategy
6. one-student-many-attempts relationship
7. attempt lifecycle
8. attempt_token purpose
9. RLS strategy
10. RPC strategy
11. server-side validation
12. application flow integration
13. security/privacy decisions
14. A1 assessment seed
15. manual Supabase migration steps
16. verification SQL
17. known limitations
18. what FA-03 will add

Do not include secrets.

## Files likely affected

Likely files include:

- supabase/migrations/*
- src/app/assessment/*
- src/components/assessment/*
- src/lib/student-information.ts
- src/lib/supabase/*
- src/lib/actions/*
- docs/database/fa-02-student-assessment-persistence.md

Claude may choose a slightly different reasonable folder structure.

Do not rewrite unrelated pages.

Do not modify branding without a functional reason.

## Security

- do not read .env.local
- do not print secrets
- do not modify .env.local
- do not commit environment files
- do not expose service role
- do not use service-role key
- do not expose student table publicly
- do not expose assessment_attempts publicly
- do not put PII in URLs
- do not return PII from public RPC functions
- do not expose raw Supabase errors
- do not add authentication yet

## Style rule

Use normal hyphens only.

Do not use em dashes.

Do not use long hyphens.

Use straight quotes where practical.

## Validation

Run:

npm run lint
npx tsc --noEmit
npm run build
git diff --check

Fix implementation errors caused by FA-02.

## Done criteria

FA-02 is complete when:

- version-controlled Supabase migration exists
- students table exists in the migration
- assessments table exists in the migration
- assessment_attempts table exists in the migration
- students use UUID primary keys
- assessment attempts use opaque UUID attempt tokens
- normalized email uniqueness is enforced
- same normalized email does not create unnecessary duplicate students
- each successful new registration creates a new assessment attempt
- active French A1 assessment is seeded
- A1 total_questions is 20
- A1 benchmark_percent is 60
- A1 assessment slug is french-a1-diagnostic
- attempt status supports registered and in_progress
- successful registration creates registered attempt
- Begin Assessment changes registered to in_progress
- Begin Assessment sets started_at
- repeated Begin Assessment does not reset started_at
- repeated Begin Assessment does not create another attempt
- RLS is enabled on students
- RLS is enabled on assessments
- RLS is enabled on assessment_attempts
- students are not anonymously listable
- assessment attempts are not anonymously listable
- controlled registration RPC exists
- controlled Begin Assessment RPC exists
- public RPC responses contain no student PII
- student information is validated server-side
- Student Information form persists before Instructions
- form has loading state
- form prevents accidental double submission
- registration error preserves entered data
- registration error is generic and retryable
- Instructions still work
- Begin Assessment has loading state
- Begin Assessment failure is generic and retryable
- successful Begin Assessment reaches the existing placeholder
- no assessment question tables are created
- no answers are created
- no answer keys are created
- no scoring is implemented
- no results are implemented
- no admin is implemented
- no authentication is implemented
- no service-role key is introduced
- no secrets are committed
- .env.local remains unchanged
- documentation exists
- npm run lint passes
- npx tsc --noEmit passes
- npm run build passes
- git diff --check passes
