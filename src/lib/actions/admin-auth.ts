"use server";

import { redirect } from "next/navigation";

import {
  ADMIN_LOGIN_NOTICE_PARAM,
  ADMIN_LOGIN_NOTICES,
  ADMIN_LOGIN_PATH,
  ADMIN_NOT_AUTHORIZED_MESSAGE,
  GENERIC_ADMIN_LOGIN_ERROR,
  adminLoginSchema,
  type AdminActionResult,
  type AdminLoginValues,
} from "@/lib/admin/admin-session";
import { isActiveFrenchAssessmentAdmin } from "@/lib/admin/auth";
import { createAdminSupabaseServerClient } from "@/lib/supabase/auth-server";

/**
 * Server boundary for administrator sign in and sign out.
 *
 * Both actions are reachable by direct POST, so each one revalidates its input
 * before touching Supabase. Nothing here logs a password, returns a raw
 * Supabase error, or tells the caller which part of a sign in failed.
 *
 * There is deliberately no sign up action, no password creation action and no
 * password reset action in this module or anywhere else in the application.
 * Supabase Auth owns credentials, and administrator accounts are provisioned
 * manually. See docs/admin/fa-05-admin-auth-dashboard.md.
 */

/** Logs a short, credential free marker so failures are diagnosable. */
function logFailure(operation: string, reason: string) {
  console.error(`[admin] ${operation} failed: ${reason}`);
}

/**
 * Authenticates a member of staff and confirms application authorization.
 *
 * The flow is deliberately ordered:
 *
 *   1. re-validate the submitted form on the server
 *   2. authenticate with Supabase Auth (email and password)
 *   3. re-read the user with getUser(), which verifies the session against the
 *      Supabase Auth server rather than trusting the freshly written cookie
 *   4. ask the database whether that verified identity is an active French
 *      Assessment administrator
 *   5. sign the session straight back out when it is not
 *
 * Every credential failure returns the same message, so an unknown email, a
 * wrong password and a malformed submission are indistinguishable.
 */
export async function signInFrenchAssessmentAdmin(
  values: AdminLoginValues,
): Promise<AdminActionResult> {
  const parsed = adminLoginSchema.safeParse(values);

  if (!parsed.success) {
    logFailure("sign in", "server validation rejected the submission");
    return { ok: false, message: GENERIC_ADMIN_LOGIN_ERROR };
  }

  try {
    const supabase = await createAdminSupabaseServerClient();

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });

    if (signInError) {
      // The status is logged, never the email and never the password.
      logFailure("sign in", `auth rejected the credentials (${signInError.status ?? "unknown"})`);
      return { ok: false, message: GENERIC_ADMIN_LOGIN_ERROR };
    }

    // Do not trust the session that was just written. Verify it.
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      logFailure("sign in", "session could not be verified");
      await supabase.auth.signOut();
      return { ok: false, message: GENERIC_ADMIN_LOGIN_ERROR };
    }

    const authorized = await isActiveFrenchAssessmentAdmin(supabase);

    if (!authorized) {
      // Authentication succeeded but this account is not a French Assessment
      // administrator. The session is removed immediately so the browser is
      // left holding nothing that could reach an admin route.
      await supabase.auth.signOut();
      return { ok: false, message: ADMIN_NOT_AUTHORIZED_MESSAGE };
    }

    return { ok: true };
  } catch {
    logFailure("sign in", "unexpected server error");
    return { ok: false, message: GENERIC_ADMIN_LOGIN_ERROR };
  }
}

/**
 * Ends the administrator session and returns to the login page.
 *
 * signOut() clears the Supabase auth cookies through @supabase/ssr, so the
 * next request to /admin has no session at all: the proxy redirects it to the
 * login page and the dashboard RPC would refuse it in any case.
 */
export async function signOutFrenchAssessmentAdmin(): Promise<void> {
  try {
    const supabase = await createAdminSupabaseServerClient();
    await supabase.auth.signOut();
  } catch {
    // A failed sign out must still return the member of staff to the login
    // page rather than leaving them on a protected screen.
    logFailure("sign out", "unexpected server error");
  }

  redirect(
    `${ADMIN_LOGIN_PATH}?${ADMIN_LOGIN_NOTICE_PARAM}=${ADMIN_LOGIN_NOTICES.signedOut}`,
  );
}
