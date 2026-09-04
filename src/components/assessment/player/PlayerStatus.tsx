import { CircleAlert, LoaderCircle } from "lucide-react";
import {
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui/button-styles";

/** Calm branded holding screen while the assessment content is retrieved. */
export function PlayerLoading() {
  return (
    <div
      className="mt-6 rounded-lg border border-academy-100 bg-white p-10 text-center sm:p-14"
      role="status"
    >
      <LoaderCircle
        className="mx-auto h-6 w-6 animate-spin text-academy-600"
        aria-hidden="true"
      />
      <p className="mt-4 text-base font-semibold text-academy-700">
        Loading your assessment
      </p>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-600">
        Please wait a moment. Do not close this tab.
      </p>
    </div>
  );
}

/**
 * Shown when the content could not be retrieved. The message is the generic
 * one the server action returned: no SQL, no Supabase detail, nothing about the
 * student or the attempt.
 */
export function PlayerUnavailable({
  message,
  onRetry,
  onBack,
}: {
  message: string;
  onRetry?: () => void;
  onBack: () => void;
}) {
  return (
    <div className="mt-6">
      <div
        role="alert"
        className="rounded-lg border border-academy-100 bg-white p-8 text-center sm:p-10"
      >
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-red-50 text-red-700">
          <CircleAlert className="h-5 w-5" aria-hidden="true" />
        </span>
        <h2 className="mt-4 text-xl font-semibold tracking-tight text-academy-700">
          Assessment unavailable
        </h2>
        <p className="mx-auto mt-2 max-w-md text-base leading-7 text-slate-600">
          {message}
        </p>
      </div>

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button type="button" onClick={onBack} className={secondaryButtonClass}>
          Back to instructions
        </button>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className={primaryButtonClass}
          >
            Try again
          </button>
        ) : null}
      </div>
    </div>
  );
}
