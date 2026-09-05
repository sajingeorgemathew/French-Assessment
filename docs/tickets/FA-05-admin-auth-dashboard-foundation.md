# FA-05 - Admin Authentication and Dashboard Foundation

## Goal

Build the secure Toronto Academy of Education administrative foundation for the French Assessment application.

FA-01 created the public student experience.

FA-02 created:

- students
- assessments
- assessment attempts
- secure registration

FA-03 created:

- assessment sections
- reading passages
- 20 A1 questions
- assessment player

FA-04 created:

- protected answer keys
- final answer persistence
- secure scoring
- submitted attempts
- score and percentage
- student completion result

FA-05 must now create:

- Supabase Auth based administrator authentication
- admin authorization
- protected admin routes
- admin login
- admin logout
- admin application shell
- admin dashboard
- high-level assessment statistics
- recent submitted assessment list
- secure admin-only dashboard RPC
- manual first-admin provisioning process

Do not build detailed attempt review yet.

Do not build question-by-question admin results yet.

Do not build student editing.

Do not build an admin user-management interface.

Those belong to later tickets.

## Product context

This is the internal administrative area for Toronto Academy of Education staff.

Students do not create accounts.

The public French assessment must remain accessible without student authentication.

Admin authentication is completely separate from the public assessment flow.

The application now contains student PII and assessment results, so administrative access must be explicitly authenticated and authorized.

## Existing public Supabase client

The application already contains a stateless Supabase client used for controlled public assessment RPC operations.

Do not convert or replace that client with an authenticated global client if doing so would disturb the existing student flow.

Create a separate authentication-aware Supabase SSR architecture for admin sessions.

Preserve the existing public assessment behavior.

## Authentication architecture

Use Supabase Auth for administrator login.

Initial authentication method:

Email + Password

Use the existing installed:

@supabase/ssr
@supabase/supabase-js

Do not add another authentication provider.

Do not add Clerk.

Do not add Auth0.

Do not add NextAuth/Auth.js.

Do not create custom password tables.

Supabase Auth must remain responsible for passwords.

## No public admin signup

There must be no public administrator registration page.

Do not create:

/admin/signup

Do not create:

Create Account

Do not allow an arbitrary authenticated Supabase user to become an application administrator.

Admin authorization must require an explicit database administrator record.

## Admin authorization table

Create:

public.admin_users

Fields:

user_id
uuid
primary key
foreign key to auth.users(id)
on delete cascade

display_name
text
not null

role
text
not null
default 'admin'

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

Allowed role for FA-05:

admin

Add an appropriate constraint.

Do not store administrator passwords in this table.

Do not duplicate Supabase Auth password information.

Email remains managed by auth.users.

## Administrator identity model

Authentication answers:

"Who is this user?"

Supabase Auth provides this.

Authorization answers:

"Is this authenticated user allowed into the French Assessment admin?"

public.admin_users provides this.

Both conditions are required.

A valid Supabase Auth account that is not present as an active admin_users record must not receive admin access.

## Private authorization helper

Create or reuse the existing private schema.

Create a protected helper similar to:

private.is_active_french_admin()

The exact name may differ for a clear technical reason.

It should return true only when:

- auth.uid() is non-null
- a matching public.admin_users row exists
- is_active = true
- role = 'admin'

The helper should not accept an arbitrary user UUID from the browser.

It must derive the authenticated identity from:

auth.uid()

This prevents callers from claiming another user's identity.

## SECURITY DEFINER safeguards

If SECURITY DEFINER is used:

- explicitly set search_path
- schema qualify table/function references where appropriate
- avoid dynamic SQL
- do not accept caller-supplied administrator IDs
- revoke overly broad execute access
- keep output minimal

## admin_users security

Enable RLS on:

public.admin_users

Do not allow:

anon SELECT
anon INSERT
anon UPDATE
anon DELETE

Do not give general authenticated users direct admin_users table access.

The admin authorization helper/RPC should determine access.

Do not expose the list of administrators to the browser.

## Admin authorization RPC

Create a controlled function similar to:

public.is_french_assessment_admin()

It should:

- derive identity from auth.uid()
- return a boolean
- return true only for an active admin
- return false otherwise

