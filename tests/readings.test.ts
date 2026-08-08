import { describe, it, expect } from "vitest";
import {
  checkCumulativeAndCrossCheck,
  exceedsPhysicalCapacity,
} from "@/lib/validation/readings";

describe("checkCumulativeAndCrossCheck", () => {
  it("passes on the very first reading for an inverter (nothing to compare)", () => {
    const result = checkCumulativeAndCrossCheck({
      dailyKwh: 25,
      cumulativeMwh: 1.2,
      previousCumulativeMwh: null,
      isReset: false,
    });
    expect(result).toEqual({ status: "ok" });
  });

  it("passes on an exact match between delta and daily kWh", () => {
    const result = checkCumulativeAndCrossCheck({
      dailyKwh: 25,
      cumulativeMwh: 10.025, // +25 kWh = +0.025 MWh
      previousCumulativeMwh: 10.0,
      isReset: false,
    });
    expect(result).toEqual({ status: "ok" });
  });

  it("passes on normal cloudy-day variance within tolerance", () => {
    // delta = 24.5 kWh, entered 25 kWh -> within max(24.5*0.05, 2) = 2 kWh tolerance
    const result = checkCumulativeAndCrossCheck({
      dailyKwh: 25,
      cumulativeMwh: 10.0245,
      previousCumulativeMwh: 10.0,
      isReset: false,
    });
    expect(result).toEqual({ status: "ok" });
  });

  it("flags a digit-typo'd daily kWh entry as a mismatch", () => {
    // Real delta is 25 kWh but someone typed 250 (extra digit).
    const result = checkCumulativeAndCrossCheck({
      dailyKwh: 250,
      cumulativeMwh: 10.025,
      previousCumulativeMwh: 10.0,
      isReset: false,
    });
    expect(result.status).toBe("mismatch");
    if (result.status === "mismatch") {
      expect(result.computedDeltaKwh).toBeCloseTo(25, 5);
      expect(result.enteredDailyKwh).toBe(250);
    }
  });

  it("flags a decimal-point-error cumulative entry as a mismatch", () => {
    // Cumulative typo'd as 100.25 MWh instead of 10.025 MWh.
    const result = checkCumulativeAndCrossCheck({
      dailyKwh: 25,
      cumulativeMwh: 100.25,
      previousCumulativeMwh: 10.0,
      isReset: false,
    });
    expect(result.status).toBe("mismatch");
  });

  it("does not false-flag right at the tolerance boundary", () => {
    // delta = 100 kWh, tolerance = max(5, 2) = 5kWh: entering 105 is exactly at the edge (not over).
    const result = checkCumulativeAndCrossCheck({
      dailyKwh: 105,
      cumulativeMwh: 10.1,
      previousCumulativeMwh: 10.0,
      isReset: false,
    });
    expect(result).toEqual({ status: "ok" });
  });

  it("flags just past the tolerance boundary", () => {
    const result = checkCumulativeAndCrossCheck({
      dailyKwh: 105.01,
      cumulativeMwh: 10.1,
      previousCumulativeMwh: 10.0,
      isReset: false,
    });
    expect(result.status).toBe("mismatch");
  });

  it("rejects a cumulative decrease that isn't flagged as a reset", () => {
    const result = checkCumulativeAndCrossCheck({
      dailyKwh: 25,
      cumulativeMwh: 9.5,
      previousCumulativeMwh: 10.0,
      isReset: false,
    });
    expect(result).toEqual({ status: "cumulative_decreased" });
  });

  it("accepts a cumulative decrease when explicitly flagged as a reset", () => {
    const result = checkCumulativeAndCrossCheck({
      dailyKwh: 25,
      cumulativeMwh: 0.025,
      previousCumulativeMwh: 10.0,
      isReset: true,
    });
    expect(result).toEqual({ status: "ok" });
  });

  it("skips the cross-check entirely on a reset day even if delta looks odd", () => {
    const result = checkCumulativeAndCrossCheck({
      dailyKwh: 999,
      cumulativeMwh: 0.001,
      previousCumulativeMwh: 10.0,
      isReset: true,
    });
    expect(result).toEqual({ status: "ok" });
  });
});

describe("exceedsPhysicalCapacity", () => {
  it("allows a plausible day within DC capacity", () => {
    expect(exceedsPhysicalCapacity(30, 5.5)).toBe(false); // ~5.5h full-sun-equivalent, plausible
  });

  it("rejects a value wildly above what the inverter could produce", () => {
    expect(exceedsPhysicalCapacity(500, 5.5)).toBe(true); // 5.5kW x 24h x 1.15 = 151.8 kWh ceiling
  });

  it("is exact at the boundary", () => {
    const ceiling = 5.5 * 24 * 1.15;
    expect(exceedsPhysicalCapacity(ceiling, 5.5)).toBe(false);
    expect(exceedsPhysicalCapacity(ceiling + 0.01, 5.5)).toBe(true);
  });
});
