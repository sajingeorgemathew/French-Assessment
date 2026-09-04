import { ArrowLeft, ArrowRight, ListChecks } from "lucide-react";
import { ReadingPassage } from "@/components/assessment/player/ReadingPassage";
import {
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui/button-styles";
import type {
  AssessmentContentPassage,
  AssessmentContentQuestion,
  AssessmentOptionKey,
} from "@/lib/assessment-content";

/**
 * One question screen.
 *
 * The four choices are real radio inputs in a fieldset, so arrow keys move
 * between them, the whole row is clickable through the wrapping label, and the
 * selected state is visible without relying on colour alone. Nothing here shows
 * correctness, hints or explanations, and nothing is written to the server.
 */
export function QuestionScreen({
  question,
  passage,
  selected,
  onSelect,
  onBack,
  onNext,
  nextLabel,
  onReturnToReview,
}: {
  question: AssessmentContentQuestion;
  passage: AssessmentContentPassage | null;
  selected: AssessmentOptionKey | undefined;
  onSelect: (optionKey: AssessmentOptionKey) => void;
  onBack: () => void;
  onNext: () => void;
  nextLabel: string;
  onReturnToReview?: () => void;
}) {
  const groupName = `question-${question.id}`;

  const questionCard = (
    <div className="rounded-lg border border-academy-100 bg-white p-5 sm:p-6">
      {question.category ? (
        <p
          className="text-xs font-semibold tracking-wide text-academy-500 uppercase"
          lang="fr"
        >
          {question.category}
        </p>
      ) : null}

      <fieldset className={question.category ? "mt-3" : undefined}>
        <legend className="w-full">
          {question.instruction ? (
            <span
              className="block text-sm leading-6 text-slate-600"
              lang="fr"
            >
              {question.instruction}
            </span>
          ) : null}
          <span
            className={[
              "block text-lg leading-8 font-semibold text-academy-700 sm:text-xl",
              question.instruction ? "mt-2" : "",
            ].join(" ")}
            lang="fr"
          >
            {question.prompt}
          </span>
          {question.note ? (
            <span
              className="mt-2 block text-sm leading-6 text-slate-500 italic"
              lang="fr"
            >
              {question.note}
            </span>
          ) : null}
        </legend>

        <div className="mt-5 space-y-2.5">
          {question.options.map((option) => {
            const isSelected = selected === option.key;

            return (
              <label
                key={option.key}
                className={[
                  "flex cursor-pointer items-start gap-3 rounded-md border px-4 py-3 transition-colors",
                  isSelected
                    ? "border-academy-600 bg-academy-50"
                    : "border-academy-200 bg-white hover:bg-academy-50",
                ].join(" ")}
              >
                <input
                  type="radio"
                  name={groupName}
                  value={option.key}
                  checked={isSelected}
                  onChange={() => onSelect(option.key)}
                  className="mt-1.5 h-4 w-4 shrink-0 accent-academy-600"
                />
                <span className="flex gap-2 text-base leading-7 text-slate-800">
                  <span className="font-semibold text-academy-700">
                    {option.key}.
                  </span>
                  <span lang="fr">{option.text}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
    </div>
  );

  return (
    <div className="mt-6">
      {passage ? (
        <div className="grid gap-5 lg:grid-cols-2 lg:items-start lg:gap-6">
          <ReadingPassage passage={passage} />
          {questionCard}
        </div>
      ) : (
        questionCard
      )}

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button type="button" onClick={onBack} className={secondaryButtonClass}>
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          Back
        </button>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
          {onReturnToReview ? (
            <button
              type="button"
              onClick={onReturnToReview}
              className={secondaryButtonClass}
            >
              <ListChecks className="h-5 w-5" aria-hidden="true" />
              Return to review
            </button>
          ) : null}
          <button type="button" onClick={onNext} className={primaryButtonClass}>
            {nextLabel}
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
