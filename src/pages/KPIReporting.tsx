import React, { useEffect, useState, createElement } from 'react';
import { motion } from 'framer-motion';
import { Download, Calendar, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend } from
'recharts';
import { Page } from '../components/Sidebar';
import { auditLogger } from '../lib/auditLogger';
import { useAuth } from '../context/AuthContext';
import { ChartSkeleton, DataStateBanner } from '../components/DataFetchState';
import {
  fetchDashboardSummary,
  fetchESGMetrics,
  fetchReadingsSummary } from
'../services/api';
interface KPIReportingProps {
  onNavigate: (page: Page) => void;
}

type PerformancePoint = {
  period: string;
  revenue: number;
  curtailment: number;
  accuracy: number;
  energyKwh: number;
};

const TIME_RANGE_DAYS: Record<string, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  YTD: 180
};

const buildPerformanceData = (
dailyRows: Awaited<ReturnType<typeof fetchReadingsSummary>>,
averageCurtailment: number)
:
PerformancePoint[] => {
  const grouped = new Map<string, {
    energy: number;
    samples: number;
    avgPower: number;
  }>();

  dailyRows.forEach((row) => {
    const key = row.date.slice(0, 7);
    const current = grouped.get(key) ?? {
      energy: 0,
      samples: 0,
      avgPower: 0
    };
    current.energy += row.totalEnergyKwh;
    current.samples += row.samples;
    current.avgPower += row.avgPowerKw;
    grouped.set(key, current);
  });

  return Array.from(grouped.entries()).
  sort(([a], [b]) => a.localeCompare(b)).
  map(([period, value]) => {
    const avgPower = value.samples > 0 ? value.avgPower / Math.max(1, dailyRows.filter((row) => row.date.startsWith(period)).length) : 0;
    const revenue = (value.energy * 1.35) / 1000;
    const derivedCurtailment = Math.max(0.3, averageCurtailment + (avgPower > 0 ? 8 / avgPower : 0));
    const accuracy = Math.max(80, Math.min(99, 96 - derivedCurtailment));

    return {
      period,
      revenue: Number(revenue.toFixed(2)),
      curtailment: Number(derivedCurtailment.toFixed(2)),
      accuracy: Number(accuracy.toFixed(1)),
      energyKwh: Number(value.energy.toFixed(2))
    };
  });
};

