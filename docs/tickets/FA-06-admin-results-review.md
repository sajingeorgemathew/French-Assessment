# FA-06 - Admin Results Management and Individual Assessment Review

## Goal

Turn the Toronto Academy French Assessment admin foundation into a practical staff result-review system.

FA-05 created:

- Supabase Auth admin authentication
- explicit admin authorization
- protected admin routes
- admin login
- admin logout
- admin shell
- dashboard metrics
- recent submitted assessments
- secure admin dashboard RPC

FA-06 must now create:

- a dedicated Results page
- searchable submitted assessment results
- benchmark filtering
- server-side pagination
- links from result rows to an individual assessment result
- an admin-only individual assessment detail page
- complete student information
- assessment summary
- all 20 submitted responses
- selected answer
- correct answer
- correct/incorrect state
- unanswered state
- section grouping
- admin-only detailed result RPCs

Do not create editing functionality.

Do not alter student assessment scores.

Do not alter stored answers.

Do not allow assessment resubmission.

Do not edit the answer key.

Do not build question management.

## Product context

The French Assessment application is now collecting real student diagnostic assessment data.

Toronto Academy staff need a practical way to:

- locate a student
- view submitted assessments
- see the student's score
- see benchmark status
- open a specific assessment attempt
- review how the student answered all 20 questions
- identify correct, incorrect and unanswered responses

This is internal administrative functionality.

All routes and database operations created in FA-06 must require the active administrator authorization created in FA-05.

## Existing admin architecture

FA-05 uses the protected route group:

src/app/admin/(protected)/

Continue using this structure.

Do not create a second independent admin authentication system.

Reuse:

- existing admin layout
- require-admin architecture
- authenticated Supabase SSR client
- existing private active-admin helper
- Toronto Academy admin shell
- existing dashboard patterns

Do not bypass the FA-05 authorization architecture.

## Admin routes

Create:

/admin/results

/admin/results/[attemptId]

Both routes must live inside the existing protected admin route group.

Suggested structure:

src/app/admin/(protected)/results/
  page.tsx

  [attemptId]/
    page.tsx

Use the current Next.js 16 routing conventions from the installed project documentation.

## Admin navigation

Update the existing AdminShell navigation.

Functional links after FA-06:

Dashboard
Results

Dashboard:

/admin

Results:

/admin/results

Do not create fake functional links for features that do not yet exist.

A future Students area may be added later.

## Dashboard recent submissions

The existing FA-05 dashboard shows recent submitted assessments.

Update those result rows so a staff member can open the corresponding detail route:

/admin/results/[attemptId]

Use the internal assessment attempt UUID.

Do not use:

attempt_token

The secret/public student attempt token must never appear in admin links.

## Results list route

Route:

/admin/results

Page title:

Assessment Results

Suggested supporting text:

"Search and review completed French assessments."

This page contains submitted assessment attempts only.

Do not mix:

registered
in_progress

into the Results list.

The dashboard already gives operational counts for those states.

## Search

Provide a search field.

Search should support reasonable matching against:

- student full name
- email address
- phone number

Use server-side database search.

Do not fetch every result into the browser and filter client-side.

Search input should be trimmed.

Set a reasonable maximum search length.

Do not use dynamic SQL.

Do not create SQL injection risk.

Search should be case-insensitive for:

name
email

Phone search may use normalized or simple text matching based on the existing stored value.

## Search URL

Use normal admin URL query parameters where appropriate.

Example:

/admin/results?q=sajin

Admin search terms are acceptable in the protected admin URL.

Do not put private answer keys or attempt tokens into search parameters.

## Benchmark filter

Provide:

All Results
Benchmark Met
Below Benchmark

Use the assessment's authoritative:

benchmark_percent

Do not hardcode 60 percent into the browser filtering logic.

Benchmark Met:

percentage >= assessment.benchmark_percent

Below Benchmark:

percentage < assessment.benchmark_percent

The current A1 benchmark happens to be 60 percent, but the database assessment configuration remains authoritative.

## Results list

Show useful columns.

Recommended:

Student
Email
Phone
Status in Canada
Level
Score
Percentage
Benchmark
Submitted

A compact mobile representation is acceptable.

Do not expose:

attempt_token
answer keys
correct answers
raw internal database fields

## Benchmark display

For administrators, use neutral operational labels:

Met
Below

or:

Benchmark Met
Below Benchmark

Do not use aggressive:

PASS
FAIL

This remains a diagnostic assessment.

## Score display

Use:

X / 20

or use the authoritative assessment total_questions.

Do not assume every future assessment will always have 20 questions.

## Results ordering

Newest submitted assessments first.

Order by:

submitted_at DESC

