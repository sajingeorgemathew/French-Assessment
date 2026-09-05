"use server";

import {
  assessmentContentRpcResultSchema,
  GENERIC_ASSESSMENT_CONTENT_ERROR,
  toAssessmentContent,
  type AssessmentContent,
} from "@/lib/assessment-content";
import {
  attemptTokenSchema,
  beginRpcResultSchema,
  GENERIC_ASSESSMENT_ERROR,
  registrationRpcResultSchema,
  type AssessmentActionResult,
  type AssessmentSession,
} from "@/lib/assessment-session";
import {
  GENERIC_ASSESSMENT_SUBMISSION_ERROR,
  submissionAnswersSchema,
  submissionRpcResultSchema,
  toAssessmentResult,
  type AssessmentResultData,
  type AssessmentSubmissionAnswers,
} from "@/lib/assessment-result";
import {
  studentInformationSchema,
  type StudentInformation,
} from "@/lib/student-information";
import { getAssessmentSupabaseClient } from "@/lib/supabase/server";

/**
 * Server boundary for the public French assessment flow.
 *
 * Every action is reachable by direct POST, so each one revalidates its input
 * with the shared Zod schema before touching Supabase. Nothing here trusts the
 * browser, logs student PII, or returns a raw database error.
 *
 * No action in this module scores anything. Correct answers live only in
 * private.assessment_answer_keys and are read only by the scoring RPC, so there
 * is no answer key to import here and nothing to compare.
 */

/** Logs a short, PII free marker so failures are diagnosable in server logs. */
function logFailure(operation: string, reason: string) {
  console.error(`[assessment] ${operation} failed: ${reason}`);
}

const failure = (message = GENERIC_ASSESSMENT_ERROR) =>
  ({ ok: false, message }) as const;

/**
 * Validates student information on the server, then calls the controlled
 * registration RPC. On success the database holds the student plus a new
 * attempt with status 'registered', and only the opaque token comes back.
 */
export async function registerFrenchAssessmentStudent(
  values: StudentInformation,
): Promise<AssessmentActionResult<AssessmentSession>> {
  const parsed = studentInformationSchema.safeParse(values);

  if (!parsed.success) {
    logFailure("registration", "server validation rejected the submission");
    return failure(
      "Please check your details and try again.",
    );
  }

  const student = parsed.data;

  try {
    const supabase = getAssessmentSupabaseClient();

    const { data, error } = await supabase.rpc("start_french_assessment", {
      p_full_name: student.fullName,
      p_email: student.email,
      p_phone: student.phone,
      p_city: student.city || null,
      p_status_in_canada: student.statusInCanada || null,
      p_current_french_level: student.frenchLevel || null,
      p_french_learning_goal: student.learningGoal || null,
    });

    if (error) {
      logFailure("registration", `rpc error code ${error.code ?? "unknown"}`);
      return failure();
    }

    const result = registrationRpcResultSchema.safeParse(data);

    if (!result.success) {
      logFailure("registration", "unexpected rpc response shape");
      return failure();
    }

    return {
      ok: true,
      data: {
        attemptToken: result.data.attempt_token,
        status: result.data.status,
      },
    };
  } catch {
    logFailure("registration", "unexpected server error");
    return failure();
  }
}

/**
 * Moves an existing attempt to 'in_progress'. It receives the opaque token and
 * nothing else, and the RPC is safe to call more than once for the same token.
 */
export async function beginFrenchAssessment(
  attemptToken: string,
): Promise<AssessmentActionResult<AssessmentSession>> {
  const parsedToken = attemptTokenSchema.safeParse(attemptToken);

  if (!parsedToken.success) {
    logFailure("begin", "attempt token was not a uuid");
    return failure();
  }

  try {
    const supabase = getAssessmentSupabaseClient();

    const { data, error } = await supabase.rpc("begin_french_assessment", {
      p_attempt_token: parsedToken.data,
    });

    if (error) {
      logFailure("begin", `rpc error code ${error.code ?? "unknown"}`);
      return failure();
    }

    const result = beginRpcResultSchema.safeParse(data);

    if (!result.success) {
      logFailure("begin", "unexpected rpc response shape");
      return failure();
    }

    return {
      ok: true,
      data: {
        attemptToken: result.data.attempt_token,
        status: result.data.status,
      },
    };
  } catch {
    logFailure("begin", "unexpected server error");
    return failure();
  }
}

