import { AdminShell } from "@/components/admin/AdminShell";
import { requireFrenchAssessmentAdmin } from "@/lib/admin/auth";

/**
 * The protected administration layout.
 *
 * Every route inside the (protected) group runs this guard on the server before
 * any markup is produced. An anonymous visitor, an expired session, an
 * authenticated non administrator and a deactivated administrator are all
 * redirected to /admin/login and never receive protected content.
 *
 * /admin/login sits outside this group on purpose, so the login page itself is
 * reachable without a session and cannot redirect to itself.
 */
export default async function ProtectedAdminLayout({
  children,
}: LayoutProps<"/admin">) {
  const admin = await requireFrenchAssessmentAdmin();

  return <AdminShell email={admin.email}>{children}</AdminShell>;
}
