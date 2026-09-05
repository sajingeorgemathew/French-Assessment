import { LogOut } from "lucide-react";

import { signOutFrenchAssessmentAdmin } from "@/lib/actions/admin-auth";

/**
 * The real sign out control.
 *
 * A plain form posting to a Server Action, so it works without client
 * JavaScript. The action clears the Supabase auth cookies and redirects to
 * /admin/login; after that the proxy sends any further /admin request straight
 * back to the login page.
 */
export function AdminSignOutButton({
  className = "",
}: {
  className?: string;
}) {
  return (
    <form action={signOutFrenchAssessmentAdmin} className={className}>
      <button
        type="submit"
        className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-academy-200 bg-white px-4 py-2 text-sm font-semibold text-academy-700 transition-colors hover:bg-academy-50"
      >
        <LogOut className="h-4 w-4" aria-hidden="true" />
        Sign Out
      </button>
    </form>
  );
}
