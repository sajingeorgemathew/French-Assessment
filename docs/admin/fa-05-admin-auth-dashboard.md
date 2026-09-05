# FA-05 Admin Authentication and Dashboard Foundation

Toronto Academy of Education - French Language Evaluation and Diagnostic Assessment

This document describes the FA-05 administration foundation: how a member of
staff signs in, how the application decides whether that person is allowed into
the French Assessment admin area, what the dashboard shows, and how the first
administrator is created.

No password, no environment value and no secret appears anywhere in this
document or in any file FA-05 added.

## 1. Purpose of FA-05

FA-01 to FA-04 built the public student experience: registration, the twenty
question A1 assessment, protected answer keys, secure scoring and the student
result screen. None of that requires a login and none of it changes in FA-05.

The database now holds student PII and assessment results, so FA-05 adds the
internal side:

- Supabase Auth based administrator authentication
- an explicit application authorization record, separate from the auth account
- server protected `/admin` routes
- an administrator sign in page and a real sign out action
- an internal Toronto Academy admin shell
- a summary dashboard with recent submitted assessments
- a secure, admin only dashboard RPC
- a manual first administrator provisioning process

FA-05 deliberately does not build attempt detail pages, per question review,
student editing, admin management UI, password reset or invitations.

## 2. Supabase Auth architecture

Supabase Auth owns credentials. The application never stores a password, never
hashes a password and never creates a password table.

- Sign in method: email and password (`supabase.auth.signInWithPassword`)
- Session transport: cookies, handled entirely by `@supabase/ssr`
- Session verification: `supabase.auth.getUser()`, which re-validates against
  the Supabase Auth server rather than trusting the cookie payload
- Keys used: `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (with the legacy
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` accepted as a fallback)

There is no service-role key in the project. The admin client uses the same
public publishable key as the student flow and gains its authority only from
the signed in user's session, which the database then checks for itself.

### Two Supabase clients, kept apart

| Client | File | Used by | Session |
| --- | --- | --- | --- |
| Public assessment client | `src/lib/supabase/server.ts` | student registration, begin, content, submission | none, stateless |
| Admin auth client | `src/lib/supabase/auth-server.ts` | `/admin` routes, admin actions, proxy | cookie backed |

`src/lib/supabase/server.ts` was not modified by FA-05. It still builds a
single cached, stateless client with `persistSession: false`,
`autoRefreshToken: false` and `detectSessionInUrl: false`. The public
assessment therefore behaves exactly as it did in FA-04.

`src/lib/supabase/auth-server.ts` exports two builders:

- `createAdminSupabaseServerClient()` - request scoped, backed by the Next.js
  cookie store, for Server Components and Server Actions
- `createAdminSupabaseProxyClient(request, response)` - for `src/proxy.ts`,
  writing refreshed cookies onto the outgoing response and copying the
  no-store cache headers Supabase supplies with them

The environment reading in the admin module is intentionally independent of
the public client, so an admin change can never alter how the public
assessment resolves its credentials.

## 3. Authentication is not authorization

Two separate questions, answered in two separate places:

| Question | Answered by | Source of truth |
| --- | --- | --- |
| Who is this user? | Supabase Auth | `auth.users` |
| Is this user a French Assessment administrator? | the application database | `public.admin_users` |

Both must succeed. A valid Supabase Auth account with no active `admin_users`
row gets nothing: no dashboard, no metrics, no student data. Creating an auth
user does not grant admin access, and there is no public sign up anywhere in
the application.

## 4. `public.admin_users` schema

| Column | Type | Notes |
| --- | --- | --- |
| `user_id` | `uuid` | primary key, `references auth.users (id) on delete cascade` |
| `display_name` | `text` | not null, not blank, max 120 characters |
| `role` | `text` | not null, default `'admin'`, `check (role in ('admin'))` |
| `is_active` | `boolean` | not null, default `true` |
| `created_at` | `timestamptz` | not null, default `now()` |
| `updated_at` | `timestamptz` | not null, default `now()`, maintained by the FA-02 `public.set_updated_at()` trigger |

Index: `admin_users_is_active_idx` on `(is_active)`.

