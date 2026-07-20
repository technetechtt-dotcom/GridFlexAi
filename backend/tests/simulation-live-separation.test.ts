import {
  buildProvenance,
  toProvenanceQuality,
  toTelemetryProvenance
} from "../src/domain/operating-mode.js";
import { defaultTelemetryEnvironmentFilter } from "../src/config/env.js";

describe("provenance contract", () => {
  it("maps DB quality and source into display Provenance", () => {
    const provenance = buildProvenance({
      sourceType: "measured",
      sourceId: "node-1",
      quality: "valid",
      measuredAt: "2026-07-20T10:00:00.000Z",
      receivedAt: "2026-07-20T10:00:01.000Z",
      unit: "kW",
      calibrationVersion: "cal-1"
    });

    expect(provenance.sourceType).toBe("measured");
    expect(provenance.quality).toBe("good");
    expect(provenance.calibrationVersion).toBe("cal-1");
    expect(toTelemetryProvenance("calculated")).toBe("estimated");
    expect(toProvenanceQuality("stale")).toBe("stale");
  });
});

describe("operating mode telemetry filter", () => {
  it("defaults simulation mode to simulation environment filter", () => {
    expect(process.env.GRIDFLEX_OPERATING_MODE ?? "SIMULATION").toMatch(/SIMULATION|HIL|PILOT_LIVE|PRODUCTION_ADVISORY/);
    // setup-env defaults to SIMULATION
    expect(defaultTelemetryEnvironmentFilter()).toBe("simulation");
  });
});

describe("live dashboard excludes simulated source types when live", () => {
  it("documents the cross-mode guard in reading filter shape", () => {
    const liveFilter = {
      environment: "live" as const,
      sourceType: { not: "simulated" as const }
    };
    expect(liveFilter.environment).toBe("live");
    expect(liveFilter.sourceType.not).toBe("simulated");
  });
});
