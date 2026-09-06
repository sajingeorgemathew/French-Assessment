import Link from "next/link";
import { Inbox } from "lucide-react";

import {
  ADMIN_EMPTY_VALUE,
  formatAdminPercentage,
  formatAdminScore,
  formatAdminTimestamp,
  type AdminRecentSubmission,
} from "@/lib/admin/admin-dashboard";
import { buildAdminResultDetailHref } from "@/lib/admin/admin-results";

/**
 * The ten most recent submitted assessments, newest first.
 *
 * Each student name links to the FA-06 review at /admin/results/[attemptId],
 * addressed by the internal attempt UUID. assessment_attempts.attempt_token is
 * the student's browser facing secret and never appears in an admin link.
 *
 * The rows themselves carry no attempt token, no answer, no answer key and no
 * per question correctness. The dashboard RPC never selects those columns; the
 * per question review is loaded by the protected FA-06 detail RPC instead.
 *
 * Metric calculations and the layout are unchanged from FA-05.
 */

const headerClass =
  "px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase whitespace-nowrap";
const cellClass = "px-4 py-3 text-sm text-slate-700 whitespace-nowrap";

export function AdminRecentSubmissions({
  submissions,
}: {
  submissions: AdminRecentSubmission[];
}) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold text-academy-700">
        Recent Submissions
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        The ten most recently completed assessments.
      </p>

      {submissions.length === 0 ? (
        <div className="mt-4 flex flex-col items-center gap-2 rounded-lg border border-dashed border-academy-200 bg-white px-6 py-12 text-center">
          <Inbox className="h-6 w-6 text-academy-300" aria-hidden="true" />
          <p className="text-sm font-medium text-academy-700">
            No completed assessments yet.
          </p>
          <p className="max-w-sm text-sm text-slate-500">
            Submitted assessments will appear here as soon as students finish
            the French diagnostic.
          </p>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-academy-100 bg-white">
          <table className="w-full border-collapse">
            <caption className="sr-only">
              Recent submitted French assessments, newest first
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
                  Submitted
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-academy-100">
              {submissions.map((submission) => (
                <tr key={submission.attemptId}>
                  <th scope="row" className={`${cellClass} text-left`}>
                    <Link
                      href={buildAdminResultDetailHref(submission.attemptId)}
                      aria-label={`View the assessment result for ${submission.studentFullName}`}
                      className="font-semibold text-academy-700 underline underline-offset-2 hover:text-academy-600"
                    >
                      {submission.studentFullName}
                    </Link>
                  </th>
                  <td className={cellClass}>{submission.studentEmail}</td>
                  <td className={cellClass}>
                    {submission.statusInCanada ?? ADMIN_EMPTY_VALUE}
                  </td>
                  <td className={cellClass}>{submission.assessmentLevel}</td>
                  <td className={cellClass}>
                    {formatAdminScore(
                      submission.score,
                      submission.totalQuestions,
                    )}
                  </td>
                  <td className={cellClass}>
                    {formatAdminPercentage(submission.percentage)}
                  </td>
                  <td className={cellClass}>
                    {formatAdminTimestamp(submission.submittedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
