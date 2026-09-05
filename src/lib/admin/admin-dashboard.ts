import { z } from "zod";

/**
 * Types, parsers and formatters for the FA-05 administrator dashboard.
 *
 * The parse below is the application side half of the dashboard contract. The
 * database half is public.get_french_admin_dashboard, which verifies active
 * administrator authorization itself before it returns anything.
 *
 * There is deliberately no attempt token, no answer key, no correct option key
 * and no per question correctness field in any schema in this module. Those
 * values are never selected by the RPC, so there is nothing here to narrow away
 * and nothing for a future change to accidentally surface.
 */

/** Aggregate counts for the metric cards. */
export const adminDashboardSummarySchema = z.object({
  total_students: z.number().int().min(0),
  total_attempts: z.number().int().min(0),
  registered_attempts: z.number().int().min(0),
  in_progress_attempts: z.number().int().min(0),
  submitted_attempts: z.number().int().min(0),
  // null when nothing has been submitted yet. Never NaN.
  average_percentage: z.number().min(0).max(100).nullable(),
  benchmark_met_count: z.number().int().min(0),
  benchmark_below_count: z.number().int().min(0),
});

/** One recent submitted attempt. Staff facing PII only, no assessment answers. */
export const adminRecentSubmissionSchema = z.object({
  attempt_id: z.uuid(),
  student_full_name: z.string().min(1),
  student_email: z.string().min(1),
  student_phone: z.string().min(1),
  status_in_canada: z.string().nullable(),
  assessment_level: z.string().min(1),
  score: z.number().int().min(0).nullable(),
  total_questions: z.number().int().positive(),
  percentage: z.number().min(0).max(100).nullable(),
  submitted_at: z.string().min(1),
});

/** Shape returned by public.get_french_admin_dashboard. */
export const adminDashboardRpcResultSchema = z.object({
  summary: adminDashboardSummarySchema,
  // The RPC applies the limit. This is the second, independent guard.
  recent_submissions: z.array(adminRecentSubmissionSchema).max(10),
});

export type AdminDashboardSummary = {
  totalStudents: number;
  totalAttempts: number;
  registeredAttempts: number;
  inProgressAttempts: number;
  submittedAttempts: number;
  averagePercentage: number | null;
  benchmarkMetCount: number;
  benchmarkBelowCount: number;
};

export type AdminRecentSubmission = {
  attemptId: string;
  studentFullName: string;
  studentEmail: string;
  studentPhone: string;
  statusInCanada: string | null;
  assessmentLevel: string;
  score: number | null;
  totalQuestions: number;
  percentage: number | null;
  submittedAt: string;
};

export type AdminDashboard = {
  summary: AdminDashboardSummary;
  recentSubmissions: AdminRecentSubmission[];
};

export function toAdminDashboard(
  parsed: z.infer<typeof adminDashboardRpcResultSchema>,
): AdminDashboard {
  return {
    summary: {
      totalStudents: parsed.summary.total_students,
      totalAttempts: parsed.summary.total_attempts,
      registeredAttempts: parsed.summary.registered_attempts,
      inProgressAttempts: parsed.summary.in_progress_attempts,
      submittedAttempts: parsed.summary.submitted_attempts,
      averagePercentage: parsed.summary.average_percentage,
      benchmarkMetCount: parsed.summary.benchmark_met_count,
      benchmarkBelowCount: parsed.summary.benchmark_below_count,
    },
    recentSubmissions: parsed.recent_submissions.map((row) => ({
      attemptId: row.attempt_id,
      studentFullName: row.student_full_name,
      studentEmail: row.student_email,
      studentPhone: row.student_phone,
      statusInCanada: row.status_in_canada,
      assessmentLevel: row.assessment_level,
      score: row.score,
      totalQuestions: row.total_questions,
      percentage: row.percentage,
      submittedAt: row.submitted_at,
    })),
  };
}

/** Placeholder used wherever the database has no value to show yet. */
export const ADMIN_EMPTY_VALUE = "-";

/**
 * Formats a database calculated percentage. A null average, which is what an
 * empty database produces, renders as the neutral placeholder rather than NaN
 * or the word null.
 */
export function formatAdminPercentage(percentage: number | null): string {
  if (percentage === null || !Number.isFinite(percentage)) {
    return ADMIN_EMPTY_VALUE;
  }

  const rounded = Number.isInteger(percentage)
    ? String(percentage)
    : String(Number(percentage.toFixed(2)));

  return `${rounded}%`;
}

/** Formats a stored score as "12 / 20", or the placeholder when unscored. */
export function formatAdminScore(
  score: number | null,
  totalQuestions: number,
): string {
  if (score === null) {
    return ADMIN_EMPTY_VALUE;
  }

  return `${score} / ${totalQuestions}`;
}

/**
 * Renders a timestamptz in Toronto local time. The time zone and locale are
 * pinned so the string is identical on the server and in the browser, and so
 * staff always read the time their students actually submitted.
 */
const submittedAtFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Toronto",
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatAdminTimestamp(value: string): string {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return ADMIN_EMPTY_VALUE;
  }

  return submittedAtFormatter.format(parsed);
}
