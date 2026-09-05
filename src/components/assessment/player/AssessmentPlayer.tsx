"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PlayerProgress } from "@/components/assessment/player/PlayerProgress";
import { PlayerShell } from "@/components/assessment/player/PlayerShell";
import {
  PlayerLoading,
  PlayerUnavailable,
} from "@/components/assessment/player/PlayerStatus";
import { QuestionScreen } from "@/components/assessment/player/QuestionScreen";
import { AssessmentResult } from "@/components/assessment/player/AssessmentResult";
import { ReviewAnswers } from "@/components/assessment/player/ReviewAnswers";
import { SectionIntroduction } from "@/components/assessment/player/SectionIntroduction";
import {
  getFrenchAssessmentContent,
  submitFrenchAssessment,
} from "@/lib/actions/assessment";
import {
  GENERIC_ASSESSMENT_CONTENT_ERROR,
  type AssessmentAnswers,
  type AssessmentContent,
  type AssessmentOptionKey,
} from "@/lib/assessment-content";
import {
  GENERIC_ASSESSMENT_SUBMISSION_ERROR,
  type AssessmentResultData,
  type AssessmentSubmissionAnswers,
} from "@/lib/assessment-result";
import {
  buildPlayerPlan,
  stageAfterBack,
  stageAfterNext,
  summariseAnswers,
  type PlayerStage,
} from "@/lib/assessment-player";

/**
 * The Toronto Academy French A1 assessment player.
 *
 * Content is fetched once, through the server action, using the opaque attempt
 * token the student is already holding in memory. The token is never put in the
 * URL and no student information is involved.
 *
 * Selected answers live in this component until the student submits. They are
 * not written to Supabase question by question, so a hard browser refresh
 * before submission still loses the current selections. That is a documented
 * FA-04 limitation, deliberately left to a later resume/recovery ticket.
 *
 * The final submission is the only write. It sends the opaque attempt token and
 * a map of question id to A/B/C/D, and nothing else: no score, no percentage
 * and no correctness. The database calculates and stores the result, and this
 * component only renders what came back.
 */
