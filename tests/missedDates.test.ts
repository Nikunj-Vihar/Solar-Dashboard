import { describe, it, expect } from "vitest";
import { getMissedDatesThisMonth } from "@/lib/calc/missedDates";

describe("getMissedDatesThisMonth", () => {
  it("returns nothing when the site has never logged or skipped a day", () => {
    expect(
      getMissedDatesThisMonth({ loggedDates: [], skippedDates: [], today: "2026-08-15" }),
    ).toEqual([]);
  });

  it("flags every day since month start that's neither logged nor skipped", () => {
    const result = getMissedDatesThisMonth({
      loggedDates: ["2026-08-01", "2026-08-10"],
      skippedDates: [],
      today: "2026-08-15",
    });
    expect(result).toEqual([
      "2026-08-02",
      "2026-08-03",
      "2026-08-04",
      "2026-08-05",
      "2026-08-06",
      "2026-08-07",
      "2026-08-08",
      "2026-08-09",
      "2026-08-11",
      "2026-08-12",
      "2026-08-13",
      "2026-08-14",
    ]);
  });

  it("treats an explicit 'no reading' day as handled, not missed", () => {
    const result = getMissedDatesThisMonth({
      loggedDates: ["2026-08-01"],
      skippedDates: ["2026-08-02"],
      today: "2026-08-03",
    });
    expect(result).toEqual([]);
  });

  it("never flags days before the site's first-ever recorded date", () => {
    // Site's first entry was the 10th -- the 1st-9th predate it, not "missed."
    const result = getMissedDatesThisMonth({
      loggedDates: ["2026-08-10"],
      skippedDates: [],
      today: "2026-08-12",
    });
    expect(result).toEqual(["2026-08-11"]);
  });

  it("returns nothing on the 1st of the month (no prior days to check yet)", () => {
    const result = getMissedDatesThisMonth({
      loggedDates: ["2026-07-15"],
      skippedDates: [],
      today: "2026-08-01",
    });
    expect(result).toEqual([]);
  });

  it("returns nothing when everything since month start is accounted for", () => {
    const result = getMissedDatesThisMonth({
      loggedDates: ["2026-08-01", "2026-08-02"],
      skippedDates: ["2026-08-03"],
      today: "2026-08-04",
    });
    expect(result).toEqual([]);
  });
});
