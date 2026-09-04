# FA-03 - A1 Assessment Engine and Question Content

## Goal

Build the actual French A1 assessment-taking experience for the Toronto Academy of Education French Assessment application.

FA-01 created:

- Toronto Academy branding
- landing page
- student information experience
- instructions
- assessment-ready placeholder

FA-02 created:

- students
- assessments
- assessment_attempts
- secure student registration
- secure Begin Assessment operation
- persistent attempt lifecycle
- opaque attempt token

FA-03 must now:

- create the assessment content schema
- seed the exact supplied A1 content
- create three assessment sections
- create three reading passages
- create exactly 20 assessment questions
- securely retrieve content for a valid in-progress attempt
- replace the assessment-ready placeholder with a real assessment player
- allow navigation through all 20 questions
- preserve selected answers during the active browser session
- provide section introductions
- provide question progress
- provide an answer review screen

Do not implement final submission.

Do not persist student answers.

Do not create answer keys.

Do not calculate correctness.

Do not calculate a score.

Do not calculate a percentage.

Do not mark the attempt submitted.

FA-04 will implement secure answer persistence, final submission, scoring, and results.

## Product context

This application belongs to Toronto Academy of Education.

The assessment is:

French Language Evaluation and Diagnostic Assessment

French title:

Évaluation Diagnostique de Français

Framework:

CEFR / CECRL

Level:

A1

Target audience:

Adult learners

Total questions:

20

Assessment areas:

- Conjugation and Grammar
- Everyday Vocabulary
- Reading Comprehension

The exact question and passage content in this ticket comes from the source assessment supplied by the project owner.

Do not invent question content.

Do not rewrite question wording.

Do not replace questions.

Do not silently correct the supplied French.

Preserve French accents.

## Existing student flow

Before FA-03:

Landing
-> Student Information
-> student persisted
-> registered attempt created
-> Instructions
-> Begin Assessment
-> attempt becomes in_progress
-> Assessment Ready placeholder

After FA-03:

Landing
-> Student Information
-> student persisted
-> registered attempt created
-> Instructions
-> Begin Assessment
-> attempt becomes in_progress
-> Section A introduction
-> Questions 1-8
-> Section B introduction
-> Questions 9-14
-> Section C introduction
-> Questions 15-20
-> Review Answers

The Review Answers screen must not submit the assessment yet.

## Database architecture

Create exactly these assessment-content tables:

1. public.assessment_sections
2. public.assessment_passages
3. public.assessment_questions

Do not create:

- assessment_answers
- assessment_answer_keys
- correct_answers
- results
- admin question editor tables

Those belong to later tickets.

## Table: assessment_sections

Create:

public.assessment_sections

Fields:

id
uuid
primary key
default gen_random_uuid()

assessment_id
uuid
not null
foreign key to public.assessments(id)

section_key
text
not null

title
text
not null

title_fr
text
nullable

description
text
nullable

position
integer
not null

created_at
timestamptz
not null
default now()

Create unique constraints for:

assessment_id + section_key

assessment_id + position

Require:

position > 0

## Seed exactly three sections

Associate every section with the assessment whose slug is:

french-a1-diagnostic

### Section 1

section_key:
grammar

title:
Conjugation and Grammar

title_fr:
Partie A : Conjugaison et Grammaire

description:
Questions 1 à 8

position:
1

### Section 2

section_key:
vocabulary

title:
Everyday Vocabulary

title_fr:
Partie B : Vocabulaire de la Vie Quotidienne

description:
Questions 9 à 14

position:
2

### Section 3

section_key:
reading

title:
Reading Comprehension

title_fr:
Partie C : Compréhension Écrite

description:
Questions 15 à 20

position:
3

## Table: assessment_passages

Create:

public.assessment_passages

Fields:

id
uuid
primary key
default gen_random_uuid()

assessment_id
uuid
not null
foreign key to public.assessments(id)

section_id
uuid
not null
foreign key to public.assessment_sections(id)

passage_key
text
not null

title
text
not null

body
text
not null

position
integer
not null

created_at
timestamptz
not null
default now()

Create unique constraint:

assessment_id + passage_key

Require:

position > 0

## Seed exactly three reading passages

All passages belong to:

french-a1-diagnostic

and section:

reading

### Passage 1

