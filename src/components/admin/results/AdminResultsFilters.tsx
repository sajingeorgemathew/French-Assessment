import Link from "next/link";
import { Search } from "lucide-react";

import {
  ADMIN_BENCHMARK_FILTERS,
  ADMIN_BENCHMARK_FILTER_LABELS,
  ADMIN_RESULTS_PARAMS,
  ADMIN_RESULTS_PATH,
  ADMIN_RESULTS_SEARCH_MAX_LENGTH,
  type AdminResultsQuery,
} from "@/lib/admin/admin-results";

/**
 * Search and benchmark filter controls for the results list.
 *
 * This is a plain GET form rather than a client component. Submitting it
 * navigates to /admin/results with the new query string, which means the
 * controls work with the keyboard, work without JavaScript, keep the current
 * view shareable and bookmarkable, and add nothing to the browser bundle.
 *
 * The page parameter is deliberately not carried through the form. A new search
 * or a new filter always returns to page one, which is what staff expect and
 * what avoids landing on an empty page of a smaller result set.
 *
 * Only the search term and the filter name are ever placed in the URL. No
 * attempt token and no answer key information is a query parameter anywhere in
 * the admin area.
 */
export function AdminResultsFilters({ query }: { query: AdminResultsQuery }) {
  const hasActiveQuery = query.search !== "" || query.benchmark !== "all";

  return (
    <form
      method="get"
      action={ADMIN_RESULTS_PATH}
      role="search"
      className="mt-6 rounded-lg border border-academy-100 bg-white px-4 py-4 sm:px-5"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-end">
        <div className="min-w-0 flex-1">
          <label
            htmlFor="admin-results-search"
            className="block text-sm font-medium text-academy-700"
          >
            Search students
          </label>
          <input
            id="admin-results-search"
            type="search"
            name={ADMIN_RESULTS_PARAMS.search}
            defaultValue={query.search}
            maxLength={ADMIN_RESULTS_SEARCH_MAX_LENGTH}
            autoComplete="off"
            placeholder="Name, email address or phone number"
            className="mt-1 w-full rounded-md border border-academy-200 bg-white px-3 py-2 text-base text-slate-800 placeholder:text-slate-400"
          />
          <p className="mt-1 text-xs text-slate-500">
            Matches full name, email address and phone number.
          </p>
        </div>

        <div className="md:w-56">
          <label
            htmlFor="admin-results-benchmark"
            className="block text-sm font-medium text-academy-700"
          >
            Benchmark
          </label>
          <select
            id="admin-results-benchmark"
            name={ADMIN_RESULTS_PARAMS.benchmark}
            defaultValue={query.benchmark}
            className="mt-1 w-full rounded-md border border-academy-200 bg-white px-3 py-2 text-base text-slate-800"
          >
            {ADMIN_BENCHMARK_FILTERS.map((filter) => (
              <option key={filter} value={filter}>
                {ADMIN_BENCHMARK_FILTER_LABELS[filter]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-academy-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-academy-700"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            Search
          </button>

          {hasActiveQuery ? (
            <Link
              href={ADMIN_RESULTS_PATH}
              className="text-sm font-semibold text-academy-600 underline underline-offset-2 hover:text-academy-700"
            >
              Clear
            </Link>
          ) : null}
        </div>
      </div>
    </form>
  );
}
