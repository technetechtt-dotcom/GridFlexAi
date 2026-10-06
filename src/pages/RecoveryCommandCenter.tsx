import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Battery,
  Clock3,
  Download,
  Droplet,
  Factory,
  Leaf,
  Recycle,
  ShieldAlert,
  Zap
} from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { Page } from '../components/Sidebar';
import { ChartSkeleton, DataStateBanner } from '../components/DataFetchState';
import {
  analyseRecoveryWindow,
  downloadRecoveryReportHtml,
  type RecoveryAnalysis,
  type RecoverySample
} from '../services/api';

interface RecoveryCommandCenterProps {
  onNavigate: (page: Page) => void;
}

type ScenarioId = 'export_limit' | 'grid_instruction' | 'inverter_fault';

const SCENARIO_LABELS: Record<ScenarioId, string> = {
  export_limit: 'Export limit',
  grid_instruction: 'Grid instruction',
  inverter_fault: 'Inverter fault'
};

const zar = new Intl.NumberFormat('en-ZA', {
  style: 'currency',
  currency: 'ZAR',
  maximumFractionDigits: 2
});

const num = (value: number, digits = 1) =>
  value.toLocaleString('en-ZA', { maximumFractionDigits: digits, minimumFractionDigits: 0 });

/** Deterministic competition scenarios — always labelled synthetic. */
function buildCompetitionScenario(scenario: ScenarioId): RecoverySample[] {
  const base = Date.UTC(2026, 9, 6, 8, 0, 0);
  return Array.from({ length: 12 }, (_, index) => {
    const timestamp = new Date(base + index * 10 * 60 * 1000).toISOString();
    const constrained = index >= 3 && index <= 9;
    const expectedPowerKw = 520 + index * 18;

    if (scenario === 'export_limit') {
      return {
        timestamp,
        expectedPowerKw,
        actualPowerKw: constrained ? 478 : expectedPowerKw - 8,
        exportLimitKw: 480,
        irradianceWm2: 780 + index * 4,
        inverterAvailable: true,
        gridInstructionActive: false
      };
    }

    if (scenario === 'grid_instruction') {
      return {
        timestamp,
        expectedPowerKw,
        actualPowerKw: constrained ? 360 : expectedPowerKw - 10,
        exportLimitKw: 700,
        irradianceWm2: 790 + index * 3,
        inverterAvailable: true,
        gridInstructionActive: constrained
      };
    }

    return {
      timestamp,
      expectedPowerKw,
      actualPowerKw: constrained ? 35 + index : expectedPowerKw - 12,
      exportLimitKw: 700,
      irradianceWm2: 800 + index * 2,
      inverterAvailable: !constrained,
      gridInstructionActive: false
    };
  });
}

