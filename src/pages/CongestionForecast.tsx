import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Calendar,
  Filter,
  Download,
  ArrowLeft,
  ArrowRight,
  Activity,
  Droplet } from
'lucide-react';
import { HeatmapGrid } from '../components/HeatmapGrid';
import { PromptInput } from '../components/PromptInput';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer } from
'recharts';
import { Page } from '../components/Sidebar';
import { usePilotStore } from '../store/pilotStore';
import { fetchCongestionNodes, fetchDynamicLineRatings, fetchForecast } from '../services/api';
import { ChartSkeleton, DataStateBanner } from '../components/DataFetchState';
interface CongestionForecastProps {
  onNavigate: (page: Page) => void;
}

type TrendPoint = {
  time: string;
  upington: number;
  deAar: number;
  limit: number;
};

export function CongestionForecast({ onNavigate }: CongestionForecastProps) {
  const { submitPrompt } = usePilotStore();
  const [filterNode, setFilterNode] = useState('All');
  const [showHyShift, setShowHyShift] = useState(false);
  const [enableDlr, setEnableDlr] = useState(true);
  const [dlrRows, setDlrRows] = useState<Awaited<ReturnType<typeof fetchDynamicLineRatings>>>([]);
  const [baseHeatmapData, setBaseHeatmapData] = useState<Array<{node: string;values: number[];}>>([]);
  const [timeLabels, setTimeLabels] = useState<string[]>([]);
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);
  const [riskRows, setRiskRows] = useState<Array<{node: string;peak: number;time: string;risk: string;}>>([]);
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
        const [dlr, nodes, upington, deAar] = await Promise.all([
          fetchDynamicLineRatings(),
          fetchCongestionNodes(),
          fetchForecast({
            lat: -28.4478,
            lon: 21.2561,
            capacity: 220
          }),
          fetchForecast({
            lat: -30.6499,
            lon: 24.0123,
            capacity: 180
          })
        ]);
        if (!active) return;
        setDlrRows(dlr);
        setBaseHeatmapData(nodes.map((node) => ({
          node: node.name,
          values: node.forecast24h
        })));
        setTimeLabels(
          upington.hourly.slice(0, 12).map((row) =>
          new Date(row.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          )
        );
        setTrendData(
          upington.hourly.slice(0, 12).map((row, idx) => ({
            time: new Date(row.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            upington: Number(((row.estimatedPowerKw / 220) * 100).toFixed(1)),
            deAar: Number((((deAar.hourly[idx]?.estimatedPowerKw ?? 0) / 180) * 100).toFixed(1)),
            limit: 90
          }))
        );
        setError(null);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to load congestion forecast.');
        setDlrRows([]);
        setBaseHeatmapData([]);
        setTrendData([]);
        setTimeLabels([]);
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [refreshKey]);
  const displayData = useMemo(() => {
    let next = baseHeatmapData;
    if (showHyShift) {
      next = next.map((row) => ({
        ...row,
        values: row.values.map((v) => Math.max(0, Math.round(v * 0.78)))
      }));
    }
    if (enableDlr) {
      next = next.map((row) => ({
        ...row,
        values: row.values.map((v) => Math.max(0, Math.round(v * 0.88)))
      }));
    }
    return next;
  }, [showHyShift, enableDlr, baseHeatmapData]);
  useEffect(() => {
    const rows = displayData.map((row) => {
      const peak = Math.max(...row.values);
      const peakIdx = row.values.indexOf(peak);
      const risk = peak >= 90 ? 'Critical' : peak >= 75 ? 'High' : peak >= 55 ? 'Medium' : 'Low';
      return {
        node: row.node,
        peak,
        time: timeLabels[peakIdx] ?? `${peakIdx}:00`,
        risk
      };
    }).
    sort((a, b) => b.peak - a.peak).
    slice(0, 5);
    setRiskRows(rows);
  }, [displayData, timeLabels]);
  return (
    <div className="space-y-6 p-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => onNavigate('dashboard')}
            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-slate-100">
              Congestion Forecasting
            </h2>
            <p className="text-slate-400">
              72-hour grid congestion prediction across all nodes
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowHyShift(!showHyShift)}
            className={`flex items-center px-3 py-2 rounded-lg transition-all border ${showHyShift ? 'bg-purple-500/20 border-purple-500/50 text-purple-300' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'}`}>

            <Droplet
              className={`w-4 h-4 mr-2 ${showHyShift ? 'text-purple-400' : ''}`} />

            Show with HyShift
          </button>
          <button
            onClick={() => setEnableDlr(!enableDlr)}
            className={`flex items-center px-3 py-2 rounded-lg transition-all border ${enableDlr ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'}`}>
            Enable DLR
          </button>
          <button
            onClick={() => onNavigate('generation-vs-forecast')}
            className="flex items-center px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 hover:bg-emerald-500/20 transition-colors">

            <Activity className="w-4 h-4 mr-2" />
            Compare vs Actual
          </button>
          <button className="flex items-center px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors">
            <Calendar className="w-4 h-4 mr-2" />
            Next 72 Hours
          </button>
          <button className="flex items-center px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors">
            <Download className="w-4 h-4 mr-2" />
            Export
          </button>
        </div>
      </div>

      <DataStateBanner
        loading={loading}
        error={error}
        empty={!loading && !error && displayData.length === 0}
        emptyMessage="No congestion forecast points are available for the selected range."
        tone="operations"
        onRetry={handleRetry}
        retryLabel="Retry feed"
      />

      {showHyShift &&
      <motion.div
        initial={{
          opacity: 0,
          height: 0
        }}
        animate={{
          opacity: 1,
          height: 'auto'
        }}
        className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3 flex items-center text-sm text-purple-200">

          <Droplet className="w-4 h-4 mr-2 text-purple-400" />
          HyShift flexible load absorbs excess generation, reducing congestion
          by ~22% across critical nodes.
        </motion.div>
      }
      {enableDlr &&
      <motion.div
        initial={{
          opacity: 0,
          height: 0
        }}
        animate={{
          opacity: 1,
          height: 'auto'
        }}
        className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-3 text-sm text-cyan-200">
          Dynamic line rating enabled. Current modeled transfer uplift:
          {' '}
          {dlrRows.length ?
          `${Math.round(dlrRows.reduce((acc, row) => acc + row.upliftPercent, 0) / dlrRows.length)}%` :
          'loading...'}
        </motion.div>
      }

      {/* AI Prompt */}
      <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
        <PromptInput
          onSubmit={(val) => submitPrompt(val, 'congestion')}
          placeholder="Ask about congestion (e.g., 'Show me congestion risks for Upington tomorrow')"
          templates={[
          {
            label: 'Upington Forecast',
            prompt: 'Show congestion forecast for Upington next 48 hours'
          },
          {
            label: 'High Risk Nodes',
            prompt: 'Identify nodes with >80% congestion probability'
          },
          {
            label: 'Weather Impact',
            prompt: 'How will cloud cover affect De Aar congestion tomorrow?'
          }]
          } />

      </div>

      {/* Heatmap */}
      {loading ?
      <ChartSkeleton heightClass="h-[260px]" /> :
      !displayData.length ?
      <div className="h-[260px] rounded-xl border border-slate-700 bg-slate-900/50 flex items-center justify-center text-sm text-slate-400">
          Waiting for congestion snapshots...
        </div> :
      <HeatmapGrid
        title={`Network Congestion Heatmap (72h)${showHyShift ? ' - HyShift Optimized' : ''}`}
        data={displayData}
        timeLabels={timeLabels} />
      }


      {/* Detailed Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
            delay: 0.2
          }}
          className="lg:col-span-2 bg-slate-800 border border-slate-700 rounded-xl p-6">

          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-slate-100">
              Congestion Trend Analysis
            </h3>
            <div className="flex space-x-2">
              <span className="flex items-center text-xs text-slate-400">
                <span className="w-3 h-3 bg-emerald-500 rounded-full mr-1"></span>{' '}
                Upington
              </span>
              <span className="flex items-center text-xs text-slate-400">
                <span className="w-3 h-3 bg-cyan-500 rounded-full mr-1"></span>{' '}
                De Aar
              </span>
              <span className="flex items-center text-xs text-slate-400">
                <span className="w-3 h-3 bg-red-500 rounded-full mr-1"></span>{' '}
                Limit
              </span>
            </div>
          </div>
          <div className="h-[350px] w-full">
            {loading ?
            <ChartSkeleton heightClass="h-[350px]" /> :
            !trendData.length ?
            <div className="h-[350px] rounded-lg border border-slate-700 bg-slate-900/50 flex items-center justify-center text-sm text-slate-400">
                Trend data will appear once forecasts arrive.
              </div> :
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
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
                  unit="%" />

                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    color: '#f1f5f9'
                  }}
                  itemStyle={{
                    color: '#f1f5f9'
                  }} />

                <Line
                  type="monotone"
                  dataKey="upington"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false} />

                <Line
                  type="monotone"
                  dataKey="deAar"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  dot={false} />

                <Line
                  type="monotone"
                  dataKey="limit"
                  stroke="#ef4444"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false} />

              </LineChart>
            </ResponsiveContainer>
            }
          </div>
        </motion.div>

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
            delay: 0.25
          }}
          className="bg-slate-800 border border-cyan-500/20 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-700 bg-slate-800/50">
            <h3 className="text-lg font-semibold text-slate-100">
              DLR Corridor Uplift
            </h3>
          </div>
          <div className="divide-y divide-slate-700/80">
            {dlrRows.map((row) =>
            <div key={row.corridor} className="p-4">
                <p className="text-sm text-slate-200 font-medium">
                  {row.corridor}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {row.staticLimitMW} MW static to {row.dynamicLimitMW} MW dynamic
                </p>
                <p className="text-xs text-cyan-300 mt-1">
                  +{row.upliftPercent}% uplift | {row.ambientTempC}C | {row.windSpeedMs} m/s
                </p>
              </div>
            )}
            {!loading && !dlrRows.length &&
            <div className="p-4 text-sm text-slate-400">
                No DLR corridor uplift values are available.
              </div>
            }
          </div>
        </motion.div>

        {/* Risk Table */}
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
            delay: 0.3
          }}
          className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">

          <div className="p-4 border-b border-slate-700 bg-slate-800/50 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-slate-100">
              High Risk Nodes
            </h3>
            <button
              onClick={() => onNavigate('dispatch-status')}
              className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center transition-colors">

              View Dispatch <ArrowRight className="w-3 h-3 ml-1" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-400 uppercase bg-slate-900/50">
                <tr>
                  <th className="px-4 py-3">Node</th>
                  <th className="px-4 py-3">Peak %</th>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Risk</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {riskRows.map((row, i) =>
                <tr
                  key={i}
                  onClick={() => onNavigate('dispatch-status')}
                  className="hover:bg-slate-700/30 transition-colors cursor-pointer">

                    <td className="px-4 py-3 font-medium text-slate-200">
                      {row.node}
                    </td>
                    <td className="px-4 py-3 text-slate-300">{row.peak}%</td>
                    <td className="px-4 py-3 text-slate-400">{row.time}</td>
                    <td className="px-4 py-3">
                      <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium
                        ${row.risk === 'Critical' ? 'bg-red-500/10 text-red-400' : row.risk === 'High' ? 'bg-amber-500/10 text-amber-400' : row.risk === 'Medium' ? 'bg-yellow-500/10 text-yellow-400' : 'bg-emerald-500/10 text-emerald-400'}`}>

                        {row.risk}
                      </span>
                    </td>
                  </tr>
                )}
                {!loading && !riskRows.length &&
                <tr>
                    <td colSpan={4} className="px-4 py-4 text-center text-slate-400">
                      No high-risk nodes detected in the current forecast.
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </div>);

}