There is deliberately no password column, no password hash column and no email
column. Email stays in `auth.users`, owned by Supabase Auth.

Setting `is_active = false` removes access immediately without deleting the
auth account or losing the record that the person once had access.

## 5. Private authorization helper

```
private.is_active_french_admin() returns boolean
```

- `language sql`, `stable`, `security definer`
- `set search_path = pg_catalog, public, pg_temp`
- takes no arguments at all, so no caller can ask about another user
- identity comes only from `auth.uid()`
- returns true only when `auth.uid()` is non null and a matching
  `public.admin_users` row exists with `is_active = true` and `role = 'admin'`
- `EXECUTE` revoked from `public`, `anon` and `authenticated`
- lives in the `private` schema, which is not in the PostgREST exposed schema
  list and has `USAGE` revoked from `anon` and `authenticated`

## 6. Admin authorization RPC

```
public.is_french_assessment_admin() returns boolean
```

- `language sql`, `stable`, `security definer`, fixed `search_path`
- delegates to `private.is_active_french_admin()`
- returns a bare boolean: no role, no display name, no email, no row
- `EXECUTE` revoked from `public` and from `anon`
- `EXECUTE` granted to `authenticated` only

Used by the login action and by `requireFrenchAssessmentAdmin()`.

## 7. Dashboard RPC

```
public.get_french_admin_dashboard() returns jsonb
```

- `language plpgsql`, `stable`, `security definer`, fixed `search_path`
- first statement checks `private.is_active_french_admin()` and raises
  `admin_authorization_required` with SQLSTATE `42501` when it fails, before
  reading a single row
- takes no arguments, so nothing about the request can widen its scope
- `EXECUTE` revoked from `public` and `anon`, granted to `authenticated` only

The benchmark comparison uses `public.assessments.benchmark_percent` from each
attempt's own assessment row. The benchmark is never hardcoded in the browser.

### Response shape

```json
{
  "summary": {
    "total_students": 0,
    "total_attempts": 0,
    "registered_attempts": 0,
    "in_progress_attempts": 0,
    "submitted_attempts": 0,
    "average_percentage": null,
    "benchmark_met_count": 0,
    "benchmark_below_count": 0
  },
  "recent_submissions": [
    {
      "attempt_id": "uuid",
      "student_full_name": "text",
      "student_email": "text",
      "student_phone": "text",
      "status_in_canada": "text or null",
      "assessment_level": "A1",
      "score": 12,
      "total_questions": 20,
      "percentage": 60,
      "submitted_at": "timestamptz"
    }
  ]
}
```

`average_percentage` is `null`, never `NaN`, when nothing has been submitted.
`recent_submissions` holds at most ten rows, newest first, and is `[]` on an
empty database.

The payload never contains:

- `assessment_attempts.attempt_token`
- any answer key or `correct_option_key`
- any `public.assessment_answers` row or per question correctness
- any `public.admin_users` content
- anything from Supabase Auth beyond the caller's own authorization result

## 8. RLS and privileges

FA-05 keeps the deny by default posture that FA-02, FA-03 and FA-04
established, and weakens nothing.

- `public.admin_users` has RLS enabled with no policies
- all privileges on `public.admin_users` revoked from `public`, `anon` and
  `authenticated`, so the administrator list never reaches a browser
- no new policy and no new privilege was added to `public.students`,
  `public.assessments`, `public.assessment_attempts`,
  `public.assessment_sections`, `public.assessment_passages`,
  `public.assessment_questions`, `public.assessment_answers` or
  `private.assessment_answer_keys`
- the admin dashboard reads those tables only through the controlled RPC
- `USAGE` on schema `private` stays revoked from `anon` and `authenticated`

Being `authenticated` therefore grants no table access at all. It grants only
the ability to call two functions, both of which check active administrator
authorization for themselves.

The migration ends with a privilege assertion block that fails the migration if
any of those boundaries is not in place.

## 9. Next.js 16 session refresh and route protection

Next.js 16 renamed Middleware to Proxy. The project uses the current
convention: `src/proxy.ts`, exporting a named `proxy` function and a `config`
object.

```
export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
```

The proxy does two things, both scoped to `/admin`:

