import { z } from "zod";

import { ADMIN_EMPTY_VALUE } from "@/lib/admin/admin-dashboard";

/**
 * Types, parsers and URL helpers for the FA-06 administrator results area.
 *
 * This module is the application side half of the FA-06 contract. The database
 * half is public.get_french_admin_results and
 * public.get_french_admin_attempt_detail, both of which verify active
 * administrator authorization themselves before they return anything.
 *
 * The module is deliberately free of server imports so the results filter form
 * and the review components can share exactly the same vocabulary the loaders
 * use. It holds no answer key: the only correct-answer fields anywhere in the
 * project's TypeScript are the ones parsed out of the protected attempt detail
 * response below, and they exist only for the duration of that one authorized
 * request.
 *
 * There is no attempt_token field in any schema here. The RPCs never select the
 * column, so there is nothing to narrow away and nothing for a future change to
 * surface by accident.
 */

// ---------------------------------------------------------------------------
// Route and paging vocabulary
// ---------------------------------------------------------------------------

export const ADMIN_RESULTS_PATH = "/admin/results";

/** Default page size. The RPC applies the same default when none is sent. */
export const ADMIN_RESULTS_PAGE_SIZE = 25;

/** Hard ceiling, mirroring the clamp inside the RPC. */
export const ADMIN_RESULTS_MAX_LIMIT = 100;

/** Maximum accepted search length, mirroring the truncation inside the RPC. */
export const ADMIN_RESULTS_SEARCH_MAX_LENGTH = 120;

/** URL query parameter names. Kept in one place so links cannot drift. */
export const ADMIN_RESULTS_PARAMS = {
  search: "q",
  benchmark: "benchmark",
  page: "page",
} as const;

/** The only benchmark filter values the page and the RPC recognise. */
export const ADMIN_BENCHMARK_FILTERS = ["all", "met", "below"] as const;

export type AdminBenchmarkFilter = (typeof ADMIN_BENCHMARK_FILTERS)[number];

/** Neutral operational labels. This is a diagnostic, so no PASS or FAIL. */
export const ADMIN_BENCHMARK_FILTER_LABELS: Record<
  AdminBenchmarkFilter,
  string
> = {
  all: "All Results",
  met: "Benchmark Met",
  below: "Below Benchmark",
};

export const ADMIN_BENCHMARK_MET_LABEL = "Met";
export const ADMIN_BENCHMARK_BELOW_LABEL = "Below";

// ---------------------------------------------------------------------------
// Results list contract
// ---------------------------------------------------------------------------

/**
 * One submitted attempt in the results list.
 *
 * percentage and score are nullable because the database column is nullable.
 * A submitted attempt always has both, but the schema describes the column
 * rather than the happy path, so an unexpected row is rendered as a placeholder
 * instead of crashing the page.
 */
export const adminResultRowSchema = z.object({
  attempt_id: z.uuid(),
  student_full_name: z.string().min(1),
  student_email: z.string().min(1),
  student_phone: z.string().min(1),
  city: z.string().nullable(),
  status_in_canada: z.string().nullable(),
  current_french_level: z.string().nullable(),
  french_learning_goal: z.string().nullable(),
  assessment_title: z.string().min(1),
  assessment_level: z.string().min(1),
  score: z.number().int().min(0).nullable(),
  total_questions: z.number().int().positive(),
  percentage: z.number().min(0).max(100).nullable(),
  benchmark_percent: z.number().int().min(0).max(100),
  benchmark_met: z.boolean(),
  started_at: z.string().min(1).nullable(),
  submitted_at: z.string().min(1),
});

export const adminResultsRpcResultSchema = z.object({
  results: z.array(adminResultRowSchema).max(ADMIN_RESULTS_MAX_LIMIT),
  total_count: z.number().int().min(0),
  limit: z.number().int().positive().max(ADMIN_RESULTS_MAX_LIMIT),
  offset: z.number().int().min(0),
});

