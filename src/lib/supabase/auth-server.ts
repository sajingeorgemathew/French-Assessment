import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest, NextResponse } from "next/server";

/**
 * Cookie and session aware Supabase client for the Toronto Academy admin area.
 *
 * This module is deliberately separate from
 * @/lib/supabase/server, which builds the stateless client used by the public
 * student assessment. That client has no session, no cookies and no auth state,
 * and nothing here changes it: the public assessment keeps working exactly as
 * it did in FA-02 to FA-04 even if this file is removed.
 *
 * The environment reading below is intentionally duplicated rather than shared
 * with the public client. It keeps the two Supabase paths completely
 * independent, so an admin change can never alter how the public assessment
 * resolves its credentials.
 *
 * There is no service-role key anywhere. The admin client uses the same public
 * publishable (anon) key and gains its authority only from the signed in user's
 * Supabase Auth session, which the database then checks with
 * private.is_active_french_admin().
 */

const SUPABASE_URL_ENV = "NEXT_PUBLIC_SUPABASE_URL";
const SUPABASE_KEY_ENV = "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY";

/** Falls back to the legacy anon-key name so either project convention works. */
const LEGACY_SUPABASE_KEY_ENV = "NEXT_PUBLIC_SUPABASE_ANON_KEY";

/**
 * Thrown when Supabase is not configured. The message names environment
 * variables only, never their values, and is never shown to staff.
 */
export class AdminSupabaseConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminSupabaseConfigurationError";
  }
}

function readSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();

  if (!url) {
    throw new AdminSupabaseConfigurationError(
      `Missing ${SUPABASE_URL_ENV}. Set it in the local environment file.`,
    );
  }

  return url;
}

function readSupabaseKey(): string {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!key) {
    throw new AdminSupabaseConfigurationError(
      `Missing ${SUPABASE_KEY_ENV} (or ${LEGACY_SUPABASE_KEY_ENV}). Set it in the local environment file.`,
    );
  }

  return key;
}

/**
 * Builds a request scoped Supabase client backed by the Next.js cookie store.
 *
 * A new client is created for every request, as @supabase/ssr requires. Cookie
 * serialisation, naming, chunking and encoding are all handled by the library:
 * this project never invents an auth cookie format of its own.
 *
 * Server Components cannot write cookies. When the client is used from a page
 * or a layout the setAll call throws and is swallowed, which is safe because
 * src/proxy.ts already refreshes the session and writes the refreshed cookies
 * on every /admin request. From a Server Action the write succeeds normally,
 * which is how sign in and sign out persist their session change.
 */
export async function createAdminSupabaseServerClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();

  return createServerClient(readSupabaseUrl(), readSupabaseKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, where the cookie store is read
          // only. The proxy performs the write instead.
        }
      },
    },
  });
}

/**
 * Builds a Supabase client for src/proxy.ts.
 *
 * Both the incoming request cookies and the outgoing response cookies are
 * updated, so a refreshed session reaches the rendered route and the browser in
 * the same pass. The cache headers Supabase supplies alongside a cookie write
 * are copied onto the response, so a CDN can never serve one member of staff
 * the session of another.
 */
export function createAdminSupabaseProxyClient(
  request: NextRequest,
  response: NextResponse,
): SupabaseClient {
  return createServerClient(readSupabaseUrl(), readSupabaseKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value, options } of cookiesToSet) {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        }

        for (const [key, headerValue] of Object.entries(headers)) {
          response.headers.set(key, headerValue);
        }
      },
    },
  });
}