Use deterministic secondary ordering if needed.

## Pagination

Add basic server-side pagination.

Default:

25 results per page

Maximum request limit:

100

Use:

page

or equivalent URL state.

Do not fetch every historical result on each request.

The data RPC should return:

results
total_count
limit
offset

or equivalent metadata.

The page should display simple:

Previous
Next

controls.

If total results fit on one page, do not show confusing active pagination.

## Empty result states

Handle:

- no submitted assessments
- no matches for current search/filter

Suggested no-data text:

"No completed assessments yet."

Suggested no-search-results text:

"No assessment results match your current search."

Do not crash.

## Admin results list RPC

Create a controlled PostgreSQL RPC similar to:

public.get_french_admin_results(
  p_search text,
  p_benchmark_filter text,
  p_limit integer,
  p_offset integer
)

Exact implementation may differ for a strong technical reason.

The function must independently verify:

private.is_active_french_admin()

before accessing protected data.

Do not assume that because the Next.js route is protected the database call is safe.

## Results RPC input validation

Supported benchmark filter values:

all
met
below

Reject or safely normalize unsupported values.

Search length should be limited.

p_limit:

minimum 1
maximum 100

Default:

25

p_offset:

minimum 0

Do not use dynamic SQL.

## Results RPC response

Return submitted attempts only.

Each result may contain:

attempt_id
student_full_name
student_email
student_phone
city
status_in_canada
current_french_level
french_learning_goal
assessment_title
assessment_level
score
total_questions
percentage
benchmark_percent
benchmark_met
started_at
submitted_at

Do not return:

attempt_token
answer rows
correct answer information
private answer-key records
administrator identity data
auth tokens

## Result detail route

Route:

/admin/results/[attemptId]

This route displays one submitted assessment attempt.

The URL uses:

assessment_attempts.id

not:

assessment_attempts.attempt_token

The attempt id must be validated as a UUID.

Invalid UUID routes should resolve safely.

Prefer:

notFound()

or an equivalent clean result.

Do not expose raw database errors.

## Result detail authorization

Create a controlled admin-only RPC similar to:

public.get_french_admin_attempt_detail(
  p_attempt_id uuid
)

The function must:

1. verify private.is_active_french_admin()
2. verify the requested attempt exists
3. verify it belongs to french-a1-diagnostic
4. verify it is submitted
5. return the attempt summary
6. return student information
7. return assessment metadata
8. return the complete 20-response review

Do not allow viewing in-progress answers through this FA-06 detail route.

Only finalized submitted assessments should have detailed answer review.

## Student information card

Display:

Full Name
Email Address
Phone Number
City
Status in Canada
Current French Level
French Learning Goal

Handle null optional values cleanly.

Use:

-

or:

Not provided

Do not render:

null
undefined

## Assessment summary

Display:

Assessment
Level
Score
Percentage
Benchmark
Benchmark Status
Started
Submitted

Use database values.

Do not recalculate the student's score in React.

Do not recalculate correctness in React.

Stored FA-04 result remains authoritative.

## Detailed answer review

Display exactly the finalized response snapshot stored by FA-04.

For each question display:

Question number
Section
Category where available
Question prompt
Selected option key
Selected option text
Correct option key
Correct option text
Correct / Incorrect / Not answered

If a reading question has a passage:

display enough passage context for the administrator to understand the question.

The full passage may be shown in a collapsible or compact block.

Do not make staff navigate back to the public assessment.

## Answer grouping

Group response review by the three assessment sections:

Partie A : Conjugaison et Grammaire

Partie B : Vocabulaire de la Vie Quotidienne

Partie C : Compréhension Écrite

Keep question numbers in ascending order.

## Correctness state

Administrator-only result detail may display:

Correct

Incorrect

Not answered

Recommended visual treatment:

Correct:
subtle positive status

Incorrect:
clear but professional negative/status treatment

Not answered:
neutral/amber state

Do not rely only on color.

Always include text labels.

## Selected option

Show:

A - option text

or equivalent.

If unanswered:

Not answered

Do not render an empty field.

## Correct answer

Show the correct option to authenticated active administrators only.

Example:

Correct answer:
B - sommes

Correct answer values come through the protected admin detail RPC.

Do not put answer-key constants in React source.

Do not recreate or infer the answer key in TypeScript.

The database's protected FA-04 answer-key storage remains authoritative.

## Answer-key security

The FA-04 answer key exists in the protected private schema.

FA-06 may join that private table inside the secure admin detail RPC.

Do not:

- grant authenticated users direct private schema access
- grant authenticated users direct answer-key table SELECT
- move answer keys into public.assessment_questions
- return the complete answer-key table separately
- expose correct answers through public student routes

