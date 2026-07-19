import type { BessConfiguration, BessState } from "../flexible-assets/bess.js";
import type { ElectrolyserConfiguration, ElectrolyserState } from "../flexible-assets/electrolyser.js";
import type { ConstraintViolation } from "../flexible-assets/constraints.js";

export const OPTIMISATION_SOLVER_VERSION = "gridflex-advisory-deterministic-v1";

export type OptimisationHorizonInterval = {
  start: string;
  durationMinutes: number;
  generationForecastKw: number;
  exportLimitKw: number;
  demandKw: number;
  forecastConfidence?: number;
};

export type OptimisationWeights = {
  exportRevenueZarPerMwh: number;
  hydrogenRevenueZarPerKg: number;
  curtailmentAvoidanceZarPerMwh: number;
  degradationCostZarPerMwh: number;
  electrolyserOperatingCostZarPerHour: number;
};

export type OptimisationProblem = {
  plantId: string;
  bessAssetId: string;
  electrolyserAssetId: string;
  bessConfig: BessConfiguration;
  bessState: BessState;
  electrolyserConfig: ElectrolyserConfiguration;
  electrolyserState: ElectrolyserState;
  horizon: OptimisationHorizonInterval[];
  weights: OptimisationWeights;
  advisoryOnly: boolean;
};

export type OptimisationSetpoint = {
  assetId: string;
  intervalStart: string;
  intervalEnd: string;
  targetKw: number;
  unit: "kW";
  expectedValue?: number;
  note?: string;
};

export type OptimisationAssumptions = {
  physicalControl: false;
  advisoryOnly: true;
  solverVersion: string;
  simulationMode: boolean;
};

export type OptimisationBaselineComparison = {
  baselineObjectiveZar: number;
  optimisedObjectiveZar: number;
  deltaZar: number;
};

export type OptimisationSensitivity = {
  lowBenefitZar: number;
  highBenefitZar: number;
  forecastUncertaintyFraction: number;
};

export type OptimisationSolutionStatus = "completed" | "infeasible" | "failed";

export type OptimisationSolution = {
  status: OptimisationSolutionStatus;
  advisory: true;
  solverVersion: string;
  objectiveValueZar: number;
  expectedBenefitZar: number;
  setpoints: OptimisationSetpoint[];
  constraintViolations: ConstraintViolation[];
  warnings: string[];
  assumptions: OptimisationAssumptions;
  baselineComparison: OptimisationBaselineComparison;
  sensitivity: OptimisationSensitivity;
};

export interface Solver {
  readonly version: string;
  solve(problem: OptimisationProblem): OptimisationSolution;
}
