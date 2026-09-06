import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { AdminBenchmarkBadge } from "@/components/admin/results/AdminBenchmarkBadge";
import {
  ADMIN_EMPTY_VALUE,
  formatAdminPercentage,
  formatAdminScore,
  formatAdminTimestamp,
} from "@/lib/admin/admin-dashboard";
import {
  buildAdminResultDetailHref,
  formatAdminOptionalValue,
  type AdminResultRow,
} from "@/lib/admin/admin-results";

/**
 * One page of submitted assessment results.
 *
 * Two representations of the same data are rendered: a semantic table for the
 * laptop widths staff actually work at, and a stacked card list below the lg
 * breakpoint, where nine columns stop being readable. Only one is visible at a
 * time, so no page ever scrolls horizontally.
 *
 * Every row links to /admin/results/[attemptId] using the internal attempt
 * UUID. assessment_attempts.attempt_token is the student's browser facing
 * secret; it is not in this payload and never appears in an admin link.
 *
 * Link text is the student's name rather than "View", so the purpose of each
 * link is clear when read out of context.
 */

const headerClass =
  "px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase whitespace-nowrap";
const cellClass = "px-4 py-3 text-sm text-slate-700 whitespace-nowrap";

function detailLinkLabel(row: AdminResultRow): string {
  return `View the assessment result for ${row.studentFullName}`;
}

export function AdminResultsTable({ results }: { results: AdminResultRow[] }) {
  return (
    <>
      {/* Desktop and laptop: full table. */}
      <div className="mt-4 hidden overflow-x-auto rounded-lg border border-academy-100 bg-white lg:block">
        <table className="w-full border-collapse">
          <caption className="sr-only">
            Submitted French assessment results, newest first
          </caption>
          <thead className="border-b border-academy-100 bg-academy-50">
            <tr>
              <th scope="col" className={headerClass}>
                Student
              </th>
              <th scope="col" className={headerClass}>
                Email
              </th>
              <th scope="col" className={headerClass}>
                Phone
              </th>
              <th scope="col" className={headerClass}>
                Status in Canada
              </th>
              <th scope="col" className={headerClass}>
                Level
              </th>
              <th scope="col" className={headerClass}>
                Score
              </th>
              <th scope="col" className={headerClass}>
                Percentage
              </th>
              <th scope="col" className={headerClass}>
                Benchmark
              </th>
              <th scope="col" className={headerClass}>
                Submitted
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-academy-100">
            {results.map((row) => (
              <tr key={row.attemptId} className="hover:bg-academy-50">
                <th scope="row" className={`${cellClass} text-left`}>
                  <Link
                    href={buildAdminResultDetailHref(row.attemptId)}
                    aria-label={detailLinkLabel(row)}
                    className="font-semibold text-academy-700 underline underline-offset-2 hover:text-academy-600"
                  >
                    {row.studentFullName}
                  </Link>
                </th>
                <td className={cellClass}>{row.studentEmail}</td>
                <td className={cellClass}>{row.studentPhone}</td>
                <td className={cellClass}>
                  {formatAdminOptionalValue(row.statusInCanada)}
                </td>
                <td className={cellClass}>{row.assessmentLevel}</td>
                <td className={cellClass}>
                  {formatAdminScore(row.score, row.totalQuestions)}
                </td>
                <td className={cellClass}>
                  {formatAdminPercentage(row.percentage)}
                </td>
                <td className={cellClass}>
                  {row.percentage === null ? (
                    ADMIN_EMPTY_VALUE
                  ) : (
                    <AdminBenchmarkBadge benchmarkMet={row.benchmarkMet} />
                  )}
                </td>
                <td className={cellClass}>
                  {formatAdminTimestamp(row.submittedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Tablet and mobile: the same rows as stacked cards. */}
      <ul className="mt-4 space-y-3 lg:hidden">
        {results.map((row) => (
          <li
            key={row.attemptId}
            className="rounded-lg border border-academy-100 bg-white px-4 py-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link
                  href={buildAdminResultDetailHref(row.attemptId)}
                  aria-label={detailLinkLabel(row)}
                  className="flex items-center gap-1 text-base font-semibold text-academy-700 underline underline-offset-2"
                >
                  <span className="truncate">{row.studentFullName}</span>
                  <ChevronRight
                    className="h-4 w-4 shrink-0"
                    aria-hidden="true"
                  />
                </Link>
                <p className="mt-0.5 truncate text-sm text-slate-600">
                  {row.studentEmail}
                </p>
                <p className="truncate text-sm text-slate-600">
                  {row.studentPhone}
                </p>
              </div>
              {row.percentage === null ? null : (
                <AdminBenchmarkBadge benchmarkMet={row.benchmarkMet} />
              )}
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-academy-100 pt-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs text-slate-500">Score</dt>
                <dd className="font-medium text-slate-800">
                  {formatAdminScore(row.score, row.totalQuestions)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Percentage</dt>
                <dd className="font-medium text-slate-800">
                  {formatAdminPercentage(row.percentage)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Level</dt>
                <dd className="font-medium text-slate-800">
                  {row.assessmentLevel}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Status in Canada</dt>
                <dd className="font-medium text-slate-800">
                  {formatAdminOptionalValue(row.statusInCanada)}
                </dd>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <dt className="text-xs text-slate-500">Submitted</dt>
                <dd className="font-medium text-slate-800">
                  {formatAdminTimestamp(row.submittedAt)}
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
