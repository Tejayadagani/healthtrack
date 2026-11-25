import { useEffect, useRef } from "react";
import { ClipboardList, Loader2 } from "lucide-react";

function formatLocalTimestamp(isoString) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return isoString;
  }
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getSeverityStyle(severity) {
  if (severity <= 3) {
    return {
      label: "Mild",
      classes: "bg-emerald-50 text-emerald-800 border-emerald-200",
    };
  }
  if (severity <= 6) {
    return {
      label: "Moderate",
      classes: "bg-amber-50 text-amber-800 border-amber-200",
    };
  }
  return {
    label: "Severe",
    classes: "bg-rose-50 text-rose-800 border-rose-200",
  };
}

export function HistoryTable({
  logs,
  isLoading,
  selectedPatient,
  lastSubmittedId,
}) {
  const newestRowRef = useRef(null);

  useEffect(() => {
    if (lastSubmittedId != null && newestRowRef.current) {
      newestRowRef.current.scrollIntoView?.({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [lastSubmittedId, logs]);

  return (
    <section
      aria-labelledby="history-table-heading"
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-teal-600" aria-hidden="true" />
          <h2
            id="history-table-heading"
            className="text-lg font-semibold text-slate-900"
          >
            Symptom History
          </h2>
        </div>
        <span className="text-xs font-medium text-slate-500">
          {logs.length} {logs.length === 1 ? "entry" : "entries"} (oldest first)
        </span>
      </div>

      {isLoading ? (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-center gap-2 py-12 text-sm text-slate-600"
        >
          <Loader2 className="h-5 w-5 animate-spin text-teal-600" aria-hidden="true" />
          <span>Loading symptom history for {selectedPatient}...</span>
        </div>
      ) : logs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center">
          <p className="text-sm font-medium text-slate-700">
            No symptoms recorded for {selectedPatient} yet.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Use the form to log a symptom entry and build a history.
          </p>
        </div>
      ) : (
        <div className="max-h-96 overflow-auto rounded-lg border border-slate-200">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="sticky top-0 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
              <tr className="border-b border-slate-200">
                <th scope="col" className="px-4 py-3 whitespace-nowrap">
                  Time (Local)
                </th>
                <th scope="col" className="px-4 py-3">
                  Symptom
                </th>
                <th scope="col" className="px-4 py-3 whitespace-nowrap">
                  Severity
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {logs.map((entry, index) => {
                const isNewest = index === logs.length - 1;
                const badge = getSeverityStyle(entry.severity);
                return (
                  <tr
                    key={entry.id}
                    ref={isNewest ? newestRowRef : null}
                    className={
                      entry.id === lastSubmittedId
                        ? "bg-teal-50/40"
                        : "hover:bg-slate-50/80"
                    }
                  >
                    <td className="px-4 py-3 align-top text-xs text-slate-600 whitespace-nowrap">
                      <time dateTime={entry.timestamp}>
                        {formatLocalTimestamp(entry.timestamp)}
                      </time>
                    </td>
                    <td className="min-w-0 max-w-md px-4 py-3 align-top text-slate-800 break-words whitespace-pre-wrap">
                      {entry.description}
                    </td>
                    <td className="px-4 py-3 align-top whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badge.classes}`}
                      >
                        <span>{entry.severity}/10</span>
                        <span className="font-normal">({badge.label})</span>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
