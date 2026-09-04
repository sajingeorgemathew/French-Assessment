import { ArrowLeft, ArrowRight } from "lucide-react";
import {
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui/button-styles";
import type { AssessmentContentSection } from "@/lib/assessment-content";

/**
 * What each part asks the student to do. These are plain descriptions of the
 * task, never study hints, worked examples or guidance about the answers.
 */
const sectionBlurbs: Record<string, string> = {
  grammar:
    "This part asks you to complete short sentences and choose the verb, article, adjective or question form that fits.",
  vocabulary:
    "This part covers everyday French vocabulary: daily routines, telling the time, family, meals out, numbers and days of the week.",
  reading:
    "This part gives you three short French texts. Each text stays on screen while you answer the two questions that go with it.",
};

export function SectionIntroduction({
  section,
  questionRangeLabel,
  onBack,
  onNext,
}: {
  section: AssessmentContentSection;
  questionRangeLabel: string;
  onBack: () => void;
  onNext: () => void;
}) {
  const heading = section.titleFr ?? section.title;
  const blurb = sectionBlurbs[section.sectionKey];

  return (
    <div className="mt-6">
      <div className="rounded-lg border border-academy-100 bg-white p-6 sm:p-8">
        <p className="text-xs font-semibold tracking-wide text-academy-500 uppercase">
          {section.title}
        </p>
        <h2
          className="mt-2 text-xl font-semibold tracking-tight text-academy-700 sm:text-2xl"
          lang={section.titleFr ? "fr" : undefined}
        >
          {heading}
        </h2>
        <p className="mt-2 text-base text-slate-600" lang="fr">
          {section.description ?? questionRangeLabel}
        </p>
        {blurb ? (
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-700">
            {blurb}
          </p>
        ) : null}
      </div>

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button type="button" onClick={onBack} className={secondaryButtonClass}>
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          Back
        </button>
        <button type="button" onClick={onNext} className={primaryButtonClass}>
          <span lang="fr">Commencer la partie</span>
          <ArrowRight className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
