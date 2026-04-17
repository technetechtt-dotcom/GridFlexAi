import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Droplet,
  Zap,
  Wind,
  Sun,
  Activity,
  ArrowRight,
  Settings,
  AlertTriangle,
  CheckCircle2,
  TrendingDown } from
'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend } from
'recharts';
import { Page } from '../components/Sidebar';
import { KPICard } from '../components/KPICard';
import { StatusBadge } from '../components/StatusBadge';
import { PromptInput } from '../components/PromptInput';
import { cn } from '../lib/utils';
import { usePilotStore } from '../store/pilotStore';
import { ChartSkeleton, DataStateBanner } from '../components/DataFetchState';
import {
  fetchHydrogenTwinState,
  fetchReadings,
  type BackendReading } from
'../services/api';
interface HyShiftControlProps {
  onNavigate: (page: Page) => void;
}
type FlowPoint = {
  time: string;
  solar: number;
  wind: number;
  grid: number;
  electrolyzer: number;
};

const buildFlowData = (rows: BackendReading[], loadPercent: number): FlowPoint[] => {
  const sorted = [...rows].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  const buckets = sorted.slice(-7);
  const rampFactor = loadPercent / 65;
  return buckets.map((row) => {
    const basePower = row.power;
    const inverter = row.inverterPower ?? basePower * 0.85;
    const solarShare = basePower > 0 ? Math.min(0.9, Math.max(0.1, inverter / Math.max(basePower, 1))) : 0.5;
    const solar = basePower * solarShare;
    const wind = Math.max(0, basePower - solar);
    const electrolyzer = Math.max(0, inverter * 0.65 * rampFactor);
    const grid = Number((basePower - electrolyzer).toFixed(1));

    return {
      time: new Date(row.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      solar: Number(solar.toFixed(1)),
      wind: Number(wind.toFixed(1)),
      grid,
      electrolyzer: Number(electrolyzer.toFixed(1))
    };
  });
};

export function HyShiftControl({ onNavigate }: HyShiftControlProps) {
  const { submitPrompt } = usePilotStore();
  const [mode, setMode] = useState<'excess' | 'arbitrage' | 'ancillary'>(
    'excess'
  );
  const [rampRate, setRampRate] = useState(65);
  const [twinState, setTwinState] = useState<Awaited<ReturnType<typeof fetchHydrogenTwinState>> | null>(null);
  const [flowRows, setFlowRows] = useState<FlowPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const handleRetry = () => {
    setError(null);
    setLoading(true);
    setRefreshKey((prev) => prev + 1);
  };
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [nextTwin, readings] = await Promise.all([
          fetchHydrogenTwinState(),
          fetchReadings({ limit: 84, sort: 'desc' })
        ]);
        if (!active) return;
        setTwinState(nextTwin);
        setFlowRows(buildFlowData(readings, rampRate));
        setMode(nextTwin.mode);
        setError(null);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to load HyShift telemetry.');
        setFlowRows([]);
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [refreshKey]);
  const chartData = useMemo(() => {
    return flowRows.map((row) => ({
      ...row,
      electrolyzer: Math.round(row.electrolyzer * (rampRate / 65)),
      grid: Math.round(row.grid - row.electrolyzer * ((rampRate / 65) - 1))
    }));
  }, [flowRows, rampRate]);
  return (
    <div className="space-y-6 p-6 pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 flex items-center">
            <Droplet className="w-6 h-6 mr-3 text-cyan-400" />
            HyShift Control Center
          </h2>
          <p className="text-slate-400">
            Green Hydrogen Electrolyzer Optimization & Dispatch
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="bg-slate-800 px-4 py-2 rounded-lg border border-slate-700 flex items-center space-x-3">
            <span className="text-sm text-slate-400">System Status:</span>
            <StatusBadge status="active" label="Production Mode" />
          </div>
          <button className="flex items-center px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 hover:bg-red-500/20 transition-colors">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Emergency Stop
          </button>
        </div>
      </div>

      <DataStateBanner
        loading={loading}
        error={error}
        empty={!loading && !error && chartData.length === 0}
        emptyMessage="No hydrogen dispatch readings found yet."
        tone="operations"
        onRetry={handleRetry}
        retryLabel="Reconnect"
      />

      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Current LCOH"
          value={`R${(twinState?.lcohZarPerKg ?? 45.2).toFixed(2)}`}
          unit="/kg"
          trend="down"
          trendValue="R2.10"
          icon={TrendingDown}
          accentColor="emerald"
          delay={0.1} />

        <KPICard
          title="H2 Production Rate"
          value={Math.round(twinState?.productionKgPerHour ?? 420).toString()}
          unit="kg/h"
          trend="up"
          trendValue="15%"
          icon={Droplet}
          accentColor="cyan"
          delay={0.2} />

        <KPICard
          title="System Efficiency"
          value={(twinState?.efficiencyKwhPerKg ?? 52.4).toFixed(1)}
          unit="kWh/kg"
          trend="neutral"
          trendValue="0.1"
          icon={Zap}
          accentColor="purple"
          delay={0.3} />

        <KPICard
          title="Water Usage"
          value={Math.round(twinState?.productionKgPerHour ? twinState.productionKgPerHour * 8.6 : 0).toLocaleString()}
          unit="L/h"
          trend="up"
          trendValue="120L"
          icon={Activity}
          accentColor="amber"
          delay={0.4} />

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Control Panel & Stats */}
        <div className="space-y-6">
          {/* Control Panel */}
          <motion.div
            initial={{
              opacity: 0,
              x: -20
            }}
            animate={{
              opacity: 1,
              x: 0
            }}
            transition={{
              delay: 0.2
            }}
            className="bg-slate-800 border border-slate-700 rounded-xl p-6">

            <div className="flex items-center space-x-2 mb-6">
              <Settings className="w-5 h-5 text-emerald-500" />
              <h3 className="text-lg font-semibold text-slate-100">
                Grid-Responsive Control
              </h3>
            </div>

            <div className="space-y-6">
              <div>
                <label className="text-sm font-medium text-slate-300 mb-3 block">
                  Optimization Strategy
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {[
                  {
                    id: 'excess',
                    label: 'Follow Renewable Excess',
                    desc: 'Maximize use of curtailed solar/wind'
                  },
                  {
                    id: 'arbitrage',
                    label: 'Price Arbitrage',
                    desc: 'Produce when grid prices are lowest'
                  },
                  {
                    id: 'ancillary',
                    label: 'Ancillary Services',
                    desc: 'Provide frequency support to grid'
                  }].
                  map((option) =>
                  <button
                    key={option.id}
                    onClick={() => setMode(option.id as any)}
                    className={cn(
                      'flex flex-col items-start p-3 rounded-lg border transition-all text-left',
                      mode === option.id ?
                      'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' :
                      'bg-slate-900/50 border-slate-700 text-slate-400 hover:border-slate-600'
                    )}>

                      <span className="font-medium text-sm">
                        {option.label}
                      </span>
                      <span className="text-xs opacity-70">{option.desc}</span>
                    </button>
                  )}
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm font-medium text-slate-300">
                    Dynamic Load Setpoint
                  </label>
                  <span className="text-sm text-emerald-400 font-mono">
                    {rampRate}% ({Math.round(rampRate * 5)} MW)
                  </span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  step="1"
                  value={rampRate}
                  onChange={(e) => setRampRate(Number(e.target.value))}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500" />

                <div className="flex justify-between mt-1 text-xs text-slate-500">
                  <span>Min (10%)</span>
                  <span>Max (100%)</span>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-700 space-y-3">
                <h4 className="text-sm font-medium text-slate-300">
                  Digital Twin State
                </h4>
                <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700 text-xs text-slate-300 space-y-1.5">
                  <p>Type: <span className="text-cyan-300">{twinState?.electrolyzerType ?? 'PEM'}</span></p>
                  <p>Renewable share: <span className="text-emerald-300">{twinState?.renewableSharePercent ?? 0}%</span></p>
                  <p>Grid price: <span className="text-amber-300">R{(twinState?.gridPriceZarPerKwh ?? 0).toFixed(2)}/kWh</span></p>
                  <p>Load-shedding risk: <span className={`${twinState?.predictedLoadsheddingRisk === 'high' ? 'text-red-300' : twinState?.predictedLoadsheddingRisk === 'medium' ? 'text-amber-300' : 'text-emerald-300'}`}>{twinState?.predictedLoadsheddingRisk ?? 'low'}</span></p>
                </div>
                <button
                  onClick={() => onNavigate('sector-coupling')}
                  className="w-full flex items-center justify-center px-3 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-sm font-medium rounded-lg border border-cyan-500/30 transition-colors">
                  Open Sector Coupling Simulator <ArrowRight className="w-4 h-4 ml-2" />
                </button>
              </div>
            </div>
          </motion.div>

          {/* Daily Stats */}
          <motion.div
            initial={{
              opacity: 0,
              x: -20
            }}
            animate={{
              opacity: 1,
              x: 0
            }}
            transition={{
              delay: 0.3
            }}
            className="bg-slate-800 border border-slate-700 rounded-xl p-6">

            <h3 className="text-lg font-semibold text-slate-100 mb-4">
              Daily Performance
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                <span className="text-slate-400 text-sm">
                  H2 Produced Today
                </span>
                <span className="text-slate-200 font-bold">3,450 kg</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                <span className="text-slate-400 text-sm">CO₂ Avoided</span>
                <span className="text-emerald-400 font-bold">28.5 tons</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                <span className="text-slate-400 text-sm">
                  Curtailed Energy Captured
                </span>
                <span className="text-amber-400 font-bold">145 MWh</span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Right Column: Charts & AI */}
        <div className="lg:col-span-2 space-y-6">
          {/* Power Flow Chart */}
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
              delay: 0.4
            }}
            className="bg-slate-800 border border-slate-700 rounded-xl p-6">

            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-slate-100">
                Real-time Power Flow Dispatch
              </h3>
              <div className="flex space-x-4 text-xs">
                <span className="flex items-center text-slate-400">
                  <Sun className="w-3 h-3 mr-1 text-amber-500" /> Solar
                </span>
                <span className="flex items-center text-slate-400">
                  <Wind className="w-3 h-3 mr-1 text-cyan-500" /> Wind
                </span>
                <span className="flex items-center text-slate-400">
                  <Droplet className="w-3 h-3 mr-1 text-purple-500" />{' '}
                  Electrolyzer
                </span>
              </div>
            </div>
            <div className="h-[350px] w-full">
              {loading ?
              <ChartSkeleton heightClass="h-[350px]" /> :
              !chartData.length ?
              <div className="h-[350px] rounded-lg border border-slate-700 bg-slate-900/50 flex items-center justify-center text-sm text-slate-400">
                  Waiting for flow telemetry...
                </div> :
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorSolar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorWind" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorH2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
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
                    axisLine={false}
                    tickFormatter={(val) => `${val} MW`} />

                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      color: '#f1f5f9'
                    }} />

                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="solar"
                    stackId="1"
                    stroke="#f59e0b"
                    fill="url(#colorSolar)"
                    name="Solar Input" />

                  <Area
                    type="monotone"
                    dataKey="wind"
                    stackId="1"
                    stroke="#06b6d4"
                    fill="url(#colorWind)"
                    name="Wind Input" />

                  <Area
                    type="monotone"
                    dataKey="electrolyzer"
                    stackId="2"
                    stroke="#a855f7"
                    fill="url(#colorH2)"
                    name="H2 Load" />

                </AreaChart>
              </ResponsiveContainer>
              }
            </div>
          </motion.div>

          {/* AI Prompt */}
          <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
            <PromptInput
              onSubmit={(val) => submitPrompt(val, 'hyshift')}
              placeholder="Ask HyShift AI (e.g., 'Optimize ramp rate for upcoming wind gust')"
              templates={[
              {
                label: 'Optimize Efficiency',
                prompt:
                'Adjust setpoints to maximize kWh/kg efficiency given current temp'
              },
              {
                label: 'Forecast H2',
                prompt:
                'Predict H2 production for next 24h based on weather forecast'
              },
              {
                label: 'Maintenance Check',
                prompt:
                'Analyze stack voltage deviation for potential degradation'
              }]
              } />

          </div>
        </div>
      </div>
    </div>);

}
