import {
  defaultBessConfiguration,
  defaultElectrolyserConfiguration,
  defaultSimulatedBessState,
  defaultSimulatedElectrolyserState,
  hasBlockingViolations,
  validateBessConfiguration,
  validateBessStateAgainstConfig,
  validateElectrolyserConfiguration,
  validateElectrolyserStateAgainstConfig
} from "../src/domain/flexible-assets/index.js";
import {
  DeterministicAdvisorySolver,
  OPTIMISATION_SOLVER_VERSION,
  type OptimisationProblem
} from "../src/domain/optimisation/index.js";
import { provenanced } from "../src/domain/flexible-assets/provenance-value.js";

describe("BESS constraint validation", () => {
  it("accepts a coherent default configuration", () => {
    const config = defaultBessConfiguration("bess-1");
    expect(hasBlockingViolations(validateBessConfiguration(config))).toBe(false);
  });

  it("rejects inverted SOC limits", () => {
    const config = defaultBessConfiguration("bess-1");
    config.minSocPercent = provenanced(90, "operator_entered");
    config.maxSocPercent = provenanced(10, "operator_entered");
    const violations = validateBessConfiguration(config);
    expect(violations.some((v) => v.code === "bess.soc_order")).toBe(true);
  });

  it("rejects simultaneous charge and discharge", () => {
    const config = defaultBessConfiguration("bess-1");
    const state = defaultSimulatedBessState("bess-1");
    state.chargePowerKw = provenanced(100, "simulated");
    state.dischargePowerKw = provenanced(50, "simulated");
    const violations = validateBessStateAgainstConfig(config, state);
    expect(violations.some((v) => v.code === "bess.state.simultaneous")).toBe(true);
  });
});

describe("Electrolyser constraint validation", () => {
  it("accepts default configuration", () => {
    const config = defaultElectrolyserConfiguration("ely-1");
    expect(hasBlockingViolations(validateElectrolyserConfiguration(config))).toBe(false);
  });

  it("rejects load below minimum stable while non-zero", () => {
    const config = defaultElectrolyserConfiguration("ely-1");
    const state = defaultSimulatedElectrolyserState("ely-1");
    state.loadPowerKw = provenanced(50, "simulated");
    const violations = validateElectrolyserStateAgainstConfig(config, state);
    expect(violations.some((v) => v.code === "ely.state.min_stable")).toBe(true);
  });

  it("rejects load during maintenance window", () => {
    const config = defaultElectrolyserConfiguration("ely-1");
    config.maintenanceWindowActive = provenanced(true, "operator_entered");
    const state = defaultSimulatedElectrolyserState("ely-1");
    state.loadPowerKw = provenanced(500, "simulated");
    const violations = validateElectrolyserStateAgainstConfig(config, state);
    expect(violations.some((v) => v.code === "ely.state.maintenance")).toBe(true);
  });
});

describe("Deterministic advisory optimisation solver", () => {
  const buildProblem = (): OptimisationProblem => ({
    plantId: "plant-1",
    bessAssetId: "bess-1",
    electrolyserAssetId: "ely-1",
    bessConfig: defaultBessConfiguration("bess-1"),
    bessState: defaultSimulatedBessState("bess-1", 40),
    electrolyserConfig: defaultElectrolyserConfiguration("ely-1"),
    electrolyserState: defaultSimulatedElectrolyserState("ely-1"),
    horizon: [
      {
        start: "2026-07-19T10:00:00.000Z",
        durationMinutes: 60,
        generationForecastKw: 9000,
        exportLimitKw: 5000,
        demandKw: 1000,
        forecastConfidence: 0.8
      },
      {
        start: "2026-07-19T11:00:00.000Z",
        durationMinutes: 60,
        generationForecastKw: 2000,
        exportLimitKw: 5000,
        demandKw: 2500,
        forecastConfidence: 0.7
      }
    ],
    weights: {
      exportRevenueZarPerMwh: 1450,
      hydrogenRevenueZarPerKg: 85,
      curtailmentAvoidanceZarPerMwh: 900,
      degradationCostZarPerMwh: 120,
      electrolyserOperatingCostZarPerHour: 400
    },
    advisoryOnly: true
  });

  it("returns deterministic advisory setpoints and baseline comparison", () => {
    const solver = new DeterministicAdvisorySolver();
    const first = solver.solve(buildProblem());
    const second = solver.solve(buildProblem());

    expect(solver.version).toBe(OPTIMISATION_SOLVER_VERSION);
    expect(first.status).toBe("completed");
    expect(first.advisory).toBe(true);
    expect(first.setpoints.length).toBeGreaterThan(0);
    expect(first.expectedBenefitZar).toBe(second.expectedBenefitZar);
    expect(first.objectiveValueZar).toBe(second.objectiveValueZar);
    expect(first.assumptions.physicalControl).toBe(false);
    expect(first.warnings.some((w) => w.toLowerCase().includes("advisory") || w.toLowerCase().includes("simulated"))).toBe(
      true
    );
  });

  it("marks infeasible when configuration is invalid", () => {
    const problem = buildProblem();
    problem.bessConfig.minSocPercent = provenanced(95, "operator_entered");
    problem.bessConfig.maxSocPercent = provenanced(10, "operator_entered");
    const solution = new DeterministicAdvisorySolver().solve(problem);
    expect(solution.status).toBe("infeasible");
    expect(solution.setpoints).toEqual([]);
  });

  it("does not silently ignore export-limit surplus (charges or electrolyses)", () => {
    const solution = new DeterministicAdvisorySolver().solve(buildProblem());
    const firstHourBess = solution.setpoints.find(
      (sp) => sp.assetId === "bess-1" && sp.intervalStart === "2026-07-19T10:00:00.000Z"
    );
    const firstHourEly = solution.setpoints.find(
      (sp) => sp.assetId === "ely-1" && sp.intervalStart === "2026-07-19T10:00:00.000Z"
    );
    expect((firstHourBess?.targetKw ?? 0) > 0 || (firstHourEly?.targetKw ?? 0) > 0).toBe(true);
  });
});
