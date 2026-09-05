# FA-04 - Secure Submission, Scoring and Results

## Goal

Complete the French A1 assessment submission lifecycle for Toronto Academy of Education.

FA-01 created the branded student intake experience.

FA-02 created students and persistent assessment attempts.

FA-03 created the real A1 assessment engine with:

- 3 sections
- 3 reading passages
- 20 questions
- secure assessment content retrieval
- browser-session answer state
- Review Answers screen
- disabled Submit Assessment action

FA-04 must now:

- create secure server-only answer-key storage
- create persistent assessment answer storage
- securely submit the student's final A/B/C/D responses
- score the assessment entirely inside PostgreSQL/server-side logic
- calculate the score out of 20
- calculate the percentage
- store the final responses
- mark the attempt submitted
- set submitted_at
- store score
- store percentage
- prevent score manipulation from the browser
- prevent double submission from changing a completed result
- replace the disabled Submit Assessment button with a real action
- create a polished Toronto Academy completion/result screen

Do not build the admin panel yet.

Do not build student login.

Do not build invitation links yet.

## Product context

The assessment is:

French Language Evaluation and Diagnostic Assessment

French title:

Évaluation Diagnostique de Français

Framework:

CEFR / CECRL

Level:

A1

Total questions:

20

Diagnostic benchmark:

60 percent

12 correct answers out of 20 corresponds to the benchmark.

This remains a diagnostic/placement assessment.

Do not present the student's outcome using large PASS or FAIL messaging.

The result experience should be supportive and professional.

## Existing assessment lifecycle

Before FA-04:

registered
-> in_progress
-> Review Answers

After FA-04:

registered
-> in_progress
-> submitted

On successful final submission:

submitted_at must be populated

score must contain the number of correct responses

percentage must contain the calculated percentage

The attempt must remain immutable from further student submissions after successful completion.

## Current answer representation

FA-03 uses stable answer identifiers:

A
B
C
D

Client answer state maps:

question_id -> option key

Continue using these stable option keys.

Never score using visible option text.

## Answer-key architecture

Correct answers must never be returned by:

public.get_french_assessment_content

Correct answers must never be included in:

- question JSON returned to the browser
- React component props
- client JavaScript bundles
- browser network response containing assessment content
- localStorage
- sessionStorage
- URL parameters

Create protected answer-key storage.

Preferred architecture:

private.assessment_answer_keys

Use a non-exposed PostgreSQL schema named:

private

The private schema should not be directly accessible to anon or authenticated roles.

Create:

private.assessment_answer_keys

Recommended fields:

question_id
uuid
primary key
foreign key to public.assessment_questions(id)
on delete cascade

correct_option_key
text
not null

created_at
timestamptz
not null
default now()

Constraint:

correct_option_key must be one of:

A
B
C
D

Do not expose the private schema through application content RPCs.

Do not grant anon or authenticated direct access to the private schema or answer-key table.

If there is a strong technical reason not to use a private schema, explain it clearly and use an equivalently protected server-only design.

## Working A1 answer key

Use the following working key:

Question 1: B
Question 2: C
Question 3: B
Question 4: A
Question 5: B
Question 6: D
Question 7: A
Question 8: B
Question 9: C
Question 10: C
Question 11: B
Question 12: A
Question 13: C
Question 14: B
Question 15: B
Question 16: C
Question 17: B
Question 18: B
Question 19: B
Question 20: B

Important:

Question 1 is explicitly confirmed in the supplied source answer-key content.

Questions 2-20 are the current working key derived from the supplied questions and must be reviewed by the instructor/project owner before production deployment.

Do not expose this answer key in browser-facing application code.

Seed the key by matching:

assessment slug
+
question_number

Do not rely on unstable UUID values hardcoded into the migration.

## Answer-key verification documentation

Create:

docs/assessment/fa-04-answer-key-review.md

Include a simple table:

Question
Working correct option
Verification status

Use:

Question 1:
Source confirmed

Questions 2-20:
Instructor review required before production

Do not include question explanations unless necessary.

This documentation is internal project documentation.

## Table: assessment_answers

Create:

public.assessment_answers

Purpose:

Store the final response snapshot for each submitted assessment attempt.

Recommended fields:

id
uuid
primary key
default gen_random_uuid()

attempt_id
uuid
not null
foreign key to public.assessment_attempts(id)
on delete cascade

question_id
uuid
not null
foreign key to public.assessment_questions(id)

selected_option_key
text
nullable

is_correct
boolean
not null

created_at
timestamptz
not null
default now()

Create unique constraint:

attempt_id + question_id

selected_option_key may be null to represent an unanswered question.

