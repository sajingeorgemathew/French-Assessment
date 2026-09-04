import { z } from "zod";

/**
 * Types and parsers for the assessment content returned by the controlled RPC
 * public.get_french_assessment_content.
 *
 * The payload is presentation content only. It carries no student identifier,
 * no student information, no attempt result, and no correct-answer data of any
 * kind, because no correct-answer data exists in the FA-03 schema.
 */

/** Stable answer identifier. Option display text is never used as the value. */
export const ASSESSMENT_OPTION_KEYS = ["A", "B", "C", "D"] as const;

export type AssessmentOptionKey = (typeof ASSESSMENT_OPTION_KEYS)[number];

/**
 * strictObject is deliberate. If a future writer ever tried to attach an
 * is_correct style field to an option, parsing would fail here rather than let
 * the flag reach the browser bundle.
 */
const optionSchema = z.strictObject({
  key: z.enum(ASSESSMENT_OPTION_KEYS),
  text: z.string().min(1),
});

const assessmentMetaSchema = z.object({
  slug: z.literal("french-a1-diagnostic"),
  title: z.string().min(1),
  title_fr: z.string().nullable(),
  framework: z.string().min(1),
  level: z.string().min(1),
  total_questions: z.number().int().positive(),
});

const sectionSchema = z.object({
  id: z.uuid(),
  section_key: z.string().min(1),
  title: z.string().min(1),
  title_fr: z.string().nullable(),
  description: z.string().nullable(),
  position: z.number().int().positive(),
});

const passageSchema = z.object({
  id: z.uuid(),
  section_id: z.uuid(),
  passage_key: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
  position: z.number().int().positive(),
});

const questionSchema = z.object({
  id: z.uuid(),
  section_id: z.uuid(),
  passage_id: z.uuid().nullable(),
  question_number: z.number().int().positive(),
  category: z.string().nullable(),
  instruction: z.string().nullable(),
  prompt: z.string().min(1),
  note: z.string().nullable(),
  options: z.array(optionSchema).length(4),
  position: z.number().int().positive(),
});

/** Shape returned by public.get_french_assessment_content. */
export const assessmentContentRpcResultSchema = z.object({
  assessment: assessmentMetaSchema,
  sections: z.array(sectionSchema).min(1),
  passages: z.array(passageSchema),
  questions: z.array(questionSchema).min(1),
});

export type AssessmentOption = z.infer<typeof optionSchema>;

export type AssessmentContentMeta = {
  slug: string;
  title: string;
  titleFr: string | null;
  framework: string;
  level: string;
  totalQuestions: number;
};

export type AssessmentContentSection = {
  id: string;
  sectionKey: string;
  title: string;
  titleFr: string | null;
  description: string | null;
  position: number;
};

export type AssessmentContentPassage = {
  id: string;
  sectionId: string;
  passageKey: string;
  title: string;
  body: string;
  position: number;
};

export type AssessmentContentQuestion = {
  id: string;
  sectionId: string;
  passageId: string | null;
  questionNumber: number;
  category: string | null;
  instruction: string | null;
  prompt: string;
  note: string | null;
  options: AssessmentOption[];
  position: number;
};

export type AssessmentContent = {
  assessment: AssessmentContentMeta;
  sections: AssessmentContentSection[];
  passages: AssessmentContentPassage[];
  questions: AssessmentContentQuestion[];
};

/**
 * Maps the validated snake_case RPC payload onto the camelCase shape the player
 * components use, and sorts defensively so rendering never depends on the order
 * the database happened to return.
 */
export function toAssessmentContent(
  parsed: z.infer<typeof assessmentContentRpcResultSchema>,
): AssessmentContent {
  const byPosition = <T extends { position: number }>(a: T, b: T) =>
    a.position - b.position;

  return {
    assessment: {
      slug: parsed.assessment.slug,
      title: parsed.assessment.title,
      titleFr: parsed.assessment.title_fr,
      framework: parsed.assessment.framework,
      level: parsed.assessment.level,
      totalQuestions: parsed.assessment.total_questions,
    },
    sections: parsed.sections
      .map((section) => ({
        id: section.id,
        sectionKey: section.section_key,
        title: section.title,
        titleFr: section.title_fr,
        description: section.description,
        position: section.position,
      }))
      .sort(byPosition),
    passages: parsed.passages
      .map((passage) => ({
        id: passage.id,
        sectionId: passage.section_id,
        passageKey: passage.passage_key,
        title: passage.title,
        body: passage.body,
        position: passage.position,
      }))
      .sort(byPosition),
    questions: parsed.questions
      .map((question) => ({
        id: question.id,
        sectionId: question.section_id,
        passageId: question.passage_id,
        questionNumber: question.question_number,
        category: question.category,
        instruction: question.instruction,
        prompt: question.prompt,
        note: question.note,
        options: question.options,
        position: question.position,
      }))
      .sort(byPosition),
  };
}

/**
 * Active answers for the current browser session: question id to option key.
 * FA-03 never writes this map to Supabase.
 */
export type AssessmentAnswers = Readonly<
  Partial<Record<string, AssessmentOptionKey>>
>;

/** The only content failure text a student ever sees. */
export const GENERIC_ASSESSMENT_CONTENT_ERROR =
  "We could not load your assessment. Please return to the assessment start and try again.";