1. Refreshes the Supabase auth session through `@supabase/ssr` and writes the
   refreshed cookies onto the outgoing response. Server Components cannot set
   cookies, so without this pass a refreshed token would be produced and lost.
2. Redirects an anonymous request for a protected admin route to
   `/admin/login`, on the server, before the route renders.

This is an optimistic check only, as the Next.js authentication guide
recommends for Proxy: it reads the session and nothing more. It fails closed -
a configuration or network problem is treated as no session.

Because the matcher covers only `/admin`, the proxy never runs for `/`,
`/assessment` or the Server Functions those routes call. The public student
flow stays completely unauthenticated and is never redirected to an admin
login page.

### Route structure

```
src/app/layout.tsx                    document shell only
src/app/(public)/layout.tsx           Academy header, main, footer
src/app/(public)/page.tsx             /
src/app/(public)/assessment/page.tsx  /assessment
src/app/admin/login/page.tsx          /admin/login   (no session required)
src/app/admin/(protected)/layout.tsx  admin guard plus admin shell
src/app/admin/(protected)/page.tsx    /admin         (dashboard)
```

Route groups change no URL. `/` and `/assessment` are served exactly as before;
the move only lets the admin area render its own internal chrome instead of the
student facing header and footer.

`/admin/login` sits outside the `(protected)` group on purpose, so the login
page is reachable without a session and can never redirect to itself.

### `requireFrenchAssessmentAdmin()`

`src/lib/admin/auth.ts`. Called by the protected layout, so it runs for every
route in the group before any markup is produced.

1. `await connection()` - the admin area is per request and is never
   prerendered or cached
2. build the request scoped auth aware Supabase client
3. `supabase.auth.getUser()` - verified identity, not an unverified cookie claim
4. no verified user, so redirect to `/admin/login`
5. call `public.is_french_assessment_admin()`
6. not an active administrator, so redirect to
   `/admin/login?notice=not-authorized`
7. return a minimal context: `userId` and `email` only

The redirects are deliberately outside every `try`/`catch`, because
`redirect()` signals by throwing and swallowing it would silently render a
protected page. Any Supabase failure returns false rather than true, so an
error can never be mistaken for a granted permission.

## 10. Login behaviour

`/admin/login` shows the Toronto Academy logo, the heading
"French Assessment Administration", an Email Address field, a Password field
and a Sign In button. There is no Sign Up control, no Create Account control
and no password recovery control.

Validation, applied identically in the browser and again on the server with the
same Zod schema:

- email: required, valid email syntax, at most 254 characters
- password: required, at most 128 characters

Server flow, in `src/lib/actions/admin-auth.ts`:

1. re-validate the submission on the server
2. `supabase.auth.signInWithPassword(...)`
3. `supabase.auth.getUser()` to verify the session that was just written
4. `public.is_french_assessment_admin()` to check application authorization
5. active administrator, so the browser navigates to `/admin`
6. anything else, generic failure

Every credential failure returns exactly the same text:

> Unable to sign in with those credentials.

An unknown email, a wrong password and a malformed submission are
indistinguishable, so the page cannot be used to enumerate accounts. The typed
password is cleared from the form on every failure. Raw Supabase and PostgreSQL
messages are never shown; server logs carry a short marker with no email and no
password.

## 11. Authenticated but unauthorized behaviour

If Supabase Auth accepts the credentials but the account is not an active
French Assessment administrator, the login action signs the session straight
back out and returns:

> This account does not have access to the French Assessment administration
> area.

No table name, no role name and no internal reason is exposed.

If a session that already exists turns out not to be authorized - for example
an administrator deactivated while signed in - `requireFrenchAssessmentAdmin()`
redirects to `/admin/login?notice=not-authorized`, which shows the same generic
message together with a Sign Out control so staff can drop the session and sign
in with the right account. No dashboard data is rendered in either case, and
the dashboard RPC would refuse the call regardless.

## 12. Protected route behaviour

| Caller | Result |
| --- | --- |
| anonymous `/admin` | server side redirect to `/admin/login` from the proxy |
| expired session `/admin` | session cannot be refreshed, treated as anonymous, redirected |
| authenticated non administrator `/admin` | redirected to `/admin/login?notice=not-authorized`, no data |
| deactivated administrator `/admin` | same as above |
| active administrator `/admin` | dashboard renders |
| direct PostgREST call to the dashboard RPC as `anon` | no `EXECUTE` privilege |
| direct PostgREST call to the dashboard RPC as a non admin `authenticated` user | SQLSTATE 42501 |