When non-null it must be one of:

A
B
C
D

An unanswered question must score as incorrect.

Do not allow the browser to insert directly into this table.

## Why store all 20 rows

On successful submission, persist exactly one assessment_answers row for each of the 20 questions.

Even unanswered questions should receive a row:

selected_option_key = null
is_correct = false

This gives the future admin panel a complete response snapshot:

20 questions
20 stored response rows

and makes reporting easier.

## RLS and table privileges

Enable RLS on:

public.assessment_answers

Do not create anonymous direct SELECT policies.

Do not create anonymous direct INSERT policies.

Do not create anonymous direct UPDATE policies.

Do not create anonymous DELETE policies.

Revoke broad table access from:

public
anon
authenticated

Student submission must occur only through the controlled scoring RPC.

The existing FA-03 content tables must remain protected.

Do not weaken existing RLS.

## Submission RPC

Create a controlled PostgreSQL RPC similar to:

public.submit_french_assessment(
  p_attempt_token uuid,
  p_answers jsonb
)

Use SECURITY DEFINER if required.

The exact signature may differ for a clear technical reason.

The function must be the authoritative scoring boundary.

## Submission input

p_attempt_token:

opaque UUID attempt token from FA-02

p_answers:

JSON object mapping:

question UUID string -> option key

Example shape:

{
  "question-uuid-1": "B",
  "question-uuid-2": "C"
}

Unanswered questions may simply be absent from the object.

Do not require the browser to submit null entries for unanswered questions.

The database function must create the complete 20-row answer snapshot itself.

## Submission validation

The submission function must validate:

1. attempt token is non-null
2. matching attempt exists
3. attempt belongs to french-a1-diagnostic
4. assessment is active
5. attempt is currently in_progress OR already submitted
6. supplied answers payload is a JSON object
7. every supplied question id is a valid UUID
8. every supplied option value is one of A/B/C/D
9. every supplied question belongs to the same french-a1-diagnostic assessment
10. no unknown question ids are accepted
11. scoring uses the protected answer-key table only

Do not trust:

- question numbering sent from the browser
- score sent from the browser
- percentage sent from the browser
- is_correct sent from the browser
- visible answer text sent from the browser

The browser must not submit any scoring information.

## Complete question set

The scoring function must obtain the authoritative question set from:

public.assessment_questions

for:

french-a1-diagnostic

The assessment currently contains exactly 20 questions.

Do not calculate the denominator from the number of answers the student happened to submit.

Percentage denominator must be the assessment's authoritative total question count.

## Scoring

For each of the 20 assessment questions:

Find the submitted selected option if present.

If absent:

selected_option_key = null
is_correct = false

If present:

compare selected_option_key against the protected answer key.

Set:

is_correct = true

only when they match.

Score:

count of assessment_answers rows where is_correct = true

Expected possible score:

0 through 20

Percentage:

score / total_questions * 100

For this assessment:

percentage = score / 20 * 100

Use sensible numeric precision.

Examples:

20 correct -> 100
15 correct -> 75
12 correct -> 60
10 correct -> 50
0 correct -> 0

Do not accept score or percentage from the client.

## Submission transaction

Final submission must behave atomically.

Within one database transaction/function call:

1. validate attempt
2. validate answer payload
3. determine authoritative question set
4. determine protected correct answers
5. store all 20 response rows
6. calculate score
7. calculate percentage
8. update attempt:
   status = submitted
   submitted_at = now()
   score = calculated score
   percentage = calculated percentage
9. return minimal result information

Do not leave a partially submitted attempt if an error occurs.

If any required scoring data is missing, fail the operation rather than producing an unreliable result.

## Idempotency and double submission

This is critical.

If an attempt is already submitted:

- do not delete existing answers
- do not overwrite answers
- do not rescore using a new payload
- do not change submitted_at
- do not change score
- do not change percentage

Instead return the already stored result.

A double click on Submit Assessment must not create duplicate answer rows.

A repeated network request must not alter a completed assessment.

## Concurrency

Handle simultaneous or near-simultaneous submission attempts safely.

Use row locking or another reliable PostgreSQL approach where appropriate.

The same attempt must not be scored twice with conflicting answer payloads.

The first successful final submission wins.

## Result returned to the browser

Return only minimal result information.

Recommended response:

status
score
percentage
total_questions
submitted_at

Optionally:

level

Do not return:

- answer key
- correct answers
- individual is_correct values
- student record
- student email
- phone
- private table content

The student result screen does not need question-by-question correctness in FA-04.

## Benchmark

The database already stores:

benchmark_percent = 60

The system may derive whether the benchmark was met for future admin use.

