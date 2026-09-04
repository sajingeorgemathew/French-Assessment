import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Minimal server-side Supabase client for the public French assessment flow.
 *
 * FA-02 only needs the two controlled RPC functions, so this client uses the
 * public URL and the publishable (anon) key. There is deliberately no
 * service-role key: the underlying tables have RLS enabled with no policies,
 * and every write happens inside a narrow SECURITY DEFINER function.
 *
 * Construct the client here only. Do not build Supabase clients inside
 * components. This module is imported exclusively by the "use server" action
 * module, so it never reaches the browser bundle.
 */

const SUPABASE_URL_ENV = "NEXT_PUBLIC_SUPABASE_URL";
const SUPABASE_KEY_ENV = "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY";

/** Falls back to the legacy anon-key name so either project convention works. */
const LEGACY_SUPABASE_KEY_ENV = "NEXT_PUBLIC_SUPABASE_ANON_KEY";

let cachedClient: SupabaseClient | null = null;

/**
 * Thrown when Supabase is not configured. The message names environment
 * variables only, never their values, and is never shown to the student.
 */
export class SupabaseConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupabaseConfigurationError";
  }
}

function readSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();

  if (!url) {
    throw new SupabaseConfigurationError(
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
    throw new SupabaseConfigurationError(
      `Missing ${SUPABASE_KEY_ENV} (or ${LEGACY_SUPABASE_KEY_ENV}). Set it in the local environment file.`,
    );
  }

  return key;
}

/**
 * Returns the shared server-side Supabase client. The client is stateless:
 * there is no user session to persist or refresh in FA-02.
 */
export function getAssessmentSupabaseClient(): SupabaseClient {
  if (cachedClient) {
    return cachedClient;
  }

  cachedClient = createClient(readSupabaseUrl(), readSupabaseKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return cachedClient;
}
