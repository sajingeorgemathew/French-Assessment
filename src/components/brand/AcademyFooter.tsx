import Image from "next/image";

/**
 * Simple application footer. Deliberately limited to information that is
 * already established for this project.
 */
export function AcademyFooter() {
  return (
    <footer className="border-t border-academy-100 bg-academy-50">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-3 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3">
          <Image
            src="/brand/favicon.png"
            alt=""
            aria-hidden="true"
            width={218}
            height={218}
            className="h-8 w-8 rounded-sm"
          />
          <p className="text-sm font-semibold text-academy-700">
            Toronto Academy of Education
          </p>
        </div>
        <p className="text-sm text-slate-600">French Language Assessment</p>
      </div>
    </footer>
  );
}
