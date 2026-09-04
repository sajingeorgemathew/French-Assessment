import { ArrowLeft, CircleCheckBig } from "lucide-react";
import {
  ASSESSMENT_LEVEL,
  ASSESSMENT_QUESTION_COUNT,
  ASSESSMENT_TITLE,
} from "@/lib/assessment";
import { secondaryButtonClass } from "@/components/ui/button-styles";

/**
 * Temporary placeholder shown after Begin Assessment. The question engine is
 * delivered in a later ticket.
 */
export function AssessmentReady({ onBack }: { onBack: () => void }) {
  return (
    <div className="mt-6">
      <div className="rounded-lg border border-academy-100 bg-white p-8 text-center sm:p-12">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent-50 text-accent-600">
          <CircleCheckBig className="h-6 w-6" aria-hidden="true" />
        </span>
        <h2 className="mt-5 text-2xl font-semibold tracking-tight text-academy-700">
          Your assessment is ready.
        </h2>
        <p className="mx-auto mt-3 max-w-md text-base leading-7 text-slate-600">
          The French A1 assessment questions will appear here.
        </p>
        <dl className="mx-auto mt-8 grid max-w-lg grid-cols-1 gap-px overflow-hidden rounded-lg border border-academy-100 bg-academy-100 text-left sm:grid-cols-2">
          <div className="bg-academy-50 px-5 py-4">
            <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">
              Assessment
            </dt>
            <dd className="mt-1 text-sm font-semibold text-academy-700">
              {ASSESSMENT_TITLE}
            </dd>
          </div>
          <div className="bg-academy-50 px-5 py-4">
            <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">
              Level and length
            </dt>
            <dd className="mt-1 text-sm font-semibold text-academy-700">
              {ASSESSMENT_LEVEL}, {ASSESSMENT_QUESTION_COUNT} questions
            </dd>
          </div>
        </dl>
      </div>

      <div className="mt-6">
        <button type="button" onClick={onBack} className={secondaryButtonClass}>
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          Back to instructions
        </button>
      </div>
    </div>
  );
}
