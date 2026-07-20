import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Battery,
  Zap,
  ArrowRight,
  Check,
  AlertTriangle,
  Play,
  TrendingUp,
  Droplet } from
'lucide-react';
import { PromptInput } from '../components/PromptInput';
import { StatusBadge } from '../components/StatusBadge';
import {
  createAdvisoryOptimisationRun,
  fetchDispatchRecommendations,
  fetchReadings,
  type AdvisoryDispatchInterval,
  type BackendReading,
  type DispatchRecommendation } from
'../services/api';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area } from
'recharts';
import { Page } from '../components/Sidebar';
import { usePilotStore } from '../store/pilotStore';
import { ChartSkeleton, DataStateBanner } from '../components/DataFetchState';
import { SimulationBanner } from '../components/SimulationBanner';
interface DispatchOptimizationProps {
  onNavigate: (page: Page) => void;
}

type DispatchChartPoint = {
  time: string;
  solar: number;
  wind: number;
  battery: number;
  electrolyzer: number;
  demand: number;
};

const formatBucketLabel = (date: Date): string => `${date.getHours().toString().padStart(2, '0')}:00`;

const buildDispatchChartData = (readings: BackendReading[]): DispatchChartPoint[] => {
  if (!readings.length) {
    return ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'].map((time) => ({
      time,
      solar: 0,
      wind: 0,
      battery: 0,
      electrolyzer: 0,
      demand: 0
    }));
  }

  const buckets = new Map<string, {
    count: number;
    power: number;
    inverterPower: number;
    curtailment: number;
  }>();

  readings.forEach((reading) => {
    const date = new Date(reading.timestamp);
    const bucketHour = Math.floor(date.getHours() / 4) * 4;
    date.setHours(bucketHour, 0, 0, 0);
    const key = formatBucketLabel(date);
    const current = buckets.get(key) ?? {
      count: 0,
      power: 0,
      inverterPower: 0,
      curtailment: 0
    };
    current.count += 1;
    current.power += reading.power;
    current.inverterPower += reading.inverterPower ?? reading.power * 0.75;
    current.curtailment += reading.curtailment ?? 0;
    buckets.set(key, current);
  });

  const orderedLabels = ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'];
  return orderedLabels.map((label) => {
    const bucket = buckets.get(label);
    if (!bucket || bucket.count === 0) {
      return {
        time: label,
        solar: 0,
        wind: 0,
        battery: 0,
        electrolyzer: 0,
        demand: 0
      };
    }

    const avgPower = bucket.power / bucket.count;
    const avgInverter = bucket.inverterPower / bucket.count;
    const avgCurtailment = bucket.curtailment / bucket.count;
    const hour = Number(label.slice(0, 2));
    const solarShare = hour >= 8 && hour <= 18 ? 0.62 : 0.08;
    const windShare = 1 - solarShare;

    return {
      time: label,
      solar: Number((avgPower * solarShare).toFixed(1)),
      wind: Number((avgPower * windShare).toFixed(1)),
      battery: Number(((avgInverter - avgPower) * 0.5).toFixed(1)),
      electrolyzer: Number((avgInverter * 0.25).toFixed(1)),
      demand: Number((avgPower + avgCurtailment * 0.8).toFixed(1))
    };
  });
};

