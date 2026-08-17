import { describe, it, expect } from "vitest";
import {
  checkCumulativeAndCrossCheck,
  exceedsPhysicalCapacity,
} from "@/lib/validation/readings";

describe("checkCumulativeAndCrossCheck", () => {
  it("passes on the very first reading for an inverter (nothing to compare)", () => {
    const result = checkCumulativeAndCrossCheck({
      cumulativeMwh: 1.2,
      previousCumulativeMwh: null,
      isReset: false,
    });
    expect(result).toEqual({ status: "ok" });
  });

  it("passes when the cumulative counter has moved forward", () => {
    const result = checkCumulativeAndCrossCheck({
      cumulativeMwh: 10.025,
      previousCumulativeMwh: 10.0,
      isReset: false,
    });
    expect(result).toEqual({ status: "ok" });
  });

  it("rejects a cumulative decrease that isn't flagged as a reset", () => {
    const result = checkCumulativeAndCrossCheck({
      cumulativeMwh: 9.5,
      previousCumulativeMwh: 10.0,
      isReset: false,
    });
    expect(result).toEqual({ status: "cumulative_decreased" });
  });

  it("accepts a cumulative decrease when explicitly flagged as a reset", () => {
    const result = checkCumulativeAndCrossCheck({
      cumulativeMwh: 0.025,
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
