"use client";

import { useId, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, CircleAlert, LoaderCircle } from "lucide-react";
import {
  FRENCH_LEVEL_OPTIONS,
  LEARNING_GOAL_OPTIONS,
  STATUS_IN_CANADA_OPTIONS,
  validateStudentInformation,
  type StudentInformation,
  type StudentInformationErrors,
} from "@/lib/student-information";
import { registerFrenchAssessmentStudent } from "@/lib/actions/assessment";
import type { AssessmentSession } from "@/lib/assessment-session";
import {
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui/button-styles";
import { InlineAlert } from "@/components/ui/InlineAlert";

const fieldClass =
  "w-full rounded-md border border-academy-200 bg-white px-3 py-2.5 text-base text-slate-900 focus:border-academy-500";

function FieldShell({
  id,
  label,
  required,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-academy-700">
        {label}
        {required ? (
          <>
            <span aria-hidden="true" className="ml-1 text-red-700">
              *
            </span>
            <span className="sr-only"> (required)</span>
          </>
        ) : null}
      </label>
      <div className="mt-1.5">{children}</div>
      {error ? (
        <p
          id={`${id}-error`}
          role="alert"
          className="mt-1.5 flex items-start gap-1.5 text-sm text-red-700"
        >
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function StudentInformationForm({
  values,
  onChange,
  onRegistered,
}: {
  values: StudentInformation;
  onChange: (values: StudentInformation) => void;
  onRegistered: (session: AssessmentSession) => void;
}) {
  const [errors, setErrors] = useState<StudentInformationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const prefix = useId();

  const fieldId = (name: keyof StudentInformation) => `${prefix}-${name}`;

  const setField = (name: keyof StudentInformation, value: string) => {
    onChange({ ...values, [name]: value });
    if (errors[name]) {
      setErrors((current) => ({ ...current, [name]: undefined }));
    }
  };

  const describedBy = (name: keyof StudentInformation) =>
    errors[name] ? `${fieldId(name)}-error` : undefined;

  const controlClass = (name: keyof StudentInformation) =>
    errors[name] ? `${fieldClass} border-red-600` : fieldClass;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    // Guard against a double submit from a fast second click or Enter press.
    if (isSubmitting) {
      return;
    }

    const result = validateStudentInformation(values);

    if (!result.success || !result.data) {
      setErrors(result.errors);
      setSubmitError(null);

      const firstInvalid = (
        Object.keys(values) as (keyof StudentInformation)[]
      ).find((name) => result.errors[name]);

      if (firstInvalid) {
        document.getElementById(fieldId(firstInvalid))?.focus();
      }
      return;
    }

    const student = result.data;

    setErrors({});
    setSubmitError(null);
    onChange(student);
    setIsSubmitting(true);

    // The student only moves on once the database holds the registered attempt.
    const registration = await registerFrenchAssessmentStudent(student);

    if (!registration.ok) {
      // Entered values stay untouched so the student can simply try again.
      setSubmitError(registration.message);
      setIsSubmitting(false);
      return;
    }

    onRegistered(registration.data);
  };

  return (
    <form noValidate onSubmit={handleSubmit} className="mt-6">
      <div className="rounded-lg border border-academy-100 bg-white p-6 sm:p-8">
        <h2 className="text-xl font-semibold text-academy-700">
          Student information
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          We use these details to share your assessment outcome and to recommend
          a suitable French learning pathway. Fields marked with an asterisk are
          required.
        </p>

        <fieldset className="mt-8 border-0 p-0">
          <legend className="text-sm font-semibold tracking-wide text-slate-500 uppercase">
            Contact details
          </legend>
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FieldShell
                id={fieldId("fullName")}
                label="Full Name"
                required
                error={errors.fullName}
              >
                <input
                  id={fieldId("fullName")}
                  name="fullName"
                  type="text"
                  autoComplete="name"
                  aria-required="true"
                  aria-invalid={errors.fullName ? true : undefined}
                  aria-describedby={describedBy("fullName")}
                  className={controlClass("fullName")}
                  value={values.fullName}
                  onChange={(event) =>
                    setField("fullName", event.target.value)
                  }
                />
              </FieldShell>
            </div>

            <FieldShell
              id={fieldId("email")}
              label="Email Address"
              required
              error={errors.email}
            >
              <input
                id={fieldId("email")}
                name="email"
                type="email"
                autoComplete="email"
                aria-required="true"
                aria-invalid={errors.email ? true : undefined}
                aria-describedby={describedBy("email")}
                className={controlClass("email")}
                value={values.email}
                onChange={(event) => setField("email", event.target.value)}
              />
            </FieldShell>

            <FieldShell
              id={fieldId("phone")}
              label="Phone Number"
              required
              error={errors.phone}
            >
              <input
                id={fieldId("phone")}
                name="phone"
                type="tel"
                autoComplete="tel"
                aria-required="true"
                aria-invalid={errors.phone ? true : undefined}
                aria-describedby={describedBy("phone")}
                className={controlClass("phone")}
                value={values.phone}
                onChange={(event) => setField("phone", event.target.value)}
              />
            </FieldShell>
          </div>
        </fieldset>

        <fieldset className="mt-8 border-0 p-0">
          <legend className="text-sm font-semibold tracking-wide text-slate-500 uppercase">
            About your French
          </legend>
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <FieldShell id={fieldId("city")} label="City" error={errors.city}>
              <input
                id={fieldId("city")}
                name="city"
                type="text"
                autoComplete="address-level2"
                className={controlClass("city")}
                value={values.city}
                onChange={(event) => setField("city", event.target.value)}
              />
            </FieldShell>

            <FieldShell
              id={fieldId("statusInCanada")}
              label="Status in Canada"
              error={errors.statusInCanada}
            >
              <select
                id={fieldId("statusInCanada")}
                name="statusInCanada"
                className={controlClass("statusInCanada")}
                value={values.statusInCanada}
                onChange={(event) =>
                  setField("statusInCanada", event.target.value)
                }
              >
                <option value="">Select an option</option>
                {STATUS_IN_CANADA_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </FieldShell>

            <FieldShell
              id={fieldId("frenchLevel")}
              label="Current French Level"
              error={errors.frenchLevel}
            >
              <select
                id={fieldId("frenchLevel")}
                name="frenchLevel"
                className={controlClass("frenchLevel")}
                value={values.frenchLevel}
                onChange={(event) =>
                  setField("frenchLevel", event.target.value)
                }
              >
                <option value="">Select an option</option>
                {FRENCH_LEVEL_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </FieldShell>

            <FieldShell
              id={fieldId("learningGoal")}
              label="French Learning Goal"
              error={errors.learningGoal}
            >
              <select
                id={fieldId("learningGoal")}
                name="learningGoal"
                className={controlClass("learningGoal")}
                value={values.learningGoal}
                onChange={(event) =>
                  setField("learningGoal", event.target.value)
                }
              >
                <option value="">Select an option</option>
                {LEARNING_GOAL_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </FieldShell>
          </div>
        </fieldset>
      </div>

      {submitError ? <InlineAlert message={submitError} /> : null}

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/" className={secondaryButtonClass}>
          Back to overview
        </Link>
        <button
          type="submit"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
          className={primaryButtonClass}
        >
          {isSubmitting ? (
            <>
              Saving your details
              <LoaderCircle
                className="h-5 w-5 animate-spin"
                aria-hidden="true"
              />
            </>
          ) : (
            <>
              Continue to Instructions
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </>
          )}
        </button>
      </div>
    </form>
  );
}