export function DispatchOptimization({
  onNavigate
}: DispatchOptimizationProps) {
  const { submitPrompt } = usePilotStore();
  const [readings, setReadings] = useState<BackendReading[]>([]);
  const [recommendations, setRecommendations] = useState<DispatchRecommendation[]>([]);
  const [advisorySchedule, setAdvisorySchedule] = useState<AdvisoryDispatchInterval[]>([]);
  const [advisoryMeta, setAdvisoryMeta] = useState<{
    improvementVsBaseline: number;
    objectiveValue: number;
    baselineObjectiveValue: number;
    provenanceLabel: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const plantId =
    (import.meta.env.VITE_DEMO_PLANT_ID as string | undefined) ?? 'plant-upington-pv-demo';
  const bessAssetId =
    (import.meta.env.VITE_DEMO_BESS_ASSET_ID as string | undefined) ?? 'asset-upington-bess-sim';
  const electrolyserAssetId =
    (import.meta.env.VITE_DEMO_ELECTROLYSER_ASSET_ID as string | undefined) ??
    'asset-upington-electrolyser-sim';
  const handleRetry = () => {
    setError(null);
    setLoading(true);
    setRefreshKey((prev) => prev + 1);
  };

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [readingRows, recommendationRows] = await Promise.all([
          fetchReadings({ limit: 300, sort: 'desc' }),
          fetchDispatchRecommendations()
        ]);
        if (!mounted) return;
        setReadings(readingRows);
        setRecommendations(recommendationRows);

        try {
          const advisory = await createAdvisoryOptimisationRun({
            plantId,
            bessAssetId,
            electrolyserAssetId,
            objective: 'max_net_benefit_advisory'
          });
          if (!mounted) return;
          setAdvisorySchedule(advisory.schedules ?? []);
          const baseline = advisory.baselineComparison ?? advisory.result?.baselineComparison;
          setAdvisoryMeta({
            improvementVsBaseline: baseline?.deltaZar ?? advisory.expectedBenefitZar ?? 0,
            objectiveValue: baseline?.optimisedObjectiveZar ?? advisory.result?.objectiveValueZar ?? 0,
            baselineObjectiveValue: baseline?.baselineObjectiveZar ?? 0,
            provenanceLabel: advisory.advisoryLabel ?? 'advisory_simulated'
          });
        } catch {
          // Demo assets may be absent before seed — fall back to reading-derived chart.
        }
        setError(null);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load dispatch data.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();
    const intervalId = setInterval(() => {
      void load();
    }, 20000);

    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, [refreshKey, plantId, bessAssetId, electrolyserAssetId]);

  const dispatchData = useMemo(() => {
    if (advisorySchedule.length > 0) {
      const byStart = new Map<string, AdvisoryDispatchInterval[]>();
      for (const row of advisorySchedule) {
        const key = row.intervalStart;
        const list = byStart.get(key) ?? [];
        list.push(row);
        byStart.set(key, list);
      }
      return [...byStart.entries()].map(([intervalStart, rows]) => {
        const bess = rows.find((r) => r.assetId.includes('bess'));
        const ely = rows.find((r) => r.assetId.includes('electrolyser'));
        return {
          time: new Date(intervalStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          solar: Number(bess?.expectedValue ?? 0),
          wind: 0,
          battery: Number(bess?.targetValue ?? 0),
          electrolyzer: Number(ely?.targetValue ?? 0),
          demand: Number((bess?.expectedValue ?? 0) + (ely?.targetValue ?? 0))
        };
      });
    }
    return buildDispatchChartData(readings);
  }, [advisorySchedule, readings]);
  const avgDemand = useMemo(() => {
    if (!dispatchData.length) return 0;
    return dispatchData.reduce((sum, point) => sum + point.demand, 0) / dispatchData.length;
  }, [dispatchData]);
  const baselineRevenue = useMemo(
    () => advisoryMeta?.baselineObjectiveValue ?? avgDemand * 1450,
    [advisoryMeta, avgDemand]
  );
  const optimizedRevenue = useMemo(
    () => advisoryMeta?.objectiveValue ?? baselineRevenue * 1.12,
    [advisoryMeta, baselineRevenue]
  );

  return (
    <div className="space-y-6 p-6 pb-20">
      <SimulationBanner
        featureName="Dispatch optimisation / flexible-asset advisory"
        detail="Schedules are advisory only. BESS/electrolyser limits are configured assumptions, not measured plant state. Approve proposes only — physical execution remains disabled."
      />
      {advisoryMeta &&
      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-xs text-emerald-100">
          Advisory improvement vs no-action baseline:{' '}
          <span className="font-semibold">R {advisoryMeta.improvementVsBaseline.toFixed(2)}</span>
          {' '}· {advisoryMeta.provenanceLabel}
        </div>
      }
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">
            Dispatch Optimization
          </h2>
          <p className="text-slate-400">
            Advisory schedules for generation and storage assets (simulated / estimated)
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => onNavigate('dispatch-status')}
            className="flex items-center px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors">

            <Battery className="w-4 h-4 mr-2" />
            View Asset Status
          </button>
          <div className="bg-slate-800 px-4 py-2 rounded-lg border border-slate-700 flex items-center space-x-3">
            <span className="text-sm text-slate-400">Dispatch Mode:</span>
            <StatusBadge status="warning" label="Advisory Only" />
          </div>
        </div>
      </div>

      <DataStateBanner
        loading={loading}
        error={error}
        empty={!loading && !error && dispatchData.every((point) => point.demand === 0)}
        emptyMessage="No dispatch profile points are available yet."
        tone="operations"
        onRetry={handleRetry}
        retryLabel="Retry sync"
      />

      <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
        <PromptInput
          placeholder="Ask Zolt about advisory dispatch (proposal only)..."
          onSubmit={(prompt) => submitPrompt(prompt, 'dispatch')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-100">Advisory Dispatch Profile</h3>
            <StatusBadge status="warning" label="Simulated / Estimated" />
          </div>
          {loading ?
          <ChartSkeleton heightClass="h-80" /> :

          <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={dispatchData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="time" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#1e293b',
                    color: '#f1f5f9'
                  }} />

                  <Legend />
                  <Area type="monotone" dataKey="solar" stackId="1" fill="#f59e0b" stroke="#f59e0b" name="Solar (kW)" />
                  <Area type="monotone" dataKey="wind" stackId="1" fill="#38bdf8" stroke="#38bdf8" name="Wind (kW)" />
                  <Bar dataKey="battery" fill="#10b981" name="BESS setpoint (kW)" />
                  <Bar dataKey="electrolyzer" fill="#a855f7" name="Electrolyser setpoint (kW)" />
                  <Line type="monotone" dataKey="demand" stroke="#f43f5e" strokeWidth={2} name="Export / demand (kW)" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          }
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3">
              <p className="text-xs text-slate-400">No-action baseline (ZAR proxy)</p>
              <p className="text-lg font-semibold text-slate-100">R {baselineRevenue.toFixed(0)}</p>
            </div>
            <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3">
              <p className="text-xs text-slate-400">Advisory optimised (ZAR proxy)</p>
              <p className="text-lg font-semibold text-emerald-400">R {optimizedRevenue.toFixed(0)}</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center mb-4">
            <Zap className="w-5 h-5 text-amber-400 mr-2" />
            <h3 className="text-lg font-semibold text-slate-100">Advisory Recommendations</h3>
          </div>
          <div className="space-y-3">
            {loading && <ChartSkeleton heightClass="h-44" />}
            {!loading && recommendations.map((rec) =>
            <div
              key={rec.id}
              className="group bg-slate-950/50 border border-slate-800 rounded-lg p-4 hover:border-slate-700 transition-colors">

                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    {rec.type === 'curtailment' && <AlertTriangle className="w-4 h-4 text-amber-400" />}
                    {(rec.type as string) === 'storage' && <Battery className="w-4 h-4 text-emerald-400" />}
                    {(rec.type as string) === 'hydrogen' && <Droplet className="w-4 h-4 text-sky-400" />}
                    {(rec.type as string) === 'revenue' && <TrendingUp className="w-4 h-4 text-fuchsia-400" />}
                    <span className="text-sm font-medium text-slate-200">{rec.title}</span>
                  </div>
                  <StatusBadge
                  status={rec.status === 'approved' ? 'optimal' : 'warning'}
                  label={rec.status === 'approved' ? 'Reviewed' : 'Proposal'} />

                </div>
                <p className="text-xs text-slate-400 mb-3">{rec.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-emerald-400">{rec.impact}</span>
                  {rec.status === 'pending' &&
                <div className="flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="px-3 py-1 bg-emerald-500/80 hover:bg-emerald-600 text-white text-xs font-medium rounded transition-colors">
                        Propose only
                      </button>
                    </div>
                }
                </div>
              </div>
            )}
            {!loading && !recommendations.length &&
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 text-sm text-slate-400">
                No active dispatch recommendations are available right now.
              </div>
            }
          </div>

          <button
            onClick={() => onNavigate('all-recommendations')}
            className="w-full mt-6 flex items-center justify-center px-4 py-3 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors font-medium">

            <Play className="w-4 h-4 mr-2" />
            View All Recommendations
          </button>
        </motion.div>
      </div>
    </div>);

}
