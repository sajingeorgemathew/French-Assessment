-- FA-03 A1 Assessment Engine and Question Content
-- Toronto Academy of Education - French Language Evaluation and Diagnostic Assessment
--
-- This migration is the source of truth for the FA-03 database objects.
-- It creates:
--   public.assessment_sections
--   public.assessment_passages
--   public.assessment_questions
--   constraints and indexes for all three tables
--   row level security (deny by default, no anonymous table policies)
--   deliberate table and function privileges
--   public.get_french_assessment_content  (controlled content RPC)
--   3 seeded sections, 3 seeded passages, 20 seeded questions
--
-- The migration is written to be safely re-runnable.
--
-- It deliberately does NOT create:
--   answer keys, correct-answer columns, is_correct flags,
--   student answer storage, scoring, results or admin objects.
-- Those belong to FA-04 and later tickets.
--
-- FA-02 must be applied first. This migration depends on
-- public.assessments and public.assessment_attempts.

-- ---------------------------------------------------------------------------
-- 0. Dependency guard
-- ---------------------------------------------------------------------------
do $do$
begin
  if to_regclass('public.assessments') is null
     or to_regclass('public.assessment_attempts') is null then
    raise exception
      'FA-03 requires the FA-02 tables public.assessments and public.assessment_attempts. Apply the FA-02 migration first.';
  end if;
end
$do$;

-- ---------------------------------------------------------------------------
-- 1. public.assessment_sections
-- ---------------------------------------------------------------------------
create table if not exists public.assessment_sections (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  section_key text not null,
  title text not null,
  title_fr text,
  description text,
  position integer not null,
  created_at timestamptz not null default now(),
  constraint assessment_sections_position_positive check (position > 0),
  constraint assessment_sections_section_key_not_blank check (btrim(section_key) <> ''),
  constraint assessment_sections_title_not_blank check (btrim(title) <> ''),
  constraint assessment_sections_section_key_length check (char_length(section_key) <= 60),
  constraint assessment_sections_assessment_id_section_key_key unique (assessment_id, section_key),
  constraint assessment_sections_assessment_id_position_key unique (assessment_id, position)
);

-- Referenced by the composite foreign keys below, so a passage or a question can
-- never point at a section that belongs to a different assessment.
create unique index if not exists assessment_sections_id_assessment_id_key
  on public.assessment_sections (id, assessment_id);

create index if not exists assessment_sections_assessment_id_position_idx
  on public.assessment_sections (assessment_id, position);

comment on table public.assessment_sections is
  'FA-03: ordered parts of an assessment. Content only. Not readable by anon or authenticated roles.';

-- ---------------------------------------------------------------------------
-- 2. public.assessment_passages
-- ---------------------------------------------------------------------------
create table if not exists public.assessment_passages (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  -- section_id is constrained by the composite foreign key below rather than by
  -- a second single column one, so there is exactly one rule per relationship.
  section_id uuid not null,
  passage_key text not null,
  title text not null,
  body text not null,
  position integer not null,
  created_at timestamptz not null default now(),
  constraint assessment_passages_position_positive check (position > 0),
  constraint assessment_passages_passage_key_not_blank check (btrim(passage_key) <> ''),
  constraint assessment_passages_title_not_blank check (btrim(title) <> ''),
  constraint assessment_passages_body_not_blank check (btrim(body) <> ''),
  constraint assessment_passages_passage_key_length check (char_length(passage_key) <= 60),
  constraint assessment_passages_assessment_id_passage_key_key unique (assessment_id, passage_key),
  -- The section a passage belongs to must belong to the same assessment.
  constraint assessment_passages_section_same_assessment_fkey
    foreign key (section_id, assessment_id)
    references public.assessment_sections (id, assessment_id)
    on delete cascade
);

create unique index if not exists assessment_passages_id_assessment_id_key
  on public.assessment_passages (id, assessment_id);

create index if not exists assessment_passages_assessment_id_position_idx
  on public.assessment_passages (assessment_id, position);

create index if not exists assessment_passages_section_id_idx
  on public.assessment_passages (section_id);

comment on table public.assessment_passages is
  'FA-03: reading comprehension texts. Content only. Not readable by anon or authenticated roles.';

