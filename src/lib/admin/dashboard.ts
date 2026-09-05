import { connection } from "next/server";

import {
  adminDashboardRpcResultSchema,
  toAdminDashboard,
  type AdminDashboard,
} from "@/lib/admin/admin-dashboard";
import { GENERIC_ADMIN_ERROR } from "@/lib/admin/admin-session";
import { createAdminSupabaseServerClient } from "@/lib/supabase/auth-server";

/**
 * Server side loader for the administrator dashboard.
 *
 * This module is a transport boundary, not an authorization boundary. It sends
 * no user id, no role and no filter: public.get_french_admin_dashboard decides
 * for itself whether the caller is an active administrator, from auth.uid(),
 * and raises 42501 when they are not. An unauthorised call therefore returns a
 * generic failure here rather than an empty dashboard.
 *
 * Raw Supabase and PostgreSQL messages are never forwarded to the browser.
 */

export type AdminDashboardResult =
  | { ok: true; data: AdminDashboard }
  | { ok: false; message: string };

/** Logs a short, PII free marker so failures are diagnosable in server logs. */
function logFailure(reason: string) {
  console.error(`[admin] dashboard failed: ${reason}`);
}

export async function getFrenchAdminDashboard(): Promise<AdminDashboardResult> {
  // Dashboard data is per request and per administrator. It is never
  // prerendered and never cached.
  await connection();

  try {
    const supabase = await createAdminSupabaseServerClient();

    const { data, error } = await supabase.rpc("get_french_admin_dashboard");

    if (error) {
      logFailure(`rpc error code ${error.code ?? "unknown"}`);
      return { ok: false, message: GENERIC_ADMIN_ERROR };
    }

    const parsed = adminDashboardRpcResultSchema.safeParse(data);

    if (!parsed.success) {
      logFailure("unexpected rpc response shape");
      return { ok: false, message: GENERIC_ADMIN_ERROR };
    }

    return { ok: true, data: toAdminDashboard(parsed.data) };
  } catch {
    logFailure("unexpected server error");
    return { ok: false, message: GENERIC_ADMIN_ERROR };
  }
}
