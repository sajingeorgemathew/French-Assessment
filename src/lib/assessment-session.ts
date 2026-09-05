import { z } from "zod";

/**
 * Types and parsers for the browser facing assessment session.
 *
 * The only identifier the browser ever holds is the opaque attempt token. It
 * carries no PII, is never placed in a URL or query parameter, and cannot be
 * used to read any table directly.
 */

/**
 * Attempt statuses the registration and begin RPCs can produce. The terminal
 * 'submitted' status is only ever produced by the FA-04 scoring RPC, and is
 * modelled by submissionRpcResultSchema in @/lib/assessment-result.
 */
export const ATTEMPT_STATUSES = ["registered", "in_progress"] as const;

export type AttemptStatus = (typeof ATTEMPT_STATUSES)[number];

/** Shape returned by public.start_french_assessment. */
export const registrationRpcResultSchema = z.object({
  attempt_token: z.uuid(),
  status: z.enum(ATTEMPT_STATUSES),
});

/** Shape returned by public.begin_french_assessment. */
export const beginRpcResultSchema = z.object({
  attempt_token: z.uuid(),
  status: z.enum(ATTEMPT_STATUSES),
  started_at: z.string().nullable(),
});

export const attemptTokenSchema = z.uuid();

/** Minimal success payload handed back to the assessment flow. */
export type AssessmentSession = {
  attemptToken: string;
  status: AttemptStatus;
};

export type AssessmentActionResult<TData> =
  | { ok: true; data: TData }
  | { ok: false; message: string };

/**
 * The only failure text a student ever sees. Raw Supabase or PostgreSQL
 * messages are never forwarded to the browser.
 */
export const GENERIC_ASSESSMENT_ERROR =
  "We could not start your assessment right now. Please try again.";