-- ---------------------------------------------------------------------------
-- 3. public.assessment_questions
-- ---------------------------------------------------------------------------
-- There is deliberately no correct_answer, correct_option, correct_option_key,
-- answer_key, expected_answer or is_correct column, and no answer key table.
-- Correct-answer data arrives in FA-04 behind a server-side boundary.
create table if not exists public.assessment_questions (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  -- section_id and passage_id are constrained by the composite foreign keys
  -- below rather than by second single column ones.
  section_id uuid not null,
  passage_id uuid,
  question_number integer not null,
  category text,
  instruction text,
  prompt text not null,
  note text,
  options jsonb not null,
  position integer not null,
  created_at timestamptz not null default now(),
  constraint assessment_questions_question_number_positive check (question_number > 0),
  constraint assessment_questions_position_positive check (position > 0),
  constraint assessment_questions_prompt_not_blank check (btrim(prompt) <> ''),
  constraint assessment_questions_assessment_id_question_number_key unique (assessment_id, question_number),
  constraint assessment_questions_assessment_id_position_key unique (assessment_id, position),
  -- Exactly four option objects, in stable A/B/C/D order, each with visible text.
  -- Every branch is null safe, because a CHECK expression that evaluated to NULL
  -- would otherwise be treated as satisfied.
  constraint assessment_questions_options_shape check (
    jsonb_typeof(options) = 'array'
    and coalesce(jsonb_typeof(options -> 0), '') = 'object'
    and coalesce(jsonb_typeof(options -> 1), '') = 'object'
    and coalesce(jsonb_typeof(options -> 2), '') = 'object'
    and coalesce(jsonb_typeof(options -> 3), '') = 'object'
    and options -> 4 is null
    and coalesce(options -> 0 ->> 'key', '') = 'A'
    and coalesce(options -> 1 ->> 'key', '') = 'B'
    and coalesce(options -> 2 ->> 'key', '') = 'C'
    and coalesce(options -> 3 ->> 'key', '') = 'D'
    and btrim(coalesce(options -> 0 ->> 'text', '')) <> ''
    and btrim(coalesce(options -> 1 ->> 'text', '')) <> ''
    and btrim(coalesce(options -> 2 ->> 'text', '')) <> ''
    and btrim(coalesce(options -> 3 ->> 'text', '')) <> ''
  ),
  -- An option object may hold "key" and "text" and nothing else. This makes it
  -- structurally impossible to smuggle an is_correct style flag into the options
  -- payload, from this migration or from any future writer.
  constraint assessment_questions_options_no_extra_fields check (
    coalesce(options -> 0, '{}'::jsonb) - 'key' - 'text' = '{}'::jsonb
    and coalesce(options -> 1, '{}'::jsonb) - 'key' - 'text' = '{}'::jsonb
    and coalesce(options -> 2, '{}'::jsonb) - 'key' - 'text' = '{}'::jsonb
    and coalesce(options -> 3, '{}'::jsonb) - 'key' - 'text' = '{}'::jsonb
  ),
  -- The section a question belongs to must belong to the same assessment.
  constraint assessment_questions_section_same_assessment_fkey
    foreign key (section_id, assessment_id)
    references public.assessment_sections (id, assessment_id)
    on delete cascade,
  -- And so must the passage, when the question has one. MATCH SIMPLE means the
  -- constraint is skipped while passage_id is null, which is the wanted
  -- behaviour for the fourteen non reading questions. NO ACTION is deliberate:
  -- a passage cannot be deleted out from under a question that shows it, but a
  -- cascading delete of the whole assessment still resolves within the
  -- statement.
  constraint assessment_questions_passage_same_assessment_fkey
    foreign key (passage_id, assessment_id)
    references public.assessment_passages (id, assessment_id)
);

create index if not exists assessment_questions_assessment_id_position_idx
  on public.assessment_questions (assessment_id, position);

create index if not exists assessment_questions_section_id_idx
  on public.assessment_questions (section_id);

create index if not exists assessment_questions_passage_id_idx
  on public.assessment_questions (passage_id);

