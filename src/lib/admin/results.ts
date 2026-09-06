import { connection } from "next/server";

import {
  ADMIN_RESULTS_MAX_PAGE,
  ADMIN_RESULTS_PAGE_SIZE,
  adminAttemptDetailRpcResultSchema,
  adminResultsRpcResultSchema,
  toAdminAttemptDetail,
  toAdminResultsPage,
  type AdminAttemptDetail,
  type AdminResultsPage,
  type AdminResultsQuery,
} from "@/lib/admin/admin-results";
import { GENERIC_ADMIN_ERROR } from "@/lib/admin/admin-session";
import { createAdminSupabaseServerClient } from "@/lib/supabase/auth-server";

/**
 * Server side loaders for the FA-06 administrator results area.
 *
 * Like the FA-05 dashboard loader, this module is a transport boundary and not
 * an authorization boundary. It sends no user id, no role and no "am I allowed"
 * flag. public.get_french_admin_results and
 * public.get_french_admin_attempt_detail each decide for themselves whether the
 * caller is an active administrator, from auth.uid(), and raise 42501 when they
 * are not. An unauthorised call therefore fails here rather than returning an
 * empty list that could be mistaken for "no results".
 *
 * Both loaders reuse the FA-05 cookie aware Supabase SSR client, so the admin
 * session travels with the request. The stateless public assessment client is
 * never used here: it carries no session, so the database would see an
 * anonymous caller and refuse.
 *
 * Raw Supabase and PostgreSQL messages are never forwarded to the browser.
 */

export type AdminResultsResult =
  | { ok: true; data: AdminResultsPage }
  | { ok: false; message: string };

/**
 * A detail lookup has three outcomes, and "not found" is deliberately distinct
 * from "failed": the route renders notFound() for the first and a safe generic
 * error for the second.
 */
export type AdminAttemptDetailResult =
  | { ok: true; data: AdminAttemptDetail }
  | { ok: true; data: null }
  | { ok: false; message: string };

/** Logs a short, PII free marker so failures are diagnosable in server logs. */
function logFailure(operation: string, reason: string) {
  console.error(`[admin] ${operation} failed: ${reason}`);
}

/**
 * Loads one page of submitted assessment results.
 *
 * Search, filtering, ordering and paging all happen in the database. The
 * browser never receives more than one page, and the full result set is never
 * loaded into the application.
 */
export async function getFrenchAdminResults(
  query: AdminResultsQuery,
): Promise<AdminResultsResult> {
  // Results are per request and per administrator. They are never prerendered
  // and never cached.
  await connection();

  const limit = ADMIN_RESULTS_PAGE_SIZE;
  const page = Math.min(Math.max(query.page, 1), ADMIN_RESULTS_MAX_PAGE);
  const offset = (page - 1) * limit;

  try {
    const supabase = await createAdminSupabaseServerClient();

    const { data, error } = await supabase.rpc("get_french_admin_results", {
      p_search: query.search === "" ? null : query.search,
      p_benchmark_filter: query.benchmark,
      p_limit: limit,
      p_offset: offset,
    });

    if (error) {
      logFailure("results", `rpc error code ${error.code ?? "unknown"}`);
      return { ok: false, message: GENERIC_ADMIN_ERROR };
    }

    const parsed = adminResultsRpcResultSchema.safeParse(data);

    if (!parsed.success) {
      logFailure("results", "unexpected rpc response shape");
      return { ok: false, message: GENERIC_ADMIN_ERROR };
    }

    return { ok: true, data: toAdminResultsPage(parsed.data) };
  } catch {
    logFailure("results", "unexpected server error");
    return { ok: false, message: GENERIC_ADMIN_ERROR };
  }
}

/**
 * Loads the full review payload for one submitted attempt.
 *
 * The attempt is addressed by its internal UUID. The student's attempt_token is
 * never accepted here and never appears in the response.
 *
 * A null payload is the database's single answer for "unknown attempt", "not a
 * french-a1-diagnostic attempt" and "not submitted yet". It is passed through
 * as { ok: true, data: null } so the route can render an identical not-found
 * for all three, without the response revealing which one occurred.
 */
export async function getFrenchAdminAttemptDetail(
  attemptId: string,
): Promise<AdminAttemptDetailResult> {
  await connection();

  try {
    const supabase = await createAdminSupabaseServerClient();

    const { data, error } = await supabase.rpc(
      "get_french_admin_attempt_detail",
      { p_attempt_id: attemptId },
    );

    if (error) {
      logFailure("attempt detail", `rpc error code ${error.code ?? "unknown"}`);
      return { ok: false, message: GENERIC_ADMIN_ERROR };
    }

    if (data === null || data === undefined) {
      return { ok: true, data: null };
    }

    const parsed = adminAttemptDetailRpcResultSchema.safeParse(data);

    if (!parsed.success) {
      logFailure("attempt detail", "unexpected rpc response shape");
      return { ok: false, message: GENERIC_ADMIN_ERROR };
    }

    return { ok: true, data: toAdminAttemptDetail(parsed.data) };
  } catch {
    logFailure("attempt detail", "unexpected server error");
    return { ok: false, message: GENERIC_ADMIN_ERROR };
  }
}
