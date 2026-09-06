# FA-06 Admin Results Management and Individual Assessment Review

Toronto Academy of Education - French Language Evaluation and Diagnostic
Assessment.

FA-06 turns the FA-05 admin foundation into a working staff review tool: a
searchable, filterable, paginated list of completed assessments, and a full
per-question review of any single submitted attempt.

Everything in FA-06 is read only. There is no editing, no deletion and no
mutation anywhere in the ticket.

---

## 1. Purpose

Toronto Academy staff need to be able to:

- find a student by name, email address or phone number
- see who has completed the French A1 diagnostic
- see each student's score, percentage and benchmark status
- open one assessment attempt
- review all 20 stored responses, with the selected answer, the correct answer
  and the correct/incorrect/unanswered state

FA-06 delivers exactly that and nothing else. It creates no new table, no new
authentication system and no new environment variable.

The authorization created by FA-05 is reused unchanged. See
`docs/admin/fa-05-admin-auth-dashboard.md` for the authentication model that
sits underneath everything described here.

---

## 2. Results route

Route: `/admin/results`

File: `src/app/admin/(protected)/results/page.tsx`

It lives inside the existing FA-05 protected route group, so
`requireFrenchAssessmentAdmin()` in `src/app/admin/(protected)/layout.tsx` runs
before any markup is produced.

Page title: **Assessment Results**
Supporting text: "Search and review completed French assessments."

The page shows submitted attempts only. Registered and in-progress attempts are
deliberately absent: there is no finalized response snapshot to review for them,
and the FA-05 dashboard already reports their operational counts.

Columns, on laptop and desktop:

| Column | Source |
| --- | --- |
| Student | `students.full_name`, linked to the detail route |
| Email | `students.email` |
| Phone | `students.phone` |
| Status in Canada | `students.status_in_canada` |
| Level | `assessments.level` |
| Score | `assessment_attempts.score` over `assessments.total_questions` |
| Percentage | `assessment_attempts.percentage` |
| Benchmark | derived in the database from `assessments.benchmark_percent` |
| Submitted | `assessment_attempts.submitted_at` |

Below the `lg` breakpoint the same rows render as stacked cards, so nine columns
never force horizontal page scrolling on a tablet or a phone.

---

## 3. Result detail route

Route: `/admin/results/[attemptId]`

File: `src/app/admin/(protected)/results/[attemptId]/page.tsx`

`attemptId` is `public.assessment_attempts.id`, the internal UUID. It is **not**
`assessment_attempts.attempt_token`. The attempt token is the student's browser
facing secret and never appears in an admin URL, an admin link or an admin RPC
payload.

The route parameter is validated as a UUID in the application before the
database is called. A parameter that is not a UUID resolves to `notFound()`.

Three different situations resolve to the same clean not-found:

1. the route parameter is not a UUID
2. the attempt does not exist
3. the attempt exists but is not a submitted `french-a1-diagnostic` attempt

The database returns one indistinguishable answer, SQL `NULL`, for cases 2 and
3, so the route cannot be used to probe whether a particular attempt id exists.

A transport or authorization failure is a different outcome and renders the
generic administrator error instead. No raw SQL or Supabase message is ever
shown.

---

## 4. Search behaviour

The search field is a plain `GET` form that navigates to
`/admin/results?q=...`. It works with the keyboard, works without JavaScript,
keeps the current view bookmarkable, and adds nothing to the browser bundle.

The search term is matched, case insensitively, against:

- `students.full_name`
- `students.email`
- `students.phone`

Phone matching is done twice: once as ordinary text, and once against a
digits-only form of both the stored phone number and the search term, so
`416 555 0123`, `4165550123` and `(416) 555-0123` all find each other.

Input handling:

- the term is trimmed
- the term is truncated to 120 characters, in the application and again in the
  RPC
- the term is escaped for `LIKE` before it becomes a pattern: the escape
  character `!`, then `%`, then `_`, so a search term can never behave as a
  wildcard
- searching always returns to page one

All searching happens in the database. The browser never receives more than one
page of results, and the full result set is never loaded into the application.

