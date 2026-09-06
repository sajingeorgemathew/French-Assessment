import { CircleCheck, CircleMinus } from "lucide-react";

import {
  ADMIN_BENCHMARK_BELOW_LABEL,
  ADMIN_BENCHMARK_MET_LABEL,
} from "@/lib/admin/admin-results";

/**
 * Neutral operational benchmark status.
 *
 * The word is always present, so the status never depends on colour or on the
 * icon alone. This is a diagnostic assessment, so the labels are Met and Below
 * rather than PASS and FAIL.
 */
export function AdminBenchmarkBadge({
  benchmarkMet,
  benchmarkPercent,
}: {
  benchmarkMet: boolean;
  benchmarkPercent?: number;
}) {
  const Icon = benchmarkMet ? CircleCheck : CircleMinus;
  const label = benchmarkMet
    ? ADMIN_BENCHMARK_MET_LABEL
    : ADMIN_BENCHMARK_BELOW_LABEL;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
        benchmarkMet
          ? "border-accent-100 bg-accent-50 text-accent-700"
          : "border-amber-200 bg-amber-50 text-amber-800"
      }`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {label}
      {benchmarkPercent === undefined ? null : (
        <span className="font-normal">({benchmarkPercent}% benchmark)</span>
      )}
    </span>
  );
}
