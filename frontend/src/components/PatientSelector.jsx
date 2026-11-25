import { User } from "lucide-react";
import { DEMO_PATIENTS } from "../hooks/usePatientSymptoms";

export function PatientSelector({ selectedPatient, onChange }) {
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
      <label
        htmlFor="patient-select"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700"
      >
        <User className="h-4 w-4 text-teal-600" aria-hidden="true" />
        <span>Patient</span>
      </label>
      <select
        id="patient-select"
        name="patient_id"
        value={selectedPatient}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm transition hover:border-teal-500"
      >
        {DEMO_PATIENTS.map((patient) => (
          <option key={patient.id} value={patient.id}>
            {patient.label}
          </option>
        ))}
      </select>
    </div>
  );
}
