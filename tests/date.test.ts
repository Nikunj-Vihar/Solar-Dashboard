import { describe, it, expect } from "vitest";
import {
  addDays,
  addMonths,
  startOfMonth,
  daysBetween,
  isValidDateString,
  shiftMonths,
  shiftYears,
} from "@/lib/date";

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

describe("shiftMonths", () => {
  it("shifts back within the same year", () => {
    expect(shiftMonths("2026-07-15", -1)).toBe("2026-06-15");
  });

  it("shifts forward across a year boundary", () => {
    expect(shiftMonths("2026-12-15", 1)).toBe("2027-01-15");
  });

  it("shifts back across a year boundary", () => {
    expect(shiftMonths("2026-01-15", -1)).toBe("2025-12-15");
  });

  it("clamps to the last valid day when the target month is shorter", () => {
    // March 31 minus one month -> Feb only has 28 days in 2026 (not a leap year).
    expect(shiftMonths("2026-03-31", -1)).toBe("2026-02-28");
  });

  it("clamps Jan 31 forward into a 30-day April correctly across two months", () => {
    expect(shiftMonths("2026-01-31", 2)).toBe("2026-03-31");
    expect(shiftMonths("2026-01-31", 3)).toBe("2026-04-30");
  });

  it("returns the same date for a zero shift", () => {
    expect(shiftMonths("2026-07-15", 0)).toBe("2026-07-15");
  });
});

describe("shiftYears", () => {
  it("shifts back a normal date by one year", () => {
    expect(shiftYears("2026-07-15", -1)).toBe("2025-07-15");
  });

  it("clamps Feb 29 to Feb 28 when the target year isn't a leap year", () => {
    expect(shiftYears("2024-02-29", 1)).toBe("2025-02-28");
  });

  it("keeps Feb 29 when shifting between two leap years", () => {
    expect(shiftYears("2024-02-29", 4)).toBe("2028-02-29");
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
