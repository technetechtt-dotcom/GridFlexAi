import React, { useEffect, useMemo, useState } from 'react';
import { ActivitySquare, ArrowLeft, CloudSun, RefreshCw } from 'lucide-react';
import { Line, LineChart, ResponsiveContainer, Tooltip } from 'recharts';
import { motion } from 'framer-motion';
import { Page } from '../components/Sidebar';
import {
  fetchDailyForecastPredictions,
  fetchNodes,
  fetchForecastProvidersHistory,
  fetchForecastProvidersStatus,
  type DailyForecastPrediction,
  type ForecastProvidersHistory,
  type ForecastProvidersStatus } from
'../services/api';

interface ProviderDiagnosticsProps {
  onNavigate: (page: Page) => void;
}

const POLL_MS = 12000;
const MAX_SPARKLINE_POINTS = 30;
const DAILY_WINDOW_OPTIONS = [7, 14, 30] as const;
const RANGE_OPTIONS = [
{ id: '15m', label: '15m', ms: 15 * 60 * 1000 },
{ id: '1h', label: '1h', ms: 60 * 60 * 1000 },
{ id: '6h', label: '6h', ms: 6 * 60 * 60 * 1000 }] as const;
type RangeOptionId = typeof RANGE_OPTIONS[number]['id'];
type DailyWindowDays = typeof DAILY_WINDOW_OPTIONS[number];

const toScore = (state: 'closed' | 'open' | 'half-open') => {
  if (state === 'closed') return 2;
  if (state === 'half-open') return 1;
  return 0;
};

const labelForScore = (score: number) => {
  if (score === 2) return 'closed';
  if (score === 1) return 'half-open';
  return 'open';
};

const tone = (state: 'closed' | 'open' | 'half-open') => {
  if (state === 'closed') return 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10';
  if (state === 'half-open') return 'text-amber-300 border-amber-500/30 bg-amber-500/10';
  return 'text-red-300 border-red-500/30 bg-red-500/10';
};

