import type { ReactNode } from "react";
import { ASSESSMENT_LEVEL, ASSESSMENT_TITLE } from "@/lib/assessment";

/**
 * Frame shared by every player screen.
 *
 * The active assessment deliberately drops the marketing treatment used on the
 * entry pages: one compact identity line, then the work. The wider container
 * exists so the reading split layout has room at 1366x768 without becoming
 * cramped.
 */
export function PlayerShell({
  title,
  titleFr,
  subtitle,
  children,
}: {
  title?: string;
  titleFr?: string | null;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    // flex-1 fills the remaining page height, so the short screens (section
    // introductions, loading, error) keep the assessment background instead of
    // leaving a white band above the footer.
    <div className="flex-1 bg-academy-50">
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-academy-100 pb-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wide text-academy-500 uppercase">
              Toronto Academy of Education
            </p>
            <h1 className="mt-1 text-lg font-semibold tracking-tight text-academy-700 sm:text-xl">
              {title ?? ASSESSMENT_TITLE}
            </h1>
          </div>
          <p className="text-sm text-slate-600">
            {titleFr ? (
              <>
                <span lang="fr">{titleFr}</span>
                <span className="text-slate-400"> | </span>
              </>
            ) : null}
            {subtitle ?? ASSESSMENT_LEVEL}
          </p>
        </header>

        {children}
      </div>
    </div>
  );
}
