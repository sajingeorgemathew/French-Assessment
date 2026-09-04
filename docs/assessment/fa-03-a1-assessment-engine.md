# FA-03 - A1 Assessment Engine and Question Content

Toronto Academy of Education
French Language Evaluation and Diagnostic Assessment
CEFR / CECRL Level A1

Migration: `supabase/migrations/20260904190000_fa_03_a1_assessment_content.sql`

---

## 1. Purpose of FA-03

FA-01 delivered the branding, landing page, student intake, instructions and an
"Assessment Ready" placeholder. FA-02 delivered `students`, `assessments`,
`assessment_attempts`, the registration and begin RPCs, and the opaque attempt
token.

FA-03 replaces the placeholder with the real assessment player and adds the
content it renders:

- three assessment content tables
- the exact supplied A1 content (3 sections, 3 passages, 20 questions)
- a controlled content RPC that requires a valid in-progress attempt
- a server-side application boundary for retrieving that content
- the full player: section introductions, 20 questions, reading passages,
  navigation, active answer state and a Review Answers screen

FA-03 does **not** persist answers, evaluate them, score them, or submit the
attempt. Those belong to FA-04.

---

## 2. Assessment content architecture

```
public.assessments                     (FA-02)
  └── public.assessment_sections       (FA-03)  3 rows
        ├── public.assessment_passages (FA-03)  3 rows, all in the reading section
        └── public.assessment_questions(FA-03)  20 rows
              └── passage_id -> assessment_passages (nullable)
```

Every FA-03 row belongs to the assessment whose slug is `french-a1-diagnostic`.

Composite foreign keys are used so a passage or question can never reference a
section, or a question reference a passage, belonging to a different assessment:

- `assessment_passages (section_id, assessment_id)` -> `assessment_sections (id, assessment_id)`
- `assessment_questions (section_id, assessment_id)` -> `assessment_sections (id, assessment_id)`
- `assessment_questions (passage_id, assessment_id)` -> `assessment_passages (id, assessment_id)`

The passage key uses MATCH SIMPLE semantics, so the constraint is simply skipped
while `passage_id` is null. That is the correct behaviour for the fourteen non
reading questions.

---

## 3. Schema: public.assessment_sections

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | primary key, `default gen_random_uuid()` |
| `assessment_id` | `uuid` | not null, FK -> `public.assessments(id)` on delete cascade |
| `section_key` | `text` | not null, stable machine key (`grammar`, `vocabulary`, `reading`) |
| `title` | `text` | not null, English title |
| `title_fr` | `text` | nullable, French title shown as the section heading |
| `description` | `text` | nullable, for example `Questions 1 à 8` |
| `position` | `integer` | not null, `> 0`, display order |
| `created_at` | `timestamptz` | not null, `default now()` |

Constraints:

- `unique (assessment_id, section_key)`
- `unique (assessment_id, position)`
- `check (position > 0)`
- `section_key` and `title` may not be blank, `section_key` max 60 characters

Indexes:

- `assessment_sections_id_assessment_id_key` (unique, composite FK target)
- `assessment_sections_assessment_id_position_idx`

---

## 4. Schema: public.assessment_passages

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | primary key, `default gen_random_uuid()` |
| `assessment_id` | `uuid` | not null, FK -> `public.assessments(id)` on delete cascade |
| `section_id` | `uuid` | not null, composite FK -> `assessment_sections` |
| `passage_key` | `text` | not null, stable key (`invitation`, `hotel`, `professional-email`) |
| `title` | `text` | not null, for example `Texte 1 - Invitation` |
| `body` | `text` | not null, the French text, source line breaks preserved |
| `position` | `integer` | not null, `> 0` |
| `created_at` | `timestamptz` | not null, `default now()` |

Constraints:

- `unique (assessment_id, passage_key)`
- `check (position > 0)`
- `passage_key`, `title` and `body` may not be blank, `passage_key` max 60 characters
- composite FK to `assessment_sections (id, assessment_id)`