There is no dynamic SQL anywhere in FA-06. Both functions are a single static
statement each, and no user input is ever concatenated into a statement.

---

## 5. Benchmark filtering

Three values are offered:

| URL value | Label | Meaning |
| --- | --- | --- |
| `all` | All Results | no benchmark filter |
| `met` | Benchmark Met | `percentage >= assessments.benchmark_percent` |
| `below` | Below Benchmark | `percentage < assessments.benchmark_percent` |

The benchmark comes from the attempt's own `public.assessments` row. It is not
hardcoded in the browser, and it is not hardcoded in the SQL. The A1 diagnostic
currently uses 60 percent, but changing that row changes the filter, the badge
and the detail page together.

Unrecognised filter values, including a hand edited URL, are normalized to `all`
rather than rejected, so a tampered URL degrades to the safe default instead of
producing an error.

Staff facing labels are the neutral operational words **Met** and **Below**.
This is a diagnostic assessment, so PASS and FAIL are deliberately not used.

Search and benchmark filtering combine: both conditions apply to the same query.

---

## 6. Pagination

- 25 results per page
- maximum request limit 100, clamped inside the RPC
- ordering is `submitted_at desc, id desc`, so the sort is newest first and
  deterministic
- the page number travels in the URL as `?page=`
- paging is server side: each control is a link that re-runs the query with a
  new offset

The list shows "Showing 1 to 25 of 63 results" and simple Previous / Next
controls. When every result fits on a single page the pagination component
renders nothing at all, so staff are never shown controls that suggest more data
exists.

A page number past the end of the current result set renders a short
"This page is past the end of the current results" state with a link back to
page one, rather than the misleading "no completed assessments yet" empty state.

Page numbers from the URL are clamped to 100000, so a hand edited URL cannot
overflow the PostgreSQL `integer` offset parameter.

---

## 7. Results list RPC

```
public.get_french_admin_results(
  p_search text default null,
  p_benchmark_filter text default 'all',
  p_limit integer default 25,
  p_offset integer default 0
) returns jsonb
```

`SECURITY DEFINER`, `STABLE`, `language plpgsql`,
`set search_path = pg_catalog, public, pg_temp`.

Order of operations:

1. `private.is_active_french_admin()` is checked. If it is not true the function
   raises `admin_authorization_required` with SQLSTATE `42501` and reads nothing.
2. Inputs are normalized into PL/pgSQL variables (search escaped and truncated,
   filter matched against an allow list, limit clamped to 1..100, offset clamped
   to >= 0).
3. One static statement runs. A `base` CTE is the single definition of "which
   attempts match", so the returned page and the total count can never disagree,
   including when the offset runs past the end of the set.

Response shape:

```json
{
  "results": [
    {
      "attempt_id": "uuid",
      "student_full_name": "text",
      "student_email": "text",
      "student_phone": "text",
      "city": "text or null",
      "status_in_canada": "text or null",
      "current_french_level": "text or null",
      "french_learning_goal": "text or null",
      "assessment_title": "text",
      "assessment_level": "text",
      "score": 15,
      "total_questions": 20,
      "percentage": 75,
      "benchmark_percent": 60,
      "benchmark_met": true,
      "started_at": "timestamptz or null",
      "submitted_at": "timestamptz"
    }
  ],
  "total_count": 63,
  "limit": 25,
  "offset": 0
}
```

The payload never contains `attempt_token`, answer rows, correct answers,
private answer-key records, administrator identity data or auth tokens.

---

## 8. Result detail RPC

```
public.get_french_admin_attempt_detail(p_attempt_id uuid) returns jsonb
```

`SECURITY DEFINER`, `STABLE`, `language plpgsql`,
`set search_path = pg_catalog, public, pg_temp`.

Order of operations:

1. `private.is_active_french_admin()` is checked. Not true raises `42501`.
2. A null `p_attempt_id` returns `NULL`.
3. The attempt must exist, belong to `french-a1-diagnostic`, have status
   `submitted` and have a `submitted_at`. All three checks are resolved in one
   query, and any failure returns `NULL`.
