"use server";

import {
  attemptTokenSchema,
  beginRpcResultSchema,
  GENERIC_ASSESSMENT_ERROR,
  registrationRpcResultSchema,
  type AssessmentActionResult,
  type AssessmentSession,
} from "@/lib/assessment-session";
import {
  studentInformationSchema,
  type StudentInformation,
} from "@/lib/student-information";
import { getAssessmentSupabaseClient } from "@/lib/supabase/server";

/**
 * Server boundary for the public French assessment flow.
 *
 * Both actions are reachable by direct POST, so each one revalidates its input
 * with the shared Zod schema before touching Supabase. Nothing here trusts the
 * browser, logs student PII, or returns a raw database error.
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