Correct answers are allowed only as part of the authorized administrator's specific attempt detail response.

## Detailed response payload

For each question, the admin detail RPC may return:

question_id
question_number
section_key
section_title
section_title_fr
category
instruction
prompt
note
passage_title
passage_body
selected_option_key
selected_option_text
correct_option_key
correct_option_text
is_correct

Do not return:

attempt_token

## Data integrity

The detailed result must use:

public.assessment_answers

as the submitted response snapshot.

Do not read the student's current browser state.

Do not reconstruct answers from client logs.

For a properly submitted A1 assessment, there should be:

20 assessment_answers rows.

If stored answer count differs from assessment total_questions:

do not silently fabricate responses.

Return the real data and expose a safe administrator-facing integrity warning.

Example:

"Stored response data is incomplete for this assessment."

Do not alter the submitted attempt automatically.

## Score consistency

The page may compare:

stored score

against:

count of is_correct response rows

for internal integrity validation.

Do not silently overwrite score if they differ.

If inconsistent:

show a small administrator-facing data integrity warning.

Do not mutate historical result data in FA-06.

## Question content

Question presentation content comes from:

public.assessment_questions

Correct answer data comes from:

private.assessment_answer_keys

Student response data comes from:

public.assessment_answers

Attempt result comes from:

public.assessment_attempts

Student information comes from:

public.students

Assessment configuration comes from:

public.assessments

Do not duplicate these into new result tables.

## Database architecture

FA-06 should not require a new persistent result table.

Use existing FA-02 through FA-05 data.

Create only:

- admin results RPC
- admin attempt detail RPC
- supporting indexes only if genuinely required

Do not create unnecessary duplicate data.

## Existing RLS

Do not weaken existing RLS.

Do not add broad SELECT policies to:

students
assessments
assessment_attempts
assessment_questions
assessment_answers
private.assessment_answer_keys

Prefer the same controlled admin RPC security architecture established by FA-05.

## RPC privileges

For new admin RPCs:

revoke execute from:

public
anon

Grant execute to:

authenticated

Every function must still internally verify:

private.is_active_french_admin()

Authentication alone is not authorization.

## SECURITY DEFINER requirements

If functions use SECURITY DEFINER:

- explicitly set search_path
- schema qualify protected table references
- avoid dynamic SQL
- perform admin check before querying PII/results
- return only required fields
- revoke public execution
- grant authenticated only

## Migration

Create a NEW migration.

Suggested filename:

supabase/migrations/20260905140000_fa_06_admin_results_review.sql

A later timestamp is acceptable.

Do not modify:

FA-02 migration
FA-03 migration
FA-04 migration
FA-05 migration

Migration should contain:

- dependency guard for FA-05 authorization helper where appropriate
- public.get_french_admin_results
- public.get_french_admin_attempt_detail
- grants/revokes
- optional genuinely useful indexes

Do not recreate existing tables.

## Application server architecture

Create typed server-side helpers for:

getFrenchAdminResults()

getFrenchAdminAttemptDetail()

or equivalent.

Reuse the FA-05 authenticated Supabase SSR client.

Reuse the FA-05 administrator protection architecture.

Do not use the public stateless assessment client for authenticated admin data if doing so would discard the admin session.

Validate all RPC responses with Zod or equivalent existing project validation conventions.

## Search params

Because this project runs Next.js 16:

read installed Next.js documentation before implementing page searchParams and dynamic params.

Do not rely on outdated synchronous App Router examples.

Implement according to the project's actual Next.js 16 API.

## Results page UI

Build:

src/app/admin/(protected)/results/page.tsx

Recommended component breakdown:

src/components/admin/results/AdminResultsFilters.tsx
src/components/admin/results/AdminResultsTable.tsx
src/components/admin/results/AdminResultsPagination.tsx

Names may differ if architecture remains clear.

Avoid over-componentization.

## Detail UI

Build:

src/app/admin/(protected)/results/[attemptId]/page.tsx

Suggested components:

AdminResultSummary.tsx
AdminStudentInformation.tsx
AdminAnswerReview.tsx
AdminAnswerReviewItem.tsx

Reuse existing UI and Toronto Academy admin styles.

## Result detail header

Suggested:

Assessment Result

Student name

Submitted date

Provide:

Back to Results

Do not create browser-history-dependent navigation only.

Use a proper link to:

/admin/results

## Dashboard integration

Update the FA-05 recent-submissions table.

Student/submission rows may now link to:

/admin/results/[attemptId]

Do not change dashboard metric calculations.

Do not redesign the dashboard.

## Results navigation

Add a functional Results item to the FA-05 admin navigation.

Dashboard remains functional.

Sign Out remains functional.

## Accessibility

