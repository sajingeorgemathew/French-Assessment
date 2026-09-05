import { redirect } from "next/navigation";
import { connection } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminSupabaseServerClient } from "@/lib/supabase/auth-server";
import {
  ADMIN_LOGIN_NOTICE_PARAM,
  ADMIN_LOGIN_NOTICES,
  ADMIN_LOGIN_PATH,
} from "@/lib/admin/admin-session";

/**
 * Server side authorization for the Toronto Academy admin area.
 *
 * Two separate questions are answered here, in order:
 *
 *   1. Who is this user?  supabase.auth.getUser() re-validates the session with
 *      the Supabase Auth server, so the answer never comes from an unverified
 *      cookie payload that a browser could have edited.
 *
 *   2. Is this user a French Assessment administrator?  public
 *      .is_french_assessment_admin() answers that in the database, from
 *      auth.uid(). No user id is sent from here, so nothing in the request can
 *      claim another person's identity.
 *
 * Neither check is the last line of defence. public.get_french_admin_dashboard
 * repeats the authorization check itself before it reads a single row, so a
 * caller who bypassed the application entirely still gets nothing.
 */

/** Logs a short, PII free marker so failures are diagnosable in server logs. */
function logFailure(operation: string, reason: string) {
  console.error(`[admin] ${operation} failed: ${reason}`);
}

/** The minimal admin context a protected route needs. No auth metadata. */
export type FrenchAssessmentAdmin = {
  userId: string;
  email: string | null;
};

/**
 * Builds the request scoped admin client, or null when Supabase is not
 * configured. The configuration error names environment variables only, and is
 * kept out of the response entirely.
 */
async function createAdminSupabaseServerClientOrNull(): Promise<SupabaseClient | null> {
  try {
    return await createAdminSupabaseServerClient();
  } catch {
    logFailure("guard", "supabase client could not be created");
    return null;
  }
}

/**
 * Asks the database whether the current session belongs to an active French
 * Assessment administrator. Returns false for every failure, so an unexpected
 * error can never be mistaken for a granted permission.
 */
export async function isActiveFrenchAssessmentAdmin(
  supabase: SupabaseClient,
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("is_french_assessment_admin");

    if (error) {
      logFailure("authorization", `rpc error code ${error.code ?? "unknown"}`);
      return false;
    }

    return data === true;
  } catch {
    logFailure("authorization", "unexpected server error");
    return false;
  }
}

/**
 * The guard used by the protected admin layout.
 *
 * Anonymous or expired sessions are sent to the login page. Authenticated
 * accounts that are not active administrators are also sent there, with a
 * generic notice, and are never shown dashboard data.
 *
 * The redirect calls are outside every try/catch on purpose: redirect() signals
 * by throwing, and swallowing that would silently render a protected page.
 */
export async function requireFrenchAssessmentAdmin(): Promise<FrenchAssessmentAdmin> {
  // The admin area is per request by definition: it must never be prerendered
  // at build time or served from a shared cache. Calling connection() first
  // also keeps the prerender bail-out out of the try/catch blocks below, so a
  // Next.js control flow signal is never mistaken for a Supabase failure.
  await connection();

  const supabase = await createAdminSupabaseServerClientOrNull();

  if (!supabase) {
    redirect(ADMIN_LOGIN_PATH);
  }

  let userId: string | null = null;
  let email: string | null = null;

  try {
    const { data, error } = await supabase.auth.getUser();

    if (!error && data.user) {
      userId = data.user.id;
      email = data.user.email ?? null;
    }
  } catch {
    logFailure("guard", "unexpected error verifying the session");
  }

  if (!userId) {
    redirect(ADMIN_LOGIN_PATH);
  }

  const authorized = await isActiveFrenchAssessmentAdmin(supabase);

  if (!authorized) {
    redirect(
      `${ADMIN_LOGIN_PATH}?${ADMIN_LOGIN_NOTICE_PARAM}=${ADMIN_LOGIN_NOTICES.notAuthorized}`,
    );
  }

  return { userId, email };
}
