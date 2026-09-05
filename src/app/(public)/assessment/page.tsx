import type { Metadata } from "next";
import { AssessmentFlow } from "@/components/assessment/AssessmentFlow";

export const metadata: Metadata = {
  title: "Student Information | Toronto Academy French Assessment",
  description:
    "Provide your student details and read the instructions before starting the Toronto Academy French A1 diagnostic assessment.",
};

export default function AssessmentPage() {
  return <AssessmentFlow />;
}
