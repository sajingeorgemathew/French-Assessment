import { Check } from "lucide-react";
import { ASSESSMENT_STEPS, type AssessmentStepIndex } from "@/lib/assessment";

/** Compact progress treatment for the three step assessment entry flow. */
export function AssessmentSteps({
  currentStep,
}: {
  currentStep: AssessmentStepIndex;
}) {
  return (
    <nav aria-label="Assessment progress">
      <ol className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {ASSESSMENT_STEPS.map((label, index) => {
          const isComplete = index < currentStep;
          const isCurrent = index === currentStep;

          return (
            <li key={label} className="flex items-center gap-3">
              <span
                className="flex items-center gap-2"
                aria-current={isCurrent ? "step" : undefined}
              >
                <span
                  aria-hidden="true"
                  className={[
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                    isComplete
                      ? "border-accent-600 bg-accent-600 text-white"
                      : isCurrent
                        ? "border-academy-600 bg-academy-600 text-white"
                        : "border-academy-200 bg-white text-slate-500",
                  ].join(" ")}
                >
                  {isComplete ? (
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  ) : (
                    index + 1
                  )}
                </span>
                <span
                  className={[
                    "text-sm",
                    isCurrent
                      ? "font-semibold text-academy-700"
                      : "text-slate-500",
                  ].join(" ")}
                >
                  {label}
                  {isComplete ? (
                    <span className="sr-only"> (completed)</span>
                  ) : null}
                </span>
              </span>
              {index < ASSESSMENT_STEPS.length - 1 ? (
                <span
                  aria-hidden="true"
                  className="hidden h-px w-8 bg-academy-200 sm:block"
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