There is no `useEffect` redirect and no client side route guard anywhere in the
admin area.

## 13. Dashboard metrics

`/admin` renders the heading "French Assessment Dashboard" with the description
"Overview of student assessment activity and recent submissions", then six
metric cards:

| Card | Source field |
| --- | --- |
| Total Students | `total_students` |
| Total Attempts | `total_attempts` (hint shows `registered_attempts`) |
| Submitted | `submitted_attempts` |
| In Progress | `in_progress_attempts` |
| Average Percentage | `average_percentage` |
| Benchmark Met | `benchmark_met_count` (hint shows `benchmark_below_count`) |

Every number is calculated in the database. The application performs no
counting, no averaging and no benchmark comparison.

## 14. Recent submissions

A table of the ten most recently submitted attempts, newest first, with the
columns Student, Email, Status in Canada, Level, Score, Percentage and
Submitted.

Timestamps render in Toronto local time with a pinned locale and time zone, so
the value is identical on the server and in the browser.

Student names are plain text. There is no detail route in FA-05, so nothing in
the table is a link. There is no pagination and no filtering yet.

## 15. Empty state handling

An empty database is a normal state, not an error:

- every count renders as `0`
- Average Percentage renders as `-` with the hint "No submissions yet", never
  `NaN` and never the word `null`
- Benchmark Met renders as `-` with the same hint
- the table is replaced by "No completed assessments yet." with a short
  explanation

## 16. Logout behaviour

The admin shell carries a Sign Out control: a plain form posting to the
`signOutFrenchAssessmentAdmin` Server Action, so it works without client
JavaScript.

The action calls `supabase.auth.signOut()`, which clears the Supabase auth
cookies through `@supabase/ssr`, then redirects to
`/admin/login?notice=signed-out`. After that, `/admin` has no session, so the
proxy redirects it to the login page again.

## 17. Migration

File:

```
supabase/migrations/20260905134000_fa_05_admin_auth_dashboard.sql
```

It creates `public.admin_users`, its constraints, index, `updated_at` trigger,
RLS and privileges, `private.is_active_french_admin()`,
`public.is_french_assessment_admin()` and
`public.get_french_admin_dashboard()`, and ends with a privilege assertion
block.

The migration is safely re-runnable and seeds no administrator, because the
first administrator needs a real `auth.users` UUID that only exists after the
account is created.

The FA-02, FA-03 and FA-04 migration files were not modified.

### Applying it

With the Supabase CLI, from the project root:

```
supabase db push
```

Or, in the Supabase dashboard: open SQL Editor, paste the contents of
`supabase/migrations/20260905134000_fa_05_admin_auth_dashboard.sql`, run it,
and confirm it completes without an exception. A failure raised by the guard or
assertion blocks means a dependency is missing or a privilege is wrong; fix
that rather than editing the assertions out.

## 18. First administrator provisioning

No password is ever written into SQL, into a migration, or into any file in
this repository.

1. Apply the FA-05 migration.
2. In the Supabase dashboard, open **Authentication** then **Users**.
3. Choose **Add user**, then **Create new user**.
4. Enter the staff email address and a password chosen at that moment. Tick
   **Auto Confirm User** so the account can sign in immediately.
5. Open the newly created user and copy its **UID** (the `auth.users.id`).
6. In **SQL Editor**, insert the matching authorization row, replacing the
   placeholders:

```sql
insert into public.admin_users (user_id, display_name, role, is_active)
values ('00000000-0000-0000-0000-000000000000', 'Staff Name', 'admin', true)
on conflict (user_id) do update
  set display_name = excluded.display_name,
      role = excluded.role,
      is_active = excluded.is_active;
```

7. Sign in at `/admin/login` with that email and password.

To remove access later without deleting the account:

```sql
update public.admin_users
   set is_active = false
 where user_id = '00000000-0000-0000-0000-000000000000';
```

