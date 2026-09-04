/** Shared button styling so every action in the flow looks and behaves the same. */

const disabledClass =
  "disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-academy-600";

export const primaryButtonClass =
  `inline-flex items-center justify-center gap-2 rounded-md bg-academy-600 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-academy-700 focus-visible:outline-academy-700 ${disabledClass}`;

export const secondaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-md border border-academy-200 bg-white px-6 py-3 text-base font-semibold text-academy-700 transition-colors hover:bg-academy-50 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-white";
