import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { AdminAnswerReview } from "@/components/admin/results/AdminAnswerReview";
import { AdminIntegrityWarnings } from "@/components/admin/results/AdminIntegrityWarnings";
import { AdminResultSummary } from "@/components/admin/results/AdminResultSummary";
import { AdminStudentInformation } from "@/components/admin/results/AdminStudentInformation";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { formatAdminTimestamp } from "@/lib/admin/admin-dashboard";
import {
  ADMIN_RESULTS_PATH,
  getAdminResultIntegrityWarnings,
  isUuid,
} from "@/lib/admin/admin-results";
import { getFrenchAdminAttemptDetail } from "@/lib/admin/results";

export const metadata: Metadata = {
  title: "Assessment Result | Toronto Academy French Assessment",
  description:
    "Individual French assessment result review for Toronto Academy staff.",
  robots: { index: false, follow: false },
};

/**
 * The FA-06 individual assessment review.
 *
 * The route parameter is public.assessment_attempts.id, the internal UUID. The
 * student's attempt_token never appears in this URL, in any link that leads
 * here, or in the RPC payload this page renders.
 *
 * Three different failures resolve to the same clean not-found: a route
 * parameter that is not a UUID, an attempt that does not exist, and an attempt
 * that exists but has not been submitted. The database returns one
 * indistinguishable answer for the last two, so the page cannot be used to
 * probe whether a particular attempt id exists.
 *
 * A transport or authorization failure is different from a missing attempt and
 * renders the generic administrator error instead, with no database detail.
 *
 * The page is read only. There is no action, no form and no mutation anywhere
 * in this route: no score editing, no answer editing, no student editing, no
 * deletion and no way to reopen an attempt.
 */
export default async function AdminResultDetailPage(
  props: PageProps<"/admin/results/[attemptId]">,
) {
  // params is a promise in Next.js 16 and must be awaited before use.
  const { attemptId } = await props.params;

  // Validated before the database is touched, so a malformed id becomes a clean
  // not-found rather than an invalid input error from PostgREST.
  if (!isUuid(attemptId)) {
    notFound();
  }

  const detail = await getFrenchAdminAttemptDetail(attemptId);

  if (!detail.ok) {
    return (
      <div className="mx-auto w-full max-w-5xl">
        <BackToResults />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-academy-700 sm:text-3xl">
          Assessment Result
        </h1>
        <InlineAlert message={detail.message} />
      </div>
    );
  }

  if (detail.data === null) {
    notFound();
  }

  const result = detail.data;
  const warnings = getAdminResultIntegrityWarnings(result);

  return (
    <div className="mx-auto w-full max-w-5xl">
      <BackToResults />

      <header className="mt-4">
        <p className="text-xs font-semibold tracking-wide text-academy-500 uppercase">
          Assessment Result
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-academy-700 sm:text-3xl">
          {result.student.fullName}
        </h1>
        <p className="mt-2 text-slate-600">
          {result.assessment.title} ({result.assessment.level}), submitted{" "}
          {formatAdminTimestamp(result.submittedAt)}.
        </p>
      </header>

      <div className="mt-6 space-y-6">
        <AdminIntegrityWarnings warnings={warnings} />

        <div className="grid gap-6 xl:grid-cols-2">
          <AdminStudentInformation student={result.student} />
          <AdminResultSummary detail={result} />
        </div>

        <AdminAnswerReview responses={result.responses} />
      </div>

      <div className="mt-8 border-t border-academy-100 pt-6">
        <BackToResults />
      </div>
    </div>
  );
}

/**
 * A real link back to the results list, not a history based control, so the
 * route works when it is opened directly or from a bookmark.
 */
function BackToResults() {
  return (
    <Link
      href={ADMIN_RESULTS_PATH}
      className="inline-flex items-center gap-1.5 text-sm font-semibold text-academy-600 underline underline-offset-2 hover:text-academy-700"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      Back to Results
    </Link>
  );
}
