import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import {
  buildAdminResultsHref,
  type AdminResultsPagination as AdminResultsPaginationState,
  type AdminResultsQuery,
} from "@/lib/admin/admin-results";

/**
 * Previous and Next controls for the results list.
 *
 * Paging is server side: each control is an ordinary link to the same route
 * with a different page number, so the next page is fetched from the database
 * rather than sliced out of a full result set held in the browser.
 *
 * When every result fits on one page the whole component renders nothing, so
 * staff are never shown disabled controls that suggest more data exists.
 */
const controlClass =
  "inline-flex items-center gap-1.5 rounded-md border border-academy-200 bg-white px-4 py-2 text-sm font-semibold text-academy-700 transition-colors hover:bg-academy-50";

export function AdminResultsPagination({
  pagination,
  query,
}: {
  pagination: AdminResultsPaginationState;
  query: AdminResultsQuery;
}) {
  if (!pagination.hasPrevious && !pagination.hasNext) {
    return null;
  }

  return (
    <nav
      aria-label="Results pages"
      className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-sm text-slate-600" aria-live="polite">
        Page {pagination.page} of {pagination.pageCount}
      </p>

      <div className="flex items-center gap-2">
        {pagination.hasPrevious ? (
          <Link
            href={buildAdminResultsHref({ ...query, page: pagination.page - 1 })}
            rel="prev"
            className={controlClass}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            Previous
          </Link>
        ) : null}

        {pagination.hasNext ? (
          <Link
            href={buildAdminResultsHref({ ...query, page: pagination.page + 1 })}
            rel="next"
            className={controlClass}
          >
            Next
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
