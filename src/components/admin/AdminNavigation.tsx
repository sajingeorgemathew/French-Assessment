"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GraduationCap, LayoutDashboard } from "lucide-react";

import { ADMIN_DASHBOARD_PATH } from "@/lib/admin/admin-session";
import { ADMIN_RESULTS_PATH } from "@/lib/admin/admin-results";

/**
 * The administration sidebar navigation.
 *
 * Every item here is a real route. Nothing is a disabled placeholder, so a
 * member of staff never clicks something that cannot work. A Students area may
 * be added by a later ticket, and will be added as a link when the route
 * exists.
 *
 * This is the only client component in the admin shell, and it exists solely to
 * read the current path so the active item can be marked with aria-current. It
 * receives no props, holds no state and reads no data.
 */

const navigation = [
  {
    label: "Dashboard",
    href: ADMIN_DASHBOARD_PATH,
    icon: LayoutDashboard,
  },
  {
    label: "Results",
    href: ADMIN_RESULTS_PATH,
    icon: GraduationCap,
  },
] as const;

export function AdminNavigation() {
  const pathname = usePathname();

  return (
    <nav aria-label="Administration" className="lg:flex-1">
      <ul className="flex flex-wrap gap-2 lg:block lg:space-y-1">
        {navigation.map((item) => {
          // The detail route /admin/results/[attemptId] keeps Results marked as
          // the current section, so staff never lose their place.
          const isCurrent =
            item.href === ADMIN_DASHBOARD_PATH
              ? pathname === ADMIN_DASHBOARD_PATH
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isCurrent ? "page" : undefined}
                className={`inline-flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
                  isCurrent
                    ? "bg-academy-600 text-white"
                    : "text-academy-700 hover:bg-academy-50"
                }`}
              >
                <item.icon className="h-4 w-4" aria-hidden="true" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