Do not make PASS/FAIL the primary student-facing message.

Do not add a large red failure state.

Do not add a large green passed state.

This is a diagnostic assessment.

## Student result experience

Replace the Review screen's disabled Submit Assessment action with a functioning submission flow.

After successful submission show a dedicated result/completion screen.

Suggested content:

Assessment Complete

Your French Language Assessment has been submitted successfully.

Score:

X / 20

Percentage:

Y%

Supporting text:

"Thank you for completing your French Language Assessment. The Toronto Academy team will review your assessment and use the results to help determine the appropriate French learning pathway."

Exact wording may be polished to match the existing Toronto Academy design.

Do not say:

Failed
You failed
Passed
You passed

Do not use alarming or celebratory pass/fail styling.

## Result screen

Create a reusable component such as:

AssessmentResult.tsx

or a similarly appropriate name.

Display:

- Toronto Academy branding consistent with current application
- Assessment Complete
- score
- total questions
- percentage
- level A1
- completion confirmation
- next-step message

Do not display correct answer keys.

Do not display question-by-question correctness yet.

Do not show the student's PII unnecessarily.

## Review Answers screen changes

The existing Review Answers screen currently:

- shows Questions 1-20
- shows answered/unanswered
- shows selected option letter
- allows returning to questions
- has disabled Submit Assessment

Preserve the existing review functionality.

Change Submit Assessment into a real action.

If unanswered questions exist:

show a clear confirmation before final submission.

Example:

"You have 3 unanswered questions. You can return to complete them or submit the assessment as it is."

Provide:

Review Questions

and

Submit Anyway

Do not force all 20 questions to be answered.

Unanswered questions score as incorrect.

If all questions are answered:

allow normal final submission confirmation.

## Final confirmation

Do not accidentally submit because the student clicked once while reviewing.

Use a lightweight confirmation step/modal/panel.

The confirmation should explain that once submitted:

the assessment cannot be changed.

Do not create a complicated modal system if a simple inline confirmation is cleaner.

## Submission loading state

When submission begins:

- disable the submit control
- prevent repeated clicks
- show clear submitting state
- keep current answers intact
- wait for authoritative server result

Suggested label:

Submitting assessment...

## Submission failure

If final submission fails:

- remain on Review Answers
- preserve current browser answer selections
- restore submit action
- show generic retryable error
- do not show raw PostgreSQL/Supabase details
- allow retry

Suggested message:

"We could not submit your assessment right now. Your answers are still here. Please try again."

Do not clear answers on failure.

## Server-side application boundary

Create a Next.js server-side function/action similar to:

submitFrenchAssessment()

It must:

1. receive attempt token
2. receive current answer map
3. validate token
4. validate answer payload structure with Zod
5. call public.submit_french_assessment
6. validate returned result
7. return typed safe result to the client

Do not calculate score in JavaScript.

Do not import answer keys into server action source.

PostgreSQL is the authoritative scoring boundary.

## Client payload validation

Use Zod or existing validation architecture.

Validate:

attemptToken:
UUID

answers:
record/object

question-id keys:
UUID-compatible strings

answer values:
A/B/C/D

Limit payload size reasonably.

Do not trust arbitrary nested JSON.

## Result state

After successful submission:

the assessment player should transition to the result state.

Do not allow the student to return and edit answers after successful submission.

Disable or remove Back-to-question navigation once result is final.

The final attempt status is:

submitted

## Refresh limitation

FA-03 answer state may still be browser-memory based before submission.

Do not overexpand FA-04 into a full resumable assessment system.

If a hard refresh before submission can lose local unsaved answers, document that limitation.

After successful submission the database result is authoritative.

Full resume/recovery can be addressed later if needed.

## Answer key source status

Create internal documentation making clear:

Question 1:
source answer key explicitly confirms B

Questions 2-20:
working key inferred from supplied assessment content and requires instructor review before production

Do not represent Questions 2-20 as source-confirmed if the current source material does not explicitly show their answer-key section.

## Documentation

Create:

docs/assessment/fa-04-submission-scoring-results.md

Include:

1. purpose
2. private answer-key architecture
3. assessment_answers schema
4. answer payload format
5. scoring RPC
6. server-side scoring boundary
7. transaction behavior
8. idempotency
9. concurrency protection
10. unanswered question behavior
11. score calculation
12. percentage calculation
13. result payload
14. result screen
15. RLS and privilege decisions
16. migration instructions
17. verification SQL
18. answer-key review requirement
19. known refresh limitation
20. FA-05 handoff

Also create:

docs/assessment/fa-04-answer-key-review.md

## Migration

