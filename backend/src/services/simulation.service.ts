import { getDashboardOverview } from "./dashboard.service.js";
import { getHybridForecast } from "./forecast.service.js";
import { listNodesWithLastReading } from "./node.service.js";
import { getReadingsSummary } from "./reading.service.js";

type SimulationNodeProfile = {
  id?: string | undefined;
  name: string;
  lat: number;
  lon: number;
  capacity: number;
};

type CongestionNode = {
  name: string;
  currentLoad: number;
  forecast24h: number[];
  risk: "low" | "medium" | "high" | "critical";
};

const fallbackProfiles: SimulationNodeProfile[] = [
  {
    name: "Upington",
    lat: -28.4478,
    lon: 21.2561,
    capacity: 220
  },
  {
    name: "De Aar",
    lat: -30.6499,
    lon: 24.0123,
    capacity: 180
  },
  {
    name: "Prieska",
    lat: -29.6699,
    lon: 22.7447,
    capacity: 140
  }
];

const toRisk = (peak: number): CongestionNode["risk"] => {
  if (peak >= 90) return "critical";
  if (peak >= 75) return "high";
  if (peak >= 55) return "medium";
  return "low";
};

const inferProfilesFromNodes = async (): Promise<SimulationNodeProfile[]> => {
  const nodes = await listNodesWithLastReading();
  const mapped = nodes.flatMap((node) => {
    if (typeof node.latitude !== "number" || typeof node.longitude !== "number") {
      return [];
    }

    const baselinePower = node.lastReading?.power ?? node.latestReadingSummary.avgPower24h ?? 140;
    return [
      {
        id: node.id,
        name: node.name,
        lat: node.latitude,
        lon: node.longitude,
        capacity: Math.max(120, Math.round(baselinePower * 1.25))
      }
    ];
  });

  return mapped.length > 0 ? mapped.slice(0, 8) : fallbackProfiles;
};

const resolveProfiles = async (profiles?: SimulationNodeProfile[]): Promise<SimulationNodeProfile[]> => {
  if (profiles && profiles.length > 0) {
    return profiles;
  }
  return inferProfilesFromNodes();
};

export const getCongestionNodesSimulation = async (profiles?: SimulationNodeProfile[]): Promise<CongestionNode[]> => {
  const resolvedProfiles = await resolveProfiles(profiles);
  const rows = await Promise.all(
    resolvedProfiles.map(async (profile) => {
      const forecast = await getHybridForecast({
        lat: profile.lat,
        lon: profile.lon,
        capacity: profile.capacity
      });
      const forecast24h = forecast.hourly.slice(0, 12).map((hour) => {
        const loadPct = (hour.estimatedPowerKw / profile.capacity) * 100;
        return Math.min(100, Math.max(0, Math.round(loadPct)));
      });
      const currentLoad = forecast24h[0] ?? 0;
      const peak = Math.max(...forecast24h, 0);

      return {
        name: profile.name,
        currentLoad,
        forecast24h,
        risk: toRisk(peak)
      } satisfies CongestionNode;
    })
  );

  return rows;
};

export const getDynamicLineRatingsSimulation = async () => {
  const profiles = await resolveProfiles();
  const topProfiles = profiles.slice(0, 3);

  const rows = await Promise.all(
    topProfiles.map(async (profile) => {
      const forecast = await getHybridForecast({
        lat: profile.lat,
        lon: profile.lon,
        capacity: profile.capacity
      });
      const horizon = forecast.hourly.slice(0, 12);
      const avgTemp = horizon.reduce((sum, point) => sum + (point.temperatureC ?? 25), 0) / Math.max(1, horizon.length);
      const avgCloud = horizon.reduce((sum, point) => sum + (point.cloudCoverPct ?? 45), 0) / Math.max(1, horizon.length);
      const inferredWind = Number((Math.max(2, 12 - avgCloud / 10)).toFixed(1));
      const upliftPercent = Math.max(8, Math.round(24 - avgTemp / 3 + inferredWind / 2));
      const staticLimitMW = Math.max(120, Math.round(profile.capacity * 1.45));

      return {
        corridor: `${profile.name} Corridor`,
        ambientTempC: Number(avgTemp.toFixed(1)),
        windSpeedMs: inferredWind,
        staticLimitMW,
        dynamicLimitMW: Math.round(staticLimitMW * (1 + upliftPercent / 100)),
        upliftPercent
      };
    })
  );

  return rows;
};