4. The attempt summary, student information and assessment configuration are
   built, including the benchmark comparison.
5. The complete stored response review is built.
6. Integrity counters are added.

Response shape:

```json
{
  "attempt": {
    "attempt_id": "uuid",
    "status": "submitted",
    "score": 15,
    "percentage": 75,
    "started_at": "timestamptz or null",
    "submitted_at": "timestamptz"
  },
  "student": {
    "full_name": "text",
    "email": "text",
    "phone": "text",
    "city": "text or null",
    "status_in_canada": "text or null",
    "current_french_level": "text or null",
    "french_learning_goal": "text or null"
  },
  "assessment": {
    "slug": "french-a1-diagnostic",
    "title": "text",
    "title_fr": "text or null",
    "framework": "text",
    "level": "text",
    "total_questions": 20,
    "benchmark_percent": 60
  },
  "benchmark_met": true,
  "responses": [
    {
      "question_id": "uuid",
      "question_number": 1,
      "section_key": "grammar",
      "section_title": "Conjugation and Grammar",
      "section_title_fr": "Partie A : Conjugaison et Grammaire",
      "section_position": 1,
      "category": "text or null",
      "instruction": "text or null",
      "prompt": "text",
      "note": "text or null",
      "passage_title": "text or null",
      "passage_body": "text or null",
      "selected_option_key": "A, B, C, D or null",
      "selected_option_text": "text or null",
      "correct_option_key": "A, B, C or D",
      "correct_option_text": "text",
      "is_correct": true
    }
  ],
  "integrity": {
    "stored_answer_count": 20,
    "correct_answer_count": 15
  }
}
```

No field in this payload is `attempt_token`.

---

## 9. Authorization model

Unchanged from FA-05, and layered:

1. **Proxy** (`src/proxy.ts`) redirects anonymous `/admin` requests to the login
   page. Optimistic session check only.
2. **Protected layout** runs `requireFrenchAssessmentAdmin()`, which re-validates
   the session against Supabase Auth and then asks the database
   `public.is_french_assessment_admin()`.
3. **The database** is the real boundary. Both FA-06 RPCs call
   `private.is_active_french_admin()` themselves, from `auth.uid()`, before they
   read a single protected row.

Authentication alone is not authorization. A signed in Supabase Auth user with
no active `public.admin_users` row gets `42501` from both functions, even if they
call PostgREST directly with a valid access token and bypass the application
entirely.

Neither function accepts a caller supplied user id, so no caller can claim
another person's identity.

`SECURITY DEFINER` safeguards used by both functions:

- explicit `search_path` with `pg_temp` pinned last
- every object reference schema qualified, including the private ones
- no dynamic SQL and no `EXECUTE`
- the admin check runs before any PII or result is read
- only the required fields are returned
- `EXECUTE` revoked from `public` and `anon`, granted to `authenticated` only

### Grants and revokes

```sql
revoke all on function public.get_french_admin_results(text, text, integer, integer) from public;
revoke all on function public.get_french_admin_results(text, text, integer, integer) from anon;
grant execute on function public.get_french_admin_results(text, text, integer, integer) to authenticated;

revoke all on function public.get_french_admin_attempt_detail(uuid) from public;
revoke all on function public.get_french_admin_attempt_detail(uuid) from anon;
grant execute on function public.get_french_admin_attempt_detail(uuid) to authenticated;
```

The migration ends with a `DO` block that asserts these privileges, and asserts
that `anon` and `authenticated` still have no direct table access to
`private.assessment_answer_keys`, `public.assessment_answers`,
`public.assessment_attempts` or `public.students`, and no `USAGE` on schema
`private`. The migration refuses to commit if any of that is untrue.

---

## 10. PII handling

The results list and the detail page both show real student contact details:
full name, email address, phone number, city and status in Canada. That is the
point of the feature, and staff need it to follow up.

Controls around it:

- both payloads are produced only for a verified active administrator
- `/admin` routes are `noindex, nofollow` and are always rendered per request,
  never prerendered and never cached
- server logs record short, PII free markers only, for example
  `[admin] results failed: rpc error code 42501`. No student name, email, phone
  or search term is ever logged