export function RecoveryCommandCenter(_props: RecoveryCommandCenterProps) {
  const [scenario, setScenario] = useState<ScenarioId>('export_limit');
  const [tariffZarPerKwh, setTariffZarPerKwh] = useState(2.25);
  const [flexibleLoadCapacityKw, setFlexibleLoadCapacityKw] = useState(180);
  const [batteryUsableEnergyKwh, setBatteryUsableEnergyKwh] = useState(300);
  const [electrolyserCapacityKw, setElectrolyserCapacityKw] = useState(120);
  const [analysis, setAnalysis] = useState<RecoveryAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const samples = useMemo(() => buildCompetitionScenario(scenario), [scenario]);

  useEffect(() => {
    let active = true;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await analyseRecoveryWindow({
          samples,
          dataEnvironment: 'synthetic_demo',
          annualEventDays: 120,
          estimatedCapexZar: 2_500_000,
          assumptions: {
            intervalMinutes: 10,
            tariffZarPerKwh,
            flexibleLoadCapacityKw,
            batteryUsableEnergyKwh,
            electrolyserCapacityKw
          }
        });
        if (!active) return;
        setAnalysis(result);
      } catch (err) {
        if (!active) return;
        setAnalysis(null);
        setError(err instanceof Error ? err.message : 'Unable to analyse recovery window.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, [
    samples,
    tariffZarPerKwh,
    flexibleLoadCapacityKw,
    batteryUsableEnergyKwh,
    electrolyserCapacityKw,
    refreshKey
  ]);

  const chartData = useMemo(
    () =>
      samples.map((sample) => ({
        time: new Date(sample.timestamp).toLocaleTimeString('en-ZA', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }),
        expected: sample.expectedPowerKw,
        actual: sample.actualPowerKw,
        exportLimit: sample.exportLimitKw ?? null
      })),
    [samples]
  );

  const opportunityIcon = (id: string) => {
    if (id === 'battery') return Battery;
    if (id === 'green_hydrogen') return Droplet;
    return Factory;
  };

  return (
    <div className="p-4 pb-16 sm:p-6 lg:p-8 space-y-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
              <Recycle className="h-3.5 w-3.5" />
              Renewable Energy Recovery Centre
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
              Where clean energy is being lost
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">
              Compare expected and measured generation, classify the likely cause, value the loss in
              rand and carbon, and review safe recovery options. Advisory only — no plant commands.
            </p>
          </div>
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            <div className="flex items-center gap-2 font-medium">
              <ShieldAlert className="h-4 w-4" />
              Advisory only
            </div>
            <p className="mt-1 text-xs text-amber-200/80">
              Physical execution remains disabled. Recommendations are decision aids, not dispatch
              orders.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
          <strong className="font-medium">Competition demonstration — synthetic data.</strong>{' '}
          These scenarios are clearly labelled simulated inputs for product demonstration. They are
          not measurements from an operating solar farm and must not be merged into live KPIs or
          customer reports.
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <h2 className="mb-3 text-sm font-medium text-slate-200">Scenario</h2>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(SCENARIO_LABELS) as ScenarioId[]).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setScenario(id)}
                className={`rounded-lg border px-3 py-2 text-sm transition ${
                  scenario === id
                    ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-200'
                    : 'border-slate-700 bg-slate-950/50 text-slate-300 hover:border-slate-500'
                }`}>
                {SCENARIO_LABELS[id]}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <h2 className="mb-3 text-sm font-medium text-slate-200">Assumptions</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <label className="space-y-1 text-slate-400">
              Tariff (R/kWh)
              <input
                type="number"
                min={0}
                step={0.05}
                value={tariffZarPerKwh}
                onChange={(event) => setTariffZarPerKwh(Number(event.target.value))}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
              />
            </label>
            <label className="space-y-1 text-slate-400">
              Flexible load (kW)
              <input
                type="number"
                min={0}
                step={10}
                value={flexibleLoadCapacityKw}
                onChange={(event) => setFlexibleLoadCapacityKw(Number(event.target.value))}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
              />
            </label>
            <label className="space-y-1 text-slate-400">
              Battery usable (kWh)
              <input
                type="number"
                min={0}
                step={10}
                value={batteryUsableEnergyKwh}
                onChange={(event) => setBatteryUsableEnergyKwh(Number(event.target.value))}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
              />
            </label>
            <label className="space-y-1 text-slate-400">
              Electrolyser (kW)
              <input
                type="number"
                min={0}
                step={10}
                value={electrolyserCapacityKw}
                onChange={(event) => setElectrolyserCapacityKw(Number(event.target.value))}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
              />
            </label>
          </div>
        </div>
      </section>

      {error && (
        <DataStateBanner
          loading={false}
          error={error}
          empty={false}
          onRetry={() => {
            setError(null);
            setRefreshKey((value) => value + 1);
          }}
        />
      )}

      {loading && !analysis ? (
        <ChartSkeleton />
      ) : analysis ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              Algorithm {analysis.algorithmVersion} · {analysis.provenance.dataEnvironment} ·
              material-loss duration {num(analysis.affectedDurationHours, 2)} h
            </p>
            <button
              type="button"
              onClick={() => downloadRecoveryReportHtml(analysis)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 hover:border-emerald-500/40">
              <Download className="h-4 w-4" />
              Download branded report
            </button>
          </div>

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            {[
              {
                label: 'Material energy lost',
                value: `${num(analysis.lostEnergyKwh)} kWh`,
                icon: Zap
              },
              {
                label: 'Revenue at risk',
                value: zar.format(analysis.revenueAtRiskZar),
                icon: AlertTriangle
              },
              {
                label: 'Performance ratio',
                value: `${num(analysis.performanceRatioPercent)}%`,
                icon: Leaf
              },
              {
                label: 'Carbon opportunity',
                value: `${num(analysis.carbonOpportunityKg)} kg CO₂e`,
                icon: Leaf
              },
              {
                label: 'Affected duration',
                value: `${num(analysis.affectedDurationHours, 2)} h`,
                icon: Clock3
              },
              {
                label: 'Affected intervals',
                value: String(analysis.affectedIntervals),
                icon: Recycle
              }
            ].map((kpi) => (
              <motion.div
                key={kpi.label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
                  <kpi.icon className="h-3.5 w-3.5" />
                  {kpi.label}
                </div>
                <div className="text-xl font-semibold text-slate-50">{kpi.value}</div>
              </motion.div>
            ))}
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-sm font-medium text-slate-200">
                  Expected vs measured generation
                </h2>
                <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[11px] text-sky-200">
                  Synthetic scenario
                </span>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="time" stroke="#64748b" fontSize={12} />
                    <YAxis stroke="#64748b" fontSize={12} unit=" kW" />
                    <Tooltip
                      contentStyle={{
                        background: '#0f172a',
                        border: '1px solid #334155',
                        borderRadius: 8
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="expected"
                      name="Expected"
                      stroke="#34d399"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="actual"
                      name="Actual"
                      stroke="#38bdf8"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="exportLimit"
                      name="Export limit"
                      stroke="#f59e0b"
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 space-y-4">
              <div>
                <h2 className="text-sm font-medium text-slate-200">Loss fingerprint</h2>
                <p className="mt-2 text-lg font-semibold text-slate-50">{analysis.causeLabel}</p>
                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-xs text-slate-400">
                    <span>Classification confidence</span>
                    <span>{Math.round(analysis.confidence * 100)}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-emerald-400"
                      style={{ width: `${Math.min(100, analysis.confidence * 100)}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Confidence is a rule-based decision aid, not certainty of root cause.
                  </p>
                </div>
              </div>
              <ul className="space-y-2 text-sm text-slate-300">
                {analysis.evidence.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <h2 className="mb-2 text-sm font-medium text-slate-200">Recommendation</h2>
            <p className="text-sm leading-relaxed text-slate-300">{analysis.recommendation}</p>
            <p className="mt-3 text-xs text-amber-200/90">
              Operator verification required. CAPEX, OPEX, degradation, water, storage and site
              constraints need a separate site-specific business case. {analysis.disclaimer}
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-medium text-slate-200">
              Recovery options (gross value ranking)
            </h2>
            <div className="grid gap-3 md:grid-cols-3">
              {analysis.opportunities.map((option) => {
                const Icon = opportunityIcon(option.id);
                return (
                  <div
                    key={option.id}
                    className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-slate-100">
                        <Icon className="h-4 w-4 text-emerald-300" />
                        <span className="font-medium">{option.label}</span>
                      </div>
                      <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-slate-400">
                        #{option.ranking}
                      </span>
                    </div>
                    <div className="text-xl font-semibold text-slate-50">
                      {zar.format(option.estimatedGrossValueZar)}
                    </div>
                    <div className="mt-1 text-sm text-slate-400">
                      {num(option.recoverableEnergyKwh)} kWh recoverable ({option.readiness})
                    </div>
                    <p className="mt-3 text-xs text-slate-500">{option.notes}</p>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <h2 className="mb-3 text-sm font-medium text-slate-200">Plant digital twin (energy flow)</h2>
              <div className="relative h-56 overflow-hidden rounded-xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/40 p-4">
                <div className="absolute left-6 top-8 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
                  Expected
                  <div className="text-lg font-semibold">{num(analysis.expectedEnergyKwh)} kWh</div>
                </div>
                <div className="absolute right-6 top-8 rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs text-sky-100">
                  Measured
                  <div className="text-lg font-semibold">{num(analysis.actualEnergyKwh)} kWh</div>
                </div>
                <div className="absolute left-1/2 top-1/2 w-40 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-center text-xs text-amber-100">
                  Constrained asset
                  <div className="text-sm font-semibold">{analysis.causeLabel}</div>
                  <div className="mt-1 text-[11px] text-amber-200/80">
                    {num(analysis.lostEnergyKwh)} kWh material loss
                  </div>
                </div>
                <div className="absolute bottom-4 left-6 right-6 flex justify-between text-[11px] text-slate-400">
                  <span>PV / inverter</span>
                  <span>Export / grid</span>
                  <span>Flexible load · BESS · H₂</span>
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Visual twin highlights the constrained path. It is advisory visualisation only and does
                not issue plant commands.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <h2 className="mb-3 text-sm font-medium text-slate-200">Annual financial & payback sketch</h2>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs text-slate-500">Annual lost energy</div>
                  <div className="font-semibold text-slate-100">
                    {num(analysis.annualFinancialModel.annualLostEnergyKwh)} kWh
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Annual revenue at risk</div>
                  <div className="font-semibold text-slate-100">
                    {zar.format(analysis.annualFinancialModel.annualRevenueAtRiskZar)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Top-option annual gross</div>
                  <div className="font-semibold text-slate-100">
                    {zar.format(analysis.annualFinancialModel.topOptionAnnualGrossValueZar)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Simple payback</div>
                  <div className="font-semibold text-slate-100">
                    {analysis.annualFinancialModel.simplePaybackYears == null
                      ? 'n/a'
                      : `${num(analysis.annualFinancialModel.simplePaybackYears, 1)} years`}
                  </div>
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-500">{analysis.annualFinancialModel.notes}</p>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 overflow-x-auto">
            <h2 className="mb-3 text-sm font-medium text-slate-200">Interval-by-interval recovery</h2>
            <table className="min-w-full text-left text-xs text-slate-300">
              <thead className="text-slate-500">
                <tr>
                  <th className="px-2 py-1">Time</th>
                  <th className="px-2 py-1">Expected</th>
                  <th className="px-2 py-1">Actual</th>
                  <th className="px-2 py-1">Material kWh</th>
                  <th className="px-2 py-1">Cause</th>
                </tr>
              </thead>
              <tbody>
                {analysis.intervals.map((interval) => (
                  <tr
                    key={interval.timestamp}
                    className={interval.material ? 'bg-amber-500/5' : undefined}>
                    <td className="px-2 py-1">
                      {new Date(interval.timestamp).toLocaleTimeString('en-ZA', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false
                      })}
                    </td>
                    <td className="px-2 py-1">{num(interval.expectedPowerKw)} kW</td>
                    <td className="px-2 py-1">{num(interval.actualPowerKw)} kW</td>
                    <td className="px-2 py-1">{num(interval.lostEnergyKwh, 2)}</td>
                    <td className="px-2 py-1">{interval.causeLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      ) : null}
    </div>
  );
}
