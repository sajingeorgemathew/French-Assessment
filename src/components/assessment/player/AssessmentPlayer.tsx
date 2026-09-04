"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PlayerProgress } from "@/components/assessment/player/PlayerProgress";
import { PlayerShell } from "@/components/assessment/player/PlayerShell";
import {
  PlayerLoading,
  PlayerUnavailable,
} from "@/components/assessment/player/PlayerStatus";
import { QuestionScreen } from "@/components/assessment/player/QuestionScreen";
import { ReviewAnswers } from "@/components/assessment/player/ReviewAnswers";
import { SectionIntroduction } from "@/components/assessment/player/SectionIntroduction";
import { getFrenchAssessmentContent } from "@/lib/actions/assessment";
import {
  GENERIC_ASSESSMENT_CONTENT_ERROR,
  type AssessmentAnswers,
  type AssessmentContent,
  type AssessmentOptionKey,
} from "@/lib/assessment-content";
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
 * Selected answers live in this component and nowhere else. FA-03 does not
 * persist them, does not evaluate them and does not submit the attempt: the
 * attempt stays in_progress from Begin Assessment through the review screen.
 * A hard browser refresh therefore loses the current selections, which is a
 * documented FA-03 limitation that FA-04 resolves with real answer persistence.
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

  const stageRegion = useRef<HTMLDivElement>(null);
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
          />
        ) : null}
      </div>
    </PlayerShell>
  );
}