export function AssessmentPlayer({
  attemptToken,
  onExit,
}: {
  attemptToken: string;
  onExit: () => void;
}) {
  const [content, setContent] = useState<AssessmentContent | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);

  // question id -> selected option key. Browser session state only.
  const [answers, setAnswers] = useState<AssessmentAnswers>({});
  const [stage, setStage] = useState<PlayerStage>({
    kind: "intro",
    sectionIndex: 0,
  });
  // Section introductions are shown once, so walking back over a boundary or
  // jumping in from the review screen does not replay them.
  const [seenIntros, setSeenIntros] = useState<ReadonlySet<number>>(
    () => new Set([0]),
  );
  const [cameFromReview, setCameFromReview] = useState(false);

  // Final submission state. `result` is the authoritative payload the database
  // returned; once it is set the player is terminal and the questions are gone.
  const [result, setResult] = useState<AssessmentResultData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const stageRegion = useRef<HTMLDivElement>(null);
  const resultRegion = useRef<HTMLDivElement>(null);
  const isFirstStage = useRef(true);

  // Retry clears the previous outcome itself, so this effect only ever settles
  // state from the resolved server call.
  const handleRetry = useCallback(() => {
    setContent(null);
    setLoadError(null);
    setReloadCount((count) => count + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    getFrenchAssessmentContent(attemptToken)
      .then((result) => {
        if (cancelled) {
          return;
        }
        if (result.ok) {
          setContent(result.data);
        } else {
          setLoadError(result.message);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(GENERIC_ASSESSMENT_CONTENT_ERROR);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [attemptToken, reloadCount]);

  // Move focus to the new screen so keyboard and screen reader users follow the
  // change, and so long screens start from the top.
  useEffect(() => {
    if (isFirstStage.current) {
      isFirstStage.current = false;
      return;
    }
    stageRegion.current?.focus();
  }, [stage]);

  // The result replaces the whole player rather than being another stage, so it
  // takes focus on its own.
  useEffect(() => {
    if (result) {
      resultRegion.current?.focus();
    }
  }, [result]);

  const plan = useMemo(
    () => (content ? buildPlayerPlan(content) : null),
    [content],
  );

  const goTo = useCallback((next: PlayerStage) => {
    if (next.kind === "intro") {
      setSeenIntros((previous) =>
        previous.has(next.sectionIndex)
          ? previous
          : new Set(previous).add(next.sectionIndex),
      );
    }
    if (next.kind === "review") {
      setCameFromReview(false);
    }
    setStage(next);
  }, []);

  const handleNext = useCallback(() => {
    if (!plan) {
      return;
    }
    const next = stageAfterNext(plan, stage, seenIntros);
    if (next) {
      goTo(next);
    }
  }, [goTo, plan, seenIntros, stage]);

  const handleBack = useCallback(() => {
    if (!plan) {
      return;
    }
    const previous = stageAfterBack(plan, stage);
    if (previous) {
      goTo(previous);
    } else {
      // Back from the very first introduction leaves the assessment.
      onExit();
    }
  }, [goTo, onExit, plan, stage]);

  const handleSelect = useCallback(
    (questionId: string, optionKey: AssessmentOptionKey) => {
      setAnswers((previous) => ({ ...previous, [questionId]: optionKey }));
    },
    [],
  );

  /**
   * Final submission.
   *
   * The payload is the answer map and nothing else. Unanswered questions are
   * left out entirely: the database builds the complete twenty row snapshot
   * itself, so the browser never states what an unanswered question is worth.
   *
   * A failure keeps every selection, keeps the student on Review Answers and
   * shows the generic retryable message. A success is terminal, so
   * `isSubmitting` is deliberately not cleared: the result screen replaces the
   * review screen instead.
   */
  const handleSubmit = useCallback(async () => {
    if (isSubmitting || result) {
      return;
    }

    setSubmitError(null);
    setIsSubmitting(true);

    const payload: AssessmentSubmissionAnswers = {};
    for (const [questionId, optionKey] of Object.entries(answers)) {
      if (optionKey) {
        payload[questionId] = optionKey;
      }
    }

    try {
      const outcome = await submitFrenchAssessment(attemptToken, payload);

      if (outcome.ok) {
        setResult(outcome.data);
        return;
      }

      setSubmitError(outcome.message);
    } catch {
      setSubmitError(GENERIC_ASSESSMENT_SUBMISSION_ERROR);
    }

    setIsSubmitting(false);
  }, [answers, attemptToken, isSubmitting, result]);

  if (loadError) {
    return (
      <PlayerShell>
        <PlayerUnavailable
          message={loadError}
          onRetry={handleRetry}
          onBack={onExit}
        />
      </PlayerShell>
    );
  }

  if (!content || !plan) {
    return (
      <PlayerShell>
        <PlayerLoading />
      </PlayerShell>
    );
  }

  // A submitted attempt is final. The questions, the review screen, the
  // progress bar and every navigation control are gone from here on, so there
  // is no route back into editing, and the database would refuse a rescore in
  // any case.
  if (result) {
    return (
      <PlayerShell
        title={content.assessment.title}
        titleFr={content.assessment.titleFr}
        subtitle={`${content.assessment.framework} Level ${content.assessment.level}`}
      >
        <div ref={resultRegion} tabIndex={-1} className="outline-none">
          <AssessmentResult result={result} />
        </div>
      </PlayerShell>
    );
  }

  const total = plan.questions.length;
  const summary = summariseAnswers(plan.questions, answers);

  const progress = (() => {
    if (stage.kind === "question") {
      const position = stage.questionIndex + 1;
      const sectionIndex =
        plan.sectionIndexByQuestionIndex[stage.questionIndex] ?? 0;
      const section = plan.sections[sectionIndex]?.section;
      const label = `Question ${position} of ${total}`;

      return {
        sectionLabel: section?.titleFr ?? section?.title ?? "",
        sectionLabelLang: section?.titleFr ? "fr" : undefined,
        positionLabel: label,
        valueNow: position,
        valueText: label,
      };
    }

    if (stage.kind === "intro") {
      const planSection = plan.sections[stage.sectionIndex];
      const label = planSection
        ? `Questions ${planSection.firstQuestionNumber} to ${planSection.lastQuestionNumber} of ${total}`
        : `${total} questions`;

      return {
        sectionLabel:
          planSection?.section.titleFr ?? planSection?.section.title ?? "",
        sectionLabelLang: planSection?.section.titleFr ? "fr" : undefined,
        positionLabel: label,
        valueNow: planSection?.firstQuestionIndex ?? 0,
        valueText: label,
      };
    }

    const label = `${summary.answered} of ${total} answered`;

    return {
      sectionLabel: "Review answers",
      sectionLabelLang: undefined,
      positionLabel: label,
      valueNow: total,
      valueText: `End of the assessment. ${label}.`,
    };
  })();

  return (
    <PlayerShell
      title={content.assessment.title}
      titleFr={content.assessment.titleFr}
      subtitle={`${content.assessment.framework} Level ${content.assessment.level}`}
    >
      <PlayerProgress
        sectionLabel={progress.sectionLabel}
        sectionLabelLang={progress.sectionLabelLang}
        positionLabel={progress.positionLabel}
        valueNow={progress.valueNow}
        valueMax={total}
        valueText={progress.valueText}
      />

      <div ref={stageRegion} tabIndex={-1} className="outline-none">
        {stage.kind === "intro" && plan.sections[stage.sectionIndex] ? (
          <SectionIntroduction
            section={plan.sections[stage.sectionIndex].section}
            questionRangeLabel={progress.positionLabel}
            onBack={handleBack}
            onNext={handleNext}
          />
        ) : null}

        {stage.kind === "question" && plan.questions[stage.questionIndex] ? (
          (() => {
            const question = plan.questions[stage.questionIndex];
            const passage = question.passageId
              ? (plan.passageById.get(question.passageId) ?? null)
              : null;

            return (
              <QuestionScreen
                question={question}
                passage={passage}
                selected={answers[question.id]}
                onSelect={(optionKey) => handleSelect(question.id, optionKey)}
                onBack={handleBack}
                onNext={handleNext}
                nextLabel={
                  stage.questionIndex === total - 1 ? "Review answers" : "Next"
                }
                onReturnToReview={
                  cameFromReview ? () => goTo({ kind: "review" }) : undefined
                }
              />
            );
          })()
        ) : null}

        {stage.kind === "review" ? (
          <ReviewAnswers
            questions={plan.questions}
            answers={answers}
            summary={summary}
            onSelectQuestion={(questionIndex) => {
              setCameFromReview(true);
              goTo({ kind: "question", questionIndex });
            }}
            onBack={handleBack}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            submitError={submitError}
          />
        ) : null}
      </div>
    </PlayerShell>
  );
}
