import { z } from "zod";

/**
 * Shared vocabulary for the Toronto Academy French Assessment admin area.
 *
 * Everything a member of staff can ever be shown about a failed sign in lives
 * here, and all of it is deliberately generic. Nothing in this module reveals
 * whether an email address exists, whether a password was wrong, or whether an
 * account exists but is not authorised, so the login page cannot be used to
 * enumerate accounts.
 */

export const ADMIN_LOGIN_PATH = "/admin/login";
export const ADMIN_DASHBOARD_PATH = "/admin";

/** Query parameter used to carry a generic notice back to the login page. */
export const ADMIN_LOGIN_NOTICE_PARAM = "notice";

/** The only notice values the login page recognises. Anything else is ignored. */
export const ADMIN_LOGIN_NOTICES = {
  notAuthorized: "not-authorized",
  signedOut: "signed-out",
} as const;

export type AdminLoginNotice =
  (typeof ADMIN_LOGIN_NOTICES)[keyof typeof ADMIN_LOGIN_NOTICES];

/**
 * Field limits shared by the browser form and the server action, so an
 * oversized payload is rejected before it ever reaches Supabase Auth.
 */
export const ADMIN_LOGIN_FIELD_LIMITS = {
  email: 254,
  password: 128,
} as const;

/**
 * The single source of truth for administrator sign in rules. The browser form
 * and the server action both parse with this schema, so server validation never
 * depends on the browser having run first.
 */
export const adminLoginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email address is required.")
    .max(ADMIN_LOGIN_FIELD_LIMITS.email, "Please shorten your email address.")
    .pipe(z.email("Please enter a valid email address.")),
  password: z
    .string()
    .min(1, "Password is required.")
    .max(ADMIN_LOGIN_FIELD_LIMITS.password, "Please shorten your password."),
});

export type AdminLoginValues = z.infer<typeof adminLoginSchema>;

export type AdminLoginErrors = Partial<
  Record<keyof AdminLoginValues, string | undefined>
>;

/**
 * Client side mirror of the schema so the form can show field level messages
 * without a round trip. The server re-validates with the same schema.
 */
export function validateAdminLogin(values: AdminLoginValues): {
  success: boolean;
  errors: AdminLoginErrors;
  data?: AdminLoginValues;
} {
  const parsed = adminLoginSchema.safeParse(values);

  if (parsed.success) {
    return { success: true, errors: {}, data: parsed.data };
  }

  const errors: AdminLoginErrors = {};

  for (const issue of parsed.error.issues) {
    const field = issue.path[0];

    if (
      (field === "email" || field === "password") &&
      errors[field] === undefined
    ) {
      errors[field] = issue.message;
    }
  }

  return { success: false, errors };
}

/**
 * The only credential failure text staff ever see. It is identical for an
 * unknown email, a wrong password and a malformed submission, so no attempt at
 * account enumeration learns anything.
 */
export const GENERIC_ADMIN_LOGIN_ERROR =
  "Unable to sign in with those credentials.";

/**
 * Shown when Supabase Auth accepted the credentials but the account is not an
 * active French Assessment administrator. It names no table, no role and no
 * internal reason.
 */
export const ADMIN_NOT_AUTHORIZED_MESSAGE =
  "This account does not have access to the French Assessment administration area.";

/** Shown when the administration area cannot load its data right now. */
export const GENERIC_ADMIN_ERROR =
  "We could not load the administration data right now. Please try again.";

export type AdminActionResult =
  | { ok: true }
  | { ok: false; message: string };