Deleting the `auth.users` row cascades and removes the `admin_users` row too.

## 19. Verification SQL

Run these in the Supabase SQL Editor after applying the migration.

Objects exist:

```sql
select to_regclass('public.admin_users') as admin_users_table;

select n.nspname as schema, p.proname as function
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where (n.nspname = 'private' and p.proname = 'is_active_french_admin')
   or (n.nspname = 'public'
       and p.proname in ('is_french_assessment_admin', 'get_french_admin_dashboard'))
order by 1, 2;
```

RLS is on and there are no policies:

```sql
select relrowsecurity
from pg_catalog.pg_class
where oid = 'public.admin_users'::regclass;

select count(*) as policy_count
from pg_catalog.pg_policies
where schemaname = 'public' and tablename = 'admin_users';
```

`anon` and `authenticated` cannot touch the table:

```sql
select r.rolname,
       has_table_privilege(r.rolname, 'public.admin_users', 'SELECT') as can_select,
       has_table_privilege(r.rolname, 'public.admin_users', 'INSERT') as can_insert,
       has_table_privilege(r.rolname, 'public.admin_users', 'UPDATE') as can_update,
       has_table_privilege(r.rolname, 'public.admin_users', 'DELETE') as can_delete
from pg_catalog.pg_roles r
where r.rolname in ('anon', 'authenticated');
```

All six values must be `false`.

Function privileges:

```sql
select r.rolname,
       has_function_privilege(r.rolname, 'public.is_french_assessment_admin()', 'EXECUTE') as check_rpc,
       has_function_privilege(r.rolname, 'public.get_french_admin_dashboard()', 'EXECUTE') as dashboard_rpc,
       has_function_privilege(r.rolname, 'private.is_active_french_admin()', 'EXECUTE') as private_helper
from pg_catalog.pg_roles r
where r.rolname in ('anon', 'authenticated');
```

Expected: `anon` false, false, false. `authenticated` true, true, false.

Administrator records, without touching Supabase Auth passwords:

```sql
select a.user_id, a.display_name, a.role, a.is_active, a.created_at
from public.admin_users a
order by a.created_at;
```

## 20. Known limitations

- The first administrator, and every later one, is provisioned manually. There
  is no admin management UI.
- There is no forgot password or reset password flow. A password is reset from
  the Supabase dashboard.
- `role` accepts only `'admin'`. A second role needs a new migration that also
  updates `private.is_active_french_admin()`.
- The dashboard shows the ten most recent submissions with no pagination,
  search or filtering.
- Student names are not clickable, because no attempt detail route exists yet.
- Metrics cover every assessment in the database. Today that is only the
  seeded `french-a1-diagnostic`.
- The proxy performs an optimistic session check only. It does not check
  administrator authorization; the protected layout and the dashboard RPC do.
- A deactivated administrator keeps a valid Supabase Auth session until they
  next request an admin route, at which point they are refused and redirected.
  Nothing protected renders for them in the meantime.
- There is no admin audit log.

## 21. FA-06 handoff

FA-06 builds the detailed assessment result review:

- a full results list with search and filtering
- an individual attempt result page
- student information on that page
- the twenty answer review, with correct and incorrect display for
  authenticated administrators only

What FA-05 leaves in place for it:

- `private.is_active_french_admin()` is the single authorization predicate to
  reuse in every new admin RPC. A new RPC should check it first, exactly as
  `public.get_french_admin_dashboard()` does.
- `requireFrenchAssessmentAdmin()` is the server side route guard. A new
  protected page belongs inside `src/app/admin/(protected)/`, where the layout
  already applies it.
- New admin data must come through a new controlled RPC granted to
  `authenticated` only. Do not add broad `SELECT` policies to
  `public.students`, `public.assessment_attempts` or
  `public.assessment_answers`.
- Attempt tokens must stay out of admin payloads. FA-06 should address an
  attempt by `assessment_attempts.id`, which is what
  `recent_submissions.attempt_id` already returns.
- Answer key values in `private.assessment_answer_keys` may be used to compute
  correctness inside a SECURITY DEFINER function, but `correct_option_key`
  itself should not be returned unless the ticket explicitly calls for showing
  the correct answer to staff.
