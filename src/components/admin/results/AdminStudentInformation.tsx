import {
  formatAdminOptionalValue,
  type AdminAttemptDetail,
} from "@/lib/admin/admin-results";

/**
 * The student information card on the result detail page.
 *
 * Every optional field is rendered through formatAdminOptionalValue, so a
 * missing city or learning goal shows the neutral placeholder rather than the
 * words null or undefined.
 *
 * This card is read only. FA-06 provides no student editing anywhere.
 */
export function AdminStudentInformation({
  student,
}: {
  student: AdminAttemptDetail["student"];
}) {
  const fields: { label: string; value: string }[] = [
    { label: "Full Name", value: student.fullName },
    { label: "Email Address", value: student.email },
    { label: "Phone Number", value: student.phone },
    { label: "City", value: formatAdminOptionalValue(student.city) },
    {
      label: "Status in Canada",
      value: formatAdminOptionalValue(student.statusInCanada),
    },
    {
      label: "Current French Level",
      value: formatAdminOptionalValue(student.currentFrenchLevel),
    },
    {
      label: "French Learning Goal",
      value: formatAdminOptionalValue(student.frenchLearningGoal),
    },
  ];

  return (
    <section
      aria-labelledby="student-information-heading"
      className="rounded-lg border border-academy-100 bg-white px-5 py-5"
    >
      <h2
        id="student-information-heading"
        className="text-lg font-semibold text-academy-700"
      >
        Student Information
      </h2>

      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        {fields.map((field) => (
          <div key={field.label} className="min-w-0">
            <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">
              {field.label}
            </dt>
            <dd className="mt-0.5 break-words text-sm font-medium text-slate-800">
              {field.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