/**
 * Loads the French A1 assessment content for an attempt that is already
 * in_progress.
 *
 * The RPC performs the real authorisation: it only returns content when the
 * token matches an existing attempt, that attempt is in_progress, and the
 * linked assessment is the active french-a1-diagnostic. It is read only, so
 * calling it never changes status, started_at, submitted_at, score or
 * percentage, and it returns no student information.
 */
export async function getFrenchAssessmentContent(
  attemptToken: string,
): Promise<AssessmentActionResult<AssessmentContent>> {
  const parsedToken = attemptTokenSchema.safeParse(attemptToken);

  if (!parsedToken.success) {
    logFailure("content", "attempt token was not a uuid");
    return failure(GENERIC_ASSESSMENT_CONTENT_ERROR);
  }

  try {
    const supabase = getAssessmentSupabaseClient();

    const { data, error } = await supabase.rpc(
      "get_french_assessment_content",
      { p_attempt_token: parsedToken.data },
    );

    if (error) {
      logFailure("content", `rpc error code ${error.code ?? "unknown"}`);
      return failure(GENERIC_ASSESSMENT_CONTENT_ERROR);
    }

    const result = assessmentContentRpcResultSchema.safeParse(data);

    if (!result.success) {
      logFailure("content", "unexpected rpc response shape");
      return failure(GENERIC_ASSESSMENT_CONTENT_ERROR);
    }

    return { ok: true, data: toAssessmentContent(result.data) };
  } catch {
    logFailure("content", "unexpected server error");
    return failure(GENERIC_ASSESSMENT_CONTENT_ERROR);
  }
}

/**
 * Submits the student's final answers and returns the authoritative result.
 *
 * This action is a transport boundary, not a scoring boundary. It validates the
 * attempt token and the answer map, hands them to
 * public.submit_french_assessment, and validates what comes back. It never
 * calculates a score or a percentage, never decides whether an answer is
 * correct, never imports or reads an answer key, and never accepts a score,
 * percentage or correctness flag from the browser: the only client supplied
 * values that leave this function are the opaque token and a map of question id
 * to A/B/C/D.
 *
 * The RPC is idempotent. Calling it again for an attempt that is already
 * submitted returns the stored result and changes nothing.
 */
export async function submitFrenchAssessment(
  attemptToken: string,
  answers: AssessmentSubmissionAnswers,
): Promise<AssessmentActionResult<AssessmentResultData>> {
  const parsedToken = attemptTokenSchema.safeParse(attemptToken);

  if (!parsedToken.success) {
    logFailure("submission", "attempt token was not a uuid");
    return failure(GENERIC_ASSESSMENT_SUBMISSION_ERROR);
  }

  const parsedAnswers = submissionAnswersSchema.safeParse(answers);

  if (!parsedAnswers.success) {
    logFailure("submission", "answer payload failed validation");
    return failure(GENERIC_ASSESSMENT_SUBMISSION_ERROR);
  }

  try {
    const supabase = getAssessmentSupabaseClient();

    const { data, error } = await supabase.rpc("submit_french_assessment", {
      p_attempt_token: parsedToken.data,
      p_answers: parsedAnswers.data,
    });

    if (error) {
      logFailure("submission", `rpc error code ${error.code ?? "unknown"}`);
      return failure(GENERIC_ASSESSMENT_SUBMISSION_ERROR);
    }

    const result = submissionRpcResultSchema.safeParse(data);

    if (!result.success) {
      logFailure("submission", "unexpected rpc response shape");
      return failure(GENERIC_ASSESSMENT_SUBMISSION_ERROR);
    }

    // Only the narrow, validated result leaves the server.
    return { ok: true, data: toAssessmentResult(result.data) };
  } catch {
    logFailure("submission", "unexpected server error");
    return failure(GENERIC_ASSESSMENT_SUBMISSION_ERROR);
  }
}
