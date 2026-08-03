import { describe, it, expect } from "vitest";
import { computeHealthStatus, findUnderperformingInverter, pickHealthReason } from "@/lib/calc/health";

describe("computeHealthStatus", () => {
  it("is good with no alerts", () => {
    expect(computeHealthStatus([])).toBe("good");
  });

  it("is watch when only watch-severity alerts exist", () => {
    expect(computeHealthStatus([{ severity: "watch" }])).toBe("watch");
  });

  it("is needs_attention when any needs_attention alert exists, even alongside watch", () => {
    expect(
      computeHealthStatus([{ severity: "watch" }, { severity: "needs_attention" }]),
    ).toBe("needs_attention");
  });
});

describe("pickHealthReason", () => {
  it("is null for good (nothing to explain)", () => {
    expect(pickHealthReason([], "good")).toBeNull();
  });

  it("returns the matching watch alert's own message", () => {
    const reason = pickHealthReason(
      [{ severity: "watch" as const, message: "Inverter 2 hasn't logged a reading in 3 days." }],
      "watch",
    );
    expect(reason).toBe("Inverter 2 hasn't logged a reading in 3 days.");
  });

  it("picks a needs_attention message over a watch one when status is needs_attention", () => {
    const reason = pickHealthReason(
      [
        { severity: "watch" as const, message: "watch message" },
        { severity: "needs_attention" as const, message: "needs_attention message" },
      ],
      "needs_attention",
    );
    expect(reason).toBe("needs_attention message");
  });

  it("picks the first (most recent) matching alert when several share a severity", () => {
    const reason = pickHealthReason(
      [
        { severity: "watch" as const, message: "newest" },
        { severity: "watch" as const, message: "oldest" },
      ],
      "watch",
    );
    expect(reason).toBe("newest");
  });
});

describe("findUnderperformingInverter", () => {
  it("returns null when all 4 inverters are close together", () => {
    const result = findUnderperformingInverter([
      { inverterId: "a", kwh: 25 },
      { inverterId: "b", kwh: 24 },
      { inverterId: "c", kwh: 26 },
      { inverterId: "d", kwh: 23 },
    ]);
    expect(result).toBeNull();
  });

  it("flags the inverter meaningfully behind the other three", () => {
    const result = findUnderperformingInverter([
      { inverterId: "a", kwh: 25 },
      { inverterId: "b", kwh: 24 },
      { inverterId: "c", kwh: 26 },
      { inverterId: "d", kwh: 5 }, // ~80% below the ~25 avg of the others
    ]);
    expect(result).toBe("d");
  });

  it("returns null when nothing has been logged today (no false positive on empty data)", () => {
    const result = findUnderperformingInverter([
      { inverterId: "a", kwh: 0 },
      { inverterId: "b", kwh: 0 },
      { inverterId: "c", kwh: 0 },
      { inverterId: "d", kwh: 0 },
    ]);
    expect(result).toBeNull();
  });

  it("does not false-flag normal daily variation just because one is lowest", () => {
    // Lowest is still within 80% of the others' average -> not flagged.
    const result = findUnderperformingInverter([
      { inverterId: "a", kwh: 25 },
      { inverterId: "b", kwh: 24 },
      { inverterId: "c", kwh: 26 },
      { inverterId: "d", kwh: 21 }, // 21 / avg(25) = 0.84, above the 0.8 threshold
    ]);
    expect(result).toBeNull();
  });
});
