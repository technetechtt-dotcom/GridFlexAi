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
  const plantId = import.meta.env.VITE_DEMO_PLANT_ID as string | undefined;
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

        if (plantId) {
          try {
            const advisory = await createAdvisoryOptimisationRun(plantId, {
              objective: 'balanced_advisory',
              horizonHours: 6,
              intervalMinutes: 60
            });
            if (!mounted) return;
            setAdvisorySchedule(advisory.schedules);
            setAdvisoryMeta({
              improvementVsBaseline: advisory.result.improvementVsBaseline,
              objectiveValue: advisory.result.objectiveValue,
              baselineObjectiveValue: advisory.result.baselineObjectiveValue,
              provenanceLabel: advisory.result.provenanceLabel
            });
          } catch {
            // Demo plant may be absent — fall back to reading-derived chart.
          }
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
  }, [refreshKey, plantId]);

  const dispatchData = useMemo(() => {
    if (advisorySchedule.length > 0) {
      return advisorySchedule.map((row) => ({
        time: new Date(row.intervalStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        solar: row.solarAvailableKw,
        wind: 0,
        battery: row.bessChargeKw - row.bessDischargeKw,
        electrolyzer: row.electrolyserKw,
        demand: row.gridExportKw
      }));
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
        detail="Schedules are advisory_simulated. BESS/electrolyser limits are configured assumptions, not measured plant state. Approve proposes only — physical execution remains disabled."
      />
      {advisoryMeta &&
      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-xs text-emerald-100">
          Advisory improvement vs no-action baseline:{' '}
          <span className="font-semibold">{advisoryMeta.improvementVsBaseline.toFixed(2)}</span>
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

      {/* AI Prompt */}
      <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
        <PromptInput
          onSubmit={(val) => {
            submitPrompt(val, 'dispatch');
            // In a real app, we'd show a toast here
          }}
          placeholder="Ask for dispatch advice (e.g., 'Optimize dispatch for Upington considering battery SOC at 45%')"
          templates={[
          {
            label: 'Optimize Battery',
            prompt:
            'Suggest battery schedule for next 24h to maximize revenue'
          },
          {
            label: 'Curtailment Strategy',
            prompt: 'How to minimize curtailment at De Aar today?'
          }]
          } />

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Charts */}
        <div className="lg:col-span-2 space-y-6">
          {/* Main Dispatch Chart */}
          <motion.div
            initial={{
              opacity: 0,
              y: 20
            }}
            animate={{
              opacity: 1,
              y: 0
            }}
            className="bg-slate-800 border border-slate-700 rounded-xl p-6">

            <h3 className="text-lg font-semibold text-slate-100 mb-6">
              Generation & Dispatch Mix
            </h3>
            <div className="h-[400px] w-full">
              {loading ?
              <ChartSkeleton heightClass="h-[400px]" /> :
              !dispatchData.length || dispatchData.every((point) => point.demand === 0) ?
              <div className="h-[400px] rounded-lg border border-slate-700 bg-slate-900/50 flex items-center justify-center text-sm text-slate-400">
                  Dispatch mix chart will appear after telemetry sync.
                </div> :
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={dispatchData}>
                  <defs>
                    <linearGradient
                      id="colorElectrolyzer"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1">

                      <stop offset="5%" stopColor="#a855f7" stopOpacity={0.6} />
                      <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#334155"
                    vertical={false} />

                  <XAxis
                    dataKey="time"
                    stroke="#94a3b8"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false} />

                  <YAxis
                    stroke="#94a3b8"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false} />

                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      color: '#f1f5f9'
                    }}
                    itemStyle={{
                      color: '#f1f5f9'
                    }} />

                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="solar"
                    stackId="1"
                    fill="#10b981"
                    stroke="#10b981"
                    fillOpacity={0.6}
                    name="Solar PV" />

                  <Area
                    type="monotone"
                    dataKey="wind"
                    stackId="1"
                    fill="#06b6d4"
                    stroke="#06b6d4"
                    fillOpacity={0.6}
                    name="Wind" />

                  <Area
                    type="monotone"
                    dataKey="electrolyzer"
                    stackId="1"
                    fill="url(#colorElectrolyzer)"
                    stroke="#a855f7"
                    fillOpacity={0.6}
                    name="Electrolyzer Load" />

                  <Bar
                    dataKey="battery"
                    fill="#f59e0b"
                    name="Battery Flow (+Chg/-Dis)" />

                  <Line
                    type="monotone"
                    dataKey="demand"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={false}
                    name="Grid Demand" />

                </ComposedChart>
              </ResponsiveContainer>
              }
            </div>
          </motion.div>

          {/* Revenue Impact */}
          <motion.div
            initial={{
              opacity: 0,
              y: 20
            }}
            animate={{
              opacity: 1,
              y: 0
            }}
            transition={{
              delay: 0.1
            }}
            onClick={() => onNavigate('revenue-detail')}
            className="bg-slate-800 border border-slate-700 rounded-xl p-6 cursor-pointer hover:border-slate-600 transition-colors group">

            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-slate-100">
                Revenue Optimization
              </h3>
              <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition-colors" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                <p className="text-sm text-slate-400 mb-1">Baseline Revenue</p>
                <p className="text-2xl font-bold text-slate-300">R{(baselineRevenue / 1_000_000).toFixed(2)}M</p>
              </div>
              <div className="bg-emerald-500/10 p-4 rounded-lg border border-emerald-500/20">
                <p className="text-sm text-emerald-400 mb-1">
                  Optimized Revenue
                </p>
                <p className="text-2xl font-bold text-emerald-400">R{(optimizedRevenue / 1_000_000).toFixed(2)}M</p>
                <p className="text-xs text-emerald-500 mt-1">+12.0% uplift</p>
              </div>
              <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                <p className="text-sm text-slate-400 mb-1">Avoided Penalties</p>
                <p className="text-2xl font-bold text-slate-300">R{Math.round(avgDemand * 35).toLocaleString()}</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Right: Recommendations */}
        <div className="space-y-6">
          <motion.div
            initial={{
              opacity: 0,
              x: 20
            }}
            animate={{
              opacity: 1,
              x: 0
            }}
            transition={{
              delay: 0.2
            }}
            className="bg-slate-800 border border-slate-700 rounded-xl p-6 h-full">

            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-slate-100">
                AI Recommendations
              </h3>
              <span className="text-xs text-slate-400">{loading ? 'Refreshing...' : 'Live backend feed'}</span>
            </div>

            <div className="space-y-4">
              {recommendations.map((rec) =>
              <div
                key={rec.id}
                className="bg-slate-900 border border-slate-700 rounded-lg p-4 hover:border-slate-600 transition-all group">

                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center space-x-2">
                      {rec.type === 'curtailment' &&
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    }
                      {rec.type === 'battery' &&
                    <Battery className="w-4 h-4 text-emerald-500" />
                    }
                      {rec.type === 'dispatch' &&
                    <Zap className="w-4 h-4 text-cyan-500" />
                    }
                      {rec.type === 'hyshift' &&
                    <Droplet className="w-4 h-4 text-purple-500" />
                    }
                      <span className="font-medium text-slate-200 text-sm">
                        {rec.title}
                      </span>
                    </div>
                    {rec.status === 'approved' ?
                  <span className="text-xs text-emerald-500 flex items-center">
                        <Check className="w-3 h-3 mr-1" /> Approved
                      </span> :

                  <span className="text-xs text-slate-500">Pending</span>
                  }
                  </div>

                  <p className="text-sm text-slate-400 mb-3">
                    {rec.description}
                  </p>

                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-emerald-400">
                      {rec.impact}
                    </span>
                    {rec.status === 'pending' &&
                  <div className="flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200">
                          <span className="sr-only">Dismiss</span>
                          <ArrowRight className="w-4 h-4 rotate-180" />
                        </button>
                        <button className="px-3 py-1 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium rounded transition-colors">
                          Approve
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
      </div>
    </div>);

}