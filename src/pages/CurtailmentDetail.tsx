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
  Legend
} from 'recharts';
import { Page } from '../components/Sidebar';
import { SimulationBanner } from '../components/SimulationBanner';
import { ChartSkeleton, DataStateBanner } from '../components/DataFetchState';
import {
  fetchCurtailmentEvents,
  reviewCurtailmentEvent,
  type CurtailmentEventSummary
} from '../services/api';

interface CurtailmentDetailProps {
  onNavigate: (page: Page) => void;
}

export function CurtailmentDetail({ onNavigate }: CurtailmentDetailProps) {
  const [events, setEvents] = useState<CurtailmentEventSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [reviewBusy, setReviewBusy] = useState(false);

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    setRefreshKey((prev) => prev + 1);
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const rows = await fetchCurtailmentEvents({ limit: 100 });
        if (!active) return;
        setEvents(rows);
        setSelectedId((prev) => prev ?? rows[0]?.id ?? null);
        setError(null);
      } catch (err) {
        if (!active) return;
        setEvents([]);
        setError(err instanceof Error ? err.message : 'Unable to load curtailment events.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [refreshKey]);

  const selected = useMemo(
    () => events.find((event) => event.id === selectedId) ?? null,
    [events, selectedId]
  );

  const isSimulated = events.some((event) => event.plant?.dataSourceType === 'simulated') || events.length === 0;

  const causeRows = useMemo(() => {
    const counts = new Map<string, number>();
    events.forEach((event) => {
      counts.set(event.cause, (counts.get(event.cause) ?? 0) + event.estimatedLostEnergyKwh);
    });
    const total = Array.from(counts.values()).reduce((sum, value) => sum + value, 0) || 1;
    return Array.from(counts.entries()).map(([reason, energy]) => ({
      reason: reason.replace(/_/g, ' '),
      value: Number(((energy / total) * 100).toFixed(1)),
      fill: reason.includes('fault') ? '#64748b' : reason.includes('export') || reason.includes('grid') ? '#ef4444' : '#f59e0b'
    }));
  }, [events]);

  const stats = useMemo(() => {
    const lost = events.reduce((sum, event) => sum + event.estimatedLostEnergyKwh, 0);
    const recoverable = events.reduce((sum, event) => sum + event.recoverableEnergyKwh, 0);
    const peak = events.reduce(
      (best, event) => (event.curtailedPowerKw > best.curtailedPowerKw ? event : best),
      events[0] ?? null
    );
    return {
      lostKwh: Number(lost.toFixed(2)),
      recoverableKwh: Number(recoverable.toFixed(2)),
      peakLabel: peak ? new Date(peak.startTime).toLocaleString() : 'N/A'
    };
  }, [events]);

  const onConfirm = async () => {
    if (!selected) return;
    setReviewBusy(true);
    try {
      await reviewCurtailmentEvent(selected.id, {
        status: 'confirmed',
        operatorNotes: notes || undefined
      });
      setNotes('');
      setRefreshKey((prev) => prev + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Review failed.');
    } finally {
      setReviewBusy(false);
    }
  };

  return (
    <div className="space-y-6 p-6 pb-20">
      {isSimulated ? (
        <SimulationBanner
          featureName="Curtailment detection"
          detail="Events are calculated from plant telemetry or synthetic fixtures. Equipment faults are never counted as recoverable grid curtailment. Physical control remains disabled."
        />
      ) : null}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => onNavigate('dashboard')}
            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-slate-100">Curtailment Control Center</h2>
            <p className="text-slate-400">Detected events, evidence, and operator review (kW / kWh)</p>
          </div>
        </div>
        <button
          onClick={() => onNavigate('ai-assistant')}
          className="inline-flex items-center justify-center px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors font-medium"
        >
          <Bot className="w-4 h-4 mr-2" />
          Ask Zolt AI About Curtailment
        </button>
      </div>

      <DataStateBanner
        loading={loading}
        error={error}
        empty={!loading && !error && events.length === 0}
        emptyMessage="No curtailment events yet. Run detection once telemetry samples are available."
        tone="operations"
        onRetry={handleRetry}
        retryLabel="Retry feed"
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-slate-400">Estimated lost energy</p>
            <TrendingDown className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-3xl font-bold text-slate-100">{stats.lostKwh} kWh</p>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-slate-400">Recoverable energy</p>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-3xl font-bold text-slate-100">{stats.recoverableKwh} kWh</p>
          <p className="text-xs text-slate-500 mt-2">Excludes equipment faults and maintenance</p>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-slate-400">Peak event start</p>
            <Clock3 className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-lg font-bold text-slate-100">{stats.peakLabel}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="xl:col-span-2 bg-slate-800 border border-slate-700 rounded-xl p-6"
        >
          <h3 className="text-lg font-semibold text-slate-100 mb-4">Detected events</h3>
          {loading ? (
            <ChartSkeleton heightClass="h-[280px]" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-slate-700">
                    <th className="py-2">Start</th>
                    <th className="py-2">Cause</th>
                    <th className="py-2">Curtailed kW</th>
                    <th className="py-2">Lost kWh</th>
                    <th className="py-2">Recoverable</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((event) => (
                    <tr
                      key={event.id}
                      onClick={() => setSelectedId(event.id)}
                      className={`border-b border-slate-800 cursor-pointer ${
                        selectedId === event.id ? 'bg-cyan-500/10' : 'hover:bg-slate-900/60'
                      }`}
                    >
                      <td className="py-2 text-slate-200">{new Date(event.startTime).toLocaleString()}</td>
                      <td className="py-2 text-slate-300">{event.cause.replace(/_/g, ' ')}</td>
                      <td className="py-2 text-amber-300">{event.curtailedPowerKw.toFixed(1)}</td>
                      <td className="py-2 text-slate-200">{event.estimatedLostEnergyKwh.toFixed(2)}</td>
                      <td className="py-2 text-emerald-300">{event.recoverableEnergyKwh.toFixed(2)}</td>
                      <td className="py-2 text-slate-400">{event.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>

        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-4">
          <h3 className="text-lg font-semibold text-slate-100">Event review</h3>
          {selected ? (
            <>
              <p className="text-sm text-slate-300">
                {selected.plant?.name ?? selected.plantId} · {selected.calculationVersion}
              </p>
              <p className="text-xs text-slate-400">
                Available {selected.availablePowerKw.toFixed(1)} kW − actual {selected.actualPowerKw.toFixed(1)} kW
              </p>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Operator notes / correction (does not overwrite original calc)"
                className="w-full h-28 rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-200"
              />
              <button
                disabled={reviewBusy}
                onClick={() => void onConfirm()}
                className="w-full px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium disabled:opacity-50"
              >
                Confirm event
              </button>
            </>
          ) : (
            <div className="flex items-center text-slate-400 text-sm gap-2">
              <AlertTriangle className="w-4 h-4" />
              Select an event to review.
            </div>
          )}
        </div>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-slate-100 mb-6">Cause mix (by lost energy)</h3>
        <div className="h-[280px] w-full">
          {loading ? (
            <ChartSkeleton heightClass="h-[280px]" />
          ) : !causeRows.length ? (
            <div className="h-[280px] rounded-lg border border-slate-700 bg-slate-900/50 flex items-center justify-center text-sm text-slate-400">
              Cause distribution appears when events exist.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={causeRows}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="reason" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={12} unit="%" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f1f5f9' }}
                />
                <Legend />
                <Bar dataKey="value" name="Share %" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
