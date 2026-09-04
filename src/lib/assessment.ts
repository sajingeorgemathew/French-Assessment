/** Shared facts about the first Toronto Academy French assessment. */

export const ASSESSMENT_TITLE =
  "French Language Evaluation and Diagnostic Assessment";

export const ASSESSMENT_TITLE_FR = "Evaluation Diagnostique de Francais";

export const ASSESSMENT_LEVEL = "CEFR / CECRL Level A1";

export const ASSESSMENT_QUESTION_COUNT = 20;

export type AssessmentSection = {
  id: "grammar" | "vocabulary" | "reading";
  name: string;
  description: string;
};

export const ASSESSMENT_SECTIONS: AssessmentSection[] = [
  {
    id: "grammar",
    name: "Grammar",
    description:
      "Everyday sentence structure, articles, verbs and agreement at beginner level.",
  },
  {
    id: "vocabulary",
    name: "Vocabulary",
    description:
      "Common French words used in daily life, study and work situations.",
  },
  {
    id: "reading",
    name: "Reading comprehension",
    description:
      "Short French passages with questions about what you have understood.",
  },
];

export const ASSESSMENT_STEPS = [
  "Student Information",
  "Instructions",
  "Assessment",
] as const;

export type AssessmentStepIndex = 0 | 1 | 2;