Grant execute only to:

authenticated

Do not grant to anon.

Do not return the entire admin_users row.

## Admin dashboard RPC

Create a controlled function similar to:

public.get_french_admin_dashboard()

The exact name may differ for a strong technical reason.

The function must first verify:

private.is_active_french_admin()

If the caller is not an active admin:

reject the operation.

Do not rely only on the frontend route guard.

The database must independently enforce administrator authorization.

## Dashboard summary

Return aggregate information useful to Toronto Academy staff.

Suggested summary fields:

total_students

total_attempts

registered_attempts

in_progress_attempts

submitted_attempts

average_percentage

benchmark_met_count

benchmark_below_count

Use the assessment benchmark stored in:

public.assessments.benchmark_percent

Do not hardcode benchmark logic into the browser.

For the current A1 assessment the benchmark is 60 percent, but database data remains authoritative.

## Recent submissions

The dashboard RPC should also return recent submitted assessments.

Return up to 10 recent submitted attempts by default.

Suggested fields:

attempt_id

student_full_name

student_email

student_phone

status_in_canada

assessment_level

score

total_questions

percentage

submitted_at

Do not return:

attempt_token

answer keys

correct_option_key

student answer correctness details

private schema data

password/authentication information

## Dashboard data scope

FA-05 dashboard is summary-oriented.

It may show recent results, but it must not yet show:

- all individual question answers
- correct/incorrect breakdown
- answer-key values
- detailed attempt page
- editable student profile

FA-06 will implement detailed assessment-result review.

## Database table access strategy

Prefer keeping the existing assessment/student tables protected rather than adding broad authenticated SELECT policies.

The admin dashboard should obtain its data through controlled administrator RPCs.

This ensures:

authenticated user
does NOT automatically equal
application administrator

Do not weaken existing FA-02, FA-03, or FA-04 RLS protections.

## Migration

Create one new migration under:

supabase/migrations/

Suggested filename:

20260905134000_fa_05_admin_auth_dashboard.sql

A later timestamp is acceptable.

Do not modify FA-02, FA-03, or FA-04 migration files.

Migration should include:

- public.admin_users
- constraints
- updated_at handling
- RLS
- privileges/revokes
- private administrator authorization helper
- public.is_french_assessment_admin
- public.get_french_admin_dashboard

Do not seed a fake admin user.

The first admin requires a real auth.users UUID and will be provisioned manually after the migration.

## Supabase Auth SSR architecture

Create a separate Supabase authentication-aware server client using:

@supabase/ssr

The client must support cookie-based sessions.

Do not use service-role credentials.

Do not store auth tokens manually in localStorage.

Do not build custom cookie serialization when the installed Supabase SSR library already provides the appropriate mechanisms.

Because this project uses Next.js 16:

Read the installed Next.js 16 documentation before implementing route interception/session refresh.

Use the current Next.js 16 convention.

If the installed documentation specifies proxy.ts rather than middleware.ts, follow the installed documentation.

Do not copy an outdated Next.js authentication tutorial blindly.

## Auth session refresh

Implement the appropriate Supabase SSR session-refresh mechanism for Next.js 16.

It should:

- refresh expired/near-expired auth sessions as appropriate
- preserve Supabase cookies
- not interfere with public student routes
- not require student authentication
- not redirect /assessment to admin login

Only admin routes require admin authentication.

## Admin routes

Create:

/admin/login

/admin

Use a protected admin layout where appropriate.

Suggested structure:

src/app/admin/
  login/
    page.tsx

  layout.tsx

  page.tsx

Claude may use route groups if technically cleaner.

## Admin login page

Route:

/admin/login

Create a clean Toronto Academy administrative login page.

Use existing Toronto Academy branding.

This is not a marketing page.

Display:

Toronto Academy of Education

French Assessment Administration

Email Address

Password

Sign In

Do not provide:

Sign Up
Create Account

Do not expose technical Supabase terminology to staff.

## Login validation

Validate:

email:
required
valid email syntax

password:
required
reasonable maximum size

Use generic login errors.

Suggested message:

"Unable to sign in with those credentials."

Do not reveal whether:

- email exists
- password was incorrect
- account exists but is unauthorized

Avoid account enumeration.

## Login flow

On login:

1. validate form
2. authenticate with Supabase Auth
3. obtain verified authenticated user using the appropriate secure Supabase method
4. verify admin authorization
5. if active admin, redirect to /admin
6. if not authorized, do not grant dashboard access

Do not trust only session data without secure server-side verification.

Follow current Supabase SSR recommendations.

## Authenticated but unauthorized user

If a Supabase Auth user successfully signs in but is not an active French Assessment administrator:

do not show dashboard data.

Prefer:

- sign that session out from the application
- return a generic access-not-authorized message on login

Suggested wording:

"This account does not have access to the French Assessment administration area."

Do not expose internal role-table details.

## Protected admin routes

/admin must not render protected dashboard data to:

- anonymous users
- expired sessions
- authenticated non-admin users
- inactive admins

Anonymous requests to /admin should redirect to:

/admin/login

Authorization must also be enforced at the server/database boundary.

Do not depend solely on client-side React redirects.

## requireAdmin helper

Create a reusable server-side authorization helper such as:

requireFrenchAssessmentAdmin()

Suggested responsibilities:

1. create auth-aware Supabase server client
2. securely determine current authenticated user
3. redirect to /admin/login when no valid user exists
4. call admin authorization RPC
5. reject inactive/non-admin accounts
6. return minimal authenticated admin context

Do not return unnecessary auth metadata.

## Admin layout

Create a reusable admin shell.

Suggested desktop layout:

compact sidebar or top navigation

Toronto Academy branding

French Assessment Admin

Dashboard

future placeholder navigation for:

Students
Results

Only Dashboard must be functional in FA-05.

Future items may be visibly disabled or omitted.

Do not create fake functional pages.

Include:

Sign Out

## Admin dashboard

Route:

/admin

Display a professional internal dashboard.

Suggested header:

French Assessment Dashboard

Supporting description:

"Overview of student assessment activity and recent submissions."

## Dashboard metric cards

Display:

Total Students

Total Attempts

Submitted

In Progress

Average Score / Average Percentage

A compact additional metric may show:

Benchmark Met

Do not overfill the page with cards.

Keep it operational and readable.

## Average percentage

If there are no submitted attempts:

display a neutral placeholder such as:

-

or:

No submissions yet

Do not display NaN.

Do not display database null directly.

## Recent submissions table

Display recent submitted assessments.

Suggested columns:

Student

Email

Status in Canada

Level

Score

Percentage

Submitted

Rows should be ordered newest first.

Limit to the latest 10 in FA-05.

Do not build pagination yet.

Do not build advanced filtering yet.

Do not make student names clickable until FA-06 creates a valid detail route.

## Empty dashboard state

If no submitted assessments exist:

show a useful empty state.

Example:

"No completed assessments yet."

The dashboard must not crash on an empty database.

## Sign out

Create a real Sign Out action using Supabase Auth.

After sign out:

redirect to:

/admin/login

The old /admin page must no longer be accessible without signing in again.

## Browser security

Do not expose:

passwords
Supabase refresh tokens in visible UI
service-role credentials
answer keys
private schema data
attempt tokens
student answer correctness details

PII shown inside the authenticated admin dashboard is acceptable where required for staff operations.

Do not expose PII on public routes.

## Public assessment regression protection

The following must continue working without authentication:

/

/assessment

Student registration

Begin Assessment

assessment question flow

submission

scoring

student completion result

Do not require students to sign in.

Do not change public assessment authentication architecture.

## Environment variables

Reuse:

NEXT_PUBLIC_SUPABASE_URL

NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

or the existing supported anon-key fallback.

Do not add service-role credentials.

Do not read .env.local contents.

Do not print environment values.

Do not modify .env.local unless an environment variable naming change is absolutely required.

No new secret is expected for FA-05.

## Password reset

Do not implement forgot-password/reset-password UI in FA-05.

Admins can initially be managed manually through Supabase Auth.

Password recovery can be a later hardening ticket if required.

## Admin user management

Do not build UI to:

- add admins
- remove admins
- activate admins
- deactivate admins
- change roles