export type AdminResultRow = {
  attemptId: string;
  studentFullName: string;
  studentEmail: string;
  studentPhone: string;
  city: string | null;
  statusInCanada: string | null;
  currentFrenchLevel: string | null;
  frenchLearningGoal: string | null;
  assessmentTitle: string;
  assessmentLevel: string;
  score: number | null;
  totalQuestions: number;
  percentage: number | null;
  benchmarkPercent: number;
  benchmarkMet: boolean;
  startedAt: string | null;
  submittedAt: string;
};

export type AdminResultsPage = {
  results: AdminResultRow[];
  totalCount: number;
  limit: number;
  offset: number;
};

export function toAdminResultsPage(
  parsed: z.infer<typeof adminResultsRpcResultSchema>,
): AdminResultsPage {
  return {
    results: parsed.results.map((row) => ({
      attemptId: row.attempt_id,
      studentFullName: row.student_full_name,
      studentEmail: row.student_email,
      studentPhone: row.student_phone,
      city: row.city,
      statusInCanada: row.status_in_canada,
      currentFrenchLevel: row.current_french_level,
      frenchLearningGoal: row.french_learning_goal,
      assessmentTitle: row.assessment_title,
      assessmentLevel: row.assessment_level,
      score: row.score,
      totalQuestions: row.total_questions,
      percentage: row.percentage,
      benchmarkPercent: row.benchmark_percent,
      benchmarkMet: row.benchmark_met,
      startedAt: row.started_at,
      submittedAt: row.submitted_at,
    })),
    totalCount: parsed.total_count,
    limit: parsed.limit,
    offset: parsed.offset,
  };
}

// ---------------------------------------------------------------------------
// Attempt detail contract
// ---------------------------------------------------------------------------

/**
 * One stored response.
 *
 * selected_option_key is null when the student left the question blank, which
 * FA-04 stores as a real row with is_correct false. correct_option_key is
 * nullable only so that a question with no key row renders as a placeholder
 * rather than failing the parse; FA-04 asserts a complete key at seed time.
 */
export const adminAttemptResponseSchema = z.object({
  question_id: z.uuid(),
  question_number: z.number().int().positive(),
  section_key: z.string().min(1),
  section_title: z.string().min(1),
  section_title_fr: z.string().nullable(),
  section_position: z.number().int().positive(),
  category: z.string().nullable(),
  instruction: z.string().nullable(),
  prompt: z.string().min(1),
  note: z.string().nullable(),
  passage_title: z.string().nullable(),
  passage_body: z.string().nullable(),
  selected_option_key: z.enum(["A", "B", "C", "D"]).nullable(),
  selected_option_text: z.string().nullable(),
  correct_option_key: z.enum(["A", "B", "C", "D"]).nullable(),
  correct_option_text: z.string().nullable(),
  is_correct: z.boolean(),
});

export const adminAttemptDetailRpcResultSchema = z.object({
  attempt: z.object({
    attempt_id: z.uuid(),
    status: z.literal("submitted"),
    score: z.number().int().min(0).nullable(),
    percentage: z.number().min(0).max(100).nullable(),
    started_at: z.string().min(1).nullable(),
    submitted_at: z.string().min(1),
  }),
  student: z.object({
    full_name: z.string().min(1),
    email: z.string().min(1),
    phone: z.string().min(1),
    city: z.string().nullable(),
    status_in_canada: z.string().nullable(),
    current_french_level: z.string().nullable(),
    french_learning_goal: z.string().nullable(),
  }),
  assessment: z.object({
    slug: z.literal("french-a1-diagnostic"),
    title: z.string().min(1),
    title_fr: z.string().nullable(),
    framework: z.string().min(1),
    level: z.string().min(1),
    total_questions: z.number().int().positive(),
    benchmark_percent: z.number().int().min(0).max(100),
  }),
  benchmark_met: z.boolean(),
  responses: z.array(adminAttemptResponseSchema),
  integrity: z.object({
    stored_answer_count: z.number().int().min(0),
    correct_answer_count: z.number().int().min(0),
  }),
});

