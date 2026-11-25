import { useEffect, useState } from "react";
import { Loader2, Send } from "lucide-react";

const MAX_DESCRIPTION_LENGTH = 500;
const PRESET_ISSUES = ["Headache", "Cough", "Fever", "Fatigue", "Knee", "Nausea"];

function getSeverityBadgeLabel(severity) {
  if (severity <= 3) return "Mild";
  if (severity <= 6) return "Moderate";
  return "Severe";
}

function buildSubmittedDescription(issueTag, rawDescription) {
  const trimmedDesc = rawDescription.trim();
  const trimmedIssue = issueTag.trim();
  if (!trimmedIssue) {
    return trimmedDesc;
  }

  const lowerDesc = trimmedDesc.toLowerCase();
  const lowerIssue = trimmedIssue.toLowerCase();
  if (lowerDesc.startsWith(`${lowerIssue}:`)) {
    return trimmedDesc;
  }

  return `${trimmedIssue}: ${trimmedDesc}`;
}

export function SymptomForm({
  selectedPatient,
  selectedIssueTag = "",
  onSelectIssueTag,
  isSubmitting,
  submitError,
  onSubmit,
  onClearFeedback,
}) {
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState(5);
  const [clientError, setClientError] = useState("");

  useEffect(() => {
    setClientError("");
  }, [selectedPatient]);

  const serverDescriptionError =
    submitError?.fieldErrors?.find((err) => err.field === "description")
      ?.message || "";
  const serverSeverityError =
    submitError?.fieldErrors?.find((err) => err.field === "severity")
      ?.message || "";

  const activeDescriptionError = clientError || serverDescriptionError;
  const combinedPreview = buildSubmittedDescription(selectedIssueTag, description);
  const trimmedLength = description.trim().length;
  const charCount = combinedPreview.length;

  function validateDescription(value) {
    const trimmed = value.trim();
    if (!trimmed) {
      return "Please enter a symptom description.";
    }
    const finalText = buildSubmittedDescription(selectedIssueTag, value);
    if (finalText.length > MAX_DESCRIPTION_LENGTH) {
      return `Symptom description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.`;
    }
    return "";
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (isSubmitting) return;

    const validationMessage = validateDescription(description);
    if (validationMessage) {
      setClientError(validationMessage);
      return;
    }

    setClientError("");
    const result = await onSubmit({
      description: buildSubmittedDescription(selectedIssueTag, description),
      severity: Number(severity),
    });

    if (result?.ok && !result?.stale) {
      setDescription("");
    }
  }

  function handleDescriptionChange(event) {
    const nextValue = event.target.value;
    setDescription(nextValue);

    if (clientError && !validateDescription(nextValue)) {
      setClientError("");
    }
    if (submitError) {
      onClearFeedback?.();
    }
  }

  return (
    <section
      aria-labelledby="symptom-form-heading"
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2
          id="symptom-form-heading"
          className="text-lg font-semibold text-slate-900"
        >
          Log Symptom
        </h2>
        <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700">
          Patient {selectedPatient}
        </span>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div>
          <div className="mb-1.5 flex items-baseline justify-between gap-2">
            <label
              htmlFor="health-issue-input"
              className="text-sm font-medium text-slate-700"
            >
              Health issue (optional)
            </label>
            {selectedIssueTag && (
              <button
                type="button"
                onClick={() => onSelectIssueTag?.("")}
                className="text-xs font-medium text-teal-700 hover:underline"
              >
                Clear tag
              </button>
            )}
          </div>

          <input
            id="health-issue-input"
            name="health_issue"
            type="text"
            maxLength={30}
            value={selectedIssueTag}
            onChange={(event) => onSelectIssueTag?.(event.target.value)}
            placeholder="e.g. Cough, Headache, Knee Pain (auto-detected if blank)"
            className="min-h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400"
          />

          <div
            className="mt-2 flex flex-wrap gap-1.5"
            role="group"
            aria-label="Common health issues"
          >
            {PRESET_ISSUES.map((issue) => {
              const active =
                selectedIssueTag.trim().toLowerCase() === issue.toLowerCase();
              return (
                <button
                  key={issue}
                  type="button"
                  onClick={() => onSelectIssueTag?.(active ? "" : issue)}
                  aria-pressed={active}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                    active
                      ? "bg-teal-600 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {issue}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-baseline justify-between gap-2">
            <label
              htmlFor="symptom-description"
              className="text-sm font-medium text-slate-700"
            >
              Symptom description <span className="text-rose-600">*</span>
            </label>
            <span
              id="symptom-char-count"
              className={`text-xs ${
                trimmedLength > MAX_DESCRIPTION_LENGTH ||
                charCount > MAX_DESCRIPTION_LENGTH
                  ? "font-semibold text-rose-600"
                  : "text-slate-500"
              }`}
            >
              {charCount} / {MAX_DESCRIPTION_LENGTH}
            </span>
          </div>

          <textarea
            id="symptom-description"
            name="description"
            rows={4}
            value={description}
            onChange={handleDescriptionChange}
            placeholder="Describe what you are experiencing (e.g., Headache since morning)"
            aria-invalid={activeDescriptionError ? "true" : "false"}
            aria-describedby={
              activeDescriptionError
                ? "symptom-description-error symptom-char-count"
                : "symptom-char-count"
            }
            className={`w-full rounded-lg border px-3 py-2.5 text-base text-slate-900 placeholder:text-slate-400 sm:text-sm ${
              activeDescriptionError
                ? "border-rose-500 bg-rose-50/30"
                : "border-slate-300 bg-white"
            }`}
          />

          {activeDescriptionError && (
            <p
              id="symptom-description-error"
              role="alert"
              className="mt-1.5 text-sm text-rose-600"
            >
              {activeDescriptionError}
            </p>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <label
              htmlFor="symptom-severity"
              className="text-sm font-medium text-slate-700"
            >
              Severity (1–10)
            </label>
            <div className="flex items-center gap-2">
              <span
                data-testid="severity-value"
                className="inline-flex min-w-[3.5rem] items-center justify-center rounded-full bg-teal-50 px-2.5 py-0.5 text-sm font-semibold text-teal-800"
              >
                {severity} / 10
              </span>
              <span className="text-xs font-medium text-slate-500">
                {getSeverityBadgeLabel(severity)}
              </span>
            </div>
          </div>

          <input
            id="symptom-severity"
            name="severity"
            type="range"
            min={1}
            max={10}
            step={1}
            value={severity}
            onChange={(event) => setSeverity(Number(event.target.value))}
            aria-describedby={
              serverSeverityError ? "symptom-severity-error" : "severity-scale-hint"
            }
            className="h-2 w-full cursor-pointer accent-teal-600"
          />

          <div
            id="severity-scale-hint"
            className="mt-1 flex justify-between text-xs text-slate-500"
          >
            <span>1 (Mild)</span>
            <span>5 (Moderate)</span>
            <span>10 (Severe)</span>
          </div>

          {serverSeverityError && (
            <p
              id="symptom-severity-error"
              role="alert"
              className="mt-1.5 text-sm text-rose-600"
            >
              {serverSeverityError}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <Send className="h-4 w-4" aria-hidden="true" />
              <span>Log Symptom</span>
            </>
          )}
        </button>
      </form>
    </section>
  );
}
