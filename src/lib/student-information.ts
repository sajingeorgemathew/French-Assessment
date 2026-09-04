import { z } from "zod";

export const STATUS_IN_CANADA_OPTIONS = [
  "Canadian Citizen",
  "Permanent Resident",
  "Work Permit",
  "Study Permit",
  "Visitor",
  "Other",
  "Prefer not to say",
] as const;

export const FRENCH_LEVEL_OPTIONS = [
  "Complete beginner",
  "Some basic French",
  "A1 / Beginner",
  "A2 / Elementary",
  "B1 or above",
  "Not sure",
] as const;

export const LEARNING_GOAL_OPTIONS = [
  "Immigration / PR",
  "TEF / TCF Preparation",
  "Employment / Career",
  "Academic Studies",
  "Everyday Communication",
  "Personal Development",
  "Other",
] as const;

/** Accepts common Canadian and international phone formats. */
const phonePattern = /^[0-9+()\-.\s]+$/;

export const studentInformationSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, "Full name is required.")
    .min(2, "Please enter your full name."),
  email: z
    .string()
    .trim()
    .min(1, "Email address is required.")
    .pipe(z.email("Enter a valid email address, for example name@example.com.")),
  phone: z
    .string()
    .trim()
    .min(1, "Phone number is required.")
    .regex(phonePattern, "Enter a valid phone number.")
    .min(7, "Enter a phone number with at least 7 digits."),
  city: z.string().trim(),
  statusInCanada: z.enum(["", ...STATUS_IN_CANADA_OPTIONS]),
  frenchLevel: z.enum(["", ...FRENCH_LEVEL_OPTIONS]),
  learningGoal: z.enum(["", ...LEARNING_GOAL_OPTIONS]),
});

export type StudentInformation = z.infer<typeof studentInformationSchema>;

export type StudentInformationErrors = Partial<
  Record<keyof StudentInformation, string>
>;

export const emptyStudentInformation: StudentInformation = {
  fullName: "",
  email: "",
  phone: "",
  city: "",
  statusInCanada: "",
  frenchLevel: "",
  learningGoal: "",
};

/**
 * Validates the intake values and returns the first message per field so the
 * form can show one clear error under each input.
 */
export function validateStudentInformation(values: StudentInformation): {
  success: boolean;
  data?: StudentInformation;
  errors: StudentInformationErrors;
} {
  const result = studentInformationSchema.safeParse(values);

  if (result.success) {
    return { success: true, data: result.data, errors: {} };
  }

  const fieldErrors = z.flattenError(result.error).fieldErrors;
  const errors: StudentInformationErrors = {};

  for (const [field, messages] of Object.entries(fieldErrors)) {
    if (messages && messages.length > 0) {
      errors[field as keyof StudentInformation] = messages[0];
    }
  }

  return { success: false, errors };
}