- no student PII appears in any error message shown to staff
- the only values FA-06 places in a URL are the search term, the benchmark filter
  name, the page number and the internal attempt UUID

Admin search terms in the protected admin URL are acceptable and intentional, so
a search result stays shareable between staff.

---

## 11. Answer-key handling

The FA-04 answer key lives in `private.assessment_answer_keys`. FA-06 did not
move it, copy it or widen access to it.

What FA-06 does:

- joins `private.assessment_answer_keys` in exactly one place, inside
  `public.get_french_admin_attempt_detail`, after the active administrator check
  has passed, and only for the one submitted attempt that was asked for

What FA-06 deliberately does not do:

- no answer-key constants in TypeScript, React or any client bundle
- no correct answers moved into `public.assessment_questions`
- no function that returns the answer-key table
- no direct private schema access for `anon` or `authenticated`
- no correct answers on any public or student facing route

The option text shown next to a correct option key is resolved from the
question's own `options` array, so an administrator always sees the key beside
the exact wording the student saw. The key itself remains the stable A/B/C/D
value, so re-wording an option never silently changes what is correct.

---

## 12. Detailed answer review

The review renders `public.assessment_answers` exactly as FA-04 finalized it. It
is a snapshot, not a recalculation:

- correctness comes from the stored `is_correct` column
- the score and percentage come from the stored attempt columns
- nothing is recomputed in React, and no answer is compared to a key in
  TypeScript

Responses are grouped into the three assessment parts, using the French section
titles from `public.assessment_sections`:

- Partie A : Conjugaison et Grammaire
- Partie B : Vocabulaire de la Vie Quotidienne
- Partie C : Compréhension Écrite

Section order follows `assessment_sections.position` and question order follows
`question_number`, both from the database. Nothing assumes how many questions a
section holds, so a future content change reorders the review correctly with no
code change.

Each question card shows:

- question number
- category, when the question has one
- instruction, when the question has one
- the question prompt
- the note, when the question has one
- the reading passage, when the question has one
- the student's selected option key and text
- the correct option key and text
- a Correct / Incorrect / Not answered status

### Correctness is never colour alone

Each card carries three independent signals:

1. the word **Correct**, **Incorrect** or **Not answered** in a chip
2. an icon with a distinct shape (check, cross, minus)
3. a coloured left border

The text label is always present, so the state survives greyscale printing,
colour vision differences and a screen reader.

---

## 13. Unanswered responses

FA-04 stores an unanswered question as a real row with `selected_option_key`
null and `is_correct` false, and a database CHECK constraint makes it impossible
for an unanswered row to be stored as correct.

FA-06 renders that state as **Not answered**, in the amber neutral treatment,
with the text "Not answered" in the Student answer field rather than an empty
field. The correct answer is still shown, so staff can see what was missed.

---

## 14. Score integrity behaviour

The detail RPC returns `integrity.correct_answer_count`, a live count of stored
rows where `is_correct` is true, alongside the stored `attempt.score`.

If they differ, the page shows a small administrator-facing warning naming both
numbers. The stored score is still displayed unchanged, and is still treated as
authoritative.

FA-06 never overwrites, recalculates or repairs a historical score.

---

## 15. Response integrity behaviour

The detail RPC returns `integrity.stored_answer_count`, and the assessment
configuration supplies `total_questions`.

A properly submitted A1 assessment has 20 stored `assessment_answers` rows. If
the stored count differs from `total_questions`, the page shows:

> Stored response data is incomplete for this assessment. N of 20 expected
> responses are recorded. The responses below are exactly what was stored at
> submission; nothing has been added or changed.

FA-06 does not fabricate a missing response, does not insert a placeholder row
and does not alter the attempt. The review simply shows the rows that exist.

Both warnings render together in one amber notice above the summary cards when
both conditions apply.

---

## 16. Dashboard integration

`src/components/admin/AdminRecentSubmissions.tsx` is unchanged apart from one
thing: each student name in the recent submissions table is now a link to
`/admin/results/[attemptId]`, built from `attempt_id`, which the FA-05 dashboard
RPC already returned.

