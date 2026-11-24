import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { useToast } from '../components/useToast';
import {
  fetchCurtailmentEvents,
  fetchDashboardSummary,
  fetchForecastAccuracyScores,
  fetchOperatingMode,
  fetchOptimisationRuns,
  listOperatorDecisions,
  listRecoveryAnalyses
} from '../services/api';
import { listRecoveryCasesRemote } from '../services/api';
import { listDecisions } from '../lib/decisionLog';

const REPORT_TYPES = [
  { id: 'full', label: 'Full operational pack (all datasets)' },
  { id: 'kpi', label: 'KPI summary' },
  { id: 'curtailment', label: 'Curtailment events' },
  { id: 'recovery', label: 'Recovery analyses' },
  { id: 'dispatch', label: 'Dispatch / optimisation proposals' },
  { id: 'forecast', label: 'Forecast accuracy' },
  { id: 'financial', label: 'Financial impact' },
  { id: 'carbon', label: 'Carbon impact' },
  { id: 'provenance', label: 'Data provenance' },
  { id: 'decisions', label: 'Approval & recommendation decisions' }
];

const csvEscape = (value: unknown): string => {
  if (value == null) return '';
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

const rowsToCsv = (headers: string[], rows: unknown[][]): string => {
  const lines = [headers.map(csvEscape).join(',')];
  for (const row of rows) {
    lines.push(row.map(csvEscape).join(','));
  }
  return lines.join('\n');
};

const downloadCsv = (filename: string, content: string) => {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const inRange = (iso: string | null | undefined, start: string, end: string): boolean => {
  if (!iso) return true;
  const t = iso.slice(0, 10);
  return t >= start && t <= end;
};

export function ReportCentrePage() {
  const { showToast } = useToast();
  const [reportType, setReportType] = useState('full');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [banner, setBanner] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const [summary, curtailment, recovery, runs, accuracy, apiDecisions, operatingMode, cases] =
        await Promise.all([
          fetchDashboardSummary().catch(() => null),
          fetchCurtailmentEvents({ limit: 200 }).catch(() => []),
          listRecoveryAnalyses({ limit: 100 }).catch(() => []),
          fetchOptimisationRuns().catch(() => []),
          fetchForecastAccuracyScores({ limit: 100 }).catch(() => []),
          listOperatorDecisions({ limit: 200 }).catch(() => []),
          fetchOperatingMode().catch(() => null),
          listRecoveryCasesRemote().catch(() => [])
        ]);
      const localDecisions = listDecisions();
      const sections: string[] = [];

      const include = (id: string) => reportType === 'full' || reportType === id;

      if (include('kpi') && summary) {
        sections.push(
          rowsToCsv(
            ['section', 'metric', 'value', 'start', 'end', 'generatedAt'],
            [
              ['kpi', 'nodes_total', summary.nodes.total, startDate, endDate, new Date().toISOString()],
              ['kpi', 'nodes_online', summary.nodes.online, startDate, endDate, new Date().toISOString()],
              ['kpi', 'avg_power_kw', summary.averages.power, startDate, endDate, new Date().toISOString()],
              ['kpi', 'avg_curtailment', summary.averages.curtailment, startDate, endDate, new Date().toISOString()],
              ['kpi', 'telemetry_environment', summary.telemetryEnvironment ?? 'unknown', startDate, endDate, new Date().toISOString()],
              ['kpi', 'excludes_simulated', summary.excludesSimulated ?? false, startDate, endDate, new Date().toISOString()]
            ]
          )
        );
      }

      if (include('curtailment')) {
        const rows = curtailment
          .filter((e) => inRange(e.startTime, startDate, endDate))
          .map((e) => [
            'curtailment',
            e.id,
            e.plantId ?? '',
            e.status ?? '',
            e.cause ?? '',
            e.estimatedLostEnergyKwh ?? '',
            e.recoverableEnergyKwh ?? '',
            e.curtailedPowerKw ?? '',
            e.startTime ?? '',
            e.endTime ?? '',
            e.plant?.dataSourceType ?? ''
          ]);
        sections.push(
          rowsToCsv(
            [
              'section',
              'eventId',
              'plantId',
              'status',
              'cause',
              'estimatedLostEnergyKwh',
              'recoverableEnergyKwh',
              'curtailedPowerKw',
              'start',
              'end',
              'dataSourceType'
            ],
            rows
          )
        );
      }

      if (include('recovery')) {
        const analysisRows = recovery
          .filter((r) => inRange(r.createdAt, startDate, endDate))
          .map((r) => [
            'recovery_analysis',
            r.id,
            r.plantId ?? '',
            r.status ?? '',
            r.dominantCause ?? '',
            r.lostEnergyKwh ?? '',
            r.revenueAtRiskZar ?? '',
            r.affectedDurationHours ?? '',
            r.algorithmVersion ?? '',
            r.createdAt ?? ''
          ]);
        const caseRows = cases.map((c) => [
          'recovery_case',
          c.caseNumber,
          c.id,
          c.status,
          c.owner,
          c.engineeringReviewer ?? '',
          c.selectedOption ?? '',
          c.actualRecoveredEnergyKwh ?? '',
          c.realisedSavingsZar ?? '',
          c.implementationDate ?? '',
          c.updatedAt
        ]);
        sections.push(
          rowsToCsv(
            [
              'section',
              'id',
              'plantOrCase',
              'status',
              'causeOrOwner',
              'lostOrReviewer',
              'revenueOrOption',
              'durationOrEnergy',
              'algoOrRealised',
              'createdOrImpl',
              'updated'
            ],
            [...analysisRows, ...caseRows]
          )
        );
      }

      if (include('dispatch')) {
        const rows = runs
          .filter((r) => inRange(r.createdAt, startDate, endDate))
          .map((r) => [
            'dispatch_proposal',
            r.id,
            r.plantId,
            r.status,
            r.advisory,
            r.expectedBenefitZar ?? '',
            r.solverVersion,
            r.advisoryLabel ?? '',
            r.createdAt
          ]);
        sections.push(
          rowsToCsv(
            ['section', 'runId', 'plantId', 'status', 'advisory', 'expectedBenefitZar', 'solver', 'label', 'createdAt'],
            rows
          )
        );
      }

      if (include('forecast')) {
        const rows = accuracy
          .filter((r) => inRange(r.scoredAt, startDate, endDate))
          .map((r) => [
            'forecast_accuracy',
            r.id,
            r.plantId,
            r.provider ?? '',
            r.horizonMinutes,
            r.maeKw,
            r.rmseKw,
            r.mapePercent ?? '',
            r.biasKw,
            r.sampleCount,
            r.periodStart,
            r.periodEnd,
            r.scoredAt
          ]);
        sections.push(
          rowsToCsv(
            [
              'section',
              'id',
              'plantId',
              'provider',
              'horizonMinutes',
              'maeKw',
              'rmseKw',
              'mapePercent',
              'biasKw',
              'sampleCount',
              'periodStart',
              'periodEnd',
              'scoredAt'
            ],
            rows
          )
        );
      }

      if (include('financial') || include('carbon')) {
        const lostEnergy = curtailment.reduce((sum, e) => sum + (Number(e.estimatedLostEnergyKwh) || 0), 0);
        const recoverableEnergy = curtailment.reduce((sum, e) => sum + (Number(e.recoverableEnergyKwh) || 0), 0);
        const recoveryRevenue = recovery.reduce((sum, r) => sum + (Number(r.revenueAtRiskZar) || 0), 0);
        const advisoryBenefit = runs.reduce((sum, r) => sum + (Number(r.expectedBenefitZar) || 0), 0);
        const caseRealised = cases.reduce((sum, c) => sum + (Number(c.realisedSavingsZar) || 0), 0);
        // SA grid average emission factor sketch for opportunity carbon (kg CO2e / kWh) — labelled illustrative.
        const carbonFactorKgPerKwh = 0.9;
        const carbonOpportunityKg = lostEnergy * carbonFactorKgPerKwh;
        sections.push(
          rowsToCsv(
            ['section', 'metric', 'value', 'unit', 'label', 'start', 'end'],
            [
              ['financial', 'curtailment_lost_energy', lostEnergy, 'kWh', 'From curtailment events', startDate, endDate],
              ['financial', 'curtailment_recoverable_energy', recoverableEnergy, 'kWh', 'From curtailment events', startDate, endDate],
              ['financial', 'recovery_revenue_at_risk', recoveryRevenue, 'ZAR', 'From recovery analyses', startDate, endDate],
              ['financial', 'recovery_case_realised', caseRealised, 'ZAR', 'Operator-entered case outcomes', startDate, endDate],
              ['financial', 'advisory_expected_benefit', advisoryBenefit, 'ZAR', 'Advisory optimisation — not realised', startDate, endDate],
              ['carbon', 'lost_energy', lostEnergy, 'kWh', 'From curtailment events', startDate, endDate],
              [
                'carbon',
                'carbon_opportunity',
                carbonOpportunityKg.toFixed(2),
                'kgCO2e',
                `Illustrative @ ${carbonFactorKgPerKwh} kg/kWh — not a verified inventory`,
                startDate,
                endDate
              ]
            ]
          )
        );
      }

      if (include('provenance')) {
        sections.push(
          rowsToCsv(
            ['section', 'field', 'value', 'notes'],
            [
              ['provenance', 'operating_mode', operatingMode?.mode ?? 'unknown', operatingMode?.label ?? ''],
              ['provenance', 'kpi_telemetry_environment', summary?.telemetryEnvironment ?? 'unknown', 'From dashboard summary'],
              ['provenance', 'kpi_excludes_simulated', summary?.excludesSimulated ?? '', 'Synthetic exclusion flag'],
              ['provenance', 'report_window_start', startDate, 'Operator-selected'],
              ['provenance', 'report_window_end', endDate, 'Operator-selected'],
              ['provenance', 'generated_at', new Date().toISOString(), 'Export timestamp'],
              ['provenance', 'honesty', 'Synthetic demo rows must not be claimed as customer results', 'GCIP rule']
            ]
          )
        );
      }

      if (include('decisions')) {
        const apiRows = apiDecisions.map((d) => [
          'decision_api',
          d.id,
          d.entityType,
          d.entityId ?? '',
          d.decision ?? d.action,
          d.message ?? '',
          d.createdAt
        ]);
        const localRows = localDecisions
          .filter((d) => inRange(d.createdAt, startDate, endDate))
          .map((d) => [
            'decision_local',
            d.id,
            d.entityType,
            d.entityId,
            d.stage,
            d.reason,
            d.createdAt
          ]);
        sections.push(
          rowsToCsv(
            ['section', 'id', 'entityType', 'entityId', 'decision', 'message', 'createdAt'],
            [...apiRows, ...localRows]
          )
        );
      }

      if (sections.length === 0) {
        throw new Error('No datasets available for the selected report type.');
      }

      const csv = sections.join('\n\n');
      downloadCsv(`gridflex-${reportType}-${startDate}-${endDate}.csv`, csv);
      setBanner(
        `Exported ${reportType} report for ${startDate} → ${endDate} with live KPI, curtailment, recovery, dispatch, forecast, financial/carbon, provenance, and decision datasets where available.`
      );
      showToast('Report CSV downloaded', 'success');
    } catch (err) {
      setBanner(err instanceof Error ? err.message : 'Export failed');
      showToast(err instanceof Error ? err.message : 'Export failed', 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6 p-6 pb-20">
      <PageHeader
        title="Report centre"
        description="Export live KPI, curtailment, recovery, dispatch, forecast, financial, carbon, provenance, and decision datasets"
        breadcrumbs={
          <Breadcrumbs items={[{ label: 'Overview', onClick: () => window.location.assign('/') }, { label: 'Reports' }]} />
        }
        primaryAction={{
          label: exporting ? 'Exporting…' : 'Export CSV',
          onClick: () => void handleExport(),
          icon: Download,
          variant: 'primary'
        }}
      />

      {banner && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{banner}</div>
      )}

      <div className="grid max-w-xl gap-4 rounded-xl border border-slate-800 bg-slate-900/50 p-6">
        <label className="block text-sm text-slate-400">
          Report type
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-200">
            {REPORT_TYPES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="block text-sm text-slate-400">
            Start date
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-200"
            />
          </label>
          <label className="block text-sm text-slate-400">
            End date
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-200"
            />
          </label>
        </div>
        <p className="text-xs text-slate-500">
          Empty sections mean the API returned no rows in range — not a stub CSV. Carbon figures are labelled illustrative.
        </p>
      </div>
    </div>
  );
}
