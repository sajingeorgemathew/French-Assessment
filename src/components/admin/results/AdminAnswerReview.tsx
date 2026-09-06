import { AdminAnswerReviewItem } from "@/components/admin/results/AdminAnswerReviewItem";
import {
  getAdminAnswerState,
  groupAdminAnswerReview,
  type AdminAttemptResponse,
} from "@/lib/admin/admin-results";

/**
 * The detailed response review, grouped into the three assessment parts.
 *
 * The rows are the finalized FA-04 snapshot from public.assessment_answers, in
 * question order, exactly as stored. Nothing is recomputed, and no row is
 * invented to fill a gap: if a response is missing, the integrity warning above
 * this section says so and the question simply does not appear.
 *
 * Section headings use the French part titles from the database, with the
 * English section name as supporting text.
 */
export function AdminAnswerReview({
  responses,
}: {
  responses: AdminAttemptResponse[];
}) {
  const sections = groupAdminAnswerReview(responses);

  if (sections.length === 0) {
    return (
      <section aria-labelledby="answer-review-heading">
        <h2
          id="answer-review-heading"
          className="text-lg font-semibold text-academy-700"
        >
          Detailed Response Review
        </h2>
        <div className="mt-4 rounded-lg border border-dashed border-academy-200 bg-white px-6 py-10 text-center">
          <p className="text-sm font-medium text-academy-700">
            No stored responses are available for this assessment.
          </p>
        </div>
      </section>
    );
  }

  const correctCount = responses.filter(
    (response) => getAdminAnswerState(response) === "correct",
  ).length;
  const unansweredCount = responses.filter(
    (response) => getAdminAnswerState(response) === "unanswered",
  ).length;

  return (
    <section aria-labelledby="answer-review-heading">
      <h2
        id="answer-review-heading"
        className="text-lg font-semibold text-academy-700"
      >
        Detailed Response Review
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        {responses.length} stored {responses.length === 1 ? "response" : "responses"},{" "}
        {correctCount} correct, {unansweredCount} not answered.
      </p>

      <div className="mt-4 space-y-8">
        {sections.map((section) => {
          const headingId = `answer-review-section-${section.sectionKey}`;

          return (
            <section key={section.sectionKey} aria-labelledby={headingId}>
              <h3
                id={headingId}
                lang="fr"
                className="text-base font-semibold text-academy-700"
              >
                {section.heading}
              </h3>
              <p className="text-sm text-slate-500">{section.subheading}</p>

              <ul className="mt-3 space-y-3">
                {section.responses.map((response) => (
                  <AdminAnswerReviewItem
                    key={response.questionId}
                    response={response}
                  />
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </section>
  );
}
