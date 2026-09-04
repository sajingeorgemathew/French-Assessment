import type { AssessmentContentPassage } from "@/lib/assessment-content";

/**
 * The reading text for the current question.
 *
 * It is rendered next to every question that references it, so a student never
 * has to remember a passage from a previous screen. The body keeps its source
 * line breaks, and on large screens the text scrolls inside its own box rather
 * than pushing Back and Next below the fold.
 */
export function ReadingPassage({
  passage,
}: {
  passage: AssessmentContentPassage;
}) {
  const headingId = `passage-${passage.id}`;

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-lg border border-academy-100 bg-white p-5 sm:p-6"
    >
      <p className="text-xs font-semibold tracking-wide text-academy-500 uppercase">
        Reading text
      </p>
      <h3
        id={headingId}
        className="mt-1 text-base font-semibold text-academy-700"
        lang="fr"
      >
        {passage.title}
      </h3>
      <div className="mt-3 lg:max-h-96 lg:overflow-y-auto lg:pr-1">
        <p
          lang="fr"
          className="text-base leading-7 whitespace-pre-line text-slate-800"
        >
          {passage.body}
        </p>
      </div>
    </section>
  );
}