Indexes:

- `assessment_passages_id_assessment_id_key` (unique, composite FK target)
- `assessment_passages_assessment_id_position_idx`
- `assessment_passages_section_id_idx`

---

## 5. Schema: public.assessment_questions

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | primary key, `default gen_random_uuid()` |
| `assessment_id` | `uuid` | not null, FK -> `public.assessments(id)` on delete cascade |
| `section_id` | `uuid` | not null, composite FK -> `assessment_sections` |
| `passage_id` | `uuid` | nullable, composite FK -> `assessment_passages` |
| `question_number` | `integer` | not null, `> 0`, 1 to 20 |
| `category` | `text` | nullable, for example `Grammaire - Être` |
| `instruction` | `text` | nullable, French instruction line |
| `prompt` | `text` | not null, the question itself |
| `note` | `text` | nullable, the supplied `Remarque :` line on question 3 |
| `options` | `jsonb` | not null, exactly four A/B/C/D option objects |
| `position` | `integer` | not null, `> 0`, display order |
| `created_at` | `timestamptz` | not null, `default now()` |

Constraints:

- `unique (assessment_id, question_number)`
- `unique (assessment_id, position)`
- `check (question_number > 0)`, `check (position > 0)`, prompt not blank
- `assessment_questions_options_shape` - the options payload must be a JSON
  array whose elements 0 to 3 are objects, with no element 4, whose `key` values
  are exactly `A`, `B`, `C`, `D` in that order, each with non blank `text`.
  Every branch is null safe, because a CHECK expression evaluating to NULL would
  otherwise be treated as satisfied.
- `assessment_questions_options_no_extra_fields` - each option object may hold
  `key` and `text` and nothing else. This makes it structurally impossible to
  smuggle an `is_correct` style flag into the options payload.
- composite FKs to `assessment_sections` and `assessment_passages`

Indexes:

- `assessment_questions_assessment_id_position_idx`
- `assessment_questions_section_id_idx`
- `assessment_questions_passage_id_idx`

### There is no answer key

There is deliberately no `correct_answer`, `correct_option`,
`correct_option_key`, `answer_key`, `expected_answer` or `is_correct` column,
no answer key table, and no correct-answer data in the seeds or in any
application source file. Correct answers are introduced in FA-04 behind a
server-side boundary.

---

## 6. Stable option-key format

Options are stored as an ordered JSON array:

```json
[
  { "key": "A", "text": "êtes" },
  { "key": "B", "text": "sommes" },
  { "key": "C", "text": "sont" },
  { "key": "D", "text": "somme" }
]
```

Rules:

- the option **key** (`A`, `B`, `C`, `D`) is the answer identifier everywhere:
  in the radio input `value`, in the client answer map and on the review screen
- option display text is never used as the response identifier
- the order in the array is the display order
- the shape is enforced by database check constraints and re-validated in the
  application with a Zod `strictObject`, so an unexpected field fails parsing
  rather than reaching the browser bundle

---

## 7. Content RPC and its security

```
public.get_french_assessment_content(p_attempt_token uuid) returns jsonb
```

The function verifies, in one lookup, that:

1. the token is not null (otherwise `22023 invalid_attempt_token`)
2. an attempt with that `attempt_token` exists
3. that attempt's `status` is `in_progress`
4. its assessment `slug` is `french-a1-diagnostic`
5. that assessment `is_active`

Any failure raises the same generic `P0002 assessment_content_unavailable`, so a
caller cannot tell an unknown token apart from an attempt that has not been
started.

Returned payload:

```json
{
  "assessment": { "slug", "title", "title_fr", "framework", "level", "total_questions" },
  "sections":  [ { "id", "section_key", "title", "title_fr", "description", "position" } ],
  "passages":  [ { "id", "section_id", "passage_key", "title", "body", "position" } ],
  "questions": [ { "id", "section_id", "passage_id", "question_number",
                   "category", "instruction", "prompt", "note", "options", "position" } ]
}
```