export function KPIReporting({ onNavigate }: KPIReportingProps) {
  const { user } = useAuth();
  const [timeRange, setTimeRange] = useState('YTD');
  const [esgMetrics, setEsgMetrics] = useState<Awaited<ReturnType<typeof fetchESGMetrics>>>([]);
  const [performanceData, setPerformanceData] = useState<PerformancePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const handleRetry = () => {
    setError(null);
    setLoading(true);
    setRefreshKey((prev) => prev + 1);
  };
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const days = TIME_RANGE_DAYS[timeRange] ?? TIME_RANGE_DAYS.YTD;
        const now = new Date();
        const endDate = now.toISOString();
        const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
        const [metrics, dashboardSummary, dailySummary] = await Promise.all([
          fetchESGMetrics(),
          fetchDashboardSummary(),
          fetchReadingsSummary({ startDate, endDate })
        ]);
        if (!mounted) return;
        setEsgMetrics(metrics);
        setPerformanceData(buildPerformanceData(dailySummary, dashboardSummary.averages.curtailment));
        setError(null);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load KPI data.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    setLoading(true);
    void load();
    return () => {
      mounted = false;
    };
  }, [timeRange, refreshKey]);

  const handleExport = () => {
    // Generate CSV content
    const headers = ['Month', 'Revenue (M)', 'Curtailment (%)', 'Accuracy (%)'];
    const rows = performanceData.map((d) =>
    [d.period, d.revenue, d.curtailment, d.accuracy].join(',')
    );
    const esgHeaders = ['Metric', 'Value', 'Unit', 'Change (%)'];
    const esgRows = esgMetrics.map((m) =>
    [m.label, m.value, m.unit, m.changePercent].join(',')
    );
    const csvContent = [
    headers.join(','),
    ...rows,
    '',
    esgHeaders.join(','),
    ...esgRows].
    join('\n');
    // Create download link
    const blob = new Blob([csvContent], {
      type: 'text/csv'
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kpi-report-${timeRange.toLowerCase()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    // Audit log
    if (user) {
      auditLogger.log('EXPORT_KPI_REPORT', user.id, {
        timeRange
      });
    }
  };
  const totals = {
    revenue: performanceData.reduce((sum, row) => sum + row.revenue, 0),
    avgCurtailment: performanceData.length ?
      performanceData.reduce((sum, row) => sum + row.curtailment, 0) / performanceData.length :
      0,
    avgAccuracy: performanceData.length ?
      performanceData.reduce((sum, row) => sum + row.accuracy, 0) / performanceData.length :
      0,
    energyKwh: performanceData.reduce((sum, row) => sum + row.energyKwh, 0)
  };

  return (
    <div className="space-y-6 p-6 pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">KPI & Reporting</h2>
          <p className="text-slate-400">
            Performance tracking and financial analytics
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="bg-slate-800 p-1 rounded-lg border border-slate-700 flex space-x-1">
            {['7d', '30d', '90d', 'YTD'].map((range) =>
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${timeRange === range ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'}`}>

                {range}
              </button>
            )}
          </div>
          <button
            onClick={handleExport}
            className="flex items-center px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors">

            <Download className="w-4 h-4 mr-2" />
            Export Report
          </button>
        </div>
      </div>

      <DataStateBanner
        loading={loading}
        error={error}
        empty={!loading && !error && performanceData.length === 0 && esgMetrics.length === 0}
        emptyMessage="No KPI points are available for this time range."
        tone="analyst"
        onRetry={handleRetry}
        retryLabel="Retry analysis"
      />

      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-100">
            ESG Performance
          </h3>
          <span className="text-xs text-emerald-300 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">
            Carbon + Hydrogen
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {esgMetrics.map((metric) =>
          <div key={metric.key} className="bg-slate-900/50 border border-slate-700 rounded-lg p-4">
              <p className="text-xs text-slate-500 mb-1">{metric.label}</p>
              <p className="text-xl font-bold text-slate-100">
                {metric.value}
                <span className="text-sm text-slate-400 ml-1">{metric.unit}</span>
              </p>
              <p className={`text-xs mt-1 ${metric.changePercent >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {metric.changePercent >= 0 ? '+' : ''}
                {metric.changePercent}%
              </p>
            </div>
          )}
          {!loading && !esgMetrics.length &&
          <div className="text-sm text-slate-400 md:col-span-2 lg:col-span-4">
              ESG metrics are not available for this range yet.
            </div>
          }
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
        {
          label: 'Total Revenue',
          value: `R${totals.revenue.toFixed(2)}M`,
          change: loading ? '...' : '+ live',
          trend: 'up',
          target: 'revenue-detail' as Page
        },
        {
          label: 'Avg Curtailment',
          value: `${totals.avgCurtailment.toFixed(2)}%`,
          change: loading ? '...' : 'rolling',
          trend: 'down',
          target: 'curtailment-detail' as Page
        },
        {
          label: 'Forecast Accuracy',
          value: `${totals.avgAccuracy.toFixed(1)}%`,
          change: loading ? '...' : 'modelled',
          trend: 'up',
          target: 'forecast-accuracy' as Page
        },
        {
          label: 'Energy Processed',
          value: `${Math.round(totals.energyKwh).toLocaleString()} kWh`,
          change: loading ? '...' : 'selected range',
          trend: 'neutral',
          target: 'dispatch-status' as Page
        }].
        map((stat, i) =>
        <div
          key={i}
          onClick={() => onNavigate(stat.target)}
          className="bg-slate-800 border border-slate-700 rounded-xl p-5 cursor-pointer hover:border-slate-600 transition-colors group">

            <p className="text-sm text-slate-400 font-medium mb-1 group-hover:text-slate-300 transition-colors">
              {stat.label}
            </p>
            <div className="flex items-end justify-between">
              <h3 className="text-2xl font-bold text-slate-100">
                {stat.value}
              </h3>
              <div
              className={`flex items-center text-xs font-medium px-2 py-1 rounded-full ${
              stat.trend === 'up' ?
              'bg-emerald-500/10 text-emerald-400' :
              stat.trend === 'down' ?
              'bg-emerald-500/10 text-emerald-400' :
              // Down is good for curtailment, handled simply here
              'bg-slate-700 text-slate-300'}`
              }>

                {stat.trend === 'up' ?
              <ArrowUpRight className="w-3 h-3 mr-1" /> :

              <ArrowDownRight className="w-3 h-3 mr-1" />
              }
                {stat.change}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <motion.div
          initial={{
            opacity: 0,
            y: 20
          }}
          animate={{
            opacity: 1,
            y: 0
          }}
          onClick={() => onNavigate('revenue-detail')}
          className="bg-slate-800 border border-slate-700 rounded-xl p-6 cursor-pointer hover:border-slate-600 transition-colors">

          <h3 className="text-lg font-semibold text-slate-100 mb-6">
            Revenue Performance (ZAR Millions)
          </h3>
          <div className="h-[300px] w-full">
            {loading ?
            <ChartSkeleton heightClass="h-[300px]" /> :
            !performanceData.length ?
            <div className="h-[300px] rounded-lg border border-slate-700 bg-slate-900/50 flex items-center justify-center text-sm text-slate-400">
                Revenue trend will appear once KPI aggregates are available.
              </div> :
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={performanceData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#334155"
                  vertical={false} />

                <XAxis
                  dataKey="period"
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
                  cursor={{
                    fill: '#334155',
                    opacity: 0.2
                  }}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    color: '#f1f5f9'
                  }} />

                <Bar
                  dataKey="revenue"
                  fill="#10b981"
                  radius={[4, 4, 0, 0]}
                  name="Revenue" />

              </BarChart>
            </ResponsiveContainer>
            }
          </div>
        </motion.div>

        {/* Curtailment Chart */}
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
          onClick={() => onNavigate('curtailment-detail')}
          className="bg-slate-800 border border-slate-700 rounded-xl p-6 cursor-pointer hover:border-slate-600 transition-colors">

          <h3 className="text-lg font-semibold text-slate-100 mb-6">
            Curtailment Rate (%)
          </h3>
          <div className="h-[300px] w-full">
            {loading ?
            <ChartSkeleton heightClass="h-[300px]" /> :
            !performanceData.length ?
            <div className="h-[300px] rounded-lg border border-slate-700 bg-slate-900/50 flex items-center justify-center text-sm text-slate-400">
                Curtailment trend will appear once KPI aggregates are available.
              </div> :
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={performanceData}>
                <defs>
                  <linearGradient
                    id="colorCurtailment"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1">

                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#334155"
                  vertical={false} />

                <XAxis
                  dataKey="period"
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
                  }} />

                <Area
                  type="monotone"
                  dataKey="curtailment"
                  stroke="#f59e0b"
                  fillOpacity={1}
                  fill="url(#colorCurtailment)"
                  name="Curtailment %" />

                <Line
                  type="monotone"
                  dataKey="curtailment"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={true} />

              </AreaChart>
            </ResponsiveContainer>
            }
          </div>
        </motion.div>
      </div>

      {/* Detailed Table */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-700">
          <h3 className="text-lg font-semibold text-slate-100">
            Monthly Breakdown
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-400 uppercase bg-slate-900/50">
              <tr>
                <th className="px-6 py-3">Month</th>
                <th className="px-6 py-3">Revenue (ZAR)</th>
                <th className="px-6 py-3">Curtailment</th>
                <th className="px-6 py-3">Forecast Accuracy</th>
                <th className="px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {performanceData.map((row, i) =>
              <tr key={i} className="hover:bg-slate-700/30 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-200">
                    {row.period}
                  </td>
                  <td className="px-6 py-4 text-emerald-400">
                    R{row.revenue.toFixed(2)}M
                  </td>
                  <td className="px-6 py-4 text-amber-400">
                    {row.curtailment}%
                  </td>
                  <td className="px-6 py-4 text-cyan-400">{row.accuracy}%</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      On Track
                    </span>
                  </td>
                </tr>
              )}
              {!loading && !performanceData.length &&
              <tr>
                  <td colSpan={5} className="px-6 py-6 text-center text-slate-400">
                    No monthly KPI rows are available for this range.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>);

}
