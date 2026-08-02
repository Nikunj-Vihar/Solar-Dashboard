import { describe, it, expect } from "vitest";
import { addDays, addMonths, startOfMonth, daysBetween, isValidDateString } from "@/lib/date";

describe("addMonths", () => {
  it("adds a month within the same year", () => {
    expect(addMonths("2026-03-01", 1)).toBe("2026-04-01");
  });

  it("goes negative across a year boundary", () => {
    expect(addMonths("2026-01-01", -1)).toBe("2025-12-01");
  });

  it("goes forward across a year boundary", () => {
    expect(addMonths("2026-12-01", 1)).toBe("2027-01-01");
  });
});

describe("startOfMonth", () => {
  it("clamps any day to the 1st of its month", () => {
    expect(startOfMonth("2026-07-19")).toBe("2026-07-01");
  });
});

describe("daysBetween", () => {
  it("is 1 for the same day (inclusive)", () => {
    expect(daysBetween("2026-07-01", "2026-07-01")).toBe(1);
  });

  it("counts inclusively across a month", () => {
    expect(daysBetween("2026-07-01", "2026-07-31")).toBe(31);
  });

  it("counts inclusively across a year boundary", () => {
    expect(daysBetween("2025-12-30", "2026-01-02")).toBe(4);
  });
});

describe("addDays + daysBetween round-trip", () => {
  it("stays consistent for an arbitrary offset", () => {
    const from = "2026-05-10";
    const to = addDays(from, 42);
    expect(daysBetween(from, to)).toBe(43);
  });
});

describe("isValidDateString", () => {
  it("accepts a well-formed date", () => {
    expect(isValidDateString("2026-02-14")).toBe(true);
  });

  it("rejects garbage", () => {
    expect(isValidDateString("not-a-date")).toBe(false);
    expect(isValidDateString("2026/02/14")).toBe(false);
  });
});
