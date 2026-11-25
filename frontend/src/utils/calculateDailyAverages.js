const MS_PER_DAY = 24 * 60 * 60 * 1000;
const LOOKBACK_DAYS = 29; // Current UTC day + preceding 29 UTC calendar days = 30 days.

/**
 * Group symptom logs by UTC calendar day over the last 30 UTC days (inclusive
 * of `now`) and return sorted daily average severity points.
 */
export function calculateDailyAverages(logs, now = new Date()) {
  if (!Array.isArray(logs) || logs.length === 0) {
    return [];
  }

  const nowDate = now instanceof Date ? now : new Date(now);
  const nowMs = nowDate.getTime();
  if (Number.isNaN(nowMs)) {
    return [];
  }

  const todayUtcMidnightMs = Date.UTC(
    nowDate.getUTCFullYear(),
    nowDate.getUTCMonth(),
    nowDate.getUTCDate()
  );
  const cutoffMs = todayUtcMidnightMs - LOOKBACK_DAYS * MS_PER_DAY;

  const grouped = new Map();

  for (const record of logs) {
    if (!record || typeof record !== "object") {
      continue;
    }

    const parsedDate = new Date(record.timestamp);
    const recordMs = parsedDate.getTime();
    if (Number.isNaN(recordMs)) {
      continue;
    }

    if (recordMs < cutoffMs || recordMs > nowMs) {
      continue;
    }

    if (typeof record.severity !== "number" || Number.isNaN(record.severity)) {
      continue;
    }

    const utcDateKey = parsedDate.toISOString().slice(0, 10);
    const existing = grouped.get(utcDateKey);
    if (existing) {
      existing.sum += record.severity;
      existing.count += 1;
    } else {
      grouped.set(utcDateKey, { sum: record.severity, count: 1 });
    }
  }

  return Array.from(grouped.entries())
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .map(([date, { sum, count }]) => ({
      date,
      average_severity: Math.round((sum / count) * 100) / 100,
    }));
}
