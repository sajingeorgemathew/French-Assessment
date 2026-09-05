import { NextResponse, type NextRequest } from "next/server";

import { ADMIN_LOGIN_PATH } from "@/lib/admin/admin-session";
import { createAdminSupabaseProxyClient } from "@/lib/supabase/auth-server";

/**
 * Next.js 16 Proxy (the convention that replaced middleware.ts).
 *
 * Two jobs, both scoped to /admin by the matcher below:
 *
 *   1. Refresh the Supabase auth session and write the refreshed cookies onto
 *      the outgoing response. Server Components cannot set cookies, so without
 *      this pass a refreshed token would be produced and then lost.
 *
 *   2. Redirect anonymous requests for a protected admin route to the login
 *      page, on the server, before the route renders. No useEffect, no client
 *      side redirect, and no protected markup is ever produced for a request
 *      that has no session.
 *
 * This is an optimistic check only, exactly as the Next.js authentication guide
 * recommends for Proxy: it reads the session and nothing else. Whether the
 * signed in user is actually a Toronto Academy administrator is decided later,
 * by requireFrenchAssessmentAdmin() in the protected layout and, definitively,
 * by public.get_french_admin_dashboard() in the database.
 *
 * The matcher keeps the public student assessment completely untouched. The
 * proxy never runs for /, /assessment or the server functions those routes
 * call, so the public flow stays unauthenticated and is never redirected to an
 * admin login page.
 */

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // The login page is the one admin route an anonymous visitor may see. It
  // still passes through the client below so an expired session is cleaned up
  // rather than left in the browser.
  const isLoginRoute = pathname === ADMIN_LOGIN_PATH;

  const response = NextResponse.next({ request });

  let hasSession = false;

  try {
    const supabase = createAdminSupabaseProxyClient(request, response);

    // Called before the response is generated so a token refresh can still be
    // written to cookies, as @supabase/ssr requires.
    const { data, error } = await supabase.auth.getClaims();

    hasSession = !error && Boolean(data?.claims?.sub);
  } catch {
    // A configuration or network failure must fail closed: the request is
    // treated as anonymous and sent to the login page.
    console.error("[admin] proxy failed: session could not be read");
    hasSession = false;
  }

  if (!isLoginRoute && !hasSession) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = ADMIN_LOGIN_PATH;
    loginUrl.search = "";

    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
