import { z } from "zod";

import { ASSESSMENT_OPTION_KEYS } from "@/lib/assessment-content";

/**
 * Types and parsers for the final submission and the result it produces.
 *
 * There is deliberately no answer key, no correct-answer table, no scoring
 * table and no correctness comparison anywhere in this module or anywhere else
 * in the application. Scoring happens only inside
 * public.submit_french_assessment. The browser sends question ids and option
 * keys, and the database sends back a score it calculated itself.
 */

/**
 * The submission payload: question id -> selected option key.
 *
 * Unanswered questions are simply absent. The browser never sends a null entry,
 * a score, a percentage or a correctness flag, and the RPC would reject any of
 * them as an unknown question id or an invalid option value.
 */
export const submissionAnswersSchema = z
  .record(z.uuid(), z.enum(ASSESSMENT_OPTION_KEYS))
  // A twenty question assessment can never legitimately produce more entries
  // than this, so an oversized object is rejected before it reaches Supabase.
  // The RPC applies its own limit as well.
  .refine((answers) => Object.keys(answers).length <= 50, {
    message: "Too many answers were supplied.",
  });

export type AssessmentSubmissionAnswers = z.infer<
  typeof submissionAnswersSchema
>;

/**
 * Shape returned by public.submit_french_assessment.
 *
 * Every field is a result fact the database calculated. The parse is strict:
 * a payload that somehow carried extra data would still be narrowed to exactly
 * these fields before anything is handed to the client.
 */
export const submissionRpcResultSchema = z.object({
  status: z.literal("submitted"),
  score: z.number().int().min(0),
  percentage: z.number().min(0).max(100),
  total_questions: z.number().int().positive(),
  submitted_at: z.string().min(1),
  level: z.string().min(1),
});

/** Minimal result the player renders. It holds no PII and no correctness data. */
export type AssessmentResultData = {
  status: "submitted";
  score: number;
  totalQuestions: number;
  percentage: number;
  level: string;
  submittedAt: string;
};

export function toAssessmentResult(
  parsed: z.infer<typeof submissionRpcResultSchema>,
): AssessmentResultData {
  return {
    status: parsed.status,
    score: parsed.score,
    totalQuestions: parsed.total_questions,
    percentage: parsed.percentage,
    level: parsed.level,
    submittedAt: parsed.submitted_at,
  };
}

/**
 * Formats the server calculated percentage for display. The value arrives as a
 * numeric with up to two decimal places, so 60 renders as "60" and a future
 * assessment length that produced 66.67 would keep its precision.
 */
export function formatPercentage(percentage: number): string {
  return Number.isInteger(percentage)
    ? String(percentage)
    : String(Number(percentage.toFixed(2)));
}

/**
 * The only submission failure text a student ever sees. Raw Supabase or
 * PostgreSQL messages are never forwarded to the browser.
 */
export const GENERIC_ASSESSMENT_SUBMISSION_ERROR =
  "We could not submit your assessment right now. Your answers are still here. Please try again.";
