import { useEffect, useState } from "react";
import { Activity, AlertCircle, CheckCircle2, RefreshCw, X } from "lucide-react";
import { HistoryTable } from "./components/HistoryTable";
import { PatientSelector } from "./components/PatientSelector";
import { SeverityTrendChart } from "./components/SeverityTrendChart";
import { SymptomForm } from "./components/SymptomForm";
import { usePatientSymptoms } from "./hooks/usePatientSymptoms";

export default function App() {
  const {
    selectedPatient,
    logs,
    isLoading,
    fetchError,
    isSubmitting,
    submitError,
    submitSuccess,
    lastSubmittedId,
    selectPatient,
    retryFetch,
    clearFeedback,
    submitSymptom,
  } = usePatientSymptoms("P001");

  const [selectedIssueTag, setSelectedIssueTag] = useState("");

  useEffect(() => {
    setSelectedIssueTag("");
  }, [selectedPatient]);

  useEffect(() => {
    if (!submitSuccess) return undefined;
    const timer = setTimeout(() => {
      clearFeedback();
    }, 4000);
    return () => clearTimeout(timer);
  }, [submitSuccess, clearFeedback]);

  const activeAlertMessage = submitError?.message || fetchError;

  function handleSelectIssueForLogging(issueName) {
    setSelectedIssueTag(issueName);
    document
      .getElementById("symptom-description")
      ?.focus?.();
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-600 text-white shadow-sm">
              <Activity className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                HealthTrack
              </h1>
              <p className="text-sm text-slate-600">
                Track symptoms. Understand trends.
              </p>
            </div>
          </div>

          <PatientSelector
            selectedPatient={selectedPatient}
            onChange={selectPatient}
          />
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
        {activeAlertMessage && (
          <div
            role="alert"
            className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-2.5">
              <AlertCircle
                className="mt-0.5 h-5 w-5 shrink-0 text-rose-600"
                aria-hidden="true"
              />
              <span>{activeAlertMessage}</span>
            </div>
            {fetchError && (
              <button
                type="button"
                onClick={retryFetch}
                className="inline-flex min-h-[36px] shrink-0 items-center gap-1.5 self-start rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 sm:self-auto"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Retry</span>
              </button>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="min-w-0 lg:col-span-5">
            <SymptomForm
              selectedPatient={selectedPatient}
              selectedIssueTag={selectedIssueTag}
              onSelectIssueTag={setSelectedIssueTag}
              isSubmitting={isSubmitting}
              submitError={submitError}
              onSubmit={submitSymptom}
              onClearFeedback={clearFeedback}
            />
          </div>

          <div className="min-w-0 lg:col-span-7">
            <HistoryTable
              logs={logs}
              isLoading={isLoading}
              selectedPatient={selectedPatient}
              lastSubmittedId={lastSubmittedId}
            />
          </div>
        </div>

        <SeverityTrendChart
          logs={logs}
          isLoading={isLoading}
          selectedPatient={selectedPatient}
          onSelectIssueForLogging={handleSelectIssueForLogging}
        />
      </main>

      {submitSuccess && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-4 right-4 z-50 flex max-w-sm items-center gap-3 rounded-xl border border-teal-200 bg-white px-4 py-3 text-sm font-medium text-teal-900 shadow-lg"
        >
          <CheckCircle2
            className="h-5 w-5 shrink-0 text-teal-600"
            aria-hidden="true"
          />
          <span>{submitSuccess}</span>
          <button
            type="button"
            onClick={clearFeedback}
            aria-label="Dismiss notification"
            className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