comment on table public.assessment_questions is
  'FA-03: assessment questions and their A/B/C/D options. Holds no correct-answer information.';
comment on column public.assessment_questions.options is
  'FA-03: ordered array of exactly four {"key","text"} objects with keys A, B, C, D. No correctness data.';

-- ---------------------------------------------------------------------------
-- 4. Row level security
-- ---------------------------------------------------------------------------
-- Same deny by default posture as FA-02: RLS is enabled and no policies are
-- created, so anon and authenticated cannot select, insert, update or delete any
-- row of the content tables directly. Content only leaves the database through
-- the SECURITY DEFINER RPC below, which first proves that the caller holds a
-- valid in-progress attempt token.
alter table public.assessment_sections enable row level security;
alter table public.assessment_passages enable row level security;
alter table public.assessment_questions enable row level security;

-- Re-assert the deny by default posture if an earlier run added policies.
drop policy if exists assessment_sections_no_public_access on public.assessment_sections;
drop policy if exists assessment_passages_no_public_access on public.assessment_passages;
drop policy if exists assessment_questions_no_public_access on public.assessment_questions;

-- ---------------------------------------------------------------------------
-- 5. Table privileges
-- ---------------------------------------------------------------------------
-- RLS is not treated as the only boundary. Supabase grants broad table
-- privileges to anon and authenticated by default, so they are revoked here.
revoke all on table public.assessment_sections from public;
revoke all on table public.assessment_passages from public;
revoke all on table public.assessment_questions from public;

