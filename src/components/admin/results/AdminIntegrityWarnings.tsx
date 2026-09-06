import { TriangleAlert } from "lucide-react";

import type { AdminResultIntegrityWarning } from "@/lib/admin/admin-results";

/**
 * Administrator facing data integrity notices.
 *
 * These are reports, not repairs. FA-06 never alters a submitted attempt: a
 * short response snapshot stays short, and a score that disagrees with the
 * stored correctness flags is still shown as the authoritative stored value.
 * The notice exists so staff know to investigate rather than quietly trusting a
 * result that does not add up.
 */
export function AdminIntegrityWarnings({
  warnings,
}: {
  warnings: AdminResultIntegrityWarning[];
}) {
  if (warnings.length === 0) {
    return null;
  }

  return (
    <div
      role="status"
      className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3"
    >
      <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
        <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
        Data integrity warning
      </p>
      <ul className="mt-1.5 space-y-1 pl-6 text-sm leading-6 text-amber-900">
        {warnings.map((warning) => (
          <li key={warning.id} className="list-disc">
            {warning.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
