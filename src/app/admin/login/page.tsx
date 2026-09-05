import type { Metadata } from "next";
import Image from "next/image";
import { CircleAlert, Info } from "lucide-react";

import { AdminLoginForm } from "@/components/admin/AdminLoginForm";
import { AdminSignOutButton } from "@/components/admin/AdminSignOutButton";
import {
  ADMIN_LOGIN_NOTICE_PARAM,
  ADMIN_LOGIN_NOTICES,
  ADMIN_NOT_AUTHORIZED_MESSAGE,
} from "@/lib/admin/admin-session";

export const metadata: Metadata = {
  title: "Administrator Sign In | Toronto Academy French Assessment",
  description:
    "Toronto Academy of Education staff sign in for the French Assessment administration area.",
  robots: { index: false, follow: false },
};

/**
 * The staff sign in page.
 *
 * It is the only /admin route an anonymous visitor may render. There is no sign
 * up control, no create account control and no password recovery control:
 * administrator accounts are provisioned manually in Supabase Auth.
 *
 * The page never reveals whether an account exists. The only notices it can
 * show are the generic "not authorised" message and a plain signed out
 * confirmation.
 */
export default async function AdminLoginPage(props: PageProps<"/admin/login">) {
  const searchParams = await props.searchParams;
  const rawNotice = searchParams[ADMIN_LOGIN_NOTICE_PARAM];
  const notice = Array.isArray(rawNotice) ? rawNotice[0] : rawNotice;

  const isNotAuthorized = notice === ADMIN_LOGIN_NOTICES.notAuthorized;
  const isSignedOut = notice === ADMIN_LOGIN_NOTICES.signedOut;

  return (
    <main
      id="main-content"
      className="flex flex-1 flex-col items-center justify-center bg-academy-50 px-4 py-12 sm:px-6"
    >
      <div className="w-full max-w-md">
        <div className="flex justify-center">
          <Image
            src="/brand/logo_final_full.png"
            alt="Toronto Academy of Education"
            width={492}
            height={166}
            preload
            className="h-14 w-auto"
          />
        </div>

        <div className="mt-6 rounded-lg border border-academy-100 bg-white px-6 py-7 sm:px-8">
          <h1 className="text-xl font-semibold text-academy-700">
            French Assessment Administration
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Sign in with your Toronto Academy staff account.
          </p>

          {isNotAuthorized ? (
            <div
              role="alert"
              className="mt-5 flex items-start gap-2.5 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900"
            >
              <CircleAlert
                className="mt-1 h-4 w-4 shrink-0"
                aria-hidden="true"
              />
              <div>
                <p>{ADMIN_NOT_AUTHORIZED_MESSAGE}</p>
                {/* Lets staff drop a signed in but unauthorised session before
                    signing in with the right account. */}
                <AdminSignOutButton className="mt-3" />
              </div>
            </div>
          ) : null}

          {isSignedOut ? (
            <p
              role="status"
              className="mt-5 flex items-start gap-2.5 rounded-md border border-academy-100 bg-academy-50 px-4 py-3 text-sm leading-6 text-academy-700"
            >
              <Info className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />
              You have been signed out.
            </p>
          ) : null}

          <AdminLoginForm />
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          Toronto Academy of Education staff access only.
        </p>
      </div>
    </main>
  );
}
