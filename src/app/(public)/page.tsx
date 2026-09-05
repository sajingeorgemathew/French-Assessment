import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AssessmentOverview } from "@/components/assessment/AssessmentOverview";
import { primaryButtonClass } from "@/components/ui/button-styles";
import {
  ASSESSMENT_LEVEL,
  ASSESSMENT_QUESTION_COUNT,
  ASSESSMENT_TITLE_FR,
} from "@/lib/assessment";

const summaryItems = [
  { label: "Level", value: "A1" },
  { label: "Questions", value: String(ASSESSMENT_QUESTION_COUNT) },
  { label: "Sections", value: "Grammar, Vocabulary, Reading" },
];

export default function Home() {
  return (
    <>
      <section className="bg-white">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center lg:gap-14">
          <div>
            <p className="text-sm font-semibold tracking-wide text-academy-500 uppercase">
              Toronto Academy of Education
            </p>
            <h1 className="mt-3 text-3xl leading-tight font-semibold tracking-tight text-academy-700 sm:text-4xl lg:text-5xl">
              French Language Assessment
            </h1>
            <p className="mt-3 text-lg text-slate-600 sm:text-xl" lang="fr">
              {ASSESSMENT_TITLE_FR}
            </p>
            <p className="mt-5 inline-flex items-center rounded-full border border-academy-200 bg-academy-50 px-3 py-1 text-sm font-medium text-academy-600">
              {ASSESSMENT_LEVEL}
            </p>
            <p className="mt-6 max-w-xl text-base leading-7 text-slate-700">
              This short diagnostic helps Toronto Academy understand your current
              French ability. There is no pass or fail. Your answers give our
              team a clear starting point so we can recommend the French
              learning pathway that fits you best.
            </p>
            <div className="mt-8">
              <Link href="/assessment" className={primaryButtonClass}>
                Start Assessment
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </Link>
              <p className="mt-3 text-sm text-slate-500">
                Takes only a few minutes. We will ask for your contact details
                first.
              </p>
            </div>
          </div>

          <div className="order-first lg:order-none">
            <Image
              src="/brand/frenchhero.jpg"
              alt="Illustration of French study materials, including books, a notebook and Paris landmarks."
              width={1536}
              height={1024}
              preload
              sizes="(min-width: 1024px) 40vw, 100vw"
              className="h-auto w-full rounded-lg border border-academy-100"
            />
          </div>
        </div>

        <div className="mx-auto w-full max-w-6xl px-4 pb-12 sm:px-6 sm:pb-16">
          <dl className="grid gap-px overflow-hidden rounded-lg border border-academy-100 bg-academy-100 sm:grid-cols-3">
            {summaryItems.map((item) => (
              <div key={item.value} className="bg-white px-5 py-4">
                <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                  {item.label}
                </dt>
                <dd className="mt-1 text-lg font-semibold text-academy-700">
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <AssessmentOverview />
    </>
  );
}