export function ProviderDiagnostics({ onNavigate }: ProviderDiagnosticsProps) {
  const [status, setStatus] = useState<ForecastProvidersStatus | null>(null);
  const [history, setHistory] = useState<ForecastProvidersHistory | null>(null);
  const [nodes, setNodes] = useState<Array<{id: string;name: string;}>>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string>('all');
  const [dailyPredictions, setDailyPredictions] = useState<DailyForecastPrediction[]>([]);
  const [dailyPredictionsLoading, setDailyPredictionsLoading] = useState(false);
  const [dailyPredictionsError, setDailyPredictionsError] = useState<string | null>(null);
  const [dailyWindowDays, setDailyWindowDays] = useState<DailyWindowDays>(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRange, setSelectedRange] = useState<RangeOptionId>('1h');

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [statusData, historyData] = await Promise.all([
        fetchForecastProvidersStatus(),
        fetchForecastProvidersHistory()]);
        if (!mounted) return;
        setStatus(statusData);
        setHistory(historyData);
        setError(null);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load provider diagnostics.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();
    const id = setInterval(() => {
      void load();
    }, POLL_MS);

    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadNodes = async () => {
      try {
        const nodeRows = await fetchNodes();
        if (!mounted) return;
        setNodes(nodeRows.map((row) => ({
          id: row.id,
          name: row.name
        })));
      } catch {
        if (!mounted) return;
        setNodes([]);
      }
    };

    void loadNodes();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadDailyPredictions = async () => {
      setDailyPredictionsLoading(true);
      try {
        const startDate = new Date(Date.now() - dailyWindowDays * 24 * 60 * 60 * 1000).toISOString();
        const response = await fetchDailyForecastPredictions({
          nodeId: selectedNodeId === 'all' ? undefined : selectedNodeId,
          startDate,
          page: 1,
          pageSize: 200
        });
        if (!mounted) return;
        setDailyPredictions(response.data);
        setDailyPredictionsError(null);
      } catch (err) {
        if (!mounted) return;
        setDailyPredictions([]);
        setDailyPredictionsError(err instanceof Error ? err.message : 'Failed to load daily predictions.');
      } finally {
        if (mounted) setDailyPredictionsLoading(false);
      }
    };

    void loadDailyPredictions();
    return () => {
      mounted = false;
    };
  }, [selectedNodeId, dailyWindowDays]);

  const chartRows = useMemo(() => {
    if (!history) return [];
    const rangeMs = RANGE_OPTIONS.find((range) => range.id === selectedRange)?.ms ?? 60 * 60 * 1000;
    const cutoff = Date.now() - rangeMs;
    const downsample = <T,>(items: T[]): T[] => {
      if (items.length <= MAX_SPARKLINE_POINTS) return items;
      const step = Math.ceil(items.length / MAX_SPARKLINE_POINTS);
      return items.filter((_, idx) => idx % step === 0);
    };

    const mapPoints = (entries: ForecastProvidersHistory['providers']['forecastSolar']) =>
    downsample(
      entries.
      filter((point) => new Date(point.timestamp).getTime() >= cutoff).
      map((point) => ({
        time: new Date(point.timestamp).toLocaleTimeString(),
        score: toScore(point.state),
        failures: point.failures
      }))
    );

    return [
    {
      key: 'forecastSolar',
      label: 'Forecast.Solar',
      points: mapPoints(history.providers.forecastSolar)
    },
    {
      key: 'openWeather',
      label: 'OpenWeatherMap',
      points: mapPoints(history.providers.openWeather)
    },
    {
      key: 'accuWeather',
      label: 'AccuWeather',
      points: mapPoints(history.providers.accuWeather)
    }];
  }, [history, selectedRange]);

  const dailyPredictionRows = useMemo(() => {
    const grouped = new Map<string, DailyForecastPrediction>();
    for (const row of dailyPredictions) {
      const key = row.forecastDate.slice(0, 10);
      if (!grouped.has(key)) {
        grouped.set(key, row);
      }
    }
    return Array.from(grouped.values()).
    sort((a, b) => a.forecastDate.localeCompare(b.forecastDate)).
    slice(-dailyWindowDays).
    map((row) => ({
      date: new Date(row.forecastDate).toLocaleDateString([], { month: 'short', day: 'numeric' }),
      energy: row.estimatedEnergyKwh,
      peak: row.peakPowerKw
    }));
  }, [dailyPredictions, dailyWindowDays]);

  return (
    <div className="space-y-6 p-6 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('dashboard')}
            className="text-slate-400 hover:text-slate-200 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-slate-100">Provider Diagnostics</h2>
            <p className="text-slate-400">Circuit-breaker transitions and forecast cache telemetry</p>
          </div>
        </div>
        <div className="text-xs text-slate-500 flex items-center gap-2">
          <RefreshCw className="w-3.5 h-3.5" />
          Polling every 12s
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500">Time range:</span>
        {RANGE_OPTIONS.map((range) =>
        <button
          key={range.id}
          onClick={() => setSelectedRange(range.id)}
          className={`px-2.5 py-1 text-xs rounded border transition-colors ${selectedRange === range.id ? 'bg-cyan-500/20 border-cyan-400/40 text-cyan-300' : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'}`}>
            {range.label}
          </button>
        )}
      </div>

      {loading ?
      <div className="text-slate-400">Loading diagnostics...</div> :
      error ?
      <div className="text-red-400">{error}</div> :
      <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {status &&
          [
          {
            name: 'Forecast.Solar',
            state: status.providers.forecastSolar.state,
            failures: status.providers.forecastSolar.failures
          },
          {
            name: 'OpenWeatherMap',
            state: status.providers.openWeather.state,
            failures: status.providers.openWeather.failures
          },
          {
            name: 'AccuWeather',
            state: status.providers.accuWeather.state,
            failures: status.providers.accuWeather.failures
          }].map((provider) =>
          <div key={provider.name} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                  <p className="text-slate-200 font-medium mb-2">{provider.name}</p>
                  <span className={`inline-flex px-2 py-1 text-xs uppercase rounded border ${tone(provider.state)}`}>
                    {provider.state}
                  </span>
                  <p className="text-xs text-slate-500 mt-2">Failures: {provider.failures}</p>
                </div>
          )
          }
          </div>

          <div className="space-y-4">
            {chartRows.map((row) =>
          <motion.div
            key={row.key}
            initial={{
              opacity: 0,
              y: 10
            }}
            animate={{
              opacity: 1,
              y: 0
            }}
            className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-slate-100 font-medium">{row.label}</p>
                  <CloudSun className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="h-20">
                  {row.points.length === 0 ?
                  <div className="h-full flex items-center justify-center text-xs text-slate-500">
                      No transitions in selected range
                    </div> :
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={row.points}>
                      <Tooltip
                        formatter={(value) => labelForScore(Number(value))}
                        labelFormatter={(label) => `Time: ${label}`}
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderColor: '#334155',
                          color: '#e2e8f0'
                        }} />
                      <Line
                        type="monotone"
                        dataKey="score"
                        stroke="#22d3ee"
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                  }
                </div>
              </motion.div>
          )}
          </div>

          {status &&
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 text-sm text-slate-400 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ActivitySquare className="w-4 h-4 text-cyan-400" />
                Cache health
              </span>
              <span>
                Redis {status.cache.redisEnabled ? status.cache.redisConnected ? 'connected' : 'degraded' : 'off'} • in-memory entries: {status.cache.inMemoryEntries} • TTL: {status.cache.ttlMs / 60000}m
              </span>
            </div>
        }

          <motion.div
            initial={{
              opacity: 0,
              y: 10
            }}
            animate={{
              opacity: 1,
              y: 0
            }}
            className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-slate-100 font-medium">Daily Prediction Trend (Last {dailyWindowDays} days)</p>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  {DAILY_WINDOW_OPTIONS.map((days) =>
                  <button
                    key={days}
                    onClick={() => setDailyWindowDays(days)}
                    className={`px-2 py-1 text-xs rounded border transition-colors ${dailyWindowDays === days ? 'bg-cyan-500/20 border-cyan-400/40 text-cyan-300' : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'}`}>
                    {days}d
                  </button>
                  )}
                </div>
                <label className="text-xs text-slate-500">Node</label>
                <select
                  value={selectedNodeId}
                  onChange={(event) => setSelectedNodeId(event.target.value)}
                  className="bg-slate-900 border border-slate-700 text-slate-300 text-xs rounded px-2 py-1">
                  <option value="all">All Nodes</option>
                  {nodes.map((node) =>
                  <option key={node.id} value={node.id}>{node.name}</option>
                  )}
                </select>
              </div>
            </div>
            <div className="h-44">
              {dailyPredictionsLoading ?
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                  Loading daily predictions...
                </div> :
              dailyPredictionsError ?
              <div className="h-full flex items-center justify-center text-xs text-red-400">
                  {dailyPredictionsError}
                </div> :
              dailyPredictionRows.length === 0 ?
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                  No daily predictions stored yet.
                </div> :
              <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailyPredictionRows}>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        color: '#e2e8f0'
                      }} />
                    <Line
                      type="monotone"
                      dataKey="energy"
                      stroke="#34d399"
                      strokeWidth={2}
                      dot={false}
                      name="Energy (kWh)" />
                    <Line
                      type="monotone"
                      dataKey="peak"
                      stroke="#38bdf8"
                      strokeWidth={2}
                      dot={false}
                      name="Peak (kW)" />
                  </LineChart>
                </ResponsiveContainer>
              }
            </div>
          </motion.div>
        </>
      }
    </div>);
}
