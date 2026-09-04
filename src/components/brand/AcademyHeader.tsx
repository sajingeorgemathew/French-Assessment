import Image from "next/image";
import Link from "next/link";

/**
 * Compact application header used on every screen so the student always knows
 * the assessment belongs to Toronto Academy of Education.
 */
export function AcademyHeader() {
  return (
    <header className="border-b border-academy-100 bg-white">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 sm:py-5">
        <Link
          href="/"
          className="inline-flex shrink-0 items-center rounded-sm"
          aria-label="Toronto Academy of Education, French Language Assessment home"
        >
          <Image
            src="/brand/logo_final_full.png"
            alt="Toronto Academy of Education"
            width={492}
            height={166}
            preload
            className="h-11 w-auto sm:h-14"
          />
        </Link>
        <p className="hidden border-l border-academy-100 pl-4 text-sm leading-tight font-medium text-academy-600 sm:block">
          French Language Assessment
          <span className="block text-xs font-normal text-slate-500">
            CEFR / CECRL Level A1
          </span>
        </p>
      </div>
    </header>
  );
}