Sections, passages and questions are all ordered by `position`.

The payload deliberately excludes `student_id`, student name, email, phone,
city, immigration status, French level, learning goal, `score`, `percentage`,
`submitted_at`, `started_at`, `benchmark_percent`, any other attempt, and any
administrative field. It contains no correct-answer information, because none
is stored.

### SECURITY DEFINER safeguards

- `security definer` with `set search_path = pg_catalog, public, pg_temp`
  (`pg_temp` pinned last)
- every object reference is schema qualified
- no dynamic SQL anywhere
- declared `stable` and genuinely read only: the function runs no `INSERT`,
  `UPDATE` or `DELETE`, so calling it cannot change the attempt
- `revoke all ... from public`, then `grant execute ... to anon, authenticated`
- the protected tables themselves are never exposed

### RLS and privileges

Row Level Security is enabled on all three content tables and **no policies are
created**. That is the same deny by default posture FA-02 established: `anon`
and `authenticated` cannot select, insert, update or delete any row directly.
Any policy left behind by an earlier run is dropped.

RLS is not treated as the only boundary. Supabase grants broad table privileges
to `anon` and `authenticated` by default, so the migration also runs:

```sql
revoke all on table public.assessment_sections  from public, anon, authenticated;
revoke all on table public.assessment_passages  from public, anon, authenticated;
revoke all on table public.assessment_questions from public, anon, authenticated;
```

No unrestricted anonymous content-table read is introduced anywhere.

No service-role key is used, added or referenced. The application continues to
call Supabase with the publishable (anon) key only.

---

## 8. Application boundary

`src/lib/actions/assessment.ts` (`"use server"`):

```ts
getFrenchAssessmentContent(attemptToken: string)
  : Promise<AssessmentActionResult<AssessmentContent>>
```

It:

1. re-validates the attempt token as a UUID with Zod, because a Server Function
   is reachable by direct POST and nothing from the browser is trusted
2. calls `public.get_french_assessment_content`
3. validates the response with `assessmentContentRpcResultSchema`
4. maps snake_case to the camelCase `AssessmentContent` type and sorts by
   `position` defensively
5. returns `{ ok: true, data }` or `{ ok: false, message }`

Failures log a short PII free marker server side (`[assessment] content failed:
rpc error code ...`) and return one generic student-facing message:

> We could not load your assessment. Please return to the assessment start and
> try again.

No raw Supabase or PostgreSQL error text ever reaches the browser. No Supabase
client is constructed in a component; the client lives only in
`src/lib/supabase/server.ts`, which is imported exclusively by the `"use server"`
module.

Types and parsers live in `src/lib/assessment-content.ts`.

---

## 9. Assessment player flow

```
Begin Assessment (FA-02, attempt becomes in_progress)
  -> Part A introduction
  -> Questions 1 to 8
  -> Part B introduction
  -> Questions 9 to 14
  -> Part C introduction
  -> Questions 15 to 20
  -> Review Answers
```

Components, all under `src/components/assessment/player/`:

| File | Responsibility |
| --- | --- |
| `AssessmentPlayer.tsx` | Client orchestrator: loads content, owns answers, stage and navigation |
| `PlayerShell.tsx` | Compact branded frame shared by every screen |
| `PlayerProgress.tsx` | Section label, `Question X of 20`, thin progress bar |
| `SectionIntroduction.tsx` | Part A / B / C introduction screens |
| `QuestionScreen.tsx` | One question, four radio options, optional passage, Back / Next |
| `ReadingPassage.tsx` | The reading text panel |
| `ReviewAnswers.tsx` | Review Answers screen |
| `PlayerStatus.tsx` | Loading screen and generic unavailable screen |

Navigation rules are pure functions in `src/lib/assessment-player.ts`
(`buildPlayerPlan`, `stageAfterNext`, `stageAfterBack`, `summariseAnswers`), so
the screens only render a stage.

