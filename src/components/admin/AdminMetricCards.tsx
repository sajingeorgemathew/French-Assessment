import {
  ADMIN_EMPTY_VALUE,
  formatAdminPercentage,
  type AdminDashboardSummary,
} from "@/lib/admin/admin-dashboard";

/**
 * The dashboard metric cards.
 *
 * Every number comes from public.get_french_admin_dashboard. Nothing is
 * calculated here, including the benchmark comparison, which the database makes
 * against public.assessments.benchmark_percent.
 */
export function AdminMetricCards({
  summary,
}: {
  summary: AdminDashboardSummary;
}) {
  const hasSubmissions = summary.submittedAttempts > 0;

  const cards = [
    {
      label: "Total Students",
      value: String(summary.totalStudents),
      hint: "Registered student records",
    },
    {
      label: "Total Attempts",
      value: String(summary.totalAttempts),
      hint: `${summary.registeredAttempts} not started`,
    },
    {
      label: "Submitted",
      value: String(summary.submittedAttempts),
      hint: "Completed assessments",
    },
    {
      label: "In Progress",
      value: String(summary.inProgressAttempts),
      hint: "Started, not yet submitted",
    },
    {
      label: "Average Percentage",
      value: formatAdminPercentage(summary.averagePercentage),
      hint: hasSubmissions ? "Across submitted attempts" : "No submissions yet",
    },
    {
      label: "Benchmark Met",
      value: hasSubmissions
        ? String(summary.benchmarkMetCount)
        : ADMIN_EMPTY_VALUE,
      hint: hasSubmissions
        ? `${summary.benchmarkBelowCount} below benchmark`
        : "No submissions yet",
    },
  ];

  return (
    <dl className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-lg border border-academy-100 bg-white px-5 py-4"
        >
          <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">
            {card.label}
          </dt>
          <dd className="mt-1 text-3xl font-semibold text-academy-700">
            {card.value}
          </dd>
          <p className="mt-1 text-sm text-slate-500">{card.hint}</p>
        </div>
      ))}
    </dl>
  );
}
