import { describe, it, expect } from "vitest";
import { exceedsPhysicalCapacity } from "@/lib/validation/readings";

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
