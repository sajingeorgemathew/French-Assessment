# FA-01 - Toronto Academy Foundation and Student Intake

## Goal

Build the first real UI foundation for the Toronto Academy of Education French Assessment application.

Replace the default Next.js starter interface with a polished Toronto Academy branded student assessment experience.

This ticket creates:

- global Toronto Academy application branding
- application metadata
- branded landing page
- student information intake flow
- assessment instructions flow
- assessment-ready placeholder
- reusable UI foundation for later assessment tickets

Do not build the actual French questions in this ticket.

Do not persist student information yet.

## Product context

This application is for Toronto Academy of Education.

It will be used primarily for new or prospective students who need to complete a French language diagnostic assessment.

The application should eventually support:

- student information collection
- French diagnostic assessments
- automated scoring where appropriate
- assessment attempts
- student results
- admin review
- assessment invitations
- future additional French levels or assessments

The first assessment is:

French Language Evaluation and Diagnostic Assessment

French title:

Evaluation Diagnostique de Francais

Level:

CEFR / CECRL A1

Assessment size:

20 questions

Assessment areas:

- grammar
- vocabulary
- reading comprehension

The source assessment defines a 60 percent diagnostic benchmark.

Do not implement scoring in FA-01.

## Main experience

The first student journey should be:

Landing Page
-> Student Information
-> Assessment Instructions
-> Assessment Ready placeholder

The actual questions will be implemented in a later ticket.

## Brand direction

This is a Toronto Academy of Education application.

Use the actual Toronto Academy assets already supplied under public/.

Inspect the existing public assets before implementing the interface.

Do not invent a replacement Toronto Academy logo.

Do not use the default Next.js logo or starter styling.

The interface should feel:

- professional
- academic
- credible
- modern
- welcoming
- appropriate for a Canadian private college
- suitable for prospective and current students

Use Toronto Academy branding prominently but tastefully.

Primary direction:

- Toronto Academy blue
- white backgrounds
- restrained green accent where suitable
- light neutral backgrounds
- clean professional typography
- generous whitespace
- clear form hierarchy

Avoid:

- generic SaaS dashboard styling
- excessive gradients
- cartoonish education graphics
- huge marketing text
- excessive rounded cards
- excessive animations
- dark mode styling
- fake college imagery

## Global metadata

Replace all default Create Next App metadata.

Use:

Title:
Toronto Academy | French Language Assessment

Description:
French language diagnostic assessment for Toronto Academy of Education students.

Use an appropriate Toronto Academy favicon or supplied brand asset if one exists and can be used correctly.

Do not create a fake favicon from unrelated assets.

## Landing page

Route:

/

Replace the complete default Next.js starter screen.

The landing page must include:

- Toronto Academy branding
- Toronto Academy of Education name
- French Language Assessment title
- French subtitle or French assessment title
- CEFR / CECRL A1 reference
- short explanation of the purpose of the assessment
- assessment summary
- primary Start Assessment CTA

Suggested assessment summary:

- Level A1
- 20 Questions
- Grammar
- Vocabulary
- Reading

The copy should explain that the assessment helps Toronto Academy understand the student's current French ability and identify an appropriate learning pathway.

Do not present the assessment as a high-pressure certification exam.

Primary button:

Start Assessment

This must navigate to:

/assessment

## Student information page

Route:

/assessment

Create a professional student information intake experience.

The form must collect:

Required:

- Full Name
- Email Address
- Phone Number

Additional fields:

- City
- Status in Canada
- Current French Level
- French Learning Goal

Use accessible labels.

Do not use placeholders instead of labels.

## Status in Canada options

Use:

- Canadian Citizen
- Permanent Resident
- Work Permit
- Study Permit
- Visitor
- Other
- Prefer not to say

## Current French Level options

Use:

- Complete beginner
- Some basic French
- A1 / Beginner
- A2 / Elementary
- B1 or above
- Not sure

## French Learning Goal options

Use:

- Immigration / PR
- TEF / TCF Preparation
- Employment / Career
- Academic Studies
- Everyday Communication
- Personal Development
- Other

## Form validation

Use Zod, which is already installed.

Validate at minimum:

Full Name:
required

Email:
required and valid email format

Phone Number:
required

Display understandable inline validation errors.

Do not persist the data.

Do not call Supabase.

Do not create database records.

Keep the data only in the current browser/session state for this ticket.

## Assessment instructions

After valid student information is entered, continue to an assessment instructions step.

Do not navigate directly into questions.

The instructions screen should clearly communicate:

