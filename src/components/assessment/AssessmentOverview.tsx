import { BookMarked, BookOpen, PenLine } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  ASSESSMENT_QUESTION_COUNT,
  ASSESSMENT_SECTIONS,
  type AssessmentSection,
} from "@/lib/assessment";

const sectionIcons: Record<AssessmentSection["id"], LucideIcon> = {
  grammar: PenLine,
  vocabulary: BookOpen,
  reading: BookMarked,
};

const whatToExpect = [
  `${ASSESSMENT_QUESTION_COUNT} questions covering grammar, vocabulary and reading comprehension.`,
  "Choose the best answer for each question.",
  "There is nothing to prepare. Answer with the French you already know.",
  "Your answers help Toronto Academy recommend a suitable French learning pathway.",
];

/** Explains what the French A1 diagnostic covers before a student starts. */
export function AssessmentOverview() {
  return (
    <section
      aria-labelledby="assessment-overview-heading"
      className="border-t border-academy-100 bg-academy-50"
    >
      <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
        <h2
          id="assessment-overview-heading"
          className="text-2xl font-semibold tracking-tight text-academy-700 sm:text-3xl"
        >
          What the assessment covers
        </h2>
        <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
          The diagnostic looks at three areas of beginner French so we can see
          where you are comfortable and where extra support would help.
        </p>

        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ASSESSMENT_SECTIONS.map((section) => {
            const Icon = sectionIcons[section.id];

            return (
              <li
                key={section.id}
                className="rounded-lg border border-academy-100 bg-white p-6"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-md bg-academy-50 text-academy-600">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-lg font-semibold text-academy-700">
                  {section.name}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {section.description}
                </p>
              </li>
            );
          })}
        </ul>

        <div className="mt-10 rounded-lg border border-academy-100 bg-white p-6 sm:p-8">
          <h3 className="text-lg font-semibold text-academy-700">
            What to expect
          </h3>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {whatToExpect.map((item) => (
              <li key={item} className="flex gap-3 text-sm leading-6 text-slate-700">
                <span
                  aria-hidden="true"
                  className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-500"
                />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
