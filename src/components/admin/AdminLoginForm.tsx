"use client";

import { useId, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, LoaderCircle, LogIn } from "lucide-react";

import { signInFrenchAssessmentAdmin } from "@/lib/actions/admin-auth";
import {
  ADMIN_DASHBOARD_PATH,
  ADMIN_LOGIN_FIELD_LIMITS,
  GENERIC_ADMIN_LOGIN_ERROR,
  validateAdminLogin,
  type AdminLoginErrors,
  type AdminLoginValues,
} from "@/lib/admin/admin-session";
import { primaryButtonClass } from "@/components/ui/button-styles";
import { InlineAlert } from "@/components/ui/InlineAlert";

/**
 * The Toronto Academy administrator sign in form.
 *
 * The password is held in component state for the life of the keystroke and
 * sent to the server action; it is never written to storage, never placed in a
 * URL and never logged. There is no sign up control and no account recovery
 * control, because administrator accounts are provisioned manually.
 *
 * Field validation here is a convenience. The server action re-validates with
 * the same schema, so a direct POST is checked just as strictly.
 */

const fieldClass =
  "w-full rounded-md border border-academy-200 bg-white px-3 py-2.5 text-base text-slate-900 focus:border-academy-500";

const emptyValues: AdminLoginValues = { email: "", password: "" };

export function AdminLoginForm() {
  const router = useRouter();
  const prefix = useId();
  const [values, setValues] = useState<AdminLoginValues>(emptyValues);
  const [errors, setErrors] = useState<AdminLoginErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fieldId = (name: keyof AdminLoginValues) => `${prefix}-${name}`;

  const setField = (name: keyof AdminLoginValues, value: string) => {
    setValues((current) => ({ ...current, [name]: value }));

    if (errors[name]) {
      setErrors((current) => ({ ...current, [name]: undefined }));
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    // Guard against a double submit from a fast second click or Enter press.
    if (isSubmitting) {
      return;
    }

    const result = validateAdminLogin(values);

    if (!result.success || !result.data) {
      setErrors(result.errors);
      setSubmitError(null);

      const firstInvalid = (
        Object.keys(values) as (keyof AdminLoginValues)[]
      ).find((name) => result.errors[name]);

      if (firstInvalid) {
        document.getElementById(fieldId(firstInvalid))?.focus();
      }
      return;
    }

    setErrors({});
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const response = await signInFrenchAssessmentAdmin(result.data);

      if (!response.ok) {
        // The password is cleared on every failure so a shared screen is never
        // left holding a typed credential.
        setValues((current) => ({ ...current, password: "" }));
        setSubmitError(response.message);
        setIsSubmitting(false);
        return;
      }

      // The session cookie is already written. Re-render on the server so the
      // proxy and the protected layout see it.
      setValues(emptyValues);
      router.replace(ADMIN_DASHBOARD_PATH);
      router.refresh();
    } catch {
      setValues((current) => ({ ...current, password: "" }));
      setSubmitError(GENERIC_ADMIN_LOGIN_ERROR);
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-5">
      <div>
        <label
          htmlFor={fieldId("email")}
          className="block text-sm font-medium text-academy-700"
        >
          Email Address
        </label>
        <div className="mt-1.5">
          <input
            id={fieldId("email")}
            name="email"
            type="email"
            autoComplete="username"
            inputMode="email"
            maxLength={ADMIN_LOGIN_FIELD_LIMITS.email}
            required
            value={values.email}
            onChange={(event) => setField("email", event.target.value)}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={
              errors.email ? `${fieldId("email")}-error` : undefined
            }
            className={
              errors.email ? `${fieldClass} border-red-600` : fieldClass
            }
          />
        </div>
        {errors.email ? (
          <p
            id={`${fieldId("email")}-error`}
            role="alert"
            className="mt-1.5 flex items-start gap-1.5 text-sm text-red-700"
          >
            <CircleAlert
              className="mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
            />
            {errors.email}
          </p>
        ) : null}
      </div>

      <div>
        <label
          htmlFor={fieldId("password")}
          className="block text-sm font-medium text-academy-700"
        >
          Password
        </label>
        <div className="mt-1.5">
          <input
            id={fieldId("password")}
            name="password"
            type="password"
            autoComplete="current-password"
            maxLength={ADMIN_LOGIN_FIELD_LIMITS.password}
            required
            value={values.password}
            onChange={(event) => setField("password", event.target.value)}
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={
              errors.password ? `${fieldId("password")}-error` : undefined
            }
            className={
              errors.password ? `${fieldClass} border-red-600` : fieldClass
            }
          />
        </div>
        {errors.password ? (
          <p
            id={`${fieldId("password")}-error`}
            role="alert"
            className="mt-1.5 flex items-start gap-1.5 text-sm text-red-700"
          >
            <CircleAlert
              className="mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
            />
            {errors.password}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className={`${primaryButtonClass} w-full`}
      >
        {isSubmitting ? (
          <>
            <LoaderCircle
              className="h-5 w-5 animate-spin"
              aria-hidden="true"
            />
            Signing in
          </>
        ) : (
          <>
            <LogIn className="h-5 w-5" aria-hidden="true" />
            Sign In
          </>
        )}
      </button>

      {submitError ? <InlineAlert message={submitError} /> : null}
    </form>
  );
}
