import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, DollarSign, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer } from
'recharts';
import { Page } from '../components/Sidebar';
import { fetchDashboardSummary, fetchReadings } from '../services/api';
import { ChartSkeleton, DataStateBanner } from '../components/DataFetchState';
interface RevenueDetailProps {
  onNavigate: (page: Page) => void;
}
export function RevenueDetail({ onNavigate }: RevenueDetailProps) {
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof fetchDashboardSummary>> | null>(null);
  const [rows, setRows] = useState<Array<{time: string;value: number;}>>([]);
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
        const [dashboard, readings] = await Promise.all([
          fetchDashboardSummary(),
          fetchReadings({ limit: 120, sort: 'asc' })
        ]);
        if (!active) return;
        setSummary(dashboard);
        setRows(
          readings.slice(-12).map((reading) => ({
            time: new Date(reading.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            value: Number((reading.power * 1.25).toFixed(1))
          }))
        );
        setError(null);
      } catch (err) {
        if (!active) return;
        setSummary(null);
        setRows([]);
        setError(err instanceof Error ? err.message : 'Unable to load revenue analytics.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [refreshKey]);

  const revenueToday = useMemo(
    () => rows.reduce((sum, row) => sum + row.value, 0),
    [rows]
  );
  const avgPrice = useMemo(
    () => (summary?.averages.power ? 1250 + summary.averages.curtailment * 40 : 0),
    [summary]
  );
  const projected = useMemo(() => revenueToday * 30, [revenueToday]);

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
            Revenue Analysis
          </h2>
          <p className="text-slate-400">
            Financial performance and projections
          </p>
        </div>
      </div>

      <DataStateBanner
        loading={loading}
        error={error}
        empty={!loading && !error && rows.length === 0}
        emptyMessage="No intraday revenue points are available yet."
        tone="analyst"
        onRetry={handleRetry}
        retryLabel="Retry analysis"
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-sm">Revenue Today</span>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-3xl font-bold text-slate-100">R{(revenueToday / 1000).toFixed(2)}M</div>
          <div className="text-sm text-emerald-400 mt-1">
            +R150k vs forecast
          </div>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-sm">Avg Price / MWh</span>
            <TrendingUp className="w-4 h-4 text-cyan-500" />
          </div>
          <div className="text-3xl font-bold text-slate-100">R{Math.round(avgPrice).toLocaleString()}</div>
          <div className="text-sm text-slate-500 mt-1">Peak: R{Math.round(avgPrice * 2.2).toLocaleString()}</div>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-sm">Projected (Month)</span>
            <DollarSign className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-3xl font-bold text-slate-100">R{(projected / 1000).toFixed(1)}M</div>
          <div className="text-sm text-emerald-400 mt-1">On track</div>
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
          Intraday Revenue Profile
        </h3>
        <div className="h-[400px] w-full">
          {loading ?
          <ChartSkeleton heightClass="h-[400px]" /> :
          !rows.length ?
          <div className="h-[400px] rounded-lg border border-slate-700 bg-slate-900/50 flex items-center justify-center text-sm text-slate-400">
              Revenue profile will appear when new dispatch intervals are available.
            </div> :
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={rows}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
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
                tickFormatter={(val) => `R${val}k`} />

              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  color: '#f1f5f9'
                }}
                itemStyle={{
                  color: '#f1f5f9'
                }}
                formatter={(val) => [`R${val}k`, 'Revenue']} />

              <Area
                type="monotone"
                dataKey="value"
                stroke="#10b981"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorRevenue)" />

            </AreaChart>
          </ResponsiveContainer>
          }
        </div>
      </motion.div>
    </div>);

}