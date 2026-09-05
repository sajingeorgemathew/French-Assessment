import { CircleCheck } from "lucide-react";
import { ASSESSMENT_TITLE_FR } from "@/lib/assessment";
import {
  formatPercentage,
  type AssessmentResultData,
} from "@/lib/assessment-result";

/**
 * The completion screen shown after a successful final submission.
 *
 * Everything on it comes from the authoritative result the database returned:
 * the score, the total, the percentage and the level. There is no pass or fail
 * message, no benchmark comparison, no celebratory or alarming styling, and no
 * question-by-question correctness. The answer key is not involved in any way,
 * because the browser never receives one.
 *
 * The screen is terminal. It offers no route back into the questions, which is
 * what makes a submitted attempt uneditable from the student's side, and the
 * database refuses a rescore regardless.
 */
export function AssessmentResult({ result }: { result: AssessmentResultData }) {
  return (
    <div className="mt-6">
      <div className="rounded-lg border border-academy-100 bg-white p-6 text-center sm:p-10">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-academy-50 text-academy-700">
          <CircleCheck className="h-6 w-6" aria-hidden="true" />
        </span>

        <h2 className="mt-5 text-2xl font-semibold tracking-tight text-academy-700 sm:text-3xl">
          Assessment Complete
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-base leading-7 text-slate-600">
          Your French Language Assessment{" "}
          <span lang="fr">({ASSESSMENT_TITLE_FR})</span> has been submitted
          successfully and recorded.
        </p>

        <dl className="mx-auto mt-8 grid max-w-2xl gap-px overflow-hidden rounded-lg border border-academy-100 bg-academy-100 sm:grid-cols-3">
          <div className="bg-academy-50 px-4 py-5">
            <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">
              Score
            </dt>
            <dd className="mt-2 text-2xl font-semibold text-academy-700">
              {result.score} / {result.totalQuestions}
            </dd>
          </div>
          <div className="bg-academy-50 px-4 py-5">
            <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">
              Percentage
            </dt>
            <dd className="mt-2 text-2xl font-semibold text-academy-700">
              {formatPercentage(result.percentage)}%
            </dd>
          </div>
          <div className="bg-academy-50 px-4 py-5">
            <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">
              Level assessed
            </dt>
            <dd className="mt-2 text-2xl font-semibold text-academy-700">
              {result.level}
            </dd>
          </div>
        </dl>

        <p className="mx-auto mt-8 max-w-xl text-base leading-7 text-slate-700">
          Thank you for completing your French Language Assessment. The Toronto
          Academy team will review your assessment and use the results to help
          determine the appropriate French learning pathway for you.
        </p>
      </div>

      <div className="mt-6 rounded-md border border-academy-100 bg-white px-4 py-3 text-sm leading-6 text-slate-600">
        <p>
          Your answers are now final and cannot be changed. There is nothing
          further to do on this page, and you can close this tab.
        </p>
      </div>
    </div>
  );
}