revoke all on table public.assessment_sections from anon, authenticated;
revoke all on table public.assessment_passages from anon, authenticated;
revoke all on table public.assessment_questions from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. RPC: public.get_french_assessment_content
-- ---------------------------------------------------------------------------
-- Returns everything needed to render the French A1 diagnostic, and nothing
-- else, for the holder of a valid in-progress attempt token.
--
-- Access checks, in order:
--   1. the attempt token must be a non null uuid
--   2. an attempt with that token must exist
--   3. the attempt status must be 'in_progress'
--   4. the linked assessment slug must be 'french-a1-diagnostic'
--   5. the linked assessment must be active
--
-- SECURITY DEFINER safeguards:
--   - explicit search_path with pg_temp pinned last
--   - every object reference is schema qualified
--   - no dynamic SQL anywhere
--   - declared STABLE and read only: the function runs no INSERT, UPDATE or
--     DELETE, so the attempt keeps its status, started_at, submitted_at, score
--     and percentage exactly as FA-02 left them
--   - returns content only: no student_id, name, email, phone or city, no score,
--     no percentage, no other attempts and no administrative fields
--   - returns no correct-answer information, because none is stored
--   - EXECUTE revoked from public, then granted only to anon and authenticated
create or replace function public.get_french_assessment_content(
  p_attempt_token uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $fn$
declare
  v_assessment_id uuid;
  v_assessment jsonb;
  v_sections jsonb;
  v_passages jsonb;
  v_questions jsonb;
begin
  if p_attempt_token is null then
    raise exception 'invalid_attempt_token' using errcode = '22023';
  end if;

  -- The attempt, its status, the assessment slug and the active flag are all
  -- verified in one lookup. Nothing about the student is selected.
  select s.id,
         jsonb_build_object(
           'slug', s.slug,
           'title', s.title,
           'title_fr', s.title_fr,
           'framework', s.framework,
           'level', s.level,
           'total_questions', s.total_questions
         )
    into v_assessment_id, v_assessment
  from public.assessment_attempts a
  join public.assessments s
    on s.id = a.assessment_id
  where a.attempt_token = p_attempt_token
    and a.status = 'in_progress'
    and s.slug = 'french-a1-diagnostic'
    and s.is_active
  limit 1;

  if v_assessment_id is null then
    -- One generic failure for every rejected case, so a caller cannot tell an
    -- unknown token apart from an attempt that has not been started.
    raise exception 'assessment_content_unavailable' using errcode = 'P0002';
  end if;

  select coalesce(jsonb_agg(
           jsonb_build_object(
             'id', sec.id,
             'section_key', sec.section_key,
             'title', sec.title,
             'title_fr', sec.title_fr,
             'description', sec.description,
             'position', sec.position
           )
           order by sec.position
         ), '[]'::jsonb)
    into v_sections
  from public.assessment_sections sec
  where sec.assessment_id = v_assessment_id;

  select coalesce(jsonb_agg(
           jsonb_build_object(
             'id', p.id,
             'section_id', p.section_id,
             'passage_key', p.passage_key,
             'title', p.title,
             'body', p.body,
             'position', p.position
           )
           order by p.position
         ), '[]'::jsonb)
    into v_passages
  from public.assessment_passages p
  where p.assessment_id = v_assessment_id;

  -- Only presentation columns are projected. There is no correct-answer column
  -- on this table to project in the first place.
  select coalesce(jsonb_agg(
           jsonb_build_object(
             'id', q.id,
             'section_id', q.section_id,
             'passage_id', q.passage_id,
             'question_number', q.question_number,
             'category', q.category,
             'instruction', q.instruction,
             'prompt', q.prompt,
             'note', q.note,
             'options', q.options,
             'position', q.position
           )
           order by q.position
         ), '[]'::jsonb)
    into v_questions
  from public.assessment_questions q
  where q.assessment_id = v_assessment_id;

  return jsonb_build_object(
    'assessment', v_assessment,
    'sections', v_sections,
    'passages', v_passages,
    'questions', v_questions
  );
end;
$fn$;

comment on function public.get_french_assessment_content(uuid) is
  'FA-03: controlled read only assessment content for a valid in-progress attempt. Returns no student PII and no correct-answer data.';

revoke all on function public.get_french_assessment_content(uuid) from public;
grant execute on function public.get_french_assessment_content(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. Seed guard
-- ---------------------------------------------------------------------------
-- Every seed below is scoped to the french-a1-diagnostic assessment created by
-- FA-02. No other assessment row is read or written.
do $do$
begin
  if not exists (
    select 1
    from public.assessments a
    where a.slug = 'french-a1-diagnostic'
  ) then
    raise exception
      'FA-03 requires the FA-02 french-a1-diagnostic assessment row. Apply the FA-02 migration first.';
  end if;
end
$do$;

-- ---------------------------------------------------------------------------
-- 8. Seed exactly three sections
-- ---------------------------------------------------------------------------
-- Idempotent: section_key is unique per assessment, so a repeat run refreshes
-- the three rows instead of adding duplicates. Positions are stable, so the
-- (assessment_id, position) unique constraint is never disturbed.
with target as (
  select a.id as assessment_id
  from public.assessments a
  where a.slug = 'french-a1-diagnostic'
)
insert into public.assessment_sections (
  assessment_id,
  section_key,
  title,
  title_fr,
  description,
  position
)
select t.assessment_id, v.section_key, v.title, v.title_fr, v.description, v.seq
from target t
cross join (
  values
    ('grammar',
     'Conjugation and Grammar',
     'Partie A : Conjugaison et Grammaire',
     'Questions 1 à 8',
     1),
    ('vocabulary',
     'Everyday Vocabulary',
     'Partie B : Vocabulaire de la Vie Quotidienne',
     'Questions 9 à 14',
     2),
    ('reading',
     'Reading Comprehension',
     'Partie C : Compréhension Écrite',
     'Questions 15 à 20',
     3)
) as v(section_key, title, title_fr, description, seq)
on conflict (assessment_id, section_key) do update
  set title = excluded.title,
      title_fr = excluded.title_fr,
      description = excluded.description,
      position = excluded.position;

-- ---------------------------------------------------------------------------
-- 9. Seed exactly three reading passages
-- ---------------------------------------------------------------------------
-- All three belong to the reading section of french-a1-diagnostic.
with target as (
  select a.id as assessment_id, sec.id as section_id
  from public.assessments a
  join public.assessment_sections sec
    on sec.assessment_id = a.id
   and sec.section_key = 'reading'
  where a.slug = 'french-a1-diagnostic'
)
insert into public.assessment_passages (
  assessment_id,
  section_id,
  passage_key,
  title,
  body,
  position
)
select t.assessment_id, t.section_id, v.passage_key, v.title, v.body, v.seq
from target t
cross join (
  values
    ('invitation',
     'Texte 1 - Invitation',
     '« Cher Marc,
Je t''invite à mon anniversaire ce samedi 15 octobre à 20h chez moi. Nous allons manger une pizza et écouter de la musique. Merci de me confirmer ta présence avant jeudi.
À bientôt, Sophie. »',
     1),
    ('hotel',
     'Texte 2 - Annonce d''Hôtel',
     '« Hôtel de la Gare - Petit-déjeuner servi de 7h00 à 10h00 dans la salle principale. Connexion Wi-Fi gratuite (Code : Hotel2026). Départ des chambres avant 11h00. »',
     2),
    ('professional-email',
     'Texte 3 - Courriel Professionnel Simple',
     '« Bonjour M. Dupont,
Notre réunion de projet est déplacée au mardi 4 août à 14h30 dans la salle B20. Merci d''apporter votre ordinateur portable.
Cordialement,
Claire Martin »',
     3)
) as v(passage_key, title, body, seq)
on conflict (assessment_id, passage_key) do update
  set section_id = excluded.section_id,
      title = excluded.title,
      body = excluded.body,
      position = excluded.position;

-- ---------------------------------------------------------------------------
-- 10. Seed exactly twenty questions
-- ---------------------------------------------------------------------------
-- Questions 1 to 8   -> grammar
-- Questions 9 to 14  -> vocabulary
-- Questions 15 to 20 -> reading, each attached to its passage
--
-- The wording, accents and punctuation below are the supplied source content
-- and are reproduced verbatim. No correct answer is recorded anywhere.
with target as (
  select a.id as assessment_id
  from public.assessments a
  where a.slug = 'french-a1-diagnostic'
),
seed(question_number, section_key, passage_key, category, instruction, prompt, note, options, seq) as (
  values
    (1,
     'grammar',
     null::text,
     'Grammaire - Être',
     'Choisissez la forme correcte du verbe être pour compléter la phrase :',
     '« Salut ! Nous ___ très contents de vous voir. »',
     null::text,
     '[{"key":"A","text":"êtes"},{"key":"B","text":"sommes"},{"key":"C","text":"sont"},{"key":"D","text":"somme"}]'::jsonb,
     1),
    (2,
     'grammar',
     null,
     'Grammaire - Négation',
     'Quelle est la forme négative correcte de la phrase :',
     '« Je mange de la viande. »',
     null,
     '[{"key":"A","text":"Je ne mange pas de la viande."},{"key":"B","text":"Je mange pas de viande."},{"key":"C","text":"Je ne mange pas de viande."},{"key":"D","text":"Je ne pas mange de viande."}]'::jsonb,
     2),
    (3,
     'grammar',
     null,
     'Grammaire - Possessifs',
     'Complétez avec l''adjectif possessif adéquat :',
     '« Voici Marie. C''est ___ amie. »',
     'Remarque : amie est un nom féminin commençant par une voyelle',
     '[{"key":"A","text":"ma"},{"key":"B","text":"mon"},{"key":"C","text":"sa"},{"key":"D","text":"mes"}]'::jsonb,
     3),
    (4,
     'grammar',
     null,
     'Grammaire - Verbes en -ER',
     'Sélectionnez la conjugaison exacte du verbe habiter :',
     '« Où ___ -vous en ce moment ? »',
     null,
     '[{"key":"A","text":"habitez"},{"key":"B","text":"habites"},{"key":"C","text":"habitons"},{"key":"D","text":"habitent"}]'::jsonb,
     4),
    (5,
     'grammar',
     null,
     'Grammaire - Verbe Aller',
     'Choisissez le verbe approprié :',
     '« Demain, ils ___ au cinéma avec des collègues. »',
     null,
     '[{"key":"A","text":"vas"},{"key":"B","text":"vont"},{"key":"C","text":"allez"},{"key":"D","text":"allons"}]'::jsonb,
     5),
    (6,
     'grammar',
     null,
     'Grammaire - Accord des adjectifs',
     'Complétez avec l''adjectif correctement accordé :',
     '« Mes sœurs sont très ___. »',
     null,
     '[{"key":"A","text":"intelligent"},{"key":"B","text":"intelligente"},{"key":"C","text":"intelligents"},{"key":"D","text":"intelligentes"}]'::jsonb,
     6),
    (7,
     'grammar',
     null,
     'Grammaire - Articles définis / indéfinis',
     'Choisissez le bon article :',
     '« Est-ce que tu as ___ stylo bleu pour signer le document ? »',
     null,
     '[{"key":"A","text":"un"},{"key":"B","text":"une"},{"key":"C","text":"des"},{"key":"D","text":"la"}]'::jsonb,
     7),
    (8,
     'grammar',
     null,
     'Grammaire - Questions',
     null,
     'Quelle structure est correcte pour poser une question polie ?',
     null,
     '[{"key":"A","text":"Où habite vous ?"},{"key":"B","text":"Où est-ce que vous habitez ?"},{"key":"C","text":"Vous habitez quoi ?"},{"key":"D","text":"Est-ce que où vous habitez ?"}]'::jsonb,
     8),
    (9,
     'vocabulary',
     null,
     'Vocabulaire - Routines',
     'Quel mot complète logiquement la phrase suivante ?',
     '« Le matin, je prends mon ___ à 8 heures. »',
     null,
     '[{"key":"A","text":"dîner"},{"key":"B","text":"déjeuner"},{"key":"C","text":"petit-déjeuner"},{"key":"D","text":"goûter"}]'::jsonb,
     9),
    (10,
     'vocabulary',
     null,
     'Vocabulaire - Les Heures',
     null,
     'Comment écrit-on en toutes lettres : 14h30 ?',
     null,
     '[{"key":"A","text":"Quatorze heures et quart"},{"key":"B","text":"Deux heures et demie du matin"},{"key":"C","text":"Quatorze heures et demie (ou deux heures et demie de l''après-midi)"},{"key":"D","text":"Seize heures trente"}]'::jsonb,
     10),
    (11,
     'vocabulary',
     null,
     'Vocabulaire - La Famille',
     null,
     'Le frère de mon père est mon ___ :',
     null,
     '[{"key":"A","text":"cousin"},{"key":"B","text":"oncle"},{"key":"C","text":"grand-père"},{"key":"D","text":"neveu"}]'::jsonb,
     11),
    (12,
     'vocabulary',
     null,
     'Vocabulaire - Au Restaurant',
     null,
     'Quelle phrase utilise-t-on pour demander l''addition au café ?',
     null,
     '[{"key":"A","text":"L''addition, s''il vous plaît."},{"key":"B","text":"Combien ça coûte la carte ?"},{"key":"C","text":"Je veux payer le repas maintenant."},{"key":"D","text":"Où est le menu ?"}]'::jsonb,
     12),
    (13,
     'vocabulary',
     null,
     'Vocabulaire - Nombres',
     null,
     'Quel est le nombre correct pour 75 en français standard ?',
     null,
     '[{"key":"A","text":"Soixante-cinq"},{"key":"B","text":"Septante-cinq"},{"key":"C","text":"Soixante-quinze"},{"key":"D","text":"Quatre-vingts"}]'::jsonb,
     13),
    (14,
     'vocabulary',
     null,
     'Vocabulaire - Les Jours',
     null,
     'Si aujourd''hui nous sommes mardi, quel jour serons-nous après-demain ?',
     null,
     '[{"key":"A","text":"Mercredi"},{"key":"B","text":"Jeudi"},{"key":"C","text":"Vendredi"},{"key":"D","text":"Lundi"}]'::jsonb,
     14),
    (15,
     'reading',
     'invitation',
     null,
     null,
     'Qui organise la fête d''anniversaire ?',
     null,
     '[{"key":"A","text":"Marc"},{"key":"B","text":"Sophie"},{"key":"C","text":"Le restaurateur"},{"key":"D","text":"Un collègue"}]'::jsonb,
     15),
    (16,
     'reading',
     'invitation',
     null,
     null,
     'Quand Marc doit-il répondre au plus tard ?',
     null,
     '[{"key":"A","text":"Samedi"},{"key":"B","text":"Vendredi"},{"key":"C","text":"Jeudi"},{"key":"D","text":"Dimanche"}]'::jsonb,
     16),
    (17,
     'reading',
     'hotel',
     null,
     null,
     'À quelle heure se termine le petit-déjeuner ?',
     null,
     '[{"key":"A","text":"7h00"},{"key":"B","text":"10h00"},{"key":"C","text":"11h00"},{"key":"D","text":"12h00"}]'::jsonb,
     17),
    (18,
     'reading',
     'hotel',
     null,
     null,
     'Quelle est l''instruction concernant le départ (check-out) ?',
     null,
     '[{"key":"A","text":"Libérer la chambre avant 10h00."},{"key":"B","text":"Libérer la chambre avant 11h00."},{"key":"C","text":"Payer à 7h00 du matin."},{"key":"D","text":"Demander le code Wi-Fi à 11h00."}]'::jsonb,
     18),
    (19,
     'reading',
     'professional-email',
     null,
     null,
     'Quel est l''objet de ce courriel ?',
     null,
     '[{"key":"A","text":"Annuler des vacances"},{"key":"B","text":"Changer l''heure et la date d''une réunion"},{"key":"C","text":"Commander un nouvel ordinateur"},{"key":"D","text":"Inviter à un déjeuner"}]'::jsonb,
     19),
    (20,
     'reading',
     'professional-email',
     null,
     null,
     'Que doit apporter M. Dupont ?',
     null,
     '[{"key":"A","text":"Un dossier papier"},{"key":"B","text":"Son ordinateur portable"},{"key":"C","text":"Un stylo"},{"key":"D","text":"Son passeport"}]'::jsonb,
     20)
)
insert into public.assessment_questions (
  assessment_id,
  section_id,
  passage_id,
  question_number,
  category,
  instruction,
  prompt,
  note,
  options,
  position
)
select t.assessment_id,
       sec.id,
       psg.id,
       q.question_number,
       q.category,
       q.instruction,
       q.prompt,
       q.note,
       q.options,
       q.seq
from seed q
cross join target t
join public.assessment_sections sec
  on sec.assessment_id = t.assessment_id
 and sec.section_key = q.section_key
left join public.assessment_passages psg
  on psg.assessment_id = t.assessment_id
 and psg.passage_key = q.passage_key
on conflict (assessment_id, question_number) do update
  set section_id = excluded.section_id,
      passage_id = excluded.passage_id,
      category = excluded.category,
      instruction = excluded.instruction,
      prompt = excluded.prompt,
      note = excluded.note,
      options = excluded.options,
      position = excluded.position;

-- ---------------------------------------------------------------------------
-- 11. Seed assertions
-- ---------------------------------------------------------------------------
-- Fail loudly rather than leave the assessment half seeded.
do $do$
declare
  v_assessment_id uuid;
  v_sections integer;
  v_passages integer;
  v_questions integer;
  v_reading_without_passage integer;
begin
  select a.id into v_assessment_id
  from public.assessments a
  where a.slug = 'french-a1-diagnostic';

  select count(*) into v_sections
  from public.assessment_sections s
  where s.assessment_id = v_assessment_id;

  select count(*) into v_passages
  from public.assessment_passages p
  where p.assessment_id = v_assessment_id;

  select count(*) into v_questions
  from public.assessment_questions q
  where q.assessment_id = v_assessment_id;

  select count(*) into v_reading_without_passage
  from public.assessment_questions q
  join public.assessment_sections s on s.id = q.section_id
  where q.assessment_id = v_assessment_id
    and s.section_key = 'reading'
    and q.passage_id is null;

  if v_sections <> 3 then
    raise exception 'FA-03 seed check failed: expected 3 sections, found %', v_sections;
  end if;

  if v_passages <> 3 then
    raise exception 'FA-03 seed check failed: expected 3 passages, found %', v_passages;
  end if;

  if v_questions <> 20 then
    raise exception 'FA-03 seed check failed: expected 20 questions, found %', v_questions;
  end if;

  if v_reading_without_passage <> 0 then
    raise exception 'FA-03 seed check failed: % reading questions have no passage', v_reading_without_passage;
  end if;
end
$do$;