Section ranges are derived from the seeded question order rather than hard
coded, so the player follows whatever the content actually says.

The player takes over the page: `AssessmentFlow` returns it directly instead of
wrapping it in the entry flow chrome, so there is no marketing intro paragraph
and no step rail during the assessment.

---

## 10. Section transitions

- Part A introduction shows `Partie A : Conjugaison et Grammaire`,
  `Questions 1 à 8` and a short description of the task, then
  **Commencer la partie**.
- Part B introduction shows `Partie B : Vocabulaire de la Vie Quotidienne` and
  `Questions 9 à 14`.
- Part C introduction shows `Partie C : Compréhension Écrite`,
  `Questions 15 à 20`, and explains that each text stays on screen while the two
  questions that go with it are answered.

The descriptions state what the part asks the student to do. They contain no
study hints, no worked examples and no guidance about the answers.

A section introduction is shown **the first time that section is entered**. If a
student walks back over a boundary and moves forward again, or jumps into a
section from the review screen, the introduction is not replayed. Section
transitions never clear answers.

---

## 11. Question navigation

| From | Next | Back |
| --- | --- | --- |
| Part A introduction | Question 1 | leaves the assessment, back to the instructions step |
| Question 1 | Question 2 | Part A introduction |
| Question 8 | Part B introduction (first time) or Question 9 | Question 7 |
| Part B introduction | Question 9 | Question 8 |
| Question 14 | Part C introduction (first time) or Question 15 | Question 13 |
| Part C introduction | Question 15 | Question 14 |
| Question 20 (`Review answers`) | Review Answers | Question 19 |
| Review Answers | disabled, FA-04 submits | Question 20 |

Back always steps to the previous question rather than back through an
introduction, so returning from Question 9 lands on Question 8 and returning
from Question 15 lands on Question 14, exactly as the ticket requires.

Students may move forward without answering. Next is never blocked and no
option is ever preselected.

Every stage change moves focus to the stage region (`tabIndex={-1}`), so
keyboard and screen reader users follow the change and long screens start from
the top.

---

## 12. Active answer state

Answers live in React state in `AssessmentPlayer` and nowhere else:

```ts
type AssessmentAnswers = Readonly<Partial<Record<string, "A" | "B" | "C" | "D">>>;
// question id -> selected option key
```

- keyed by question `id` (a UUID from the content payload)
- the value is always the option key, never the option text
- answers survive Next, Back and section transitions within the session
- answers can be changed at any time, including from the review screen
- the review screen reads the same map
- **nothing is written to Supabase**, and correctness is never computed

---

## 13. Reading passage behaviour

| Questions | Passage |
| --- | --- |
| 15 and 16 | `Texte 1 - Invitation` |
| 17 and 18 | `Texte 2 - Annonce d'Hôtel` |
| 19 and 20 | `Texte 3 - Courriel Professionnel Simple` |

The association is data driven: each reading question carries a `passage_id`,
and the player looks the passage up by id. The passage is rendered on every
question that references it, so a student never has to remember it from the
previous screen.

The passage body keeps its source line breaks (`whitespace-pre-line`) and is
marked `lang="fr"`.

---

## 14. Review Answers behaviour

The Review Answers screen shows:

- all 20 questions, in order, as clickable items
- per question: the number, a truncated prompt, and either
  `Answered - option B` or `Not answered`
- `Answered: 15 of 20` and `Unanswered: 5` totals
- unanswered items carry a distinct amber treatment as well as the text label,
  so status is not conveyed by colour alone

Clicking a review item returns directly to that question. A **Return to review**
button then appears on the question screen, so there is always a clear path
back. That button disappears once the review screen is reached again.

The screen never shows correct, incorrect, a score, a percentage, a benchmark
result, passed or failed.

At the bottom:

> Submission and scoring will be enabled in the next assessment step. Your
> answers are held in this browser session only and have not been sent anywhere.

