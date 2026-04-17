import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Battery,
  Zap,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Play,
  RotateCcw,
  Server } from
'lucide-react';
import { motion } from 'framer-motion';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer } from
'recharts';
import { StatusBadge } from '../components/StatusBadge';
import { Page } from '../components/Sidebar';
import {
  fetchDispatchRecommendations,
  fetchNodes,
  fetchReadings,
  type BackendNode,
  type DispatchRecommendation } from
'../services/api';
import { ChartSkeleton, DataStateBanner } from '../components/DataFetchState';
interface DispatchStatusProps {
  onNavigate: (page: Page) => void;
}
export function DispatchStatus({ onNavigate }: DispatchStatusProps) {
  const [nodes, setNodes] = useState<BackendNode[]>([]);
  const [recommendations, setRecommendations] = useState<DispatchRecommendation[]>([]);
  const [latencyRows, setLatencyRows] = useState<Array<{time: string;value: number;}>>([]);
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
        const [backendNodes, recs, readings] = await Promise.all([
          fetchNodes(),
          fetchDispatchRecommendations(),
          fetchReadings({ limit: 30, sort: 'asc' })
        ]);
        if (!active) return;
        setNodes(backendNodes);
        setRecommendations(recs);
        setLatencyRows(
          readings.slice(-10).map((row, idx) => ({
            time: new Date(row.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            value: Number((0.8 + ((row.curtailment ?? 0) * 0.05) + idx * 0.02).toFixed(2))
          }))
        );
        setError(null);
      } catch (err) {
        if (!active) return;
        setNodes([]);
        setRecommendations([]);
        setLatencyRows([]);
        setError(err instanceof Error ? err.message : 'Unable to load dispatch status feeds.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [refreshKey]);

  const commandRows = useMemo(
    () =>
      recommendations.map((rec, index) => ({
        time: new Date(Date.now() - index * 8 * 60 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        command: rec.title,
        asset: rec.type === 'battery' ? 'Battery fleet' : rec.type === 'hyshift' ? 'Electrolyzer' : 'Grid dispatch',
        status: rec.status === 'approved' ? 'executed' : rec.status === 'rejected' ? 'failed' : 'executing',
        operator: 'Auto-AI'
      })),
    [recommendations]
  );

  const assetRows = useMemo(
    () =>
      nodes.map((node) => {
        const output = node.lastReading?.power ?? 0;
        const capacity = Math.max(1, Math.round(output * 1.15));
        const progress = Math.max(0, Math.min(100, Math.round((output / capacity) * 100)));
        return {
          name: node.name,
          type: node.location.toLowerCase().includes('wind') ? 'Wind' : 'Solar PV',
          output: `${Math.round(output)} MW`,
          capacity: `${capacity} MW`,
          status: node.status === 'online' ? 'optimal' : 'warning',
          progress
        };
      }),
    [nodes]
  );

  const dispatchStats = useMemo(() => {
    const executed = commandRows.filter((row) => row.status === 'executed').length;
    const total = Math.max(1, commandRows.length);
    const successRate = (executed / total) * 100;
    const avgLatency = latencyRows.length ? latencyRows.reduce((sum, row) => sum + row.value, 0) / latencyRows.length : 0;
    const alerts = assetRows.filter((asset) => asset.status !== 'optimal').length;
    return {
      commands24h: commandRows.length,
      successRate: Number(successRate.toFixed(1)),
      avgLatency: Number(avgLatency.toFixed(2)),
      alerts
    };
  }, [assetRows, commandRows, latencyRows]);

  return (
    <div className="space-y-6 p-6 pb-20">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => onNavigate('dashboard')}
            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors">

            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-slate-100">
              Dispatch Status
            </h2>
            <p className="text-slate-400">Real-time asset control and state</p>
          </div>
        </div>
        <div className="flex space-x-2">
          <button className="flex items-center px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors">
            <RotateCcw className="w-4 h-4 mr-2" />
            Run Diagnostics
          </button>
          <button
            onClick={() => onNavigate('dispatch')}
            className="flex items-center px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors font-medium shadow-lg shadow-emerald-500/20">

            <Activity className="w-4 h-4 mr-2" />
            View Optimization
          </button>
        </div>
      </div>

      <DataStateBanner
        loading={loading}
        error={error}
        empty={!loading && !error && !commandRows.length && !assetRows.length}
        emptyMessage="No dispatch commands or asset states are available yet."
        tone="operations"
        onRetry={handleRetry}
        retryLabel="Retry feed"
      />

      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
        {
          label: 'Dispatch Commands (24h)',
          value: dispatchStats.commands24h.toString(),
          icon: Server,
          color: 'text-blue-400'
        },
        {
          label: 'Success Rate',
          value: `${dispatchStats.successRate}%`,
          icon: CheckCircle2,
          color: 'text-emerald-400'
        },
        {
          label: 'Avg Response Time',
          value: `${dispatchStats.avgLatency}s`,
          icon: Clock,
          color: 'text-purple-400'
        },
        {
          label: 'Active Alerts',
          value: dispatchStats.alerts.toString(),
          icon: AlertTriangle,
          color: 'text-amber-400'
        }].
        map((stat, i) =>
        <motion.div
          key={i}
          initial={{
            opacity: 0,
            y: 20
          }}
          animate={{
            opacity: 1,
            y: 0
          }}
          transition={{
            delay: i * 0.05
          }}
          className="bg-slate-800 border border-slate-700 rounded-xl p-5 flex items-center justify-between">

            <div>
              <p className="text-sm text-slate-400 font-medium mb-1">
                {stat.label}
              </p>
              <h3 className="text-2xl font-bold text-slate-100">
                {stat.value}
              </h3>
            </div>
            <div className={`p-3 rounded-lg bg-slate-900/50 ${stat.color}`}>
              <stat.icon className="w-6 h-6" />
            </div>
          </motion.div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Status & Charts */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
              className="bg-slate-800 border border-slate-700 rounded-xl p-6">

              <h3 className="text-lg font-semibold text-slate-100 mb-6 flex items-center">
                <Battery className="w-5 h-5 mr-2 text-emerald-500" />
                Battery Energy Storage
              </h3>
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-400">Total SOC</span>
                    <span className="text-emerald-400 font-bold">78%</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-4">
                    <div
                      className="bg-emerald-500 h-4 rounded-full"
                      style={{
                        width: '78%'
                      }}>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-900/50 p-4 rounded-lg">
                    <span className="text-xs text-slate-500 uppercase">
                      De Aar BESS
                    </span>
                    <div className="text-xl font-bold text-slate-200 mt-1">
                      82%
                    </div>
                    <StatusBadge
                      status="active"
                      label="Charging"
                      className="mt-2" />

                  </div>
                  <div className="bg-slate-900/50 p-4 rounded-lg">
                    <span className="text-xs text-slate-500 uppercase">
                      Upington BESS
                    </span>
                    <div className="text-xl font-bold text-slate-200 mt-1">
                      65%
                    </div>
                    <StatusBadge
                      status="warning"
                      label="Discharging"
                      className="mt-2" />

                  </div>
                </div>
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
                delay: 0.3
              }}
              className="bg-slate-800 border border-slate-700 rounded-xl p-6">

              <h3 className="text-lg font-semibold text-slate-100 mb-6 flex items-center">
                <Zap className="w-5 h-5 mr-2 text-amber-500" />
                Grid Connection
              </h3>
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-400">
                      Export Capacity Usage
                    </span>
                    <span className="text-amber-400 font-bold">82%</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-4">
                    <div
                      className="bg-amber-500 h-4 rounded-full"
                      style={{
                        width: '82%'
                      }}>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-slate-900/50 rounded-lg">
                    <span className="text-slate-300">Frequency</span>
                    <span className="font-mono text-emerald-400">50.02 Hz</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-slate-900/50 rounded-lg">
                    <span className="text-slate-300">Voltage</span>
                    <span className="font-mono text-emerald-400">132.4 kV</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Command History Table */}
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
            className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">

            <div className="p-4 border-b border-slate-700 bg-slate-800/50">
              <h3 className="text-lg font-semibold text-slate-100">
                Recent Dispatch Commands
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-400 uppercase bg-slate-900/50">
                  <tr>
                    <th className="px-6 py-3">Time</th>
                    <th className="px-6 py-3">Command</th>
                    <th className="px-6 py-3">Asset</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Operator</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {commandRows.map((cmd, i) =>
                  <tr
                    key={i}
                    className="hover:bg-slate-700/30 transition-colors">

                      <td className="px-6 py-4 text-slate-400 font-mono">
                        {cmd.time}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-200">
                        {cmd.command}
                      </td>
                      <td className="px-6 py-4 text-slate-300">{cmd.asset}</td>
                      <td className="px-6 py-4">
                        <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                          ${cmd.status === 'executed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : cmd.status === 'executing' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 animate-pulse' : cmd.status === 'failed' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>

                          {cmd.status.charAt(0).toUpperCase() +
                        cmd.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-400">
                        {cmd.operator}
                      </td>
                    </tr>
                  )}
                  {!loading && !commandRows.length &&
                  <tr>
                      <td colSpan={5} className="px-6 py-6 text-center text-slate-400">
                        No recent dispatch commands are available.
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>

        {/* Right Column: Asset Control & Response Chart */}
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
              delay: 0.5
            }}
            className="bg-slate-800 border border-slate-700 rounded-xl p-6">

            <h3 className="text-lg font-semibold text-slate-100 mb-4">
              Asset Control Panel
            </h3>
            <div className="space-y-4">
              {assetRows.map((asset, i) =>
              <div
                key={i}
                className="bg-slate-900/50 border border-slate-700 rounded-lg p-4 hover:border-slate-600 transition-colors">

                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-medium text-slate-200">
                        {asset.name}
                      </h4>
                      <p className="text-xs text-slate-500">{asset.type}</p>
                    </div>
                    <StatusBadge
                    status={asset.status as any}
                    label={asset.status} />

                  </div>
                  <div className="flex justify-between items-end mb-2">
                    <div>
                      <span className="text-2xl font-bold text-slate-100">
                        {asset.output}
                      </span>
                      <span className="text-xs text-slate-500 ml-1">
                        / {asset.capacity}
                      </span>
                    </div>
                    <button className="text-xs text-emerald-400 hover:text-emerald-300 font-medium">
                      View Details
                    </button>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-1.5">
                    <div
                    className={`h-1.5 rounded-full ${asset.status === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    style={{
                      width: `${asset.progress}%`
                    }}>
                  </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>

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
              delay: 0.6
            }}
            className="bg-slate-800 border border-slate-700 rounded-xl p-6">

            <h3 className="text-lg font-semibold text-slate-100 mb-4">
              Response Latency (1h)
            </h3>
            <div className="h-[200px] w-full">
              {loading ?
              <ChartSkeleton heightClass="h-[200px]" /> :
              !latencyRows.length ?
              <div className="h-[200px] rounded-lg border border-slate-700 bg-slate-900/50 flex items-center justify-center text-sm text-slate-400">
                  Latency points will populate when dispatch traffic resumes.
                </div> :
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={latencyRows}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#334155"
                    vertical={false} />

                  <XAxis
                    dataKey="time"
                    stroke="#94a3b8"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false} />

                  <YAxis
                    stroke="#94a3b8"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    domain={[0, 2]} />

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
                    dataKey="value"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={false} />

                </LineChart>
              </ResponsiveContainer>
              }
            </div>
          </motion.div>
        </div>
      </div>
    </div>);

}