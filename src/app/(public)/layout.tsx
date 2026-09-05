import { AcademyHeader } from "@/components/brand/AcademyHeader";
import { AcademyFooter } from "@/components/brand/AcademyFooter";

/**
 * The public student facing shell: the Toronto Academy header, the main region
 * and the footer that FA-01 established.
 *
 * This layout carries no authentication of any kind. The public French
 * assessment stays completely unauthenticated: students never sign in, and the
 * admin proxy does not run for these routes.
 */
export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-academy-600 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
      >
        Skip to main content
      </a>
      <AcademyHeader />
      {/* A column flex container so a page can opt into filling the
          viewport with flex-1. Pages that do not stay content sized. */}
      <main id="main-content" className="flex flex-1 flex-col">
        {children}
      </main>
      <AcademyFooter />
    </>
  );
}