First-admin provisioning is manual.

Later admin management can be added separately if needed.

## Manual Supabase setup

After migration:

1. create the administrator as a Supabase Auth user
2. obtain the user's auth UUID
3. create the corresponding public.admin_users row
4. ensure is_active = true
5. test login

Do not seed passwords in SQL.

Do not put administrator passwords in migration files.

## Documentation

Create:

docs/admin/fa-05-admin-auth-dashboard.md

Document:

1. purpose of FA-05
2. Supabase Auth architecture
3. separation between authentication and authorization
4. admin_users schema
5. private admin helper
6. admin authorization RPC
7. dashboard RPC
8. Supabase SSR cookie/session architecture
9. Next.js 16 route/session protection
10. login behavior
11. unauthorized-user behavior
12. protected-route behavior
13. dashboard metrics
14. recent submissions
15. logout behavior
16. RLS and security
17. first-admin provisioning
18. migration instructions
19. verification SQL
20. known limitations
21. FA-06 handoff

Do not include passwords or environment values.

## FA-06 handoff

FA-06 will build:

- assessment results list
- search/filtering
- individual attempt result page
- student information
- detailed 20-answer review
- correct/incorrect display for authenticated administrators only

Do not implement those features in FA-05.

## Files likely affected

Likely files include:

supabase/migrations/*

src/app/admin/*
src/components/admin/*
src/lib/admin/*
src/lib/actions/admin-auth.ts
src/lib/supabase/auth-server.ts

and the appropriate Next.js 16 proxy/session-refresh file.

Do not rewrite unrelated public assessment components.

Do not remove the existing stateless public assessment Supabase client.

## Security requirements

- Supabase Auth handles passwords
- no custom password table
- no public admin signup
- authentication alone does not grant admin rights
- active admin_users record is required
- auth.uid() determines authorization identity
- no caller-supplied user id for admin authorization
- /admin protected server-side
- database RPC independently checks admin authorization
- no anon admin dashboard access
- no non-admin authenticated dashboard access
- no service-role key
- no answer-key exposure
- no broad authenticated SELECT policies on student/result tables
- no attempt tokens returned in dashboard
- no secrets committed
- .env.local remains ignored
- public student assessment remains unauthenticated

## Style rule

Use normal hyphens.

Do not use em dashes.

Use straight quotes where practical.

Preserve existing Toronto Academy branding.

## Validation

Run:

npm run lint
npx tsc --noEmit
npm run build
git diff --check

Fix all FA-05 implementation errors.

## Done criteria

FA-05 is complete when:

- new FA-05 migration exists
- previous migrations remain unchanged
- public.admin_users exists
- admin_users references auth.users
- admin role constraint exists
- is_active exists
- RLS is enabled on admin_users
- anon cannot directly read admin_users
- authenticated general users cannot directly list admin_users
- private active-admin authorization helper exists
- authorization derives identity from auth.uid()
- public admin-check RPC exists
- admin-check RPC is not available to anon
- secure admin dashboard RPC exists
- dashboard RPC independently verifies active admin authorization
- no broad authenticated table policies were added to existing protected data
- auth-aware Supabase SSR client exists
- existing public assessment Supabase client remains intact
- appropriate Next.js 16 session-refresh mechanism exists
- /admin/login exists
- login uses Supabase Auth email/password
- no public signup exists
- login errors do not enumerate accounts
- authenticated non-admin cannot access dashboard
- inactive admin cannot access dashboard
- anonymous /admin redirects to /admin/login
- valid active admin can access /admin
- admin dashboard renders
- total student metric works
- total attempt metric works
- submitted metric works
- in-progress metric works
- average percentage handles empty data
- benchmark metric works
- recent submissions show newest first
- recent submissions are limited appropriately
- no attempt token is exposed in dashboard
- no answer key is exposed
- sign out works
- signed-out user cannot reopen /admin without authentication
- public /assessment still works without login
- student submission/scoring still works
- no admin management UI is added
- no result detail page is added
- no service-role credential is introduced
- .env.local remains unchanged
- documentation exists
- npm run lint passes
- npx tsc --noEmit passes
- npm run build passes
- git diff --check passes
