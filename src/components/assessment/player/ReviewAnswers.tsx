"use client";

import { useState } from "react";
import { ArrowLeft, LoaderCircle, TriangleAlert } from "lucide-react";
import {
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui/button-styles";
import { InlineAlert } from "@/components/ui/InlineAlert";
import type {
  AssessmentAnswers,
  AssessmentContentQuestion,
} from "@/lib/assessment-content";
import type { AnswerSummary } from "@/lib/assessment-player";

/**
 * Review Answers.
 *
 * It reports only what the student selected, never whether a selection is
 * right. There is no score, percentage, benchmark or pass/fail anywhere on this
 * screen, because the browser holds no correct-answer information at all.
 *
 * Submit Assessment is a two step action. The first click opens an inline
 * confirmation that explains the answers become final, and names the number of
 * unanswered questions when there are any. Only the confirmation actually
 * submits, so a single stray click while reviewing can never end the
 * assessment.
 */
export function ReviewAnswers({
  questions,
  answers,
  summary,
  onSelectQuestion,
  onBack,
  onSubmit,
  isSubmitting,
  submitError,
}: {
  questions: AssessmentContentQuestion[];
  answers: AssessmentAnswers;
  summary: AnswerSummary;
  onSelectQuestion: (questionIndex: number) => void;
  onBack: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  submitError: string | null;
}) {
  const [isConfirming, setIsConfirming] = useState(false);

  const lastQuestionNumber = questions.at(-1)?.questionNumber;
  const firstUnansweredIndex = questions.findIndex(
    (question) => !answers[question.id],
  );
  const hasUnanswered = summary.unanswered > 0;

  // "Review questions" goes straight to the first question still missing an
  // answer when there is one, which is the reason the student opened the
  // warning. Otherwise it simply closes the confirmation.
  const handleReviewQuestions = () => {
    setIsConfirming(false);
    if (firstUnansweredIndex >= 0) {
      onSelectQuestion(firstUnansweredIndex);
    }
  };

  return (
    <div className="mt-6">
      <div className="rounded-lg border border-academy-100 bg-white p-5 sm:p-6">
        <h2 className="text-xl font-semibold tracking-tight text-academy-700">
          Review your answers
        </h2>
        <p className="mt-2 max-w-2xl text-base leading-7 text-slate-600">
          Here is every question and the option you selected. Choose any
          question to go back to it and change your answer.
        </p>

        <dl className="mt-5 grid max-w-md grid-cols-2 gap-px overflow-hidden rounded-lg border border-academy-100 bg-academy-100">
          <div className="bg-academy-50 px-4 py-3">
            <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">
              Answered
            </dt>
            <dd className="mt-1 text-base font-semibold text-academy-700">
              {summary.answered} of {summary.total}
            </dd>
          </div>
          <div className="bg-academy-50 px-4 py-3">
            <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">
              Unanswered
            </dt>
            <dd className="mt-1 text-base font-semibold text-academy-700">
              {summary.unanswered}
            </dd>
          </div>
        </dl>

        <h3 className="mt-8 text-sm font-semibold tracking-wide text-slate-500 uppercase">
          All questions
        </h3>
        <ol className="mt-4 grid gap-2 sm:grid-cols-2">
          {questions.map((question, index) => {
            const selected = answers[question.id];

            return (
              // min-w-0 stops the truncated prompt from widening the grid
              // track and pushing the page into horizontal scroll on mobile.
              <li key={question.id} className="min-w-0">
                <button
                  type="button"
                  onClick={() => onSelectQuestion(index)}
                  disabled={isSubmitting}
                  aria-label={
                    selected
                      ? `Question ${question.questionNumber}, answered, option ${selected}. Go to this question.`
                      : `Question ${question.questionNumber}, not answered. Go to this question.`
                  }
                  className={[
                    "flex w-full items-center gap-3 rounded-md border px-3 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                    selected
                      ? "border-academy-200 bg-white hover:bg-academy-50"
                      : "border-amber-200 bg-amber-50/60 hover:bg-amber-50",
                  ].join(" ")}
                >
                  <span
                    aria-hidden="true"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-academy-100 text-xs font-semibold text-academy-700"
                  >
                    {question.questionNumber}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      aria-hidden="true"
                      className="block truncate text-sm text-slate-600"
                      lang="fr"
                    >
                      {question.prompt}
                    </span>
                    <span
                      aria-hidden="true"
                      className={[
                        "mt-0.5 block text-xs font-semibold",
                        selected ? "text-academy-700" : "text-amber-700",
                      ].join(" ")}
                    >
                      {selected ? `Answered - option ${selected}` : "Not answered"}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      {submitError ? <InlineAlert message={submitError} /> : null}

      {isConfirming ? (
        <div
          role="group"
          aria-label="Confirm final submission"
          className="mt-6 rounded-lg border border-academy-200 bg-white p-5 sm:p-6"
        >
          <div className="flex gap-3">
            {hasUnanswered ? (
              <TriangleAlert
                className="mt-1 h-5 w-5 shrink-0 text-amber-600"
                aria-hidden="true"
              />
            ) : null}
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-academy-700">
                {hasUnanswered
                  ? "Submit with unanswered questions?"
                  : "Submit your assessment?"}
              </h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                {hasUnanswered
                  ? `You have ${summary.unanswered} unanswered ${
                      summary.unanswered === 1 ? "question" : "questions"
                    }. You can return to complete them, or submit the assessment as it is. Unanswered questions are recorded as they stand.`
                  : `You have answered all ${summary.total} questions.`}{" "}
                Once you submit, your answers are final and cannot be changed.
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={handleReviewQuestions}
              disabled={isSubmitting}
              className={secondaryButtonClass}
            >
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
              Review Questions
            </button>
            <button
              type="button"
              onClick={onSubmit}
              disabled={isSubmitting}
              aria-busy={isSubmitting}
              className={primaryButtonClass}
            >
              {isSubmitting ? (
                <>
                  Submitting assessment...
                  <LoaderCircle
                    className="h-5 w-5 animate-spin"
                    aria-hidden="true"
                  />
                </>
              ) : hasUnanswered ? (
                "Submit Anyway"
              ) : (
                "Submit Assessment"
              )}
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-6 rounded-md border border-academy-100 bg-white px-4 py-3 text-sm leading-6 text-slate-600">
          When you submit, your answers are sent to Toronto Academy of Education
          and your assessment is marked complete. You will see your result on
          the next screen.
        </p>
      )}

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={onBack}
          disabled={isSubmitting}
          className={secondaryButtonClass}
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          {lastQuestionNumber
            ? `Back to question ${lastQuestionNumber}`
            : "Back"}
        </button>
        <button
          type="button"
          onClick={() => setIsConfirming(true)}
          disabled={isConfirming || isSubmitting}
          className={primaryButtonClass}
        >
          Submit Assessment
        </button>
      </div>
    </div>
  );
}
