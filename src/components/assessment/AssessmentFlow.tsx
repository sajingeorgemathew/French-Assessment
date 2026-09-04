"use client";

import { useEffect, useRef, useState } from "react";
import { AssessmentSteps } from "@/components/assessment/AssessmentSteps";
import { StudentInformationForm } from "@/components/assessment/StudentInformationForm";
import { AssessmentInstructions } from "@/components/assessment/AssessmentInstructions";
import { AssessmentReady } from "@/components/assessment/AssessmentReady";
import {
  ASSESSMENT_LEVEL,
  ASSESSMENT_TITLE_FR,
  type AssessmentStepIndex,
} from "@/lib/assessment";
import {
  emptyStudentInformation,
  type StudentInformation,
} from "@/lib/student-information";

const stepIntro: Record<AssessmentStepIndex, string> = {
  0: "Tell us a little about yourself so we can share your outcome and suggest a French learning pathway.",
  1: "Read the instructions before you start the diagnostic.",
  2: "You are ready to start the diagnostic.",
};

/**
 * Holds the entry flow state for the current page session. Student information
 * is kept here, not persisted, so moving back from the instructions step keeps
 * everything the student already entered.
 */
export function AssessmentFlow() {
  const [step, setStep] = useState<AssessmentStepIndex>(0);
  const [student, setStudent] = useState<StudentInformation>(
    emptyStudentInformation,
  );
  const stepRegion = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);

  // Move focus to the new step so keyboard and screen reader users follow along.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    stepRegion.current?.focus();
  }, [step]);

  return (
    <div className="bg-academy-50">
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <p className="text-sm font-semibold tracking-wide text-academy-500 uppercase">
          Toronto Academy of Education
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-academy-700 sm:text-3xl">
          French Language Assessment
        </h1>
        <p className="mt-2 text-base text-slate-600">
          <span lang="fr">{ASSESSMENT_TITLE_FR}</span>
          <span className="text-slate-400"> | </span>
          {ASSESSMENT_LEVEL}
        </p>

        <div className="mt-6 rounded-lg border border-academy-100 bg-white px-5 py-4">
          <AssessmentSteps currentStep={step} />
        </div>

        <div ref={stepRegion} tabIndex={-1} className="outline-none">
          <p className="mt-6 text-base leading-7 text-slate-600">
            {stepIntro[step]}
          </p>

          {step === 0 ? (
            <StudentInformationForm
              values={student}
              onChange={setStudent}
              onContinue={() => setStep(1)}
            />
          ) : null}

          {step === 1 ? (
            <AssessmentInstructions
              studentName={student.fullName}
              onBack={() => setStep(0)}
              onBegin={() => setStep(2)}
            />
          ) : null}

          {step === 2 ? <AssessmentReady onBack={() => setStep(1)} /> : null}
        </div>
      </div>
    </div>
  );
}
