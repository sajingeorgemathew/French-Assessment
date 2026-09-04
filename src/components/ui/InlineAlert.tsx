import { CircleAlert } from "lucide-react";

/**
 * Generic, retryable message shown when a server operation fails. It never
 * carries database detail, only the safe text the action returned.
 */
export function InlineAlert({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="mt-6 flex items-start gap-2.5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800"
    >
      <CircleAlert className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