with a clearly **disabled** `Submit Assessment` button. Reaching the review
screen submits nothing. The attempt stays `in_progress`, and `submitted_at`,
`score` and `percentage` stay null.

---

## 15. Loading and failure states

While content loads, a calm branded panel shows "Loading your assessment". There
is never an empty or broken screen.

If the token is invalid, the attempt is not `in_progress`, the assessment is
inactive or the RPC fails, the player shows an "Assessment unavailable" panel
with the generic message, a **Try again** button that refetches, and a
**Back to instructions** button that returns to the FA-02 Begin Assessment step
(the begin RPC is idempotent, so retrying is safe).

No SQL, no Supabase detail, no attempt detail and no student data appear in any
error surface. The attempt token is never placed in a URL or query parameter.

---

## 16. Responsive behaviour

- The player container is `max-w-5xl`, wider than the entry flow, so the reading
  split layout has room without becoming cramped.
- Reading questions use `grid gap-5 lg:grid-cols-2 lg:items-start`: the passage
  is on the left and the question on the right from the `lg` breakpoint, and the
  passage stacks above the question below it.
- On large screens the passage scrolls inside its own box
  (`lg:max-h-96 lg:overflow-y-auto`), so a long text cannot push Back and Next
  off screen.
- Navigation rows are `flex-col-reverse sm:flex-row`, so on mobile the primary
  action sits above Back and both stay reachable.
- The review list is a single column on mobile and two columns from `sm`. The
  list items carry `min-w-0` so a truncated French prompt cannot widen the grid
  track and cause horizontal scroll.

Verified with no horizontal page scroll at 390, 500, 768, 1000, 1366 and 1707
CSS pixels. At 1366x768 the whole reading screen, including Back and Next, fits
without scrolling.

`src/app/layout.tsx` was changed from `<main className="flex-1">` to
`<main className="flex flex-1 flex-col">` so the player can fill the remaining
page height with `flex-1` and short screens keep the assessment background
instead of leaving a white band above the footer. Pages that do not opt in stay
content sized, and the landing and intake pages render unchanged.

---

## 17. Accessibility

- semantic structure: `header`, `h1`, `h2`, `h3`, `section`, `ol`, `dl`
- each question is a real `fieldset` whose `legend` carries the instruction,
  prompt and note
- four real `input[type=radio]` in one named group, so arrow keys move between
  options and Space selects
- each radio is wrapped in a `label`, so the full option row is clickable
- selection is shown by the radio, a border change and a background change, not
  by colour alone
- the progress bar is a `role="progressbar"` with `aria-valuemin`,
  `aria-valuemax`, `aria-valuenow` and a readable `aria-valuetext`
  (`Question 3 of 20`)
- review items carry a descriptive `aria-label`
  (`Question 4, not answered. Go to this question.`), with the decorative
  duplicate text hidden from assistive technology
- the loading panel is `role="status"`, the failure panel is `role="alert"`
- focus moves to the stage region on every screen change
- the global `:focus-visible` outline from FA-01 gives every control a visible
  focus state
- all French content is marked `lang="fr"` so it is pronounced correctly

---

## 18. Migration instructions

Claude did not touch the remote Supabase project. Apply the migration manually.

1. Confirm the FA-02 migration
   (`20260904181600_fa_02_student_assessment_persistence.sql`) has already been
   applied. FA-03 raises a clear error if `public.assessments`,
   `public.assessment_attempts` or the `french-a1-diagnostic` row is missing.
2. Open the Supabase dashboard for the project.
3. Go to **SQL Editor** and open a new query.
4. Paste the full contents of
   `supabase/migrations/20260904190000_fa_03_a1_assessment_content.sql`.
   Make sure the paste keeps UTF-8 accents intact (`à`, `é`, `è`, `ê`, `ô`, `û`,
   `œ`, `«`, `»`). The file is UTF-8 encoded.
