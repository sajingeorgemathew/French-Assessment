import type { Metadata } from "next";

import { AdminMetricCards } from "@/components/admin/AdminMetricCards";
import { AdminRecentSubmissions } from "@/components/admin/AdminRecentSubmissions";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { getFrenchAdminDashboard } from "@/lib/admin/dashboard";

export const metadata: Metadata = {
  title: "French Assessment Dashboard | Toronto Academy",
  description:
    "Overview of student assessment activity and recent submissions for Toronto Academy staff.",
  robots: { index: false, follow: false },
};

/**
 * The FA-05 administrator dashboard.
 *
 * The protected layout has already verified the session and the administrator
 * authorization. public.get_french_admin_dashboard verifies it again before it
 * reads a row, so this page cannot render dashboard data for anyone who is not
 * an active administrator, whatever happens in the application layer.
 *
 * An empty database is a normal state here: every count renders as zero, the
 * average renders as a neutral placeholder rather than NaN, and the table shows
 * its empty state.
 */
export default async function AdminDashboardPage() {
  const dashboard = await getFrenchAdminDashboard();

  return (
    <div className="mx-auto w-full max-w-6xl">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-academy-700 sm:text-3xl">
          French Assessment Dashboard
        </h1>
        <p className="mt-2 text-slate-600">
          Overview of student assessment activity and recent submissions.
        </p>
      </header>

      {dashboard.ok ? (
        <>
          <AdminMetricCards summary={dashboard.data.summary} />
          <AdminRecentSubmissions
            submissions={dashboard.data.recentSubmissions}
          />
        </>
      ) : (
        <InlineAlert message={dashboard.message} />
      )}
    </div>
  );
}