- French A1 diagnostic assessment
- 20 questions
- grammar section
- vocabulary section
- reading comprehension section
- choose the best answer for each question
- answers will eventually be submitted at the end

Provide:

Back

and

Begin Assessment

Back should return to the student information step without losing the entered information during the current page session.

## Assessment ready state

When the student clicks Begin Assessment, display a clean temporary assessment-ready placeholder.

Example direction:

Your assessment is ready.

The French A1 assessment questions will appear here.

Do not create fake questions.

Do not add sample questions.

Do not copy questions from the assessment document yet.

The real assessment engine belongs to a later ticket.

## Step indicator

The assessment entry flow should make the student's progress understandable.

Suggested steps:

1. Student Information
2. Instructions
3. Assessment

Use a compact progress or step treatment.

Do not overengineer it.

## Header

Create a reusable Toronto Academy application header.

It should use the supplied Toronto Academy branding.

Keep it compact.

The student should always understand that the assessment belongs to Toronto Academy of Education.

Do not add unnecessary navigation links.

This is an assessment application, not the main college website.

## Footer

Add a simple professional footer if appropriate.

Suggested information:

Toronto Academy of Education

French Language Assessment

Do not invent legal wording, accreditation statements, addresses, phone numbers, or copyright claims that are not already available in the repository.

## Component architecture

Keep the architecture simple and reusable.

Suggested structure:

src/
  app/
    page.tsx
    assessment/
      page.tsx

  components/
    brand/
      AcademyHeader.tsx

    assessment/
      AssessmentOverview.tsx
      StudentInformationForm.tsx
      AssessmentInstructions.tsx
      AssessmentReady.tsx
      AssessmentSteps.tsx

    ui/

Claude may adjust component names when there is a clear technical reason.

Do not create unnecessary abstractions.

## Styling

Use Tailwind CSS already installed.

Use Lucide React when icons are useful.

Do not install another UI framework.

Do not install shadcn.

Do not install Material UI.

Do not install Bootstrap.

Do not add unnecessary packages.

Keep the existing project lightweight.

## Responsive behavior

Desktop and laptop are important.

The application must also work well on mobile.

Minimum expectations:

- works well at 1366x768
- works well at 1440x900
- usable at tablet width
- usable at mobile width
- no horizontal scrolling
- form fields remain usable
- buttons remain reachable
- brand logo does not overflow
- text remains readable
- student flow remains clear

## Accessibility

Use:

- semantic HTML
- real labels
- keyboard accessible controls
- visible focus states
- sufficient contrast
- descriptive image alt text
- correctly associated validation messages

## Supabase

Manual Supabase steps:

None.

Do not create tables.

Do not create migrations.

Do not insert student records.

Do not add RLS policies.

Do not change Supabase settings.

Do not create authentication.

The local project already contains Supabase environment configuration for future tickets.

FA-02 will implement the database and persistence layer.

## Security

- do not read .env.local
- do not print environment variables
- do not expose Supabase keys
- do not add secrets to source code
- do not add service-role credentials
- do not commit environment files
- do not implement authentication
- do not implement admin access

## Out of scope

Do not build:

- French assessment questions
- answer keys
- scoring
- percentage calculation
- result page
- database schema
- student persistence
- admin panel
- admin authentication
- student authentication
- invitation links
- email
- SMS
- GoHighLevel integration
- analytics
- Vercel deployment
- AI evaluation
- additional assessment levels

These belong to later tickets.

## Files likely affected

Likely files include:

- src/app/page.tsx
- src/app/layout.tsx
- src/app/globals.css
- src/app/assessment/page.tsx
- src/components/brand/*
- src/components/assessment/*
- public/* only if an existing asset needs to be referenced or organized

Do not modify files unnecessarily.

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

Fix any errors caused by this implementation.

## Done criteria

FA-01 is complete when:

- default Next.js starter UI is completely removed
- Toronto Academy branding is visible
- real supplied Toronto Academy assets are used
- application metadata is updated
- / is a polished French assessment landing page
- Start Assessment navigates to /assessment
- student information form is present
- Full Name is required
- Email is required and validated
- Phone Number is required
- optional student information fields are available
- student can continue to instructions
- Back preserves current-session form information
- Begin Assessment reaches an assessment-ready placeholder
- no fake French questions are created
- no assessment scoring is implemented
- no Supabase data operations are implemented
- no database changes are made
- no authentication is implemented
- no secrets are exposed
- .env.local remains ignored
- mobile layout is usable
- desktop layout is polished
- npm run lint passes
- npx tsc --noEmit passes
- npm run build passes
- git diff --check passes
