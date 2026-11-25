import { useEffect, useMemo, useState } from "react";
import { Loader2, PlusCircle, TrendingUp, X } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { calculateDailyAverages } from "../utils/calculateDailyAverages";
import { groupSymptomsByIssue } from "../utils/groupSymptomsByIssue";

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const value = payload[0]?.value;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="font-semibold text-slate-900">{label} (UTC)</p>
      <p className="mt-0.5 text-teal-700">
        Average severity: <span className="font-semibold">{value}</span> / 10
      </p>
    </div>
  );
}

function IssueLineChartCard({
  title,
  logs,
  selectedPatient,
  entryCount,
  latestSeverity,
  onLogForIssue,
}) {
  const dailyAverages = useMemo(() => calculateDailyAverages(logs), [logs]);
  const latestPoint =
    dailyAverages.length > 0 ? dailyAverages[dailyAverages.length - 1] : null;

  const summary =
    dailyAverages.length === 0
      ? `No ${title} entries recorded in the last 30 UTC days for ${selectedPatient}.`
      : `${title}: ${dailyAverages.length} UTC ${
          dailyAverages.length === 1 ? "day" : "days"
        } (${entryCount} ${
          entryCount === 1 ? "entry" : "entries"
        }). Latest daily average is ${latestPoint.average_severity} out of 10 on ${
          latestPoint.date
        }.`;

  return (
    <article className="flex flex-col rounded-xl border border-slate-200 bg-slate-50/40 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <p className="text-xs text-slate-500">
            {entryCount} {entryCount === 1 ? "entry" : "entries"}
            {latestSeverity != null ? ` · Latest: ${latestSeverity}/10` : ""}
          </p>
        </div>

        {onLogForIssue && (
          <button
            type="button"
            onClick={() => onLogForIssue(title)}
            className="inline-flex items-center gap-1 rounded-lg border border-teal-200 bg-white px-2.5 py-1 text-xs font-medium text-teal-700 transition hover:bg-teal-50"
          >
            <PlusCircle className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Log {title}</span>
          </button>
        )}
      </div>

      {dailyAverages.length === 0 ? (
        <div className="flex h-44 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white px-3 text-center text-xs text-slate-500">
          No entries in the last 30 UTC days for {title}.
        </div>
      ) : (
        <div className="h-52 w-full min-w-0" role="region" aria-label={summary}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={dailyAverages}
              margin={{ top: 10, right: 16, left: -8, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="date"
                padding={{ left: 16, right: 16 }}
                tick={{ fill: "#475569", fontSize: 11 }}
                tickLine={{ stroke: "#cbd5e1" }}
                axisLine={{ stroke: "#cbd5e1" }}
              />
              <YAxis
                domain={[1, 10]}
                ticks={[1, 3, 5, 7, 10]}
                width={32}
                tick={{ fill: "#475569", fontSize: 11 }}
                tickLine={{ stroke: "#cbd5e1" }}
                axisLine={{ stroke: "#cbd5e1" }}
              />
              <Tooltip content={<ChartTooltip />} />
              <Line
                type="monotone"
                dataKey="average_severity"
                name={`${title} Average Severity`}
                stroke="#0d9488"
                strokeWidth={2.5}
                dot={{
                  r: 4.5,
                  fill: "#0d9488",
                  stroke: "#ffffff",
                  strokeWidth: 2,
                }}
                activeDot={{ r: 6.5, fill: "#0f766e" }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <p className="mt-2 text-xs text-slate-600">{summary}</p>
    </article>
  );
}

export function SeverityTrendChart({
  logs,
  isLoading,
  selectedPatient,
  onSelectIssueForLogging,
}) {
  const [viewMode, setViewMode] = useState("by-issue");
  const [issueQuery, setIssueQuery] = useState("");
  const [activeIssue, setActiveIssue] = useState("");

  useEffect(() => {
    setIssueQuery("");
    setActiveIssue("");
  }, [selectedPatient]);

  const issueGroups = useMemo(() => groupSymptomsByIssue(logs), [logs]);
  const combinedAverages = useMemo(() => calculateDailyAverages(logs), [logs]);

  const normalizedQuery = issueQuery.trim().toLowerCase();

  const visibleGroups = useMemo(() => {
    return issueGroups.filter((group) => {
      if (activeIssue && group.issue !== activeIssue) {
        return false;
      }
      if (normalizedQuery && !group.issue.toLowerCase().includes(normalizedQuery)) {
        return false;
      }
      return true;
    });
  }, [issueGroups, activeIssue, normalizedQuery]);

  const latestCombined =
    combinedAverages.length > 0
      ? combinedAverages[combinedAverages.length - 1]
      : null;

  const combinedSummary =
    combinedAverages.length === 0
      ? `No symptom data in the last 30 days for ${selectedPatient}.`
      : `Showing ${combinedAverages.length} UTC ${
          combinedAverages.length === 1 ? "day" : "days"
        } across all symptoms for ${selectedPatient}. Latest daily average is ${
          latestCombined.average_severity
        } out of 10 on ${latestCombined.date}.`;

  return (
    <section
      aria-labelledby="severity-chart-heading"
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-teal-600" aria-hidden="true" />
            <h2
              id="severity-chart-heading"
              className="text-lg font-semibold text-slate-900"
            >
              {viewMode === "by-issue"
                ? "Severity Trends by Health Issue (Last 30 Days)"
                : "Overall Average Severity, Last 30 Days"}
            </h2>
          </div>
          <p className="mt-0.5 text-xs font-medium text-slate-500">
            {viewMode === "by-issue"
              ? "Each health issue is graphed separately by UTC date"
              : "Combined daily average across all recorded symptoms"}
          </p>
        </div>

        <div
          className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1"
          role="group"
          aria-label="Chart view mode"
        >
          <button
            type="button"
            onClick={() => setViewMode("by-issue")}
            aria-pressed={viewMode === "by-issue"}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              viewMode === "by-issue"
                ? "bg-teal-600 text-white shadow-sm"
                : "text-slate-700 hover:bg-slate-200/70"
            }`}
          >
            Separate per Issue
          </button>
          <button
            type="button"
            onClick={() => setViewMode("combined")}
            aria-pressed={viewMode === "combined"}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              viewMode === "combined"
                ? "bg-teal-600 text-white shadow-sm"
                : "text-slate-700 hover:bg-slate-200/70"
            }`}
          >
            All Combined
          </button>
        </div>
      </div>

      {isLoading ? (
        <div
          role="status"
          aria-live="polite"
          className="flex h-64 items-center justify-center gap-2 text-sm text-slate-600"
        >
          <Loader2
            className="h-5 w-5 animate-spin text-teal-600"
            aria-hidden="true"
          />
          <span>Loading 30-day severity trends for {selectedPatient}...</span>
        </div>
      ) : logs.length === 0 ? (
        <div className="flex h-56 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 text-center">
          <p className="text-sm font-medium text-slate-700">
            No symptom data in the last 30 days for {selectedPatient}.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Log a symptom above to see separate graphs for each health issue.
          </p>
        </div>
      ) : viewMode === "by-issue" ? (
        <div className="space-y-4">
          <div
            role="search"
            className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div
              className="flex flex-wrap items-center gap-1.5"
              role="group"
              aria-label="Filter by health issue"
            >
              <button
                type="button"
                onClick={() => setActiveIssue("")}
                aria-pressed={!activeIssue}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  !activeIssue
                    ? "bg-teal-600 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                All Issues ({issueGroups.length})
              </button>
              {issueGroups.map((group) => {
                const isSelected = activeIssue === group.issue;
                return (
                  <button
                    key={group.issue}
                    type="button"
                    onClick={() =>
                      setActiveIssue(isSelected ? "" : group.issue)
                    }
                    aria-pressed={isSelected}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                      isSelected
                        ? "bg-teal-600 text-white"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {group.issue} ({group.logs.length})
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="issue-search-input" className="sr-only">
                Search health issue graphs
              </label>
              <div className="relative">
                <input
                  id="issue-search-input"
                  type="search"
                  value={issueQuery}
                  onChange={(event) => setIssueQuery(event.target.value)}
                  placeholder="Search issue (e.g. Cough)"
                  className="min-h-[36px] w-48 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 pr-7 text-xs text-slate-900 placeholder:text-slate-400"
                />
                {issueQuery && (
                  <button
                    type="button"
                    onClick={() => setIssueQuery("")}
                    aria-label="Clear issue search"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {visibleGroups.length === 0 ? (
            <div className="flex h-44 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 text-center">
              <p className="text-sm font-medium text-slate-700">
                No health issue graphs matching &ldquo;{issueQuery.trim() || activeIssue}&rdquo;.
              </p>
              <button
                type="button"
                onClick={() => {
                  setIssueQuery("");
                  setActiveIssue("");
                }}
                className="mt-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-teal-700 transition hover:bg-slate-100"
              >
                Show all issues
              </button>
            </div>
          ) : (
            <div
              className={`grid grid-cols-1 gap-4 ${
                visibleGroups.length > 1 ? "md:grid-cols-2" : ""
              }`}
            >
              {visibleGroups.map((group) => (
                <IssueLineChartCard
                  key={group.issue}
                  title={group.issue}
                  logs={group.logs}
                  selectedPatient={selectedPatient}
                  entryCount={group.logs.length}
                  latestSeverity={group.latestSeverity}
                  onLogForIssue={onSelectIssueForLogging}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          <div
            className="h-72 w-full min-w-0"
            role="region"
            aria-label={combinedSummary}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={combinedAverages}
                margin={{ top: 12, right: 20, left: 0, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="date"
                  padding={{ left: 20, right: 20 }}
                  tick={{ fill: "#475569", fontSize: 12 }}
                  tickLine={{ stroke: "#cbd5e1" }}
                  axisLine={{ stroke: "#cbd5e1" }}
                />
                <YAxis
                  domain={[1, 10]}
                  ticks={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}
                  width={36}
                  tick={{ fill: "#475569", fontSize: 12 }}
                  tickLine={{ stroke: "#cbd5e1" }}
                  axisLine={{ stroke: "#cbd5e1" }}
                />
                <Tooltip content={<ChartTooltip />} />
                <Line
                  type="monotone"
                  dataKey="average_severity"
                  name="Average Severity"
                  stroke="#0d9488"
                  strokeWidth={2.5}
                  dot={{
                    r: 5,
                    fill: "#0d9488",
                    stroke: "#ffffff",
                    strokeWidth: 2,
                  }}
                  activeDot={{ r: 7, fill: "#0f766e" }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-600">
            {combinedSummary}
          </p>
        </>
      )}
    </section>
  );
}
