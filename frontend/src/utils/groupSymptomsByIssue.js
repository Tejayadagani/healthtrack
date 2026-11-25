const KNOWN_ISSUES = [
  { label: "Headache", patterns: [/\bheadaches?\b/i, /\bmigraines?\b/i] },
  { label: "Cough", patterns: [/\bcoughs?\b/i, /\bcoughing\b/i] },
  { label: "Fever", patterns: [/\bfevers?\b/i, /\bchills\b/i] },
  { label: "Fatigue", patterns: [/\bfatigues?\b/i, /\btired(ness)?\b/i, /\bexhaust(ed|ion)\b/i] },
  { label: "Throat", patterns: [/\bthroat\b/i] },
  { label: "Congestion", patterns: [/\bcongestion\b/i, /\bsinus\b/i, /\brunny nose\b/i] },
  { label: "Knee", patterns: [/\bknees?\b/i] },
  { label: "Back", patterns: [/\bback\b/i, /\bspine\b/i] },
  { label: "Nausea", patterns: [/\bnause(a|ous)\b/i, /\bvomit(ing)?\b/i] },
  { label: "Dizziness", patterns: [/\bdizz(y|iness)\b/i, /\blightheaded(ness)?\b/i] },
  { label: "Chest", patterns: [/\bchest\b/i] },
  { label: "Stomach", patterns: [/\bstomach\b/i, /\babdom(en|inal)\b/i] },
  { label: "Body Aches", patterns: [/\baches?\b/i, /\bsoreness\b/i, /\bpains?\b/i] },
];

function toTitleCase(text) {
  return text
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Determine the health issue label for a symptom log entry.
 * Supports explicit "[Issue]: details" or "Issue: details" prefixes, then falls
 * back to the earliest matching symptom keyword in the description.
 */
export function extractHealthIssue(description) {
  if (typeof description !== "string") {
    return "General";
  }

  const trimmed = description.trim();
  if (!trimmed) {
    return "General";
  }

  const bracketMatch = trimmed.match(/^\[([^\]]{2,30})\](?:\s*:\s*|\s+)/);
  if (bracketMatch) {
    return toTitleCase(bracketMatch[1]);
  }

  const colonMatch = trimmed.match(/^([A-Za-z][A-Za-z0-9 /'-]{1,28}):\s+/);
  if (colonMatch) {
    return toTitleCase(colonMatch[1]);
  }

  let earliestMatch = null;
  for (const issue of KNOWN_ISSUES) {
    for (const regex of issue.patterns) {
      const match = regex.exec(trimmed);
      if (match && (earliestMatch === null || match.index < earliestMatch.index)) {
        earliestMatch = { index: match.index, label: issue.label };
      }
    }
  }

  if (earliestMatch) {
    return earliestMatch.label;
  }

  const shortFallback = trimmed.replace(/\s+/g, " ").slice(0, 28);
  return shortFallback.length < trimmed.length ? `${shortFallback}...` : shortFallback;
}

/**
 * Group symptom logs into separate per-issue buckets ordered by most recent activity.
 */
export function groupSymptomsByIssue(logs) {
  if (!Array.isArray(logs) || logs.length === 0) {
    return [];
  }

  const groups = new Map();

  for (const log of logs) {
    if (!log || typeof log !== "object") continue;
    const issue = extractHealthIssue(log.description);
    const existing = groups.get(issue);
    if (existing) {
      existing.logs.push(log);
    } else {
      groups.set(issue, { issue, logs: [log] });
    }
  }

  return Array.from(groups.values())
    .map((group) => {
      const latestLog = group.logs[group.logs.length - 1];
      return {
        issue: group.issue,
        logs: group.logs,
        latestSeverity: latestLog?.severity ?? null,
        latestTimestamp: latestLog?.timestamp ?? "",
      };
    })
    .sort((a, b) => {
      if (b.logs.length !== a.logs.length) {
        return b.logs.length - a.logs.length;
      }
      return b.latestTimestamp.localeCompare(a.latestTimestamp);
    });
}