export type AdminAttemptResponse = {
  questionId: string;
  questionNumber: number;
  sectionKey: string;
  sectionTitle: string;
  sectionTitleFr: string | null;
  sectionPosition: number;
  category: string | null;
  instruction: string | null;
  prompt: string;
  note: string | null;
  passageTitle: string | null;
  passageBody: string | null;
  selectedOptionKey: "A" | "B" | "C" | "D" | null;
  selectedOptionText: string | null;
  correctOptionKey: "A" | "B" | "C" | "D" | null;
  correctOptionText: string | null;
  isCorrect: boolean;
};

export type AdminAttemptDetail = {
  attemptId: string;
  score: number | null;
  percentage: number | null;
  startedAt: string | null;
  submittedAt: string;
  student: {
    fullName: string;
    email: string;
    phone: string;
    city: string | null;
    statusInCanada: string | null;
    currentFrenchLevel: string | null;
    frenchLearningGoal: string | null;
  };
  assessment: {
    title: string;
    titleFr: string | null;
    framework: string;
    level: string;
    totalQuestions: number;
    benchmarkPercent: number;
  };
  benchmarkMet: boolean;
  responses: AdminAttemptResponse[];
  integrity: {
    storedAnswerCount: number;
    correctAnswerCount: number;
  };
};

export function toAdminAttemptDetail(
  parsed: z.infer<typeof adminAttemptDetailRpcResultSchema>,
): AdminAttemptDetail {
  return {
    attemptId: parsed.attempt.attempt_id,
    score: parsed.attempt.score,
    percentage: parsed.attempt.percentage,
    startedAt: parsed.attempt.started_at,
    submittedAt: parsed.attempt.submitted_at,
    student: {
      fullName: parsed.student.full_name,
      email: parsed.student.email,
      phone: parsed.student.phone,
      city: parsed.student.city,
      statusInCanada: parsed.student.status_in_canada,
      currentFrenchLevel: parsed.student.current_french_level,
      frenchLearningGoal: parsed.student.french_learning_goal,
    },
    assessment: {
      title: parsed.assessment.title,
      titleFr: parsed.assessment.title_fr,
      framework: parsed.assessment.framework,
      level: parsed.assessment.level,
      totalQuestions: parsed.assessment.total_questions,
      benchmarkPercent: parsed.assessment.benchmark_percent,
    },
    benchmarkMet: parsed.benchmark_met,
    responses: parsed.responses.map((row) => ({
      questionId: row.question_id,
      questionNumber: row.question_number,
      sectionKey: row.section_key,
      sectionTitle: row.section_title,
      sectionTitleFr: row.section_title_fr,
      sectionPosition: row.section_position,
      category: row.category,
      instruction: row.instruction,
      prompt: row.prompt,
      note: row.note,
      passageTitle: row.passage_title,
      passageBody: row.passage_body,
      selectedOptionKey: row.selected_option_key,
      selectedOptionText: row.selected_option_text,
      correctOptionKey: row.correct_option_key,
      correctOptionText: row.correct_option_text,
      isCorrect: row.is_correct,
    })),
    integrity: {
      storedAnswerCount: parsed.integrity.stored_answer_count,
      correctAnswerCount: parsed.integrity.correct_answer_count,
    },
  };
}

// ---------------------------------------------------------------------------
// Search, filter and paging URL state
// ---------------------------------------------------------------------------

export type AdminResultsQuery = {
  search: string;
  benchmark: AdminBenchmarkFilter;
  /** One based, for the URL and the UI. The RPC offset is derived from it. */
  page: number;
};

export const ADMIN_RESULTS_DEFAULT_QUERY: AdminResultsQuery = {
  search: "",
  benchmark: "all",
  page: 1,
};

/**
 * Upper bound on the page number accepted from the URL.
 *
 * The RPC offset is a PostgreSQL integer, so an unbounded page number from a
 * hand edited URL could overflow it. Clamping here keeps the derived offset
 * comfortably inside the integer range whatever the URL says.
 */
export const ADMIN_RESULTS_MAX_PAGE = 100_000;

/** Reads the first value of a Next.js searchParams entry, ignoring repeats. */
function firstValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

