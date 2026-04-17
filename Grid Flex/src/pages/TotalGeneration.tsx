import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Zap, Sun, Wind } from 'lucide-react';
import { motion } from 'framer-motion';
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
import { StatusBadge } from '../components/StatusBadge';
import { Page } from '../components/Sidebar';
import { fetchDashboardSummary, fetchNodes, fetchReadings, type BackendNode } from '../services/api';
import { ChartSkeleton, DataStateBanner } from '../components/DataFetchState';
interface TotalGenerationProps {
  onNavigate: (page: Page) => void;
}
export function TotalGeneration({ onNavigate }: TotalGenerationProps) {
  const [nodes, setNodes] = useState<BackendNode[]>([]);
  const [chartRows, setChartRows] = useState<Array<{time: string;solar: number;wind: number;total: number;}>>([]);
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof fetchDashboardSummary>> | null>(null);
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
        const [dashboard, backendNodes, readings] = await Promise.all([
          fetchDashboardSummary(),
          fetchNodes(),
          fetchReadings({ limit: 120, sort: 'asc' })
        ]);
        if (!active) return;
        setSummary(dashboard);
        setNodes(backendNodes);
        const rows = readings.slice(-12).map((row) => {
          const solar = (row.inverterPower ?? row.power * 0.75);
          const wind = Math.max(0, row.power - solar);
          return {
            time: new Date(row.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            solar: Number(solar.toFixed(1)),
            wind: Number(wind.toFixed(1)),
            total: Number(row.power.toFixed(1))
          };
        });
        setChartRows(rows);
        setError(null);
      } catch (err) {
        if (!active) return;
        setSummary(null);
        setNodes([]);
        setChartRows([]);
        setError(err instanceof Error ? err.message : 'Unable to load total generation data.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [refreshKey]);

  const currentOutput = summary?.averages.power ?? 0;
  const solarShare = summary && summary.averages.power > 0 ? (summary.averages.inverterPower / summary.averages.power) * 100 : 0;
  const windShare = 100 - solarShare;
  const assetRows = useMemo(
    () =>
      nodes.map((node) => ({
        name: node.name,
        type: node.location.toLowerCase().includes('wind') ? 'Wind' : 'Solar PV',
        cap: `${Math.round((node.lastReading?.power ?? 0) * 1.2)} MW`,
        curr: `${Math.round(node.lastReading?.power ?? 0)} MW`,
        status: node.status === 'online' ? 'optimal' : 'warning'
      })),
    [nodes]
  );

  return (
    <div className="space-y-6 p-6 pb-20">
      <div className="flex items-center space-x-4 mb-6">
        <button
          onClick={() => onNavigate('dashboard')}
          className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors">

          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-slate-100">
            Total Generation
          </h2>
          <p className="text-slate-400">
            Detailed breakdown of generation sources
          </p>
        </div>
      </div>

      <DataStateBanner
        loading={loading}
        error={error}
        empty={!loading && !error && chartRows.length === 0}
        emptyMessage="No generation mix points are available yet."
        tone="operations"
        onRetry={handleRetry}
        retryLabel="Retry sync"
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-sm">Current Output</span>
            <Zap className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-3xl font-bold text-slate-100">{Math.round(currentOutput)} MW</div>
          <div className="text-sm text-emerald-400 mt-1">+12% vs yesterday</div>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-sm">Solar Contribution</span>
            <Sun className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-3xl font-bold text-slate-100">{Math.round(summary?.averages.inverterPower ?? 0)} MW</div>
          <div className="text-sm text-slate-500 mt-1">{Math.max(0, Math.round(solarShare))}% of total</div>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-sm">Wind Contribution</span>
            <Wind className="w-4 h-4 text-cyan-500" />
          </div>
          <div className="text-3xl font-bold text-slate-100">{Math.max(0, Math.round(currentOutput - (summary?.averages.inverterPower ?? 0)))} MW</div>
          <div className="text-sm text-slate-500 mt-1">{Math.max(0, Math.round(windShare))}% of total</div>
        </div>
      </div>

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
          Generation Mix (24h)
        </h3>
        <div className="h-[400px] w-full">
          {loading ?
          <ChartSkeleton heightClass="h-[400px]" /> :
          !chartRows.length ?
          <div className="h-[400px] rounded-lg border border-slate-700 bg-slate-900/50 flex items-center justify-center text-sm text-slate-400">
              Generation mix chart will appear after readings sync.
            </div> :
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartRows}>
              <defs>
                <linearGradient id="colorSolar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorWind" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
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
                stroke="#f59e0b"
                fill="url(#colorSolar)"
                name="Solar PV" />

              <Area
                type="monotone"
                dataKey="wind"
                stackId="1"
                stroke="#06b6d4"
                fill="url(#colorWind)"
                name="Wind" />

            </AreaChart>
          </ResponsiveContainer>
          }
        </div>
      </motion.div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-700">
          <h3 className="text-lg font-semibold text-slate-100">
            Asset Performance
          </h3>
        </div>
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-slate-400 uppercase bg-slate-900/50">
            <tr>
              <th className="px-6 py-3">Asset Name</th>
              <th className="px-6 py-3">Type</th>
              <th className="px-6 py-3">Capacity</th>
              <th className="px-6 py-3">Current Output</th>
              <th className="px-6 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {assetRows.map((row, i) =>
            <tr key={i} className="hover:bg-slate-700/30 transition-colors">
                <td className="px-6 py-4 font-medium text-slate-200">
                  {row.name}
                </td>
                <td className="px-6 py-4 text-slate-400">{row.type}</td>
                <td className="px-6 py-4 text-slate-400">{row.cap}</td>
                <td className="px-6 py-4 text-emerald-400">{row.curr}</td>
                <td className="px-6 py-4">
                  <StatusBadge status={row.status as any} />
                </td>
              </tr>
            )}
            {!loading && !assetRows.length &&
            <tr>
                <td colSpan={5} className="px-6 py-6 text-center text-slate-400">
                  No asset performance rows are available yet.
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>);

}