5. Run the query. Expect `INSERT 0 3`, `INSERT 0 3`, `INSERT 0 20` and no error.
   The migration ends with assertions that fail loudly if the counts are wrong.
6. Re-running the whole file is safe. Sections upsert on
   `(assessment_id, section_key)`, passages on `(assessment_id, passage_key)`,
   and questions on `(assessment_id, question_number)`, so the counts stay at
   3 / 3 / 20 and no duplicate content is created.
7. No environment variable changes are needed. FA-03 introduces no new
   configuration and no service-role key.

---

## 19. Verification SQL

Run in the Supabase SQL Editor after applying the migration.

```sql
-- 1. exactly 3 / 3 / 20
select
  (select count(*) from public.assessment_sections)  as sections,
  (select count(*) from public.assessment_passages)  as passages,
  (select count(*) from public.assessment_questions) as questions;

-- 2. question numbers run 1 to 20 and every question has four options
select min(question_number) as min_qn,
       max(question_number) as max_qn,
       count(distinct question_number) as distinct_numbers,
       count(*) filter (where jsonb_array_length(options) = 4) as with_four_options
from public.assessment_questions;

-- 3. section membership: grammar 1-8, vocabulary 9-14, reading 15-20
select s.section_key,
       min(q.question_number) as first_q,
       max(q.question_number) as last_q,
       count(*) as questions
from public.assessment_questions q
join public.assessment_sections s on s.id = q.section_id
group by s.section_key, s.position
order by s.position;

-- 4. reading questions are attached to the right passage
select q.question_number, p.passage_key, p.title
from public.assessment_questions q
join public.assessment_passages p on p.id = q.passage_id
order by q.question_number;

-- 5. option keys are exactly A, B, C, D in order (expect 0)
select count(*) as questions_with_bad_keys
from public.assessment_questions q
where (
  select array_agg(o ->> 'key' order by ord)
  from jsonb_array_elements(q.options) with ordinality as t(o, ord)
) is distinct from array['A','B','C','D'];

-- 6. no answer-key style columns exist (expect 0 rows)
select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and table_name in ('assessment_sections','assessment_passages','assessment_questions')
  and column_name ~* 'correct|answer|expected|score|percent';

-- 7. every option object holds only key and text (expect exactly: key, text)
select distinct k
from public.assessment_questions q,
     jsonb_array_elements(q.options) o,
     jsonb_object_keys(o) k;

-- 8. accents survived
select question_number, prompt
from public.assessment_questions
where question_number in (1, 6, 17);
select section_key, title_fr, description
from public.assessment_sections order by position;

-- 9. RLS on, no policies (expect relrowsecurity = t, policies = 0)
select c.relname, c.relrowsecurity,
       (select count(*) from pg_policy where polrelid = c.oid) as policies
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('assessment_sections','assessment_passages','assessment_questions')
order by c.relname;

-- 10. anon and authenticated hold no table privileges (expect 0 rows)
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('assessment_sections','assessment_passages','assessment_questions')
  and grantee in ('anon','authenticated','PUBLIC');

-- 11. the RPC is SECURITY DEFINER, STABLE, with a pinned search_path
select p.proname, p.prosecdef, p.provolatile, p.proconfig, p.proacl
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'get_french_assessment_content';

-- 12. the RPC refuses an unknown token (expect P0002)
select public.get_french_assessment_content(
  '00000000-0000-4000-8000-000000000000'::uuid
);

-- 13. with a real in-progress attempt token, the payload is complete.
--     Replace the uuid with a token from a test run.
select jsonb_array_length(c -> 'sections')  as sections,
       jsonb_array_length(c -> 'passages')  as passages,
       jsonb_array_length(c -> 'questions') as questions
from (
  select public.get_french_assessment_content('<attempt_token>'::uuid) as c
) s;

-- 14. the attempt is unchanged after fetching content
select status, started_at is not null as has_started_at,
       submitted_at, score, percentage
from public.assessment_attempts
where attempt_token = '<attempt_token>'::uuid;
```