/**
 * Normalizes the admin results URL state.
 *
 * Every branch has a safe default, so a hand edited or stale URL narrows the
 * view rather than producing an error. The same normalization runs again inside
 * the RPC, which is the boundary that actually matters.
 */
export function parseAdminResultsQuery(
  searchParams: Record<string, string | string[] | undefined>,
): AdminResultsQuery {
  const rawSearch = firstValue(searchParams[ADMIN_RESULTS_PARAMS.search])
    .trim()
    .slice(0, ADMIN_RESULTS_SEARCH_MAX_LENGTH);

  const rawBenchmark = firstValue(
    searchParams[ADMIN_RESULTS_PARAMS.benchmark],
  ).trim();

  const benchmark = (
    ADMIN_BENCHMARK_FILTERS as readonly string[]
  ).includes(rawBenchmark)
    ? (rawBenchmark as AdminBenchmarkFilter)
    : "all";

  const parsedPage = Number.parseInt(
    firstValue(searchParams[ADMIN_RESULTS_PARAMS.page]),
    10,
  );

  const page =
    Number.isFinite(parsedPage) && parsedPage >= 1
      ? Math.min(parsedPage, ADMIN_RESULTS_MAX_PAGE)
      : 1;

  return { search: rawSearch, benchmark, page };
}

/**
 * Builds a /admin/results URL for the given state.
 *
 * Default values are omitted, so an untouched list stays on a clean
 * /admin/results URL. Only the search term, the benchmark filter and the page
 * number are ever placed in the query string.
 */
export function buildAdminResultsHref(query: AdminResultsQuery): string {
  const params = new URLSearchParams();

  if (query.search) {
    params.set(ADMIN_RESULTS_PARAMS.search, query.search);
  }

  if (query.benchmark !== "all") {
    params.set(ADMIN_RESULTS_PARAMS.benchmark, query.benchmark);
  }

  if (query.page > 1) {
    params.set(ADMIN_RESULTS_PARAMS.page, String(query.page));
  }

  const queryString = params.toString();

  return queryString ? `${ADMIN_RESULTS_PATH}?${queryString}` : ADMIN_RESULTS_PATH;
}

/** The detail route for one attempt. Always the internal id, never a token. */
export function buildAdminResultDetailHref(attemptId: string): string {
  return `${ADMIN_RESULTS_PATH}/${encodeURIComponent(attemptId)}`;
}

/** Whether a route parameter is a syntactically valid UUID. */
export function isUuid(value: string): boolean {
  return z.uuid().safeParse(value).success;
}

// ---------------------------------------------------------------------------
// Paging arithmetic
// ---------------------------------------------------------------------------

export type AdminResultsPagination = {
  page: number;
  pageCount: number;
  totalCount: number;
  /** One based index of the first row on this page, or 0 when empty. */
  rangeStart: number;
  /** One based index of the last row on this page, or 0 when empty. */
  rangeEnd: number;
  hasPrevious: boolean;
  hasNext: boolean;
};

export function getAdminResultsPagination(
  results: AdminResultsPage,
): AdminResultsPagination {
  const pageCount = Math.max(1, Math.ceil(results.totalCount / results.limit));
  const page = Math.floor(results.offset / results.limit) + 1;
  const rangeStart = results.results.length > 0 ? results.offset + 1 : 0;
  const rangeEnd =
    results.results.length > 0 ? results.offset + results.results.length : 0;

  return {
    page,
    pageCount,
    totalCount: results.totalCount,
    rangeStart,
    rangeEnd,
    hasPrevious: page > 1,
    hasNext: results.offset + results.results.length < results.totalCount,
  };
}

// ---------------------------------------------------------------------------
// Section grouping
// ---------------------------------------------------------------------------

export type AdminAnswerReviewSection = {
  sectionKey: string;
  /** The French part heading, for example "Partie A : Conjugaison et Grammaire". */
  heading: string;
  /** The English section name, shown as supporting text. */
  subheading: string;
  responses: AdminAttemptResponse[];
};