The dashboard was not redesigned. No metric calculation changed, no column
changed and no RPC changed.

The link uses the student's name as its text, so its purpose is clear when read
out of context, and carries an `aria-label` naming the student.

---

## 17. Admin navigation

`src/components/admin/AdminShell.tsx` now delegates its navigation to a new
`src/components/admin/AdminNavigation.tsx`.

Functional items after FA-06:

- **Dashboard** -> `/admin`
- **Results** -> `/admin/results`

Sign Out is unchanged and still functional.

The FA-05 disabled "Students" and "Results" placeholders are gone. Every item in
the navigation is now a real route, so staff never click something that cannot
work. A Students area can be added by a later ticket as a real link.

`AdminNavigation` is the only client component in the admin shell. It exists
solely to read the current path with `usePathname()` so the active item can be
marked with `aria-current="page"`. It takes no props, holds no state and reads no
data. The detail route `/admin/results/[attemptId]` keeps **Results** marked as
the current section.

---

## 18. Migration steps

Migration file:

```
supabase/migrations/20260905140000_fa_06_admin_results_review.sql
```

The FA-02, FA-03, FA-04 and FA-05 migrations are unchanged. FA-06 creates no
table, no policy and no view.

It creates:

- `public.get_french_admin_results(text, text, integer, integer)`
- `public.get_french_admin_attempt_detail(uuid)`
- one partial index, `assessment_attempts_submitted_at_idx`
- the grants and revokes above
- a dependency guard and a final privilege assertion

### Applying it

1. Open the Supabase dashboard for the project.
2. Go to **SQL Editor** and open a new query.
3. Paste the entire contents of
   `supabase/migrations/20260905140000_fa_06_admin_results_review.sql`.
4. Run it.
5. Confirm it completes with no error. The dependency guard raises a clear
   message if FA-02 to FA-05 have not been applied, and the closing privilege
   assertion raises if any boundary is wrong.

The migration is safely re-runnable.

No new environment variable is required. No new Supabase Auth user is required
if FA-05 administrator provisioning is complete. No service-role credential is
used or requested anywhere in FA-06.

---

## 19. Verification SQL

Run these in the Supabase SQL Editor after applying the migration.

**Both functions exist, with the right security settings:**

```sql
select p.proname,
       p.prosecdef as security_definer,
       p.provolatile,
       p.proconfig
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('get_french_admin_results', 'get_french_admin_attempt_detail')
order by p.proname;
```

Expect `security_definer = true`, `provolatile = 's'` and
`proconfig = {search_path=pg_catalog, public, pg_temp}` for both.

**Execute privileges are correct:**

```sql
select has_function_privilege('anon',
         'public.get_french_admin_results(text, text, integer, integer)', 'EXECUTE')
         as anon_results,
       has_function_privilege('anon',
         'public.get_french_admin_attempt_detail(uuid)', 'EXECUTE')
         as anon_detail,
       has_function_privilege('authenticated',
         'public.get_french_admin_results(text, text, integer, integer)', 'EXECUTE')
         as auth_results,
       has_function_privilege('authenticated',
         'public.get_french_admin_attempt_detail(uuid)', 'EXECUTE')
         as auth_detail;
```

Expect `false, false, true, true`.

**The private schema was not widened:**

```sql
select has_schema_privilege('anon', 'private', 'USAGE') as anon_schema,
       has_schema_privilege('authenticated', 'private', 'USAGE') as auth_schema,
       has_table_privilege('authenticated',
         'private.assessment_answer_keys', 'SELECT') as auth_keys,
       has_table_privilege('authenticated',
         'public.assessment_answers', 'SELECT') as auth_answers,
       has_table_privilege('authenticated',
         'public.students', 'SELECT') as auth_students;
```

Expect `false` for every column.

**No new policies were added:**

```sql
select schemaname, tablename, policyname
from pg_policies
where schemaname in ('public', 'private')
order by tablename;
```

Expect zero rows. Every FA-02 to FA-06 table is RLS enabled with no policies.

**The supporting index exists:**

