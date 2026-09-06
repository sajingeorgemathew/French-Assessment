import { AdminBenchmarkBadge } from "@/components/admin/results/AdminBenchmarkBadge";
import {
  ADMIN_EMPTY_VALUE,
  formatAdminPercentage,
  formatAdminScore,
  formatAdminTimestamp,
} from "@/lib/admin/admin-dashboard";
import type { AdminAttemptDetail } from "@/lib/admin/admin-results";

/**
 * The assessment summary card.
 *
 * Every value comes from the database: the score and percentage stored by FA-04
 * at submission, the benchmark percent from the assessment configuration, and
 * the benchmark status decided by the FA-06 detail RPC. Nothing on this card is
 * recalculated in React, so the page can never disagree with the stored result.
 */
export function AdminResultSummary({
  detail,
}: {
  detail: AdminAttemptDetail;
}) {
  const fields: { label: string; value: React.ReactNode }[] = [
    { label: "Assessment", value: detail.assessment.title },
    {
      label: "Level",
      value: `${detail.assessment.level} (${detail.assessment.framework})`,
    },
    {
      label: "Score",
      value: formatAdminScore(detail.score, detail.assessment.totalQuestions),
    },
    { label: "Percentage", value: formatAdminPercentage(detail.percentage) },
    {
      label: "Benchmark",
      value: `${detail.assessment.benchmarkPercent}%`,
    },
    {
      label: "Benchmark Status",
      value:
        detail.percentage === null ? (
          ADMIN_EMPTY_VALUE
        ) : (
          <AdminBenchmarkBadge benchmarkMet={detail.benchmarkMet} />
        ),
    },
    {
      label: "Started",
      value:
        detail.startedAt === null
          ? ADMIN_EMPTY_VALUE
          : formatAdminTimestamp(detail.startedAt),
    },
    { label: "Submitted", value: formatAdminTimestamp(detail.submittedAt) },
  ];

  return (
    <section
      aria-labelledby="assessment-summary-heading"
      className="rounded-lg border border-academy-100 bg-white px-5 py-5"
    >
      <h2
        id="assessment-summary-heading"
        className="text-lg font-semibold text-academy-700"
      >
        Assessment Summary
      </h2>

      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        {fields.map((field) => (
          <div key={field.label} className="min-w-0">
            <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">
              {field.label}
            </dt>
            <dd className="mt-0.5 break-words text-sm font-medium text-slate-800">
              {field.value}
            </dd>
          </div>
        ))}
      </dl>

      <p className="mt-4 border-t border-academy-100 pt-3 text-xs text-slate-500">
        All times are shown in Toronto local time. This result is read only and
        cannot be edited from the administration area.
      </p>
    </section>
  );
}
