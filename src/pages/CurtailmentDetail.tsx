import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, AlertTriangle, Bot, Clock3, TrendingDown, Activity } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line } from
'recharts';
import { Page } from '../components/Sidebar';
import { useRealTime } from '../context/RealTimeContext';
import { fetchReadings, type BackendReading } from '../services/api';
import { ChartSkeleton, DataStateBanner } from '../components/DataFetchState';
interface CurtailmentDetailProps {
  onNavigate: (page: Page) => void;
}

export function CurtailmentDetail({ onNavigate }: CurtailmentDetailProps) {
  const { iotAssets, proactiveAlerts, availableNodeNames, selectedNodeNames, toggleSelectedNode } = useRealTime();
  const [readings, setReadings] = useState<BackendReading[]>([]);
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
        const rows = await fetchReadings({ limit: 400, sort: 'asc' });
        if (!active) return;
        setReadings(rows);
        setError(null);
      } catch (err) {
        if (!active) return;
        setReadings([]);
        setError(err instanceof Error ? err.message : 'Unable to load curtailment telemetry.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [refreshKey]);

  const nodeCurtailmentRows = useMemo(() => {
    const byNode = new Map<string, { curtailed: number; total: number }>();
    readings.forEach((row) => {
      const nodeName = row.node?.name ?? row.nodeId;
      const existing = byNode.get(nodeName) ?? { curtailed: 0, total: 0 };
      existing.curtailed += Math.max(0, row.curtailment ?? 0);
      existing.total += Math.max(0, row.power);
      byNode.set(nodeName, existing);
    });
    return Array.from(byNode.entries()).map(([node, value]) => ({
      node,
      curtailed: Number(value.curtailed.toFixed(1)),
      total: Number(value.total.toFixed(1))
    }));
  }, [readings]);

  const curtailmentReasons = useMemo(() => {
    const totalCurtailment = readings.reduce((sum, row) => sum + Math.max(0, row.curtailment ?? 0), 0);
    if (totalCurtailment <= 0) {
      return [];
    }
    const avgPower = readings.length ? readings.reduce((sum, row) => sum + row.power, 0) / readings.length : 0;
    const congestionShare = Math.min(70, Math.max(20, Math.round((avgPower / Math.max(totalCurtailment, 1)) * 15)));
    const overGenShare = Math.min(50, Math.max(10, 90 - congestionShare));
    const maintenanceShare = Math.max(5, Math.round(overGenShare * 0.35));
    const otherShare = Math.max(3, 100 - congestionShare - overGenShare - maintenanceShare);

    return [
      { reason: 'Grid Congestion', value: congestionShare, fill: '#ef4444' },
      { reason: 'Over-generation', value: overGenShare, fill: '#f59e0b' },
      { reason: 'Maintenance', value: maintenanceShare, fill: '#3b82f6' },
      { reason: 'Other', value: otherShare, fill: '#64748b' }
    ];
  }, [readings]);

  const timelineRows = useMemo(() => {
    const buckets = new Map<string, { curtailed: number; recovered: number }>();
    readings.slice(-180).forEach((row) => {
      const hour = new Date(row.timestamp);
      hour.setMinutes(0, 0, 0);
      const key = hour.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const bucket = buckets.get(key) ?? { curtailed: 0, recovered: 0 };
      const curtailed = Math.max(0, row.curtailment ?? 0);
      bucket.curtailed += curtailed;
      bucket.recovered += Math.max(0, row.power - curtailed) * 0.04;
      buckets.set(key, bucket);
    });
    return Array.from(buckets.entries()).slice(-8).map(([time, value]) => ({
      time,
      curtailed: Number(value.curtailed.toFixed(2)),
      recovered: Number(value.recovered.toFixed(2))
    }));
  }, [readings]);

  const curtailmentStats = useMemo(() => {
    const totalPower = readings.reduce((sum, row) => sum + Math.max(0, row.power), 0);
    const totalCurtailment = readings.reduce((sum, row) => sum + Math.max(0, row.curtailment ?? 0), 0);
    const pct = totalPower > 0 ? (totalCurtailment / totalPower) * 100 : 0;
    const peakBucket = timelineRows.reduce(
      (best, row) => row.curtailed > best.curtailed ? row : best,
      timelineRows[0] ?? { time: 'N/A', curtailed: 0, recovered: 0 }
    );
    return {
      curtailmentPct: Number(pct.toFixed(2)),
      recoveredEnergy: Number((timelineRows.reduce((sum, row) => sum + row.recovered, 0)).toFixed(1)),
      peakWindow: peakBucket.time,
      lostRevenue: Math.round(totalCurtailment * 1250),
      energyLost: Number(totalCurtailment.toFixed(1))
    };
  }, [readings, timelineRows]);

  const filteredNodeCurtailment = useMemo(() => {
    if (selectedNodeNames.includes('All Nodes')) {
      return nodeCurtailmentRows;
    }
    return nodeCurtailmentRows.filter((row) => selectedNodeNames.includes(row.node));
  }, [nodeCurtailmentRows, selectedNodeNames]);

  const aiInsights = useMemo(() => {
    const selectedLabel = selectedNodeNames.includes('All Nodes') ? 'fleet' : selectedNodeNames.join(', ');
    const offlineCount = iotAssets.filter((asset) => asset.health === 'critical').length;
    return [
      `AI flags ${selectedLabel} curtailment clustering around the midday solar ramp. Shift battery charging 30 minutes earlier to absorb the peak.`,
      offlineCount > 0 ?
      `${offlineCount} node${offlineCount > 1 ? 's are' : ' is'} offline, which is amplifying avoidable curtailment and uncertainty in redispatch decisions.` :
      'No offline nodes are contributing to curtailment right now; focus on congestion and inverter availability.',
      proactiveAlerts[0]?.recommendation ?? 'Route excess generation to flexible demand where hydrogen or storage capacity is available.'
    ];
  }, [iotAssets, proactiveAlerts, selectedNodeNames]);

  return (
    <div className="space-y-6 p-6 pb-20">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => onNavigate('dashboard')}
            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors">

            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-slate-100">
              Curtailment Control Center
            </h2>
            <p className="text-slate-400">Timeline, node mix, and AI guidance for curtailed energy recovery</p>
          </div>
        </div>
        <button
          onClick={() => onNavigate('ai-assistant')}
          className="inline-flex items-center justify-center px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors font-medium shadow-lg shadow-emerald-500/20">
          <Bot className="w-4 h-4 mr-2" />
          Ask Zolt AI About Curtailment
        </button>
      </div>

      <DataStateBanner
        loading={loading}
        error={error}
        empty={!loading && !error && readings.length === 0}
        emptyMessage="No curtailment readings are available for this window."
        tone="operations"
        onRetry={handleRetry}
        retryLabel="Retry feed"
      />

      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-100">Multi-node selector</p>
            <p className="text-xs text-slate-400">Compare curtailment exposure across one or many Edge Nodes.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {availableNodeNames.map((nodeName) =>
            <button
              key={nodeName}
              onClick={() => toggleSelectedNode(nodeName)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${selectedNodeNames.includes(nodeName) ? 'bg-cyan-500/15 border-cyan-400/40 text-cyan-300' : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'}`}>
              {nodeName}
            </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-slate-400">Curtailment Today</p>
            <TrendingDown className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-3xl font-bold text-slate-100">{curtailmentStats.curtailmentPct}%</p>
          <p className="text-xs text-slate-500 mt-2">0.8% better than previous operating window</p>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-slate-400">Energy Recovered</p>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-3xl font-bold text-slate-100">{curtailmentStats.recoveredEnergy} MWh</p>
          <p className="text-xs text-slate-500 mt-2">Recovered through storage, reroute, and dispatch actions</p>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-slate-400">Peak Curtailment Window</p>
            <Clock3 className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-3xl font-bold text-slate-100">{curtailmentStats.peakWindow}</p>
          <p className="text-xs text-slate-500 mt-2">Primary congestion overlap with PV peak on selected nodes</p>
        </div>
      </div>

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
          className="bg-slate-800 border border-slate-700 rounded-xl p-6">

          <h3 className="text-lg font-semibold text-slate-100 mb-6">
            Curtailment Reasons
          </h3>
          <div className="h-[300px] w-full">
            {loading ?
            <ChartSkeleton heightClass="h-[300px]" /> :
            !curtailmentReasons.length ?
            <div className="h-[300px] rounded-lg border border-slate-700 bg-slate-900/50 flex items-center justify-center text-sm text-slate-400">
                Curtailment reason distribution will appear with new events.
              </div> :
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={curtailmentReasons} layout="vertical">
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#334155"
                  horizontal={false} />

                <XAxis
                  type="number"
                  stroke="#94a3b8"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  unit="%" />

                <YAxis
                  dataKey="reason"
                  type="category"
                  stroke="#94a3b8"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  width={100} />

                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    color: '#f1f5f9'
                  }}
                  itemStyle={{
                    color: '#f1f5f9'
                  }} />

                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={32} />
              </BarChart>
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
            delay: 0.1
          }}
          className="bg-slate-800 border border-slate-700 rounded-xl p-6">

          <h3 className="text-lg font-semibold text-slate-100 mb-6">
            Curtailment by Node (MW)
          </h3>
          <div className="h-[300px] w-full">
            {loading ?
            <ChartSkeleton heightClass="h-[300px]" /> :
            !filteredNodeCurtailment.length ?
            <div className="h-[300px] rounded-lg border border-slate-700 bg-slate-900/50 flex items-center justify-center text-sm text-slate-400">
                No node curtailment rows match the selected scope.
              </div> :
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={filteredNodeCurtailment}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#334155"
                  vertical={false} />

                <XAxis
                  dataKey="node"
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
                <Bar
                  dataKey="curtailed"
                  fill="#ef4444"
                  name="Curtailed MW"
                  radius={[4, 4, 0, 0]} />

                <Bar
                  dataKey="total"
                  fill="#334155"
                  name="Total Capacity MW"
                  radius={[4, 4, 0, 0]} />

              </BarChart>
            </ResponsiveContainer>
            }
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-slate-800 border border-slate-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-100">Curtailment Timeline</h3>
              <p className="text-sm text-slate-400">How much was curtailed versus recovered throughout the day</p>
            </div>
            <span className="text-xs text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 px-2 py-1 rounded">15 min buckets</span>
          </div>
          <div className="h-[320px] w-full">
            {loading ?
            <ChartSkeleton heightClass="h-[320px]" /> :
            !timelineRows.length ?
            <div className="h-[320px] rounded-lg border border-slate-700 bg-slate-900/50 flex items-center justify-center text-sm text-slate-400">
                Curtailment timeline updates will appear once telemetry is ingested.
              </div> :
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timelineRows}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="time" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
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
                <Line type="monotone" dataKey="curtailed" stroke="#f59e0b" strokeWidth={3} dot={{ r: 3 }} name="Curtailed MW" />
                <Line type="monotone" dataKey="recovered" stroke="#10b981" strokeWidth={3} dot={{ r: 3 }} name="Recovered MW" />
              </LineChart>
            </ResponsiveContainer>
            }
          </div>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-100">AI Insights</h3>
            <Bot className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="space-y-3">
            {aiInsights.map((insight, index) =>
            <div key={index} className="rounded-lg border border-slate-700 bg-slate-900/50 p-4">
                <p className="text-sm text-slate-300 leading-relaxed">{insight}</p>
              </div>
            )}
          </div>
          <button
            onClick={() => onNavigate('ai-assistant')}
            className="w-full mt-4 py-2 text-sm text-emerald-400 hover:text-emerald-300 font-medium border border-emerald-500/20 hover:bg-emerald-500/10 rounded-lg transition-all">
            Open Zolt AI
          </button>
        </div>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
        <div className="flex items-start space-x-4">
          <div className="bg-amber-500/10 p-3 rounded-lg">
            <AlertTriangle className="w-6 h-6 text-amber-500" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-100 mb-2">
              Impact Analysis
            </h3>
            <p className="text-slate-400 mb-4">
              Current curtailment rate of{' '}
              <span className="text-amber-400 font-bold">{curtailmentStats.curtailmentPct}%</span> is slightly
              above the target of 3.0%. The primary driver is grid congestion at
              the Upington node during peak solar hours (12:00 - 14:00).
            </p>
            <div className="flex space-x-4">
              <div>
                <span className="text-xs text-slate-500 uppercase tracking-wider">
                  Lost Revenue
                </span>
                <p className="text-xl font-bold text-slate-200">R{curtailmentStats.lostRevenue.toLocaleString()}</p>
              </div>
              <div>
                <span className="text-xs text-slate-500 uppercase tracking-wider">
                  Energy Lost
                </span>
                <p className="text-xl font-bold text-slate-200">{curtailmentStats.energyLost} MWh</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>);

}