export const getTopologyOptimizationSimulation = async () => {
  const [dashboard, congestionNodes] = await Promise.all([
    getDashboardOverview(),
    getCongestionNodesSimulation()
  ]);

  const highRiskNodes = congestionNodes.filter((node) => node.risk === "high" || node.risk === "critical").length;
  const congestionReductionPercent = Math.min(
    36,
    Math.max(8, Math.round(dashboard.averages.curtailment * 4 + highRiskNodes * 3 + 8))
  );
  const transferCapacityGainPercent = Math.min(
    42,
    Math.max(10, Math.round(12 + dashboard.nodes.online * 2 + highRiskNodes))
  );
  const rerouteToElectrolyzerMW = Math.max(
    5,
    Math.round(dashboard.averages.curtailment * 2 + dashboard.averages.inverterPower * 0.4)
  );

  return {
    congestionReductionPercent,
    transferCapacityGainPercent,
    recommendedTopology:
      `Prioritize dynamic rerouting on ${Math.max(1, highRiskNodes)} high-risk corridor(s) and shift flexible load to maintain contingency margin.`,
    rerouteToElectrolyzerMW
  };
};

export const getHydrogenTwinSimulation = async () => {
  const dashboard = await getDashboardOverview();
  const avgPower = Math.max(dashboard.averages.power, 1);
  const stackLoadPercent = Math.max(15, Math.min(95, Math.round((dashboard.averages.inverterPower / avgPower) * 100)));
  const renewableSharePercent = Math.max(0, Math.min(100, Math.round(100 - dashboard.averages.curtailment * 4)));
  const predictedLoadsheddingRisk =
    dashboard.nodes.offline >= 2 ? "high" : dashboard.nodes.offline === 1 ? "medium" : "low";

  return {
    electrolyzerType: "PEM" as const,
    stackLoadPercent,
    efficiencyKwhPerKg: Number((52 - Math.min(6, dashboard.averages.curtailment * 0.4)).toFixed(1)),
    productionKgPerHour: Math.max(80, Math.round(avgPower * 8.4)),
    lcohZarPerKg: Number(
      (48 - Math.min(10, dashboard.nodes.online * 1.2) + dashboard.averages.curtailment * 0.8).toFixed(1)
    ),
    gridPriceZarPerKwh: Number((0.72 + dashboard.averages.curtailment * 0.05).toFixed(2)),
    renewableSharePercent,
    predictedLoadsheddingRisk,
    mode:
      dashboard.averages.curtailment >= 2.5 ?
        "excess" :
        dashboard.averages.curtailment >= 1 ?
          "arbitrage" :
          "ancillary"
  };
};

export const getPilotReportSimulation = async () => {
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
  const [dashboard, summaryRows] = await Promise.all([
    getDashboardOverview(),
    getReadingsSummary({ startDate, endDate })
  ]);

  const energyKwh = summaryRows.reduce((acc, row) => acc + row.totalEnergyKwh, 0);

  return {
    date: endDate.toISOString().slice(0, 10),
    curtailmentSaved: Number((Math.max(0, energyKwh * 0.06) / 1000).toFixed(2)),
    revenueUplift: Number((energyKwh * 1.35).toFixed(0)),
    h2Produced: Number((energyKwh / 52).toFixed(0)),
    co2Avoided: Number((energyKwh * 0.0009).toFixed(2)),
    gridStabilityScore: Math.max(
      60,
      Math.min(99, Math.round(92 - dashboard.averages.curtailment * 2 + dashboard.nodes.online))
    )
  };
};