Create one version-controlled migration under:

supabase/migrations/

Suggested filename:

20260905073000_fa_04_submission_scoring_results.sql

A different later timestamp is acceptable.

The migration must include:

- private schema if needed
- protected answer-key table
- 20 answer-key seeds
- public.assessment_answers
- constraints
- indexes
- RLS
- revokes/grants
- controlled final-submission/scoring RPC

Do not modify previous migration files.

Create a new migration.

## Migration dependencies

FA-04 depends on:

FA-02:
public.assessments
public.assessment_attempts

FA-03:
public.assessment_questions

Fail clearly if dependencies are missing.

Do not silently create replacement FA-02 or FA-03 tables.

## Manual Supabase steps

Claude creates the migration only.

Claude must not:

- run SQL against remote Supabase
- open Supabase dashboard
- read environment secrets
- use a service-role credential
- modify .env.local

The user will apply the migration manually.

## Environment files

Do not read .env.local.

Do not print .env.local.

Do not modify .env.local.

Do not commit environment files.

Do not add service-role credentials.

## Security

- answer keys must remain server-only
- answer keys must not enter browser content payload
- answer keys must not be present in React source
- client cannot submit score
- client cannot submit percentage
- client cannot submit is_correct
- scoring must happen in controlled PostgreSQL function
- answer table has no anonymous direct access
- private answer-key table has no anonymous direct access
- student PII remains protected
- no PII in URLs
- raw database errors are never shown to student
- existing RLS must not be weakened
- attempt token remains the only student session credential used for submission

## Admin

Do not build:

- admin login
- admin dashboard
- result search
- student table UI
- detailed answer review UI
- question management

Those belong to FA-05 and later.

## Out of scope

Do not implement:

- admin authentication
- admin dashboard
- invitation links
- email delivery
- SMS
- GoHighLevel
- PDF result generation
- certificate generation
- AI feedback
- detailed answer explanations
- public answer review
- A2 questions
- B1 questions
- full assessment resume/recovery
- analytics dashboards

## Files likely affected

Likely files include:

- supabase/migrations/*
- src/components/assessment/player/AssessmentPlayer.tsx
- src/components/assessment/player/ReviewAnswers.tsx
- src/components/assessment/player/AssessmentResult.tsx
- src/lib/assessment-content.ts
- src/lib/assessment-player.ts
- src/lib/assessment-actions.ts or equivalent
- docs/assessment/fa-04-submission-scoring-results.md
- docs/assessment/fa-04-answer-key-review.md

Use the existing architecture rather than rewriting the player unnecessarily.

## Style rule

Use normal hyphens for English prose.

Do not use em dashes.

Use straight quotes where practical.

Preserve French accents where required.

## Validation

Run:

npm run lint
npx tsc --noEmit
npm run build
git diff --check

Fix all FA-04 implementation errors.

## Done criteria

FA-04 is complete when:

- new FA-04 migration exists
- previous migration files remain unchanged
- protected answer-key storage exists
- anon cannot directly read answer keys
- authenticated cannot directly read answer keys
- exactly 20 answer-key rows are seeded
- answer key is mapped by authoritative question identity
- public.assessment_answers exists
- assessment_answers uses one row per attempt/question
- selected option uses A/B/C/D or null
- unanswered questions can be stored as null
- is_correct is calculated server-side
- RLS is enabled on assessment_answers
- public direct answer-table writes are blocked
- controlled submission RPC exists
- submission requires valid attempt token
- submission requires french-a1-diagnostic
- submission requires active assessment
- submission validates question ids
- submission validates option keys
- unknown question ids are rejected
- exactly 20 response rows are stored on final submission
- unanswered questions score incorrect
- score is calculated server-side
- percentage is calculated server-side
- client cannot set score
- client cannot set percentage
- client cannot set correctness
- successful submission changes status to submitted
- successful submission sets submitted_at
- successful submission stores score
- successful submission stores percentage
- submission is atomic
- repeat submission does not alter completed result
- repeat submission does not create duplicate answers
- concurrent double submission is handled safely
- Review Answers remains functional before submission
- unanswered warning works
- real Submit Assessment action exists
- submitting loading state exists
- failed submission preserves browser answer state
- successful submission opens result screen
- result screen shows score out of 20
- result screen shows percentage
- result screen shows A1
- result screen does not show PASS/FAIL
- no answer key is exposed to browser
- no individual correctness is exposed to student
- no admin UI is built
- .env.local remains unchanged
- answer-key review documentation exists
- FA-04 technical documentation exists
- npm run lint passes
- npx tsc --noEmit passes
- npm run build passes
- git diff --check passes