/**
 * Groups the stored responses into the three assessment parts.
 *
 * Section order follows assessment_sections.position and question order follows
 * question_number, both from the database. Nothing is sorted by an assumption
 * about how many questions a section holds, so a future content change reorders
 * the review correctly without a code change.
 */
export function groupAdminAnswerReview(
  responses: AdminAttemptResponse[],
): AdminAnswerReviewSection[] {
  const sections = new Map<string, AdminAnswerReviewSection>();
  const positions = new Map<string, number>();

  for (const response of responses) {
    let section = sections.get(response.sectionKey);

    if (!section) {
      section = {
        sectionKey: response.sectionKey,
        heading: response.sectionTitleFr ?? response.sectionTitle,
        subheading: response.sectionTitle,
        responses: [],
      };

      sections.set(response.sectionKey, section);
      positions.set(response.sectionKey, response.sectionPosition);
    }

    section.responses.push(response);
  }

  const ordered = [...sections.values()].sort(
    (a, b) =>
      (positions.get(a.sectionKey) ?? 0) - (positions.get(b.sectionKey) ?? 0),
  );

  for (const section of ordered) {
    section.responses.sort((a, b) => a.questionNumber - b.questionNumber);
  }

  return ordered;
}

// ---------------------------------------------------------------------------
// Correctness presentation
// ---------------------------------------------------------------------------

export type AdminAnswerState = "correct" | "incorrect" | "unanswered";

/**
 * The correctness state of one stored response.
 *
 * is_correct is read straight from the FA-04 snapshot. Nothing here compares an
 * option key to a key value to decide correctness: the database decided that at
 * submission time and remains authoritative.
 */
export function getAdminAnswerState(
  response: AdminAttemptResponse,
): AdminAnswerState {
  if (response.selectedOptionKey === null) {
    return "unanswered";
  }

  return response.isCorrect ? "correct" : "incorrect";
}

/** Text labels, always rendered, so correctness is never colour only. */
export const ADMIN_ANSWER_STATE_LABELS: Record<AdminAnswerState, string> = {
  correct: "Correct",
  incorrect: "Incorrect",
  unanswered: "Not answered",
};

/** Formats "B - sommes", or the not answered text when nothing was selected. */
export function formatAdminOption(
  optionKey: string | null,
  optionText: string | null,
): string {
  if (!optionKey) {
    return ADMIN_ANSWER_STATE_LABELS.unanswered;
  }

  if (!optionText) {
    return optionKey;
  }

  return `${optionKey} - ${optionText}`;
}

/** Renders an optional student field without ever printing null or undefined. */
export function formatAdminOptionalValue(value: string | null): string {
  const trimmed = value?.trim() ?? "";

  return trimmed === "" ? ADMIN_EMPTY_VALUE : trimmed;
}

// ---------------------------------------------------------------------------
// Data integrity
// ---------------------------------------------------------------------------

export type AdminResultIntegrityWarning = {
  id: string;
  message: string;
};

/**
 * Administrator facing integrity checks.
 *
 * These are reported only. FA-06 never repairs, backfills or overwrites a
 * historical result, and it never fabricates a missing response row: the review
 * shows exactly the rows that FA-04 stored, and says so when the count or the
 * score does not line up with the assessment configuration.
 */
export function getAdminResultIntegrityWarnings(
  detail: AdminAttemptDetail,
): AdminResultIntegrityWarning[] {
  const warnings: AdminResultIntegrityWarning[] = [];
  const expected = detail.assessment.totalQuestions;
  const stored = detail.integrity.storedAnswerCount;

  if (stored !== expected) {
    warnings.push({
      id: "response-count",
      message: `Stored response data is incomplete for this assessment. ${stored} of ${expected} expected responses are recorded. The responses below are exactly what was stored at submission; nothing has been added or changed.`,
    });
  }

  if (
    detail.score !== null &&
    detail.score !== detail.integrity.correctAnswerCount
  ) {
    warnings.push({
      id: "score-consistency",
      message: `The stored score (${detail.score}) does not match the number of responses recorded as correct (${detail.integrity.correctAnswerCount}). The original submitted result is shown unchanged and has not been recalculated.`,
    });
  }

  return warnings;
}
