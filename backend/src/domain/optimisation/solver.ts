import {
  hasBlockingViolations,
  validateBessConfiguration,
  validateBessStateAgainstConfig,
  validateElectrolyserConfiguration,
  validateElectrolyserStateAgainstConfig
} from "../flexible-assets/constraints.js";
import {
  OPTIMISATION_SOLVER_VERSION,
  type OptimisationProblem,
  type OptimisationSetpoint,
  type OptimisationSolution,
  type Solver
} from "./types.js";

/**
 * Deterministic surplus-absorption heuristic (advisory only).
 * Charge BESS then electrolyser before curtailing; discharge when short.
 */
export class DeterministicAdvisorySolver implements Solver {
  readonly version = OPTIMISATION_SOLVER_VERSION;

  solve(problem: OptimisationProblem): OptimisationSolution {
    const violations = [
      ...validateBessConfiguration(problem.bessConfig),
      ...validateBessStateAgainstConfig(problem.bessConfig, problem.bessState),
      ...validateElectrolyserConfiguration(problem.electrolyserConfig),
      ...validateElectrolyserStateAgainstConfig(
        problem.electrolyserConfig,
        problem.electrolyserState
      )
    ];

    const assumptions = {
      physicalControl: false as const,
      advisoryOnly: true as const,
      solverVersion: this.version,
      simulationMode:
        problem.bessConfig.simulationMode || problem.electrolyserConfig.simulationMode
    };

    const emptyBaseline = {
      baselineObjectiveZar: 0,
      optimisedObjectiveZar: 0,
      deltaZar: 0
    };

    if (hasBlockingViolations(violations)) {
      return {
        status: "infeasible",
        advisory: true,
        solverVersion: this.version,
        objectiveValueZar: 0,
        expectedBenefitZar: 0,
        setpoints: [],
        constraintViolations: violations,
        warnings: [
          "Advisory run marked infeasible due to hard constraint violations",
          "No physical control ΓÇö advisory / simulated schedules only"
        ],
        assumptions,
        baselineComparison: emptyBaseline,
        sensitivity: {
          lowBenefitZar: 0,
          highBenefitZar: 0,
          forecastUncertaintyFraction: 0.15
        }
      };
    }

    const weights = problem.weights;
    let socFraction = problem.bessState.socPercent.value / 100;
    let storageKg = problem.electrolyserState.storageLevelKg.value;
    const energyKwh = problem.bessConfig.ratedEnergyKwh.value;
    const minSoc = problem.bessConfig.minSocPercent.value / 100;
    const maxSoc = problem.bessConfig.maxSocPercent.value / 100;
    const reserveSoc = problem.bessConfig.reserveSocPercent.value / 100;
    const chargeEff = problem.bessConfig.chargeEfficiency.value;
    const dischargeEff = problem.bessConfig.dischargeEfficiency.value;
    const maxChargeKw = problem.bessConfig.maxChargePowerKw.value;
    const maxDischargeKw = problem.bessConfig.maxDischargePowerKw.value;
    const elyMin = problem.electrolyserConfig.minStableLoadKw.value;
    const elyMax = problem.electrolyserConfig.maxLoadKw.value;
    const elyEff = problem.electrolyserConfig.efficiencyKwhPerKg.value;
    const storageCap = problem.electrolyserConfig.hydrogenStorageCapacityKg.value;
    const maintenance = problem.electrolyserConfig.maintenanceWindowActive.value;

    const setpoints: OptimisationSetpoint[] = [];
    let optimisedZar = 0;
    let baselineZar = 0;
    let remainingCurtailmentMwh = 0;

    for (const interval of problem.horizon) {
      const hours = interval.durationMinutes / 60;
      const start = interval.start;
      const end = new Date(new Date(start).getTime() + interval.durationMinutes * 60_000).toISOString();

      const surplusKw = interval.generationForecastKw - interval.demandKw;
      const exportKw = Math.max(0, Math.min(surplusKw, interval.exportLimitKw));
      const curtailableKw = Math.max(0, surplusKw - interval.exportLimitKw);
      const shortfallKw = Math.max(0, -surplusKw);

      const baselineExportMwh = (exportKw * hours) / 1000;
      const baselineCurtailMwh = (curtailableKw * hours) / 1000;
      baselineZar +=
        baselineExportMwh * weights.exportRevenueZarPerMwh -
        baselineCurtailMwh * weights.curtailmentAvoidanceZarPerMwh;

      let chargeKw = 0;
      let dischargeKw = 0;
      let elyKw = 0;

      if (curtailableKw > 0) {
        const headroomKwh = Math.max(0, (maxSoc - socFraction) * energyKwh);
        const maxChargeByEnergy = hours > 0 ? headroomKwh / (hours * chargeEff) : 0;
        chargeKw = Math.min(curtailableKw, maxChargeKw, Math.max(0, maxChargeByEnergy));
        let remainingCurtailKw = curtailableKw - chargeKw;

        if (!maintenance && remainingCurtailKw > 0) {
          const storageRoomKg = Math.max(0, storageCap - storageKg);
          const maxByStorage = hours > 0 && elyEff > 0 ? (storageRoomKg * elyEff) / hours : 0;
          let candidate = Math.min(remainingCurtailKw, elyMax, Math.max(0, maxByStorage));
          if (candidate > 0 && candidate < elyMin) {
            candidate = 0;
          }
          elyKw = candidate;
        }
      } else if (shortfallKw > 0) {
        const usableSoc = Math.max(0, socFraction - Math.max(minSoc, reserveSoc));
        const availableKwh = usableSoc * energyKwh * dischargeEff;
        const maxDischargeByEnergy = hours > 0 ? availableKwh / hours : 0;
        dischargeKw = Math.min(shortfallKw, maxDischargeKw, Math.max(0, maxDischargeByEnergy));
      }

      if (chargeKw > 0) {
        socFraction += (chargeKw * hours * chargeEff) / energyKwh;
        setpoints.push({
          assetId: problem.bessAssetId,
          intervalStart: start,
          intervalEnd: end,
          targetKw: chargeKw,
          unit: "kW",
          note: "Advisory BESS charge (simulated)"
        });
      } else if (dischargeKw > 0) {
        socFraction -= (dischargeKw * hours) / (energyKwh * dischargeEff);
        setpoints.push({
          assetId: problem.bessAssetId,
          intervalStart: start,
          intervalEnd: end,
          targetKw: -dischargeKw,
          unit: "kW",
          note: "Advisory BESS discharge (simulated)"
        });
      }

      if (elyKw > 0) {
        const h2Kg = (elyKw * hours) / elyEff;
        storageKg = Math.min(storageCap, storageKg + h2Kg);
        setpoints.push({
          assetId: problem.electrolyserAssetId,
          intervalStart: start,
          intervalEnd: end,
          targetKw: elyKw,
          unit: "kW",
          expectedValue: h2Kg / hours,
          note: "Advisory electrolyser load (simulated)"
        });
      }

      const absorbedKw = chargeKw + elyKw;
      const netExportKw = Math.max(
        0,
        Math.min(
          interval.generationForecastKw - interval.demandKw - absorbedKw + dischargeKw,
          interval.exportLimitKw
        )
      );
      const curtailKw = Math.max(
        0,
        interval.generationForecastKw - interval.demandKw - absorbedKw + dischargeKw - netExportKw
      );
      remainingCurtailmentMwh += (curtailKw * hours) / 1000;

      const exportMwh = (netExportKw * hours) / 1000;
      const chargeMwh = (chargeKw * hours) / 1000;
      const h2KgInterval = elyKw > 0 ? (elyKw * hours) / elyEff : 0;

      optimisedZar +=
        exportMwh * weights.exportRevenueZarPerMwh +
        h2KgInterval * weights.hydrogenRevenueZarPerKg -
        chargeMwh * weights.degradationCostZarPerMwh -
        (elyKw > 0 ? hours * weights.electrolyserOperatingCostZarPerHour : 0) -
        ((curtailKw * hours) / 1000) * weights.curtailmentAvoidanceZarPerMwh;
    }

    const expectedBenefitZar = optimisedZar - baselineZar;
    const uncertainty = 0.15;

    return {
      status: "completed",
      advisory: true,
      solverVersion: this.version,
      objectiveValueZar: optimisedZar,
      expectedBenefitZar,
      setpoints,
      constraintViolations: violations.filter((v) => v.severity === "soft"),
      warnings: [
        "Advisory optimisation only ΓÇö no physical dispatch commands are issued",
        "Asset state and schedules are simulated / estimated unless labelled measured",
        remainingCurtailmentMwh > 0
          ? `Residual curtailment after flexible absorption: ${remainingCurtailmentMwh.toFixed(3)} MWh`
          : "Flexible assets absorbed export-limit surplus within horizon"
      ],
      assumptions,
      baselineComparison: {
        baselineObjectiveZar: baselineZar,
        optimisedObjectiveZar: optimisedZar,
        deltaZar: expectedBenefitZar
      },
      sensitivity: {
        lowBenefitZar: expectedBenefitZar * (1 - uncertainty),
        highBenefitZar: expectedBenefitZar * (1 + uncertainty),
        forecastUncertaintyFraction: uncertainty
      }
    };
  }
}

export const defaultAdvisoryEngine = new DeterministicAdvisorySolver();
