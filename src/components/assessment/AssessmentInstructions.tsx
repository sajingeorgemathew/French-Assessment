"use client";

import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookMarked,
  BookOpen,
  LoaderCircle,
  PenLine,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  ASSESSMENT_QUESTION_COUNT,
  ASSESSMENT_SECTIONS,
  ASSESSMENT_TITLE_FR,
  type AssessmentSection,
} from "@/lib/assessment";
import { beginFrenchAssessment } from "@/lib/actions/assessment";
import type { AssessmentSession } from "@/lib/assessment-session";
import {
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui/button-styles";
import { InlineAlert } from "@/components/ui/InlineAlert";

const sectionIcons: Record<AssessmentSection["id"], LucideIcon> = {
  grammar: PenLine,
  vocabulary: BookOpen,
  reading: BookMarked,
};

const instructions = [
  `The assessment has ${ASSESSMENT_QUESTION_COUNT} questions in total.`,
  "Choose the best answer for each question.",
  "Answer every question, even if you are unsure.",
  "Your answers will be submitted together at the end of the assessment.",
  "This is a diagnostic, not an exam. Answer with the French you already know.",
];

/**
 * By the time this step is visible the database already holds the student and a
 * registered attempt. Begin Assessment only transitions that existing attempt,
 * so it never creates a second one.
 */
export function AssessmentInstructions({
  studentName,
  attemptToken,
  onBack,
  onBegun,
}: {
  studentName: string;
  attemptToken: string;
  onBack: () => void;
  onBegun: (session: AssessmentSession) => void;
}) {
  const [isBeginning, setIsBeginning] = useState(false);
  const [beginError, setBeginError] = useState<string | null>(null);

  const handleBegin = async () => {
    // Guard against a repeated click while the transition is in flight.
    if (isBeginning) {
      return;
    }

    setBeginError(null);
    setIsBeginning(true);

    const result = await beginFrenchAssessment(attemptToken);

    if (!result.ok) {
      setBeginError(result.message);
      setIsBeginning(false);
      return;
    }

    onBegun(result.data);
  };

  return (
    <div className="mt-6">
      <div className="rounded-lg border border-academy-100 bg-white p-6 sm:p-8">
        <h2 className="text-xl font-semibold text-academy-700">
          Assessment instructions
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {studentName ? `${studentName}, here is ` : "Here is "}
          what to expect from the French A1 diagnostic assessment{" "}
          <span lang="fr">({ASSESSMENT_TITLE_FR})</span>.
        </p>

        <h3 className="mt-8 text-sm font-semibold tracking-wide text-slate-500 uppercase">
          Sections
        </h3>
        <ul className="mt-4 grid gap-4 sm:grid-cols-3">
          {ASSESSMENT_SECTIONS.map((section) => {
            const Icon = sectionIcons[section.id];

            return (
              <li
                key={section.id}
                className="rounded-md border border-academy-100 bg-academy-50 p-4"
              >
                <span className="flex items-center gap-2 text-academy-700">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  <span className="font-semibold">{section.name}</span>
                </span>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {section.description}
                </p>
              </li>
            );
          })}
        </ul>

        <h3 className="mt-8 text-sm font-semibold tracking-wide text-slate-500 uppercase">
          Before you begin
        </h3>
        <ul className="mt-4 space-y-3">
          {instructions.map((instruction) => (
            <li
              key={instruction}
              className="flex gap-3 text-base leading-7 text-slate-700"
            >
              <span
                aria-hidden="true"
                className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-500"
              />
              {instruction}
            </li>
          ))}
        </ul>
      </div>

      {beginError ? <InlineAlert message={beginError} /> : null}

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={onBack}
          disabled={isBeginning}
          className={secondaryButtonClass}
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          Back
        </button>
        <button
          type="button"
          onClick={handleBegin}
          disabled={isBeginning}
          aria-busy={isBeginning}
          className={primaryButtonClass}
        >
          {isBeginning ? (
            <>
              Starting your assessment
              <LoaderCircle
                className="h-5 w-5 animate-spin"
                aria-hidden="true"
              />
            </>
          ) : (
            <>
              Begin Assessment
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