```sql
select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'assessment_attempts'
  and indexname = 'assessment_attempts_submitted_at_idx';
```

**Authorization actually blocks a non-admin.** Run as an anonymous SQL Editor
session or with an access token for a user with no `admin_users` row:

```sql
select public.get_french_admin_results(null, 'all', 25, 0);
```

Expect `permission denied` (anon has no EXECUTE), or SQLSTATE `42501` with
`admin_authorization_required` for an authenticated non-admin.

**Data sanity, run as the postgres role in the SQL Editor:**

```sql
-- Submitted attempts that the results list will show.
select count(*)
from public.assessment_attempts a
join public.assessments s on s.id = a.assessment_id
where a.status = 'submitted'
  and a.submitted_at is not null
  and s.slug = 'french-a1-diagnostic';

-- Response row counts per submitted attempt. Every row should read 20.
select a.id as attempt_id,
       a.score,
       count(ans.id) as stored_answers,
       count(*) filter (where ans.is_correct) as correct_answers
from public.assessment_attempts a
left join public.assessment_answers ans on ans.attempt_id = a.id
where a.status = 'submitted'
group by a.id, a.score
order by a.submitted_at desc;
```

Any row where `stored_answers` is not 20, or where `score` differs from
`correct_answers`, is exactly what the on-page integrity warnings report.

**No attempt token is in either payload.** Run as postgres, substituting a real
submitted attempt id:

```sql
select public.get_french_admin_attempt_detail('00000000-0000-0000-0000-000000000000'::uuid)::text
       like '%attempt_token%' as leaks_token;
```

Expect `false`, or `NULL` for an id that does not resolve.

---

## 20. Browser testing steps

Start the app with `npm run dev`.

**Public regression, signed out (use a private window):**

1. Open `/`. The landing page renders with no redirect to a login page.
2. Open `/assessment`. Student registration renders.
3. Register, click Begin Assessment, answer the 20 questions, review and submit.
4. The student completion result renders. No correct answers and no answer key
   appear anywhere in the student flow.
5. Open `/admin/results` while signed out. You are redirected to `/admin/login`.
6. Open `/admin/results/<any-uuid>` while signed out. You are redirected to
   `/admin/login`.

**Admin, signed in as an active administrator:**

7. Sign in at `/admin/login`. The dashboard renders.
8. The sidebar shows Dashboard and Results, both working, plus Sign Out. There
   is no disabled placeholder.
9. Click a student name in Recent Submissions. The result detail page opens.
   Check the browser address bar: the URL contains a UUID, and it is the attempt
   id, not the attempt token.
10. Click Back to Results. The results list opens.
11. Click Results in the sidebar. It is highlighted and marked as the current
    page.
12. Search a partial student name. Results narrow. The URL shows `?q=`.
13. Search a partial email address. Results narrow.
14. Search a phone number with spaces or dashes, then without them. Both find
    the same student.
15. Search a term that matches nothing. "No assessment results match your
    current search." renders, and the filters stay populated.
16. Click Clear. The full list returns on a clean `/admin/results` URL.
17. Set the benchmark filter to Benchmark Met, then Below Benchmark. The list
    changes and the badges match the filter.
18. Combine a search term with a benchmark filter. Both apply.
19. With more than 25 submitted results, use Next and Previous. The URL page
    number changes and the "Showing X to Y of Z" line updates. With 25 or fewer
    results, no pagination controls appear.
20. Open a result detail page. Confirm student information, the assessment
    summary, and 20 question cards grouped into Partie A, Partie B and Partie C,
    numbered 1 to 20 in order.
21. Confirm each card shows the student answer, the correct answer and a
    Correct / Incorrect / Not answered label in words, not only a colour.
22. On a question in Partie C, expand Reading text and confirm the passage is
    readable without leaving the page.
23. If the student skipped a question, confirm it reads "Not answered" rather
    than an empty field, and still shows the correct answer.
24. Open `/admin/results/not-a-uuid`. The 404 page renders.
25. Open `/admin/results/00000000-0000-0000-0000-000000000000`. The 404 page
    renders.
