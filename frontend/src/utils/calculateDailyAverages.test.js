import { describe, expect, it } from "vitest";
import { calculateDailyAverages } from "./calculateDailyAverages";

describe("calculateDailyAverages", () => {
  const fixedNow = new Date("2026-11-25T12:00:00Z");

  it("computes daily averages, rounds to 2 decimals, and omits missing days", () => {
    const logs = [
      { id: 1, timestamp: "2026-11-20T08:00:00Z", severity: 6 },
      { id: 2, timestamp: "2026-11-20T18:00:00Z", severity: 8 },
      { id: 3, timestamp: "2026-11-21T10:00:00Z", severity: 5 },
      { id: 4, timestamp: "2026-11-23T09:00:00Z", severity: 4 },
      { id: 5, timestamp: "2026-11-24T09:00:00Z", severity: 5 },
      { id: 6, timestamp: "2026-11-24T12:00:00Z", severity: 6 },
      { id: 7, timestamp: "2026-11-24T15:00:00Z", severity: 5 },
    ];

    expect(calculateDailyAverages(logs, fixedNow)).toEqual([
      { date: "2026-11-20", average_severity: 7 },
      { date: "2026-11-21", average_severity: 5 },
      { date: "2026-11-23", average_severity: 4 },
      { date: "2026-11-24", average_severity: 5.33 },
    ]);
  });

  it("groups entries strictly by UTC calendar date across midnight boundaries", () => {
    const logs = [
      { id: 1, timestamp: "2026-11-20T23:59:59Z", severity: 8 },
      { id: 2, timestamp: "2026-11-21T00:00:00Z", severity: 2 },
      // +05:30 offset converts 2026-11-21T02:00:00+05:30 to 2026-11-20T20:30:00Z
      { id: 3, timestamp: "2026-11-21T02:00:00+05:30", severity: 4 },
    ];

    expect(calculateDailyAverages(logs, fixedNow)).toEqual([
      { date: "2026-11-20", average_severity: 6 },
      { date: "2026-11-21", average_severity: 2 },
    ]);
  });

  it("applies the 30-day midnight UTC cutoff (current day + 29 preceding days)", () => {
    const logs = [
      // 30 days before Nov 25 is Oct 26 -> excluded
      { id: 1, timestamp: "2026-10-26T23:59:59.999Z", severity: 9 },
      // 29 days before Nov 25 is Oct 27 at 00:00:00Z -> included
      { id: 2, timestamp: "2026-10-27T00:00:00.000Z", severity: 3 },
      // Today (Nov 25) -> included
      { id: 3, timestamp: "2026-11-25T12:00:00.000Z", severity: 7 },
    ];

    expect(calculateDailyAverages(logs, fixedNow)).toEqual([
      { date: "2026-10-27", average_severity: 3 },
      { date: "2026-11-25", average_severity: 7 },
    ]);
  });

  it("excludes records with timestamps after `now`", () => {
    const logs = [
      { id: 1, timestamp: "2026-11-25T11:59:59Z", severity: 4 },
      { id: 2, timestamp: "2026-11-25T12:00:01Z", severity: 10 },
      { id: 3, timestamp: "2026-12-01T00:00:00Z", severity: 9 },
    ];

    expect(calculateDailyAverages(logs, fixedNow)).toEqual([
      { date: "2026-11-25", average_severity: 4 },
    ]);
  });

  it("sorts output dates in ascending chronological order", () => {
    const logs = [
      { id: 1, timestamp: "2026-11-24T10:00:00Z", severity: 5 },
      { id: 2, timestamp: "2026-11-02T10:00:00Z", severity: 2 },
      { id: 3, timestamp: "2026-11-15T10:00:00Z", severity: 8 },
    ];

    expect(calculateDailyAverages(logs, fixedNow)).toEqual([
      { date: "2026-11-02", average_severity: 2 },
      { date: "2026-11-15", average_severity: 8 },
      { date: "2026-11-24", average_severity: 5 },
    ]);
  });

  it("returns an empty array for empty or invalid inputs", () => {
    expect(calculateDailyAverages([], fixedNow)).toEqual([]);
    expect(calculateDailyAverages(null, fixedNow)).toEqual([]);
  });
});
