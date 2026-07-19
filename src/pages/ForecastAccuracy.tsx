import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Target } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  LineChart,
  Line,
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
  fetchForecastAccuracyScores,
  fetchPlants,
  type ForecastAccuracyScoreRow
} from '../services/api';

interface ForecastAccuracyProps {
  onNavigate: (page: Page) => void;
}

export function ForecastAccuracy({ onNavigate }: ForecastAccuracyProps) {
  const [scores, setScores] = useState<ForecastAccuracyScoreRow[]>([]);
  const [plantLabel, setPlantLabel] = useState('No plant');
  const [simulated, setSimulated] = useState(true);
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
        const plants = await fetchPlants();
        const plant = plants[0];
        if (!plant) {
          if (!active) return;
          setScores([]);
          setPlantLabel('No plant');
          setSimulated(true);
          setError(null);
          return;
        }
        const rows = await fetchForecastAccuracyScores({ plantId: plant.id });
        if (!active) return;
        setScores(rows);
        setPlantLabel(plant.name);
        setSimulated(plant.dataSourceType === 'simulated' || rows.length === 0);
        setError(null);
      } catch (err) {
        if (!active) return;
        setScores([]);
        setError(err instanceof Error ? err.message : 'Unable to load forecast accuracy scores.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [refreshKey]);

  const latest = scores[0];
  const chartRows = useMemo(
    () =>
      [...scores]
        .reverse()
        .slice(-14)
        .map((row) => ({
          day: new Date(row.scoredAt).toLocaleDateString([], { month: 'short', day: 'numeric' }),
          mae: Number(row.maeKw.toFixed(2)),
          rmse: Number(row.rmseKw.toFixed(2)),
          bias: Number(row.biasKw.toFixed(2))
        })),
    [scores]
  );

  return (
    <div className="space-y-6 p-6 pb-20">
      {simulated ? (
        <SimulationBanner
          featureName="Forecast accuracy"
          detail="Scores are MAE/RMSE/MAPE/bias from stored forecast vintages versus actuals. Clear-sky and persistence baselines are estimated stubs — not measured irradiance."
        />
      ) : null}

      <div className="flex items-center space-x-4 mb-6">
        <button
          onClick={() => onNavigate('dashboard')}
          className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Forecast Accuracy</h2>
          <p className="text-slate-400">Plant: {plantLabel} · horizon-aware scoring</p>
        </div>
      </div>

      <DataStateBanner
        loading={loading}
        error={error}
        empty={!loading && !error && scores.length === 0}
        emptyMessage="No forecast accuracy scores yet. Score a forecast run once actuals are available."
        tone="analyst"
        onRetry={handleRetry}
        retryLabel="Retry analysis"
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-sm">MAE</span>
            <Target className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-3xl font-bold text-slate-100">{latest ? `${latest.maeKw.toFixed(2)} kW` : '—'}</div>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <span className="text-slate-400 text-sm">RMSE</span>
          <div className="text-3xl font-bold text-slate-100 mt-2">{latest ? `${latest.rmseKw.toFixed(2)} kW` : '—'}</div>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <span className="text-slate-400 text-sm">MAPE</span>
          <div className="text-3xl font-bold text-slate-100 mt-2">
            {latest?.mapePercent != null ? `${latest.mapePercent.toFixed(1)}%` : '—'}
          </div>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <span className="text-slate-400 text-sm">Bias</span>
          <div className="text-3xl font-bold text-slate-100 mt-2">{latest ? `${latest.biasKw.toFixed(2)} kW` : '—'}</div>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-slate-800 border border-slate-700 rounded-xl p-6"
      >
        <h3 className="text-lg font-semibold text-slate-100 mb-6">Error trend</h3>
        <div className="h-[400px] w-full">
          {loading ? (
            <ChartSkeleton heightClass="h-[400px]" />
          ) : !chartRows.length ? (
            <div className="h-[400px] rounded-lg border border-slate-700 bg-slate-900/50 flex items-center justify-center text-sm text-slate-400">
              Accuracy trend renders after scored forecast vintages exist.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartRows}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="day" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} unit=" kW" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f1f5f9' }}
                />
                <Legend />
                <Line type="monotone" dataKey="mae" stroke="#22d3ee" strokeWidth={2} name="MAE (kW)" />
                <Line type="monotone" dataKey="rmse" stroke="#a855f7" strokeWidth={2} name="RMSE (kW)" />
                <Line type="monotone" dataKey="bias" stroke="#f59e0b" strokeWidth={2} name="Bias (kW)" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </motion.div>
    </div>
  );
}
