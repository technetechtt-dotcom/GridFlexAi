import {
  calculateDataFreshness,
  convertEnergy,
  convertPower,
  formatEnergyKwh,
  formatPowerKw,
  UnitConversionError
} from "../src/domain/units";

describe("unit conversions", () => {
  it("converts MW to kW without silent mixing", () => {
    expect(convertPower(1.5, "MW", "kW")).toBe(1500);
    expect(convertPower(2500, "kW", "MW")).toBe(2.5);
  });

  it("converts MWh to kWh", () => {
    expect(convertEnergy(2, "MWh", "kWh")).toBe(2000);
    expect(convertEnergy(500, "kWh", "MWh")).toBe(0.5);
  });

  it("rejects non-finite values", () => {
    expect(() => convertPower(Number.NaN, "kW", "MW")).toThrow(UnitConversionError);
  });

  it("formats display strings with explicit units", () => {
    expect(formatPowerKw(12.345)).toBe("12.35 kW");
    expect(formatEnergyKwh(100)).toBe("100.00 kWh");
  });
});

describe("data freshness", () => {
  const now = new Date("2026-07-19T12:00:00.000Z");

  it("marks missing timestamps as offline", () => {
    const result = calculateDataFreshness(null, { now });
    expect(result.qualityHint).toBe("missing");
    expect(result.isOffline).toBe(true);
  });

  it("marks recent timestamps as valid", () => {
    const result = calculateDataFreshness(new Date("2026-07-19T11:59:30.000Z"), { now });
    expect(result.qualityHint).toBe("valid");
    expect(result.isStale).toBe(false);
  });

  it("marks aged timestamps as stale then offline", () => {
    const stale = calculateDataFreshness(new Date("2026-07-19T11:57:00.000Z"), {
      now,
      staleAfterSeconds: 120,
      offlineAfterSeconds: 600
    });
    expect(stale.isStale).toBe(true);
    expect(stale.isOffline).toBe(false);

    const offline = calculateDataFreshness(new Date("2026-07-19T11:40:00.000Z"), {
      now,
      staleAfterSeconds: 120,
      offlineAfterSeconds: 600
    });
    expect(offline.isOffline).toBe(true);
  });
});
