/**
 * Compact progress treatment for the active assessment.
 *
 * It answers the three questions a student has at any moment: which part they
 * are in, which question they are on, and how much is left. The bar is thin and
 * quiet on purpose so it never competes with the question itself.
 */
export function PlayerProgress({
  sectionLabel,
  sectionLabelLang,
  positionLabel,
  valueNow,
  valueMax,
  valueText,
}: {
  sectionLabel: string;
  sectionLabelLang?: string;
  positionLabel: string;
  valueNow: number;
  valueMax: number;
  valueText: string;
}) {
  const percent = valueMax > 0 ? Math.round((valueNow / valueMax) * 100) : 0;

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p
          className="text-sm font-semibold text-academy-700"
          lang={sectionLabelLang}
        >
          {sectionLabel}
        </p>
        <p className="text-sm text-slate-600">{positionLabel}</p>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={valueMax}
        aria-valuenow={valueNow}
        aria-valuetext={valueText}
        className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-academy-100"
      >
        <div
          className="h-full rounded-full bg-academy-600"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
