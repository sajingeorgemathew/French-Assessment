# FA-04 - A1 Answer Key Review

Toronto Academy of Education
French Language Evaluation and Diagnostic Assessment
CEFR / CECRL Level A1

Internal project documentation. This file is not published to students and is
not read by any application code.

Seeded by: `supabase/migrations/20260905073000_fa_04_submission_scoring_results.sql`
Stored in: `private.assessment_answer_keys`

---

## 1. Why this document exists

FA-04 makes the database the authoritative scoring boundary. Every score the
system produces is decided by the twenty rows in
`private.assessment_answer_keys`, so the correctness of those twenty rows is the
correctness of the assessment.

The supplied source material explicitly confirms the answer for **Question 1
only**. The remaining nineteen answers are the project's current working key,
inferred from the supplied question content. They are good enough to build,
test and demonstrate the full submission and scoring lifecycle, and they are
**not** yet approved for production use.

This file is the review sheet. An instructor or the project owner must confirm
or correct Questions 2 to 20 before the assessment is used with real students.

---

## 2. Working answer key

Answers are stored as the stable option key (A/B/C/D), never as the visible
option text, so re-wording an option never silently changes what is correct.

| Question | Working correct option | Verification status |
| --- | --- | --- |
| 1 | B | Source confirmed |
| 2 | C | Instructor review required before production |
| 3 | B | Instructor review required before production |
| 4 | A | Instructor review required before production |
| 5 | B | Instructor review required before production |
| 6 | D | Instructor review required before production |
| 7 | A | Instructor review required before production |
| 8 | B | Instructor review required before production |
| 9 | C | Instructor review required before production |
| 10 | C | Instructor review required before production |
| 11 | B | Instructor review required before production |
| 12 | A | Instructor review required before production |
| 13 | C | Instructor review required before production |
| 14 | B | Instructor review required before production |
| 15 | B | Instructor review required before production |
| 16 | C | Instructor review required before production |
| 17 | B | Instructor review required before production |
| 18 | B | Instructor review required before production |
| 19 | B | Instructor review required before production |
| 20 | B | Instructor review required before production |

Total seeded rows: **20**
Source confirmed: **1** (Question 1)
Awaiting instructor review: **19** (Questions 2 to 20)

---

## 3. Source status, stated plainly

**Question 1 is source confirmed.** The supplied answer-key content explicitly
records B.

**Questions 2 to 20 are not source confirmed.** The supplied material did not
include an answer-key section for them. The values above were derived from the
question content itself and represent the project's current working position.
They must not be described, reported or presented as source confirmed until an
instructor has signed them off.

---

## 4. How to review

The reviewer needs the question text, which lives in
`public.assessment_questions`. Read it with the questions in order:

```sql
select q.question_number,
       q.category,
       q.instruction,
       q.prompt,
       q.note,
       q.options
from public.assessment_questions q
join public.assessments a on a.id = q.assessment_id
where a.slug = 'french-a1-diagnostic'
order by q.question_number;
```

To see the questions alongside the working key, and the visible text of the
option the key currently selects:

```sql
select q.question_number,
       k.correct_option_key,
       (
         select o ->> 'text'
         from jsonb_array_elements(q.options) as o
         where o ->> 'key' = k.correct_option_key
       ) as correct_option_text,
       q.prompt
from public.assessment_questions q
join public.assessments a on a.id = q.assessment_id
join private.assessment_answer_keys k on k.question_id = q.id
where a.slug = 'french-a1-diagnostic'
order by q.question_number;
```

Run these in the Supabase SQL editor, which connects as a privileged role.
`anon` and `authenticated` cannot run either query.

---

## 5. How to record a correction

Do not edit
`supabase/migrations/20260905073000_fa_04_submission_scoring_results.sql`.
It is an applied migration, and re-running it would overwrite all twenty rows
with the working key again.

Record confirmed corrections in a **new** migration, so every environment picks
them up in the same way:

```sql
-- Example: instructor review corrected question 7 to C.
with target as (
  select a.id as assessment_id
  from public.assessments a
  where a.slug = 'french-a1-diagnostic'
)
update private.assessment_answer_keys k
   set correct_option_key = 'C'
from public.assessment_questions q, target t
where q.id = k.question_id
  and q.assessment_id = t.assessment_id
  and q.question_number = 7;
```

Then update the table in section 2 of this file: change the option if it
changed, and change the status to `Instructor confirmed`.

---

## 6. Effect of a correction on existing results

Answer keys are read at submission time only. Correcting a key changes how
**future** submissions are scored. It does not retroactively change
`public.assessment_answers`, `assessment_attempts.score` or
`assessment_attempts.percentage` for attempts that were already submitted, by
design: a submitted attempt is immutable.

If a key is corrected after real students have submitted, the affected attempts
need a deliberate, separately reviewed rescore. That is out of scope for FA-04
and is another reason to complete this review before production.

---

## 7. Sign-off

| Field | Value |
| --- | --- |
| Reviewed by | _pending_ |
| Review date | _pending_ |
| Questions confirmed | _pending_ |
| Questions corrected | _pending_ |
| Approved for production | **No** |

FA-04 is complete as an engineering deliverable. The assessment is not
production ready until this section is filled in.
