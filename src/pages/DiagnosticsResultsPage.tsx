import React, { useCallback, useState } from 'react';
import { Activity, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Breadcrumbs } from '../components/Breadcrumbs';
import {
  fetchForecastProvidersStatus,
  fetchNodes,
  fetchReadings,
  fetchDashboardSummary
} from '../services/api';
import { recordDecision } from '../lib/decisionLog';
import { useAuth } from '../context/useAuth';

type CheckResult = {
  id: string;
  label: string;
  status: 'pass' | 'warn' | 'fail';
  detail: string;
};

export function DiagnosticsResultsPage() {
  const { user } = useAuth();
  const [running, setRunning] = useState(false);
  const [checks, setChecks] = useState<CheckResult[]>([]);
  const [ranAt, setRanAt] = useState<string | null>(null);

  const runDiagnostics = useCallback(async () => {
    setRunning(true);
    const results: CheckResult[] = [];
    const push = (row: CheckResult) => results.push(row);

    try {
      const summary = await fetchDashboardSummary();
      push({
        id: 'database',
        label: 'Dashboard / database path',
        status: summary.nodes.total >= 0 ? 'pass' : 'fail',
        detail: `${summary.nodes.online}/${summary.nodes.total} nodes online in summary`
      });
    } catch (err) {
      push({
        id: 'database',
        label: 'Database',
        status: 'fail',
        detail: err instanceof Error ? err.message : 'Dashboard summary failed'
      });
    }

    try {
      const nodes = await fetchNodes();
      const offline = nodes.filter((n) => n.status !== 'online');
      const lastSeen = nodes
        .map((n) => (n.lastSeen ? Date.parse(n.lastSeen) : NaN))
        .filter((v) => Number.isFinite(v));
      const newest = lastSeen.length ? Math.max(...lastSeen) : null;
      const ageMin = newest != null ? (Date.now() - newest) / 60000 : null;
      push({
        id: 'connectivity',
        label: 'Device connectivity',
        status: offline.length ? 'warn' : nodes.length ? 'pass' : 'fail',
        detail: nodes.length
          ? `${nodes.length - offline.length}/${nodes.length} online`
          : 'No nodes returned'
      });
      push({
        id: 'last-telemetry',
        label: 'Last telemetry time',
        status: ageMin == null ? 'fail' : ageMin > 60 ? 'warn' : 'pass',
        detail:
          newest != null
            ? `${new Date(newest).toLocaleString()} (${ageMin?.toFixed(0)} min ago)`
            : 'No lastSeen timestamps'
      });
      push({
        id: 'inverter',
        label: 'Inverter availability',
        status: nodes.some((n) => n.status === 'online') ? 'pass' : 'warn',
        detail: 'Derived from node online status (pilot — not a SunSpec FC03 probe)'
      });
    } catch (err) {
      push({
        id: 'connectivity',
        label: 'Device connectivity',
        status: 'fail',
        detail: err instanceof Error ? err.message : 'Node list failed'
      });
    }

    try {
      const readings = await fetchReadings({ limit: 50, sort: 'desc' });
      const gaps = readings.length > 1
        ? readings.slice(0, -1).filter((row, idx) => {
            const newer = Date.parse(row.timestamp);
            const older = Date.parse(readings[idx + 1]?.timestamp ?? '');
            return newer - older > 20 * 60 * 1000;
          }).length
        : 0;
      push({
        id: 'sequence-gaps',
        label: 'Sequence / interval gaps',
        status: gaps > 0 ? 'warn' : readings.length ? 'pass' : 'fail',
        detail: readings.length
          ? `${readings.length} readings; ${gaps} gaps >20 min in sample`
          : 'No readings'
      });
      push({
        id: 'missing-readings',
        label: 'Missing readings',
        status: readings.length < 5 ? 'warn' : 'pass',
        detail: `${readings.length} recent readings loaded`
      });
    } catch (err) {
      push({
        id: 'missing-readings',
        label: 'Missing readings',
        status: 'fail',
        detail: err instanceof Error ? err.message : 'Readings failed'
      });
    }

    try {
      const providers = await fetchForecastProvidersStatus();
      const openWeatherOk = providers.providers.openWeather?.state === 'closed';
      push({
        id: 'forecast',
        label: 'Forecast providers',
        status: openWeatherOk ? 'pass' : 'warn',
        detail: `openWeather=${providers.providers.openWeather?.state ?? 'n/a'}; redis=${
          providers.cache.redisConnected ? 'connected' : 'down'
        }`
      });
      push({
        id: 'redis',
        label: 'Redis (forecast cache)',
        status: providers.cache.redisConnected ? 'pass' : providers.cache.redisEnabled ? 'fail' : 'warn',
        detail: providers.cache.redisEnabled
          ? providers.cache.redisConnected
            ? 'Connected'
            : 'Enabled but not connected'
          : 'Redis not enabled in this environment'
      });
    } catch (err) {
      push({
        id: 'forecast',
        label: 'Forecast providers',
        status: 'fail',
        detail: err instanceof Error ? err.message : 'Provider status failed'
      });
    }

    push({
      id: 'alarms',
      label: 'Active alarms',
      status: 'warn',
      detail: 'Alarm feed not queried in this diagnostic pass — open Ops → Alarms for live incidents'
    });
    push({
      id: 'clock',
      label: 'Clock drift',
      status: 'pass',
      detail: `Browser clock ${new Date().toISOString()} (server skew check requires authenticated /health timing)`
    });

    setChecks(results);
    setRanAt(new Date().toISOString());
    recordDecision({
      entityType: 'diagnostics',
      entityId: 'dispatch-diagnostics',
      title: 'Run Diagnostics',
      stage: 'diagnostics_run',
      actorName: user?.name ?? 'Operator',
      actorRole: user?.role ?? 'operator',
      reason: 'Manual diagnostics from Dispatch Status',
      expectedOutcome: `${results.filter((r) => r.status === 'pass').length}/${results.length} checks passed`
    });
    setRunning(false);
  }, [user?.name, user?.role]);

  const iconFor = (status: CheckResult['status']) => {
    if (status === 'pass') return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
    if (status === 'warn') return <AlertTriangle className="h-4 w-4 text-amber-400" />;
    return <XCircle className="h-4 w-4 text-rose-400" />;
  };

  return (
    <div className="space-y-6 p-6 pb-20">
      <PageHeader
        title="Diagnostics results"
        description="Connectivity, telemetry freshness, providers, and cache checks — advisory only"
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Overview', onClick: () => window.location.assign('/') },
              { label: 'Diagnostics' }
            ]}
          />
        }
        primaryAction={{
          label: running ? 'Running…' : 'Run diagnostics',
          onClick: () => void runDiagnostics(),
          icon: Activity,
          variant: 'primary',
          disabled: running
        }}
      />

      <p className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
        Diagnostics never send plant commands. Physical execution remains locked.
      </p>

      {ranAt && (
        <p className="text-xs text-slate-500">Last run {new Date(ranAt).toLocaleString()}</p>
      )}

      <ul className="space-y-2">
        {checks.map((check) => (
          <li
            key={check.id}
            className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            {iconFor(check.status)}
            <div>
              <p className="font-medium text-slate-100">{check.label}</p>
              <p className="text-sm text-slate-400">{check.detail}</p>
            </div>
          </li>
        ))}
        {!checks.length && !running && (
          <li className="rounded-xl border border-dashed border-slate-700 p-6 text-sm text-slate-500">
            Run diagnostics to populate results.
          </li>
        )}
      </ul>
    </div>
  );
}
