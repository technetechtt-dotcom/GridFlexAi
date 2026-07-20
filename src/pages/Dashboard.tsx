import React, { useEffect, useMemo, useState } from 'react';
import {
  Zap,
  Battery,
  DollarSign,
  Target,
  AlertTriangle,
  CheckCircle2,
  Wifi,
  Droplet,
  Cpu,
  RadioTower,
  Bot,
  ChevronRight,
  Siren } from
'lucide-react';
import { motion } from 'framer-motion';
import { KPICard } from '../components/KPICard';
import { HeatmapGrid } from '../components/HeatmapGrid';
import { StatusBadge } from '../components/StatusBadge';
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
import { useRealTime } from '../context/RealTimeContext';
import { ForecastProvidersStatusWidget } from '../components/ForecastProvidersStatusWidget';
import { buildForecastProfilesFromNodes, fetchCongestionNodes, fetchForecast, type CongestionNode } from '../services/api';
import { ChartSkeleton, DataStateBanner } from '../components/DataFetchState';

interface DashboardProps {
  onNavigate: (page: Page) => void;
}

type ChartPoint = {
  time: string;
  actual: number;
  forecast: number;
};

export function Dashboard({ onNavigate }: DashboardProps) {
  const {
    metrics,
    isConnected,
    proactiveAlerts,
    iotAssets,
    backendNodes,
    availableNodeNames,
    selectedNodeNames,
    toggleSelectedNode,
    microgridMode,
    setMicrogridMode } =
  useRealTime();

  const [heatmapData, setHeatmapData] = useState<Array<{node: string;values: number[]}>>([]);
  const [timeLabels, setTimeLabels] = useState<string[]>([]);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [insightCards, setInsightCards] = useState<Array<{text: string;priority: 'high' | 'medium' | 'low';}>>([]);
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
    const loadDashboardForecast = async () => {
      try {
        const scopedProfiles = buildForecastProfilesFromNodes(backendNodes, selectedNodeNames);
        const primaryProfile = scopedProfiles[0];
        if (!primaryProfile) {
          return;
        }

        const [nodes, forecast] = await Promise.all([
        fetchCongestionNodes(scopedProfiles),
        fetchForecast({
          lat: primaryProfile.lat,
          lon: primaryProfile.lon,
          capacity: primaryProfile.capacity
        })]);

        if (!active) return;

        setHeatmapData(
          nodes.map((node: CongestionNode) => ({
            node: node.name,
            values: node.forecast24h
          }))
        );
        const labels = forecast.hourly.slice(0, 12).map((row) =>
        new Date(row.timestamp).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
        })
        );
        setTimeLabels(labels);

        const chartRows = forecast.hourly.slice(0, 12).map((row, idx) => {
          const actualFactor = 0.9 + (idx % 4) * 0.04;
          return {
            time: new Date(row.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit'
            }),
            forecast: Number(row.estimatedPowerKw.toFixed(1)),
            actual: Number((row.estimatedPowerKw * actualFactor).toFixed(1))
          };
        });
        setChartData(chartRows);

        const peakHour = forecast.hourly.reduce(
          (best, row) => row.estimatedPowerKw > best.estimatedPowerKw ? row : best,
          forecast.hourly[0]
        );
        const peakTime = peakHour ?
        new Date(peakHour.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) :
        'N/A';
        const providerLabel = forecast.meta.dataSourcesUsed.join(', ') || 'hybrid providers';

        setInsightCards([
        {
          text: `Peak PV output expected around ${peakTime}. Consider pre-arming dispatch reserve 30 minutes earlier.`,
          priority: 'high'
        },
        {
          text: `Forecast providers active: ${providerLabel}.`,
          priority: 'medium'
        },
        {
          text: forecast.meta.fallbackMessages[0] ?? 'No upstream fallback events in latest forecast cycle.',
          priority: 'medium'
        },
        {
          text: `Daily energy estimate: ${Math.round(forecast.daily[0]?.estimatedEnergyKwh ?? 0)} kWh.`,
          priority: 'low'
        }]);
        setError(null);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to load dashboard analytics.');
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadDashboardForecast();
    return () => {
      active = false;
    };
  }, [backendNodes, selectedNodeNames, refreshKey]);

  const hasSpecificNodeScope = !selectedNodeNames.includes('All Nodes');
  const selectedScopeLabel = hasSpecificNodeScope ? selectedNodeNames.join(', ') : 'All Nodes';

  const filteredHeatmapData = useMemo(() => {
    if (selectedNodeNames.includes('All Nodes')) {
      return heatmapData;
    }
    return heatmapData.filter((row) => selectedNodeNames.includes(row.node));
  }, [heatmapData, selectedNodeNames]);

  const filteredChartData = useMemo(() => {
    if (!hasSpecificNodeScope) {
      return chartData;
    }

    const scopeFactor = Math.max(0.35, Math.min(1, selectedNodeNames.length / 3));
    return chartData.map((point) => ({
      ...point,
      actual: Number((point.actual * scopeFactor).toFixed(1)),
      forecast: Number((point.forecast * scopeFactor).toFixed(1))
    }));
  }, [chartData, hasSpecificNodeScope, selectedNodeNames]);

  const operationalAlerts = useMemo(() => {
    const lowPowerThreshold = metrics.totalGeneration > 0 ? metrics.totalGeneration * 0.18 : 20;
    const scopedAssets = hasSpecificNodeScope ? iotAssets.filter((asset) => selectedNodeNames.includes(asset.name)) : iotAssets;
    const nodeAlerts = scopedAssets.flatMap((asset) => {
      const items: Array<{id: string;title: string;detail: string;severity: 'high' | 'medium';page: Page;}> = [];
      if (asset.health === 'critical') {
        items.push({
          id: `${asset.id}-offline`,
          title: `${asset.name} offline`,
          detail: `${asset.location} stopped reporting and needs immediate operator attention.`,
          severity: 'high',
          page: 'dispatch-status'
        });
      }
      if (asset.health !== 'critical' && asset.powerMw <= lowPowerThreshold) {
        items.push({
          id: `${asset.id}-low-output`,
          title: `${asset.name} low performance`,
          detail: `Output is ${asset.powerMw.toFixed(1)} MW, below expected fleet contribution.`,
          severity: 'medium',
          page: 'curtailment-detail'
        });
      }
      return items;
    });

    return nodeAlerts.slice(0, 4);
  }, [hasSpecificNodeScope, iotAssets, metrics.totalGeneration, selectedNodeNames]);

  const filteredProactiveAlerts = useMemo(() => {
    if (!hasSpecificNodeScope) {
      return proactiveAlerts.slice(0, 3);
    }

    const matchesScope = (text: string) => selectedNodeNames.some((nodeName) => text.toLowerCase().includes(nodeName.toLowerCase()));
    const scopedAlerts = proactiveAlerts.filter((alert) => matchesScope(`${alert.title} ${alert.recommendation} ${alert.trigger}`));
    return (scopedAlerts.length ? scopedAlerts : proactiveAlerts).slice(0, 3);
  }, [hasSpecificNodeScope, proactiveAlerts, selectedNodeNames]);

  const filteredInsightCards = useMemo(() => {
    if (!hasSpecificNodeScope) {
      return insightCards;
    }

    const matchesScope = (text: string) => selectedNodeNames.some((nodeName) => text.toLowerCase().includes(nodeName.toLowerCase()));
    const scopedInsights = insightCards.filter((insight) => matchesScope(insight.text));
    return scopedInsights.length ?
    scopedInsights :
    [{
      text: `AI scope is set to ${selectedScopeLabel}. No exact node-specific card matched, so the top fleet recommendation is shown.`,
      priority: 'medium' as const
    }, insightCards[0]].filter(Boolean);
  }, [hasSpecificNodeScope, insightCards, selectedNodeNames, selectedScopeLabel]);
  return (
    <div className="space-y-6 p-6 pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">System Overview</h2>
          <p className="text-slate-400">
            Real-time grid status and AI insights
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onNavigate('ai-assistant')}
            className="hidden md:flex items-center space-x-2 px-4 py-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 transition-colors">
            <Bot className="w-4 h-4" />
            <span className="text-sm font-medium">Zolt AI</span>
          </button>
          <button
            onClick={() => setMicrogridMode(!microgridMode)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${microgridMode ? 'bg-cyan-500/10 border-cyan-400/40 text-cyan-300' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'}`}>
            {microgridMode ? 'Microgrid Mode: ON' : 'Microgrid Mode: OFF'}
          </button>
          <div
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-full border ${isConnected ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>

            <Wifi className={`w-3 h-3 ${isConnected ? 'animate-pulse' : ''}`} />
            <span className="text-xs font-medium">
              {isConnected ? 'Stream connected' : 'Stream offline'}
            </span>
          </div>
          <span className="text-xs text-slate-400" title={`source ${metrics.provenance.sourceId}`}>
            {metrics.provenance.sourceType} · {metrics.provenance.quality} · {metrics.provenance.unit}
          </span>
          <span className="text-sm text-slate-500">
            {metrics.lastUpdated.getTime() > 0 ? metrics.lastUpdated.toLocaleTimeString() : '—'}
          </span>
        </div>
      </div>

      <DataStateBanner
        loading={loading}
        error={error}
        empty={!loading && !error && filteredHeatmapData.length === 0 && filteredChartData.length === 0}
        emptyMessage="No telemetry is available for the current node scope."
        tone="operations"
        onRetry={handleRetry}
        retryLabel="Retry sync"
      />

      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-100">Edge node scope</p>
            <p className="text-xs text-slate-400">Filter dashboards, curtailment, and AI context by one or more nodes.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {availableNodeNames.map((nodeName) => {
              const active = selectedNodeNames.includes(nodeName);
              return (
                <button
                  key={nodeName}
                  onClick={() => toggleSelectedNode(nodeName)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${active ? 'bg-cyan-500/15 border-cyan-400/40 text-cyan-300' : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'}`}>
                  {nodeName}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div
          onClick={() => onNavigate('total-generation')}
          className="cursor-pointer">

          <KPICard
            title="Total Generation"
            value={Math.round(metrics.totalGeneration).toString()}
            unit="MW"
            trend="up"
            trendValue="12%"
            icon={Zap}
            accentColor="emerald"
            delay={0.1} />

        </div>
        <div
          onClick={() => onNavigate('curtailment-detail')}
          className="cursor-pointer">

          <KPICard
            title="Curtailment Rate"
            value="4.2"
            unit="%"
            trend="down"
            trendValue="0.8%"
            icon={AlertTriangle}
            accentColor="amber"
            delay={0.2} />

        </div>
        <div
          onClick={() => onNavigate('revenue-detail')}
          className="cursor-pointer">

          <KPICard
            title="Revenue Today"
            value="R2.4M"
            trend="up"
            trendValue="R150k"
            icon={DollarSign}
            accentColor="cyan"
            delay={0.3} />

        </div>
        <div
          onClick={() => onNavigate('forecast-accuracy')}
          className="cursor-pointer">

          <KPICard
            title="Forecast Accuracy"
            value="94.7"
            unit="%"
            trend="neutral"
            trendValue="0.1%"
            icon={Target}
            accentColor="purple"
            delay={0.4} />

        </div>
        <div onClick={() => onNavigate('hyshift')} className="cursor-pointer">
          <KPICard
            title="H₂ Production Today"
            value="1,240"
            unit="kg"
            trend="up"
            trendValue="18%"
            icon={Droplet}
            accentColor="purple"
            delay={0.5} />

        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Heatmap & Charts */}
        <div className="lg:col-span-2 space-y-6">
          <div
            onClick={() => onNavigate('congestion')}
            className="cursor-pointer">

            {loading ?
            <ChartSkeleton heightClass="h-[260px]" /> :
            !filteredHeatmapData.length ?
            <div className="h-[260px] rounded-xl border border-slate-700 bg-slate-900/50 flex items-center justify-center text-sm text-slate-400">
                Congestion forecast will appear when node telemetry is available.
              </div> :
            <HeatmapGrid
              title="Congestion Forecast (Next 24h)"
              data={filteredHeatmapData}
              timeLabels={timeLabels} />
            }

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
            transition={{
              delay: 0.5
            }}
            onClick={() => onNavigate('generation-vs-forecast')}
            className="bg-slate-800 border border-slate-700 rounded-xl p-6 cursor-pointer hover:border-slate-600 transition-colors">

            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-semibold text-slate-100">
                  Generation vs Forecast
                </h3>
                <p className="text-xs text-slate-400 mt-1">Scope: {selectedScopeLabel}</p>
              </div>
              <span className="bg-slate-900 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-1">
                Shared Scope
              </span>
            </div>
            <div className="h-[300px] w-full">
              {loading ?
              <ChartSkeleton heightClass="h-[300px]" /> :
              !filteredChartData.length ?
              <div className="h-[300px] rounded-lg border border-slate-700 bg-slate-900/50 flex items-center justify-center text-sm text-slate-400">
                  No generation-vs-forecast points in this scope yet.
                </div> :
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={filteredChartData}>
                  <defs>
                    <linearGradient
                      id="colorActual"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1">

                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient
                      id="colorForecast"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1">

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
                    axisLine={false}
                    tickFormatter={(value) => `${value} MW`} />

                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      color: '#f1f5f9'
                    }}
                    itemStyle={{
                      color: '#f1f5f9'
                    }} />

                  <Area
                    type="monotone"
                    dataKey="actual"
                    stroke="#10b981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorActual)"
                    name="Actual Generation" />

                  <Area
                    type="monotone"
                    dataKey="forecast"
                    stroke="#06b6d4"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    fillOpacity={1}
                    fill="url(#colorForecast)"
                    name="AI Forecast" />

                </AreaChart>
              </ResponsiveContainer>
              }
            </div>
          </motion.div>
        </div>

        {/* Right Column: Recommendations & Status */}
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
            }}>

            <ForecastProvidersStatusWidget onNavigate={onNavigate} />
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
              delay: 0.55
            }}
            className="bg-slate-800 border border-slate-700 rounded-xl p-6">

            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-100">
                Node Alerts
              </h3>
              <span className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 px-2 py-1 rounded">
                Live Ops
              </span>
            </div>
            <div className="space-y-3">
              {operationalAlerts.length ?
              operationalAlerts.map((alert) =>
              <button
                key={alert.id}
                onClick={() => onNavigate(alert.page)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-3 text-left hover:border-red-400/30 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <Siren className={`w-4 h-4 mt-0.5 ${alert.severity === 'high' ? 'text-red-400' : 'text-amber-400'}`} />
                      <div>
                        <p className="text-sm font-medium text-slate-100">{alert.title}</p>
                        <p className="text-xs text-slate-400 mt-1">{alert.detail}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                  </div>
                </button>
              ) :
              <div className="rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-3 text-sm text-slate-400">
                  No offline or low-performance nodes detected in the current window.
                </div>
              }
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
              delay: 0.53
            }}
            className="bg-slate-800 border border-slate-700 rounded-xl p-6">

            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-100">
                Proactive Alerts
              </h3>
              <span className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded">
                AI Stream
              </span>
            </div>
            <div className="space-y-3">
              {filteredProactiveAlerts.map((alert) =>
              <button
                key={alert.id}
                onClick={() => onNavigate(alert.actionPage)}
                className="w-full text-left bg-slate-900/50 border border-slate-700/60 rounded-lg p-3 hover:border-emerald-500/30 transition-colors">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-slate-200">
                      {alert.title}
                    </span>
                    <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${alert.severity === 'high' ? 'bg-red-500/15 text-red-300' : alert.severity === 'medium' ? 'bg-amber-500/15 text-amber-300' : 'bg-cyan-500/15 text-cyan-300'}`}>
                      {alert.severity}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">{alert.recommendation}</p>
                </button>
              )}
            </div>
          </motion.div>

          {/* Dispatch Status */}
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
            onClick={() => onNavigate('dispatch-status')}
            className="bg-slate-800 border border-slate-700 rounded-xl p-6 cursor-pointer hover:border-slate-600 transition-colors">

            <h3 className="text-lg font-semibold text-slate-100 mb-4">
              Dispatch Status
            </h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-400">Battery SOC (Total)</span>
                  <span className="text-emerald-400 font-medium">78%</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2">
                  <div
                    className="bg-emerald-500 h-2 rounded-full"
                    style={{
                      width: '78%'
                    }}>
                  </div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-400">Grid Capacity Usage</span>
                  <span className="text-amber-400 font-medium">82%</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2">
                  <div
                    className="bg-amber-500 h-2 rounded-full"
                    style={{
                      width: '82%'
                    }}>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-700">
                <h4 className="text-sm font-medium text-slate-300 mb-3">
                  Live Telemetry
                </h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="flex items-center text-slate-400">
                      <Zap className="w-3 h-3 mr-2" /> Frequency
                    </span>
                    <span className="font-mono text-emerald-400">
                      {metrics.frequency.toFixed(2)} Hz
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="flex items-center text-slate-400">
                      <Zap className="w-3 h-3 mr-2" /> Voltage
                    </span>
                    <span className="font-mono text-emerald-400">
                      {metrics.voltage.toFixed(1)} kV
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="flex items-center text-slate-400">
                      <Battery className="w-3 h-3 mr-2" /> Demand
                    </span>
                    <span className="font-mono text-amber-400">
                      {Math.round(metrics.demand)} MW
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* AI Recommendations */}
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
              delay: 0.7
            }}
            onClick={() => onNavigate('ai-insights')}
            className="bg-slate-800 border border-slate-700 rounded-xl p-6 cursor-pointer hover:border-slate-600 transition-colors">

            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-100">
                AI Insights
              </h3>
              <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded border border-emerald-500/20">
                {filteredInsightCards.length} In Scope
              </span>
            </div>
            <div className="space-y-3">
              {filteredInsightCards.map((rec, i) =>
              <div
                key={i}
                className="bg-slate-900/50 p-3 rounded-lg border border-slate-700/50 hover:border-slate-600 transition-colors">

                  <div className="flex items-start space-x-3">
                    {rec.priority === 'high' ?
                  <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" /> :

                  <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                  }
                    <p className="text-sm text-slate-300 leading-snug">
                      {rec.text}
                    </p>
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onNavigate('all-recommendations');
              }}
              className="w-full mt-4 py-2 text-sm text-emerald-400 hover:text-emerald-300 font-medium border border-emerald-500/20 hover:bg-emerald-500/10 rounded-lg transition-all">

              View All Recommendations
            </button>
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
              delay: 0.8
            }}
            className="bg-slate-800 border border-slate-700 rounded-xl p-6">

            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-100">
                Edge IoT Assets
              </h3>
              <Cpu className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="space-y-3">
              {iotAssets.slice(0, 3).map((asset) =>
              <div key={asset.id} className="bg-slate-900/50 border border-slate-700/60 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-200 font-medium">
                        {asset.name}
                      </p>
                      <p className="text-xs text-slate-500">{asset.location}</p>
                    </div>
                    <RadioTower className={`w-4 h-4 ${asset.health === 'critical' ? 'text-red-400' : asset.health === 'degraded' ? 'text-amber-400' : 'text-emerald-400'}`} />
                  </div>
                  <div className="mt-2 flex justify-between text-xs">
                    <span className="text-slate-400">{asset.powerMw} MW</span>
                    <span className="text-cyan-300">
                      Edge FCST {Math.round(asset.edgeForecastConfidence * 100)}%
                    </span>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>);

}
