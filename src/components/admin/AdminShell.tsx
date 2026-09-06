import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";

import { AdminNavigation } from "@/components/admin/AdminNavigation";
import { AdminSignOutButton } from "@/components/admin/AdminSignOutButton";
import { ADMIN_DASHBOARD_PATH } from "@/lib/admin/admin-session";

/**
 * The internal Toronto Academy administration shell.
 *
 * Deliberately plain: a compact branded sidebar on desktop, a stacked header on
 * small screens, and the page content. Students never see this chrome, and it
 * is never rendered for a request that has not already passed
 * requireFrenchAssessmentAdmin().
 *
 * Navigation lives in AdminNavigation, which marks the current section. Every
 * item there is a real route: FA-06 added Results, so there is no longer a
 * disabled placeholder anywhere in this shell.
 */

export function AdminShell({
  email,
  children,
}: {
  email: string | null;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-academy-50 lg:flex-row">
      <aside className="border-b border-academy-100 bg-white lg:w-64 lg:shrink-0 lg:border-r lg:border-b-0">
        <div className="flex h-full flex-col gap-6 px-4 py-4 sm:px-6 lg:px-5 lg:py-6">
          <div>
            <Link
              href={ADMIN_DASHBOARD_PATH}
              className="inline-flex shrink-0 items-center rounded-sm"
              aria-label="Toronto Academy of Education, French Assessment Admin"
            >
              <Image
                src="/brand/logo_final_full.png"
                alt="Toronto Academy of Education"
                width={492}
                height={166}
                className="h-10 w-auto"
              />
            </Link>
            <p className="mt-2 text-xs font-semibold tracking-wide text-academy-500 uppercase">
              French Assessment Admin
            </p>
          </div>

          <AdminNavigation />

          <div className="lg:mt-auto">
            {email ? (
              <p className="mb-2 truncate text-xs text-slate-500" title={email}>
                Signed in as {email}
              </p>
            ) : null}
            <AdminSignOutButton />
          </div>
        </div>
      </aside>

      <main
        id="main-content"
        className="flex min-w-0 flex-1 flex-col px-4 py-8 sm:px-6 lg:px-8"
      >
        {children}
      </main>
    </div>
  );
}
