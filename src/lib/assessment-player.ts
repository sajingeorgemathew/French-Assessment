import type {
  AssessmentAnswers,
  AssessmentContent,
  AssessmentContentPassage,
  AssessmentContentQuestion,
  AssessmentContentSection,
} from "@/lib/assessment-content";

/**
 * Pure navigation model for the assessment player.
 *
 * Keeping the sequence rules here, away from React, means the screens only have
 * to render a stage. Nothing in this module reads or writes Supabase.
 */

export type PlayerStage =
  | { kind: "intro"; sectionIndex: number }
  | { kind: "question"; questionIndex: number }
  | { kind: "review" };

/** A section plus the slice of the question order that belongs to it. */
export type PlayerSection = {
  section: AssessmentContentSection;
  firstQuestionIndex: number;
  lastQuestionIndex: number;
  firstQuestionNumber: number;
  lastQuestionNumber: number;
};

export type PlayerPlan = {
  questions: AssessmentContentQuestion[];
  sections: PlayerSection[];
  /** Section index for every question index, so lookups stay O(1). */
  sectionIndexByQuestionIndex: number[];
  passageById: Map<string, AssessmentContentPassage>;
};

/**
 * Section ranges are derived from the question order rather than assumed, so
 * the player follows whatever the seeded content actually says.
 */
export function buildPlayerPlan(content: AssessmentContent): PlayerPlan {
  const sectionById = new Map(
    content.sections.map((section) => [section.id, section]),
  );

  const sections: PlayerSection[] = [];
  const sectionIndexByQuestionIndex: number[] = [];

  content.questions.forEach((question, index) => {
    const current = sections.at(-1);

    if (current && current.section.id === question.sectionId) {
      current.lastQuestionIndex = index;
      current.lastQuestionNumber = question.questionNumber;
    } else {
      // The composite foreign keys make an unknown section impossible, so the
      // fallback exists only to keep the indexes aligned if content ever drifts.
      const section: AssessmentContentSection = sectionById.get(
        question.sectionId,
      ) ?? {
        id: question.sectionId,
        sectionKey: "",
        title: "",
        titleFr: null,
        description: null,
        position: sections.length + 1,
      };

      sections.push({
        section,
        firstQuestionIndex: index,
        lastQuestionIndex: index,
        firstQuestionNumber: question.questionNumber,
        lastQuestionNumber: question.questionNumber,
      });
    }

    sectionIndexByQuestionIndex[index] = sections.length - 1;
  });

  return {
    questions: content.questions,
    sections,
    sectionIndexByQuestionIndex,
    passageById: new Map(
      content.passages.map((passage) => [passage.id, passage]),
    ),
  };
}

/**
 * Forward navigation.
 *
 * A section introduction is only inserted the first time a section is entered.
 * That keeps Next predictable after the student has walked back over a section
 * boundary or jumped in from the review screen, instead of replaying an
 * introduction they have already read.
 *
 * Returns null when there is nowhere further to go, which only happens on the
 * review screen, because FA-03 does not submit the assessment.
 */
export function stageAfterNext(
  plan: PlayerPlan,
  stage: PlayerStage,
  seenIntros: ReadonlySet<number>,
): PlayerStage | null {
  if (stage.kind === "intro") {
    const section = plan.sections[stage.sectionIndex];
    return section
      ? { kind: "question", questionIndex: section.firstQuestionIndex }
      : { kind: "review" };
  }

  if (stage.kind === "review") {
    return null;
  }

  const nextIndex = stage.questionIndex + 1;

  if (nextIndex >= plan.questions.length) {
    return { kind: "review" };
  }

  const currentSection = plan.sectionIndexByQuestionIndex[stage.questionIndex];
  const nextSection = plan.sectionIndexByQuestionIndex[nextIndex];

  if (nextSection !== currentSection && !seenIntros.has(nextSection)) {
    return { kind: "intro", sectionIndex: nextSection };
  }

  return { kind: "question", questionIndex: nextIndex };
}

/**
 * Backward navigation.
 *
 * Back always steps to the previous question rather than to the introduction
 * the student passed through, so returning from Question 9 lands on Question 8
 * and returning from Question 15 lands on Question 14.
 *
 * Returns null from the very first introduction, which the player treats as
 * leaving the assessment and going back to the instructions step.
 */
export function stageAfterBack(
  plan: PlayerPlan,
  stage: PlayerStage,
): PlayerStage | null {
  if (stage.kind === "review") {
    return plan.questions.length > 0
      ? { kind: "question", questionIndex: plan.questions.length - 1 }
      : { kind: "intro", sectionIndex: 0 };
  }

  if (stage.kind === "question") {
    return stage.questionIndex > 0
      ? { kind: "question", questionIndex: stage.questionIndex - 1 }
      : { kind: "intro", sectionIndex: 0 };
  }

  if (stage.sectionIndex <= 0) {
    return null;
  }

  const section = plan.sections[stage.sectionIndex];

  return section && section.firstQuestionIndex > 0
    ? { kind: "question", questionIndex: section.firstQuestionIndex - 1 }
    : { kind: "intro", sectionIndex: stage.sectionIndex - 1 };
}

export type AnswerSummary = {
  total: number;
  answered: number;
  unanswered: number;
};

/** Counts current selections. It never looks at what the answers are worth. */
export function summariseAnswers(
  questions: AssessmentContentQuestion[],
  answers: AssessmentAnswers,
): AnswerSummary {
  const answered = questions.reduce(
    (count, question) => (answers[question.id] ? count + 1 : count),
    0,
  );

  return {
    total: questions.length,
    answered,
    unanswered: questions.length - answered,
  };
}
