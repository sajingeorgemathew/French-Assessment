import { ArrowLeft } from "lucide-react";
import {
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui/button-styles";
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
 * screen, and reaching it does not submit anything: the attempt is still
 * in_progress. FA-04 turns the Submit Assessment button on.
 */
export function ReviewAnswers({
  questions,
  answers,
  summary,
  onSelectQuestion,
  onBack,
}: {
  questions: AssessmentContentQuestion[];
  answers: AssessmentAnswers;
  summary: AnswerSummary;
  onSelectQuestion: (questionIndex: number) => void;
  onBack: () => void;
}) {
  const lastQuestionNumber = questions.at(-1)?.questionNumber;

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
                  aria-label={
                    selected
                      ? `Question ${question.questionNumber}, answered, option ${selected}. Go to this question.`
                      : `Question ${question.questionNumber}, not answered. Go to this question.`
                  }
                  className={[
                    "flex w-full items-center gap-3 rounded-md border px-3 py-3 text-left transition-colors",
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

      <p className="mt-6 rounded-md border border-academy-100 bg-white px-4 py-3 text-sm leading-6 text-slate-600">
        Submission and scoring will be enabled in the next assessment step. Your
        answers are held in this browser session only and have not been sent
        anywhere.
      </p>

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button type="button" onClick={onBack} className={secondaryButtonClass}>
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          {lastQuestionNumber
            ? `Back to question ${lastQuestionNumber}`
            : "Back"}
        </button>
        <button type="button" disabled className={primaryButtonClass}>
          Submit Assessment
        </button>
      </div>
    </div>
  );
}