Results table must:

- have proper headers
- use semantic table markup on desktop where practical
- maintain readable mobile behavior
- provide descriptive link text

Filter controls must:

- have labels
- be keyboard accessible

Correctness must not be communicated by color alone.

## Responsive behavior

Admin priority:

1366x768
1440x900
1536x864

Results list should also remain usable on tablet and mobile.

On narrow screens:

a responsive card/list representation is acceptable if a wide table becomes unusable.

Do not create horizontal page overflow.

Detailed question cards should stack naturally.

## Error handling

If results RPC fails:

show a safe administrator-facing generic error.

Do not show raw SQL or Supabase details.

If detail attempt does not exist or is not submitted:

prefer a safe not-found response.

Do not reveal whether an inaccessible attempt exists.

## Data mutations

FA-06 is read-only.

Do not create actions to:

- change scores
- delete results
- edit answers
- edit students
- mark benchmark manually
- reopen assessment attempts
- reset attempts

These may be considered later if there is a business requirement.

## Public assessment regression

Do not modify public student behavior unnecessarily.

The following must still work without admin login:

/
 /assessment
 student registration
 Begin Assessment
 20-question player
 review
 submission
 secure scoring
 student completion result

Do not expose admin result RPC data publicly.

## Manual Supabase steps

The user will manually apply the FA-06 migration through Supabase SQL Editor.

No new Auth user is required if FA-05 administrator provisioning is already complete.

No new environment variables are expected.

Do not ask for a service-role credential.

## Documentation

Create:

docs/admin/fa-06-results-review.md

Document:

1. purpose
2. Results route
3. Result detail route
4. search behavior
5. benchmark filtering
6. pagination
7. results list RPC
8. result detail RPC
9. authorization model
10. PII handling
11. answer-key handling
12. detailed answer review
13. unanswered responses
14. score integrity behavior
15. response integrity behavior
16. dashboard integration
17. admin navigation
18. migration steps
19. verification SQL
20. security notes
21. known limitations
22. FA-07 handoff

## FA-07 handoff

Do not implement FA-07 functionality.

Likely FA-07 scope will include assessment invitation links and controlled invitation tracking.

Potential future capabilities:

- generate assessment invitation
- unique invitation link/token
- invitation status
- student prefill
- expiry
- admin invitation list

These are out of scope for FA-06.

## Security requirements

- every results RPC verifies active admin
- authentication alone is insufficient
- anon cannot execute admin results RPC
- no attempt_token is returned
- no public answer-key access is introduced
- correct answers appear only in protected attempt detail
- no service-role key
- no broad authenticated SELECT policies
- public student routes remain public
- no raw database errors
- no administrator password changes
- .env.local remains ignored

## Style rule

Use normal hyphens.

Do not use em dashes.

Use straight quotes where practical.

Preserve French accents in question and section content.

## Validation

Run:

npm run lint
npx tsc --noEmit
npm run build
git diff --check

Fix all FA-06 implementation errors.

## Done criteria

FA-06 is complete when:

- a new FA-06 migration exists
- older migrations remain unchanged
- secure admin results RPC exists
- secure admin attempt detail RPC exists
- both RPCs independently verify active admin authorization
- anon cannot execute either RPC
- authenticated non-admin cannot retrieve data
- /admin/results exists
- Results navigation exists
- submitted assessments are listed
- results are newest first
- search by name works
- search by email works
- search by phone works
- benchmark filter works
- search/filter combination works
- basic server-side pagination works
- empty database state works
- no-match state works
- result rows link to detail
- dashboard recent submissions link to detail
- /admin/results/[attemptId] exists
- invalid attempt id is handled safely
- non-existent attempt is handled safely
- non-submitted attempt is not exposed by detail
- student information is displayed
- assessment summary is displayed
- score is displayed
- percentage is displayed
- benchmark is displayed
- benchmark status is displayed
- started/submitted timestamps are displayed
- all stored question responses are displayed
- responses are ordered 1 through 20
- responses are grouped by section
- selected option is displayed
- selected option text is displayed
- unanswered state is displayed
- correct answer is displayed to admin
- correct answer text is displayed to admin
- correct/incorrect status is displayed
- correctness is not communicated by color alone
- reading passage context is available for reading questions
- no attempt_token appears in URL or RPC payload
- no public answer-key access was added
- result detail is read-only
- no score editing exists
- no answer editing exists
- no student editing exists
- no question editing exists
- existing dashboard continues to work
- existing sign out continues to work
- public assessment continues to work
- no service-role credential is introduced
- .env.local remains unchanged
- documentation exists
- npm run lint passes
- npx tsc --noEmit passes
- npm run build passes
- git diff --check passes