passage_key:
invitation

title:
Texte 1 - Invitation

position:
1

body:

« Cher Marc,
Je t'invite à mon anniversaire ce samedi 15 octobre à 20h chez moi. Nous allons manger une pizza et écouter de la musique. Merci de me confirmer ta présence avant jeudi.
À bientôt, Sophie. »

Used by:

Questions 15 and 16

### Passage 2

passage_key:
hotel

title:
Texte 2 - Annonce d'Hôtel

position:
2

body:

« Hôtel de la Gare - Petit-déjeuner servi de 7h00 à 10h00 dans la salle principale. Connexion Wi-Fi gratuite (Code : Hotel2026). Départ des chambres avant 11h00. »

Used by:

Questions 17 and 18

### Passage 3

passage_key:
professional-email

title:
Texte 3 - Courriel Professionnel Simple

position:
3

body:

« Bonjour M. Dupont,
Notre réunion de projet est déplacée au mardi 4 août à 14h30 dans la salle B20. Merci d'apporter votre ordinateur portable.
Cordialement,
Claire Martin »

Used by:

Questions 19 and 20

## Table: assessment_questions

Create:

public.assessment_questions

Fields:

id
uuid
primary key
default gen_random_uuid()

assessment_id
uuid
not null
foreign key to public.assessments(id)

section_id
uuid
not null
foreign key to public.assessment_sections(id)

passage_id
uuid
nullable
foreign key to public.assessment_passages(id)

question_number
integer
not null

category
text
nullable

instruction
text
nullable

prompt
text
not null

note
text
nullable

options
jsonb
not null

position
integer
not null

created_at
timestamptz
not null
default now()

Create unique constraints for:

assessment_id + question_number

assessment_id + position

Require:

question_number > 0

position > 0

## Question option format

Every question in this assessment has exactly four choices.

Store choices as stable A/B/C/D option objects.

Recommended structure:

[
  { "key": "A", "text": "..." },
  { "key": "B", "text": "..." },
  { "key": "C", "text": "..." },
  { "key": "D", "text": "..." }
]

The application must use the option key:

A
B
C
D

as the selected-answer identifier.

Do not use option display text as the primary response identifier.

## Critical answer-key rule

FA-03 must NOT create or store correct-answer information.

Do not create columns named or equivalent to:

correct_answer
correct_option
correct_option_key
answer_key
is_correct
expected_answer

Do not create a separate answer-key table.

Do not put correct answers in application source code.

Do not infer correct answers during this ticket.

Correct answers will be introduced behind a secure server-side boundary in FA-04.

## Exact assessment content

Seed exactly the following 20 questions.

Do not rewrite the supplied content.

### Question 1

Section:
grammar

Category:
Grammaire - Être

Instruction:
Choisissez la forme correcte du verbe être pour compléter la phrase :

Prompt:
« Salut ! Nous ___ très contents de vous voir. »

Options:

A. êtes
B. sommes
C. sont
D. somme

### Question 2

Section:
grammar

Category:
Grammaire - Négation

Instruction:
Quelle est la forme négative correcte de la phrase :

Prompt:
« Je mange de la viande. »

Options:

A. Je ne mange pas de la viande.
B. Je mange pas de viande.
C. Je ne mange pas de viande.
D. Je ne pas mange de viande.

### Question 3

Section:
grammar

Category:
Grammaire - Possessifs

Instruction:
Complétez avec l'adjectif possessif adéquat :

Prompt:
« Voici Marie. C'est ___ amie. »

Note:
Remarque : amie est un nom féminin commençant par une voyelle

Options:

A. ma
B. mon
C. sa
D. mes

### Question 4

Section:
grammar

Category:
Grammaire - Verbes en -ER

Instruction:
Sélectionnez la conjugaison exacte du verbe habiter :

Prompt:
« Où ___ -vous en ce moment ? »

Options:

A. habitez
B. habites
C. habitons
D. habitent

### Question 5

Section:
grammar

Category:
Grammaire - Verbe Aller

Instruction:
Choisissez le verbe approprié :

Prompt:
« Demain, ils ___ au cinéma avec des collègues. »

Options:

A. vas
B. vont
C. allez
D. allons

### Question 6

Section:
grammar

Category:
Grammaire - Accord des adjectifs

