import type { Metadata } from "next";
import Link from "next/link";
import { Inbox, SearchX } from "lucide-react";

import { AdminResultsFilters } from "@/components/admin/results/AdminResultsFilters";
import { AdminResultsPagination } from "@/components/admin/results/AdminResultsPagination";
import { AdminResultsTable } from "@/components/admin/results/AdminResultsTable";
import { InlineAlert } from "@/components/ui/InlineAlert";
import {
  buildAdminResultsHref,
  getAdminResultsPagination,
  parseAdminResultsQuery,
  type AdminResultsPage,
  type AdminResultsQuery,
} from "@/lib/admin/admin-results";
import { getFrenchAdminResults } from "@/lib/admin/results";

export const metadata: Metadata = {
  title: "Assessment Results | Toronto Academy French Assessment",
  description:
    "Search and review completed French assessments for Toronto Academy staff.",
  robots: { index: false, follow: false },
};

/**
 * The FA-06 results list.
 *
 * The protected layout has already verified the session and the administrator
 * authorization. public.get_french_admin_results verifies it again before it
 * reads a row, so this page cannot render results for anyone who is not an
 * active administrator, whatever happens in the application layer.
 *
 * Search, benchmark filtering, ordering and paging all happen in the database.
 * Only the current page of rows ever reaches the browser.
 *
 * Two empty states are distinguished on purpose: an empty database is a normal
 * early state and says so, while an empty filtered view tells staff their
 * search is the reason and leaves the filters in place so they can adjust it.
 */
export default async function AdminResultsPage(
  props: PageProps<"/admin/results">,
) {
  // searchParams is a promise in Next.js 16 and must be awaited before use.
  const searchParams = await props.searchParams;
  const query = parseAdminResultsQuery(searchParams);

  const results = await getFrenchAdminResults(query);

  const hasActiveQuery = query.search !== "" || query.benchmark !== "all";

  return (
    <div className="mx-auto w-full max-w-7xl">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-academy-700 sm:text-3xl">
          Assessment Results
        </h1>
        <p className="mt-2 text-slate-600">
          Search and review completed French assessments.
        </p>
      </header>

      <AdminResultsFilters query={query} />

      {!results.ok ? (
        <InlineAlert message={results.message} />
      ) : results.data.results.length === 0 ? (
        <div className="mt-4 flex flex-col items-center gap-2 rounded-lg border border-dashed border-academy-200 bg-white px-6 py-12 text-center">
          {results.data.totalCount > 0 ? (
            <>
              <SearchX className="h-6 w-6 text-academy-300" aria-hidden="true" />
              <p className="text-sm font-medium text-academy-700">
                This page is past the end of the current results.
              </p>
              <Link
                href={buildAdminResultsHref({ ...query, page: 1 })}
                className="text-sm font-semibold text-academy-600 underline underline-offset-2 hover:text-academy-700"
              >
                Return to the first page
              </Link>
            </>
          ) : hasActiveQuery ? (
            <>
              <SearchX className="h-6 w-6 text-academy-300" aria-hidden="true" />
              <p className="text-sm font-medium text-academy-700">
                No assessment results match your current search.
              </p>
              <p className="max-w-sm text-sm text-slate-500">
                Try a different name, email address or phone number, or set the
                benchmark filter back to All Results.
              </p>
            </>
          ) : (
            <>
              <Inbox className="h-6 w-6 text-academy-300" aria-hidden="true" />
              <p className="text-sm font-medium text-academy-700">
                No completed assessments yet.
              </p>
              <p className="max-w-sm text-sm text-slate-500">
                Submitted assessments will appear here as soon as students
                finish the French diagnostic.
              </p>
            </>
          )}
        </div>
      ) : (
        <ResultsListing results={results.data} query={query} />
      )}
    </div>
  );
}

/**
 * The populated list. Pagination state is derived once, from the same payload
 * the table renders, so the range summary and the controls cannot disagree.
 */
function ResultsListing({
  results,
  query,
}: {
  results: AdminResultsPage;
  query: AdminResultsQuery;
}) {
  const pagination = getAdminResultsPagination(results);

  return (
    <>
      <p className="mt-6 text-sm text-slate-600">
        Showing {pagination.rangeStart} to {pagination.rangeEnd} of{" "}
        {pagination.totalCount}{" "}
        {pagination.totalCount === 1 ? "result" : "results"}.
      </p>
      <AdminResultsTable results={results.results} />
      <AdminResultsPagination pagination={pagination} query={query} />
    </>
  );
}
