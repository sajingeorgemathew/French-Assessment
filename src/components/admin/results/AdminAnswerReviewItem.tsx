import { CircleCheck, CircleMinus, CircleX } from "lucide-react";

import {
  ADMIN_ANSWER_STATE_LABELS,
  formatAdminOption,
  getAdminAnswerState,
  type AdminAnswerState,
  type AdminAttemptResponse,
} from "@/lib/admin/admin-results";

/**
 * One reviewed question.
 *
 * Correctness is never signalled by colour alone. Each card carries the word
 * Correct, Incorrect or Not answered in a chip, an icon with a distinct shape,
 * and a left border, so the state survives greyscale printing, colour vision
 * differences and a screen reader.
 *
 * The correct option shown here comes from the protected FA-06 detail RPC,
 * which joined private.assessment_answer_keys for this one submitted attempt
 * after checking active administrator authorization. There is no answer key in
 * this component, in any other component, or anywhere in the project's
 * TypeScript.
 */

const stateStyles: Record<
  AdminAnswerState,
  { border: string; chip: string; Icon: typeof CircleCheck }
> = {
  correct: {
    border: "border-l-accent-500",
    chip: "border-accent-100 bg-accent-50 text-accent-700",
    Icon: CircleCheck,
  },
  incorrect: {
    border: "border-l-red-400",
    chip: "border-red-200 bg-red-50 text-red-800",
    Icon: CircleX,
  },
  unanswered: {
    border: "border-l-amber-400",
    chip: "border-amber-200 bg-amber-50 text-amber-800",
    Icon: CircleMinus,
  },
};

export function AdminAnswerReviewItem({
  response,
}: {
  response: AdminAttemptResponse;
}) {
  const state = getAdminAnswerState(response);
  const { border, chip, Icon } = stateStyles[state];

  return (
    <li
      className={`rounded-lg border border-academy-100 border-l-4 bg-white px-4 py-4 sm:px-5 ${border}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wide text-academy-500 uppercase">
            Question {response.questionNumber}
            {response.category ? (
              <span className="ml-2 font-normal normal-case text-slate-500">
                {response.category}
              </span>
            ) : null}
          </p>
          {response.instruction ? (
            <p lang="fr" className="mt-1 text-sm text-slate-500">
              {response.instruction}
            </p>
          ) : null}
        </div>

        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${chip}`}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          {ADMIN_ANSWER_STATE_LABELS[state]}
        </span>
      </div>

      <p
        lang="fr"
        className="mt-2 text-base leading-7 font-medium whitespace-pre-line text-slate-800"
      >
        {response.prompt}
      </p>

      {response.note ? (
        <p lang="fr" className="mt-1 text-sm text-slate-500">
          {response.note}
        </p>
      ) : null}

      {response.passageBody ? (
        <details className="mt-3 rounded-md border border-academy-100 bg-academy-50 px-3 py-2">
          <summary className="cursor-pointer text-sm font-semibold text-academy-700">
            Reading text
            {response.passageTitle ? (
              <span lang="fr" className="ml-1 font-normal text-slate-600">
                {response.passageTitle}
              </span>
            ) : null}
          </summary>
          <p
            lang="fr"
            className="mt-2 max-h-72 overflow-y-auto text-sm leading-6 whitespace-pre-line text-slate-700"
          >
            {response.passageBody}
          </p>
        </details>
      ) : null}

      <dl className="mt-3 grid gap-3 border-t border-academy-100 pt-3 sm:grid-cols-2">
        <div className="min-w-0">
          <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">
            Student answer
          </dt>
          <dd
            lang={response.selectedOptionKey ? "fr" : undefined}
            className="mt-0.5 break-words text-sm font-medium text-slate-800"
          >
            {formatAdminOption(
              response.selectedOptionKey,
              response.selectedOptionText,
            )}
          </dd>
        </div>

        <div className="min-w-0">
          <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">
            Correct answer
          </dt>
          <dd
            lang={response.correctOptionKey ? "fr" : undefined}
            className="mt-0.5 break-words text-sm font-medium text-slate-800"
          >
            {response.correctOptionKey === null
              ? "Not recorded"
              : formatAdminOption(
                  response.correctOptionKey,
                  response.correctOptionText,
                )}
          </dd>
        </div>
      </dl>
    </li>
  );
}