26. Find an attempt whose status is `registered` or `in_progress` in the
    database, and open its id at `/admin/results/<id>`. The 404 page renders:
    unsubmitted attempts are never exposed by the detail route.
27. Resize to 1366x768, 1440x900 and 1536x864. The table fits with no horizontal
    page scrolling.
28. Resize to a phone width. The table becomes stacked cards and the page still
    does not scroll horizontally.
29. Tab through the search field, the benchmark select, the Search button and
    the result links. Focus is visible on each.
30. Sign Out still works and returns to the login page.

---

## 21. Security notes

- Both FA-06 RPCs verify `private.is_active_french_admin()` before reading
  anything. Route protection is not relied on.
- `anon` cannot execute either function.
- An authenticated non-admin receives `42501` and no data.
- No `attempt_token` is accepted as input, returned in a payload, or placed in a
  URL.
- No public answer-key access was introduced. The private schema keeps `USAGE`
  revoked from `anon` and `authenticated`.
- Correct answers appear only inside the protected attempt detail response for
  one submitted attempt.
- No service-role key exists anywhere in the project. The admin client uses the
  same publishable key as the public flow and gains authority only from the
  signed in user's session.
- No broad `SELECT` policy was added to any table. FA-06 added no policy at all.
- Public student routes remain public and unauthenticated. The proxy matcher
  still covers `/admin` only.
- No raw database or Supabase error reaches the browser. Failures render the
  shared generic administrator message.
- No administrator password handling was added or changed.
- `.env.local` was not read, not modified and remains git ignored.
- FA-06 is read only. There is no server action, no form POST and no mutation in
  any FA-06 file.

---

## 22. Known limitations

1. **A1 only.** Both RPCs are scoped to the `french-a1-diagnostic` slug. That
   keeps the list and the detail route consistent with each other, since detail
   review is A1 only by design. A second assessment would need the scope widened
   in a new migration.
2. **Search is a substring scan.** With no trigram extension, `ILIKE '%term%'`
   cannot use an index. That is comfortably fast at the current data volume; a
   `pg_trgm` index would be the fix at tens of thousands of rows.
3. **Offset pagination.** Deep pages re-scan the preceding rows. Fine for a
   staff tool at this scale; keyset pagination would be the fix if it ever
   matters.
4. **No export.** There is no CSV or PDF download of a result or of the list.
5. **No sorting controls.** Ordering is always newest submitted first.
6. **No date range filter.** Only search and benchmark filtering exist.
7. **No student-centric view.** A student with several attempts appears once per
   attempt. There is no per-student history page.
8. **Integrity warnings are advisory.** They report a mismatch and never repair
   it. Correcting historical data is a deliberate manual database operation.
9. **Answer key review still pending.** As recorded in
   `docs/assessment/fa-04-answer-key-review.md`, questions 2 to 20 use the
   project's working key and need instructor review. The correct answers shown
   in the FA-06 review are only as good as that key.

---

## 23. FA-07 handoff

FA-06 implements no FA-07 functionality.

Likely FA-07 scope is assessment invitation links and controlled invitation
tracking:

- generate an assessment invitation
- unique invitation link and token
- invitation status
- student prefill from an invitation
- invitation expiry
- an admin invitation list

Useful starting points left by FA-06:

- `public.get_french_admin_results` is the pattern to copy for any new admin
  list RPC: admin check first, allow-listed filter values, clamped paging, one
  static statement, `{ results, total_count, limit, offset }` response.
- `src/lib/admin/admin-results.ts` is the pattern for a pure, client-safe module
  of Zod schemas, parsers and URL helpers, paired with a server-only loader in
  `src/lib/admin/results.ts`.
- `AdminNavigation` takes a flat array of real routes. An Invitations item is a
  one line addition once the route exists.
- The `GET` form filter pattern in `AdminResultsFilters` gives searchable,
  bookmarkable, JavaScript-free list filtering and is worth reusing.

Items intentionally left open for a later ticket:

- a Students area, listing students rather than attempts
- CSV export of the results list
- date range filtering
- `pg_trgm` backed search if data volume grows
- an instructor review pass over the FA-04 answer key