The schema, seeds, RPC, RLS posture, privileges and every check above were
executed against a throwaway local PostgreSQL 17 cluster before hand-off, with
FA-02 applied first. The migration was applied twice to confirm idempotency.

---

## 20. Known limitations

1. **Answers are not persisted.** Selections live in React state only. FA-03
   deliberately does not write them to Supabase.
2. **A hard browser refresh loses the active answers**, and also loses the
   attempt token, which is held in memory by design and never placed in a URL.
   The flow restarts from Student Information. This is inherited from the FA-02
   session model and is not worked around here, because persisting answers
   purely to survive a refresh is out of scope.
3. **The assessment cannot be submitted.** The Submit Assessment button on the
   review screen is disabled. No path in FA-03 changes `status`, `started_at`,
   `submitted_at`, `score` or `percentage`.
4. **No scoring, no results, no benchmark.** Nothing in FA-03 evaluates an
   answer, and no correct-answer data exists to evaluate against.
5. **Content is fetched once per player mount.** There is no caching layer and
   no revalidation. That is adequate for a 20 question assessment.
6. **Section introductions are shown once per session.** Moving back and forward
   over a boundary does not replay them.
7. **FA-02 seeded `assessments.title_fr` without accents**
   (`Evaluation Diagnostique de Francais`). FA-03 does not modify the FA-02
   assessment row, so the player displays it as stored. Correcting it is a
   one line update that belongs to whoever owns that row, not to FA-03.

---

## 21. What FA-04 will add

FA-04 owns everything FA-03 deliberately left out:

1. **Answer persistence** - an `assessment_answers` table (attempt id, question
   id, selected option key) written through a controlled RPC that requires the
   same in-progress attempt token.
2. **The answer key** - correct-answer data introduced behind a server-side
   boundary. It must never be readable by `anon`, must never appear in a content
   payload, and must never reach the browser bundle. The FA-03 content RPC and
   the `options` check constraints are designed so adding a key cannot leak
   through them.
3. **Final submission** - activating the Submit Assessment button, moving the
   attempt to `submitted` and setting `submitted_at`.
4. **Server-side scoring** - computing `score` and `percentage` in the database,
   never in the browser.
5. **Benchmark evaluation** - the 60 percent benchmark already stored in
   `assessments.benchmark_percent`.
6. **The result screen** - the first place any correctness, score or percentage
   is shown to a student.

### Hand-off contract

What FA-04 can rely on from FA-03:

- `public.assessment_sections`, `public.assessment_passages` and
  `public.assessment_questions` exist, seeded with 3 / 3 / 20 rows for
  `french-a1-diagnostic`, with RLS on and no anonymous table access.
- `public.get_french_assessment_content(uuid)` is the single content read path.
  It is read only and safe to call repeatedly.
- `assessment_questions.id` is the stable question identifier and
  `question_number` runs 1 to 20. Use the question `id` as the answer foreign
  key.
- The answer value is the option key: the single characters `A`, `B`, `C` or
  `D`. Never store or compare option display text.
- `getFrenchAssessmentContent(attemptToken)` in
  `src/lib/actions/assessment.ts` is the server boundary to extend. Follow the
  same pattern: revalidate the token with Zod, call the RPC, parse the response,
  return a generic failure message and log a PII free marker.
- The client answer map in `AssessmentPlayer` is
  `Record<questionId, "A" | "B" | "C" | "D">`. That is the exact payload shape
  a persistence action should accept.
- `ReviewAnswers` already receives `questions`, `answers` and `summary`. Turning
  on submission means enabling its Submit Assessment button and wiring an
  `onSubmit` prop, not restructuring the screen.
- The attempt arrives at the review screen as `in_progress` with `submitted_at`,
  `score` and `percentage` all null. FA-04 owns the transition out of that
  state.
