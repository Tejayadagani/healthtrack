import { describe, expect, it } from "vitest";
import { extractHealthIssue, groupSymptomsByIssue } from "./groupSymptomsByIssue";

describe("groupSymptomsByIssue", () => {
  it("extracts explicit issue prefixes and earliest matching keywords", () => {
    expect(extractHealthIssue("Back Pain: stiff after sitting")).toBe("Back Pain");
    expect(extractHealthIssue("[Sleep] Woke up twice")).toBe("Sleep");
    expect(extractHealthIssue("Dry cough and scratchy throat")).toBe("Cough");
    expect(extractHealthIssue("Low-grade fever and body aches")).toBe("Fever");
    expect(extractHealthIssue("Sharp knee soreness during walk")).toBe("Knee");
  });

  it("groups entries into separate buckets per health issue", () => {
    const logs = [
      { id: 1, description: "Dry cough", severity: 5, timestamp: "2026-11-20T08:00:00Z" },
      { id: 2, description: "Mild headache", severity: 3, timestamp: "2026-11-21T08:00:00Z" },
      { id: 3, description: "Worsening cough", severity: 7, timestamp: "2026-11-22T08:00:00Z" },
    ];

    const groups = groupSymptomsByIssue(logs);
    expect(groups).toHaveLength(2);
    expect(groups[0].issue).toBe("Cough");
    expect(groups[0].logs).toHaveLength(2);
    expect(groups[0].latestSeverity).toBe(7);

    expect(groups[1].issue).toBe("Headache");
    expect(groups[1].logs).toHaveLength(1);
    expect(groups[1].latestSeverity).toBe(3);
  });

  it("returns an empty array when given no logs", () => {
    expect(groupSymptomsByIssue([])).toEqual([]);
    expect(groupSymptomsByIssue(null)).toEqual([]);
  });
});