Instruction:
Complétez avec l'adjectif correctement accordé :

Prompt:
« Mes sœurs sont très ___. »

Options:

A. intelligent
B. intelligente
C. intelligents
D. intelligentes

### Question 7

Section:
grammar

Category:
Grammaire - Articles définis / indéfinis

Instruction:
Choisissez le bon article :

Prompt:
« Est-ce que tu as ___ stylo bleu pour signer le document ? »

Options:

A. un
B. une
C. des
D. la

### Question 8

Section:
grammar

Category:
Grammaire - Questions

Prompt:
Quelle structure est correcte pour poser une question polie ?

Options:

A. Où habite vous ?
B. Où est-ce que vous habitez ?
C. Vous habitez quoi ?
D. Est-ce que où vous habitez ?

### Question 9

Section:
vocabulary

Category:
Vocabulaire - Routines

Instruction:
Quel mot complète logiquement la phrase suivante ?

Prompt:
« Le matin, je prends mon ___ à 8 heures. »

Options:

A. dîner
B. déjeuner
C. petit-déjeuner
D. goûter

### Question 10

Section:
vocabulary

Category:
Vocabulaire - Les Heures

Prompt:
Comment écrit-on en toutes lettres : 14h30 ?

Options:

A. Quatorze heures et quart
B. Deux heures et demie du matin
C. Quatorze heures et demie (ou deux heures et demie de l'après-midi)
D. Seize heures trente

### Question 11

Section:
vocabulary

Category:
Vocabulaire - La Famille

Prompt:
Le frère de mon père est mon ___ :

Options:

A. cousin
B. oncle
C. grand-père
D. neveu

### Question 12

Section:
vocabulary

Category:
Vocabulaire - Au Restaurant

Prompt:
Quelle phrase utilise-t-on pour demander l'addition au café ?

Options:

A. L'addition, s'il vous plaît.
B. Combien ça coûte la carte ?
C. Je veux payer le repas maintenant.
D. Où est le menu ?

### Question 13

Section:
vocabulary

Category:
Vocabulaire - Nombres

Prompt:
Quel est le nombre correct pour 75 en français standard ?

Options:

A. Soixante-cinq
B. Septante-cinq
C. Soixante-quinze
D. Quatre-vingts

### Question 14

Section:
vocabulary

Category:
Vocabulaire - Les Jours

Prompt:
Si aujourd'hui nous sommes mardi, quel jour serons-nous après-demain ?

Options:

A. Mercredi
B. Jeudi
C. Vendredi
D. Lundi

### Question 15

Section:
reading

Passage:
invitation

Prompt:
Qui organise la fête d'anniversaire ?

Options:

A. Marc
B. Sophie
C. Le restaurateur
D. Un collègue

### Question 16

Section:
reading

Passage:
invitation

Prompt:
Quand Marc doit-il répondre au plus tard ?

Options:

A. Samedi
B. Vendredi
C. Jeudi
D. Dimanche

### Question 17

Section:
reading

Passage:
hotel

Prompt:
À quelle heure se termine le petit-déjeuner ?

Options:

A. 7h00
B. 10h00
C. 11h00
D. 12h00

### Question 18

Section:
reading

Passage:
hotel

Prompt:
Quelle est l'instruction concernant le départ (check-out) ?

Options:

A. Libérer la chambre avant 10h00.
B. Libérer la chambre avant 11h00.
C. Payer à 7h00 du matin.
D. Demander le code Wi-Fi à 11h00.

### Question 19

Section:
reading

Passage:
professional-email

Prompt:
Quel est l'objet de ce courriel ?

Options:

A. Annuler des vacances
B. Changer l'heure et la date d'une réunion
C. Commander un nouvel ordinateur
D. Inviter à un déjeuner

### Question 20

Section:
reading

Passage:
professional-email

Prompt:
Que doit apporter M. Dupont ?

Options:

A. Un dossier papier
B. Son ordinateur portable
C. Un stylo
D. Son passeport

## Seed strategy

Seed exactly:

3 sections

3 passages

20 questions

Use an idempotent migration strategy.

The seed must not create duplicate content if safe seed logic is run again.

All content belongs to:

french-a1-diagnostic

Do not modify unrelated assessment records.

## RLS

Enable Row Level Security on:

public.assessment_sections
public.assessment_passages
public.assessment_questions

Do not grant anonymous unrestricted direct table SELECT access.

Assessment content should be retrieved through a controlled operation tied to an active attempt.

## Assessment content RPC

Create a controlled PostgreSQL function similar to:

public.get_french_assessment_content(p_attempt_token uuid)

The exact name may differ for a strong technical reason.

The function must:

1. receive an opaque attempt token
2. locate the matching assessment attempt
3. verify the attempt exists
4. verify attempt status is in_progress
5. verify the associated assessment slug is french-a1-diagnostic
6. verify the assessment is active
7. return assessment presentation metadata
8. return the three sections in order
9. return the three passages
10. return the twenty questions in order

The result must contain only information required to render the assessment.

Do not return:

- student_id
- student name
- student email
- phone
- city
- score
- percentage
- answer keys
- correct-answer information
- other assessment attempts
- administrative information

## SECURITY DEFINER

A SECURITY DEFINER RPC is acceptable when needed to allow controlled access to protected content.

If used:

- explicitly set search_path
- include pg_temp appropriately
- qualify database objects
- avoid dynamic SQL
- return minimal data
- revoke overly broad execute access where appropriate
- grant only required execution
- do not expose protected application tables directly

## Application content retrieval

Create a server-side application boundary for retrieving assessment content.

Suggested responsibility:

getFrenchAssessmentContent(attemptToken)

It should:

1. validate the attempt token as a UUID
2. call the controlled content RPC
3. map the response into typed assessment content
4. return a safe success or failure result

Do not expose raw Supabase errors.

Do not fetch protected tables directly in arbitrary client components.

## Assessment player

Replace the FA-01 Assessment Ready placeholder with the actual assessment experience.

Do not redesign the main Toronto Academy website-style pages.

The active assessment should feel:

- focused
- academic
- professional
- calm
- readable
- appropriate for adult learners
- consistent with Toronto Academy branding

Avoid:

- large marketing hero layouts
- excessive decorative cards
- unnecessary animations
- huge typography
- full dashboard styling
- distracting navigation

## Assessment player sequence

Use this sequence:

Part A Introduction
-> Questions 1-8
-> Part B Introduction
-> Questions 9-14
-> Part C Introduction
-> Questions 15-20
-> Review Answers

## Section introduction: Part A

Display:

Partie A : Conjugaison et Grammaire

Questions 1 à 8

Briefly explain that the student will answer grammar and conjugation questions.

Do not add educational hints.

Then:

Commencer la partie

or an appropriate consistent CTA.

## Section introduction: Part B

Display:

Partie B : Vocabulaire de la Vie Quotidienne

Questions 9 à 14

Briefly explain that this section covers everyday vocabulary.

Do not provide hints.

## Section introduction: Part C

Display:

Partie C : Compréhension Écrite

Questions 15 à 20

Briefly explain that students should read the supplied texts and answer the related questions.

Do not provide hints.

## Question screen

Each question should display:

- current section
- question category where applicable
- Question X of 20
- compact overall progress
- instruction where applicable
- prompt
- note where applicable
- four answer choices
- Back
- Next

Use accessible real radio inputs.

Make the full option row clickable.

Clearly indicate the selected answer.

Do not show correctness.

Do not show hints.

Do not show explanations.

## Progress

Display:

Question X of 20

Use a compact progress bar or equivalent.

The student should always understand:

- where they are
- which section they are in
- how much assessment remains

Do not make progress visually overwhelming.

## Active answer state

For FA-03, selected answers remain in client/browser state only.

Recommended structure:

question id or question number
-> selected option key

Use:

A
B
C
D

as answer values.

Requirements:

- answer survives Next during the current flow
- answer survives Back during the current flow
- answer can be changed
- section transitions must not clear answers
- review screen can inspect current selections

Do not write answers to Supabase.

Do not calculate correctness.

## Unanswered questions

Students may move forward without choosing an answer.

Do not automatically select a choice.

Do not block Next merely because the question is unanswered.

The final Review Answers screen must identify unanswered questions.

## Back navigation

Back must allow the student to return through previous questions.

Do not lose answers.

At section boundaries, choose a sensible behavior.

Returning from Question 9 should allow access to Question 8 without creating broken section-state behavior.

Returning from Question 15 should allow access to Question 14.

Do not make navigation confusing.

## Reading experience

Questions 15-20 require passages.

### Questions 15 and 16

Display:

Texte 1 - Invitation

with the Invitation passage.

### Questions 17 and 18

Display:

Texte 2 - Annonce d'Hôtel

with the Hotel passage.

### Questions 19 and 20

Display:

Texte 3 - Courriel Professionnel Simple

with the Professional Email passage.

The passage must remain visible for both questions associated with it.

Do not require the student to remember the passage from the previous screen.

## Reading layout

Desktop/laptop:

A clean split layout is preferred when practical:

left:
reading passage

right:
question and answers

The exact proportions may be adjusted based on the existing design.

Both areas must remain usable at:

1366x768

Do not let a long passage push controls off screen unnecessarily.

Mobile:

stack passage above question.

No horizontal overflow.

## Review Answers screen

After Question 20, show a Review Answers screen.

Display:

- Questions 1-20
- answered/unanswered state
- selected option letter for answered questions
- total answered
- total unanswered

Example:

Answered: 17 of 20

Unanswered: 3

Strongly prefer allowing the student to click a question number or review item and return directly to that question.

If returning to a question from Review, provide a sensible path back to Review.

Do not show answer text as correct or incorrect.

## Review state styling

Use simple status language such as:

Answered
Not answered

Do not use:

Correct
Incorrect
Passed
Failed

## Final Review action

FA-03 must NOT submit the assessment.

Do not create a fake successful completion.

Use a clear non-production placeholder at the bottom of Review.

Suggested development state:

"Submission and scoring will be enabled in the next assessment step."

A disabled button labelled:

Submit Assessment

is acceptable if it is clearly unavailable.

Do not allow the attempt to become submitted.

FA-04 will activate final submission.

## Attempt lifecycle

FA-02 already creates the attempt.

FA-03 must not create a new attempt.

Before assessment content is returned:

attempt.status must be:

in_progress

FA-03 must not modify:

started_at
submitted_at
score
percentage

The attempt should remain:

in_progress

through the Review screen.

## Loading state

When assessment content is loading:

show a clean Toronto Academy assessment loading state.

Do not show an empty broken screen.

## Content retrieval failure

If the attempt token is invalid, expired from local flow, unavailable, or the RPC fails:

- show a clean generic error
- do not crash
- do not expose SQL/Supabase details
- do not expose internal student data
- offer a safe way to restart the assessment flow where appropriate

Suggested direction:

"We could not load your assessment. Please return to the assessment start and try again."

## Refresh behavior

Do not overengineer full answer persistence in FA-03.

Preserve whatever safe attempt-token/session behavior already exists from FA-02.

If answers held only in React state are lost after a hard browser refresh, document that explicitly as a known FA-03 limitation.

Do not persist answers merely to solve refresh behavior in this ticket.

Do not put student PII into URLs.

## Responsive behavior

Priority viewport sizes:

1366x768
1440x900
1536x864

Also support:

tablet
mobile

Requirements:

- no horizontal page scroll
- question text wraps naturally
- answer options remain readable
- buttons remain reachable
- progress fits
- reading passage fits
- split layout does not become cramped
- mobile reading layout stacks cleanly
- long French text can scroll naturally

## Accessibility

Use:

- semantic HTML
- appropriate headings
- fieldset and legend where appropriate
- real radio inputs
- keyboard selection
- visible focus states
- sufficient contrast
- accessible progress text
- descriptive button labels

The student must be able to navigate choices using keyboard controls.

## Migration

Create a version-controlled migration under:

supabase/migrations/

Suggested filename:

20260904190000_fa_03_a1_assessment_content.sql

If another timestamp is more appropriate, use it.

The migration must include:

- assessment_sections
- assessment_passages
- assessment_questions
- constraints
- indexes
- RLS
- required grants/revokes
- controlled assessment-content RPC
- 3 section seeds
- 3 passage seeds
- 20 question seeds

Do not include answer keys.

Do not include answer persistence.

Do not include scoring.

## Manual Supabase steps

Claude creates the migration only.

Claude must not:

- access the remote Supabase dashboard
- run SQL against the remote database
- read .env.local
- retrieve secret credentials
- use a service-role credential

The user will manually apply the migration through Supabase SQL Editor.

## Documentation

Create:

docs/assessment/fa-03-a1-assessment-engine.md

Document:

1. purpose of FA-03
2. assessment content architecture
3. assessment_sections schema
4. assessment_passages schema
5. assessment_questions schema
6. stable option-key format
7. content RPC security
8. assessment player flow
9. section transitions
10. question navigation
11. active answer state
12. reading passage behavior
13. Review Answers behavior
14. responsive behavior
15. accessibility considerations
16. migration instructions
17. verification SQL
18. known limitation: answers are not persisted
19. known limitation: refresh may lose active answers
20. known limitation: assessment cannot be submitted yet
21. what FA-04 will add

Do not include secrets.

## Environment files

Do not read .env.local.

Do not print .env.local.

Do not modify .env.local.

Do not commit environment files.

Do not introduce a service-role key.

## Security

- content retrieval requires a valid in-progress attempt
- no public unrestricted table reads
- no student PII returned with assessment content
- no answer keys
- no correct-answer data
- no student answer persistence
- no raw Supabase errors
- no PII in URLs
- no environment secrets
- no service-role key in browser or server source

## Out of scope

Do not implement:

- answer keys
- correct answer fields
- persisted answers
- assessment_answers table
- final submission
- submitted status
- submitted_at
- server scoring
- score calculation
- percentage calculation
- 60 percent benchmark evaluation
- result screen
- pass/fail
- explanations
- question feedback
- admin panel
- admin question editor
- invitation links
- email
- SMS
- GoHighLevel
- AI evaluation
- A2 assessment
- B1 assessment
- other assessment levels

## Files likely affected

Likely files include:

- supabase/migrations/*
- src/app/assessment/*
- src/components/assessment/*
- src/lib/assessment/*
- src/lib/supabase/*
- docs/assessment/fa-03-a1-assessment-engine.md

Claude may choose another reasonable component breakdown.

Do not rewrite unrelated landing, branding, or database functionality.

## Style rule

Use normal hyphens for English prose.

Do not use em dashes.

Do not use long hyphens.

Use straight quotes where practical outside source content.

Preserve French accents and punctuation in the supplied assessment content.

Do not strip or anglicize French characters.

## Validation

Run:

npm run lint
npx tsc --noEmit
npm run build
git diff --check

Fix implementation errors caused by FA-03.

## Done criteria

FA-03 is complete when:

- version-controlled migration exists
- assessment_sections table is defined
- assessment_passages table is defined
- assessment_questions table is defined
- RLS is enabled on all three content tables
- unrestricted anonymous content-table reads are not introduced
- controlled assessment-content RPC exists
- RPC requires a valid in-progress attempt
- RPC confirms french-a1-diagnostic
- RPC confirms assessment is active
- exactly 3 sections are seeded
- exactly 3 passages are seeded
- exactly 20 questions are seeded
- question numbers are 1 through 20
- grammar contains Questions 1-8
- vocabulary contains Questions 9-14
- reading contains Questions 15-20
- every question contains exactly four options
- option keys use A/B/C/D
- no answer-key columns exist
- no answer-key table exists
- no correct-answer data is seeded
- Assessment Ready placeholder is replaced
- Part A introduction works
- Questions 1-8 work
- Part B introduction works
- Questions 9-14 work
- Part C introduction works
- Questions 15-20 work
- Question X of 20 is visible
- overall progress is visible
- Back works
- Next works
- selected answers survive Back/Next during active session
- answers can be changed
- unanswered questions are allowed
- section transitions preserve answers
- correct passage appears for Questions 15-16
- correct passage appears for Questions 17-18
- correct passage appears for Questions 19-20
- Review Answers screen exists
- Review shows all 20 questions
- Review shows answered/unanswered state
- Review shows answered/unanswered totals
- Review may return to specific questions
- Review shows no correctness
- Review shows no score
- Review shows no percentage
- Review shows no pass/fail
- assessment remains in_progress
- submitted_at remains null
- score remains null
- percentage remains null
- no student answers are persisted
- no admin changes are made
- no authentication changes are made
- no service-role key is introduced
- .env.local remains unchanged
- documentation exists
- npm run lint passes
- npx tsc --noEmit passes
- npm run build passes
- git diff --check passes
