import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { useToast } from '../components/Toast';

const REPORT_TYPES = [
  { id: 'kpi', label: 'KPI summary' },
  { id: 'dispatch', label: 'Dispatch advisory log' },
  { id: 'congestion', label: 'Congestion forecast snapshot' }
];

export function ReportCentrePage() {
  const { showToast } = useToast();
  const [reportType, setReportType] = useState('kpi');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [banner, setBanner] = useState<string | null>(null);

  const handleExport = () => {
    const headers = ['report', 'start', 'end', 'generatedAt'];
    const row = [reportType, startDate, endDate, new Date().toISOString()];
    const csv = [headers.join(','), row.join(',')].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gridflex-${reportType}-${startDate}-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setBanner(`Exported ${reportType} report stub for ${startDate} → ${endDate}. Full datasets will attach when report APIs are wired.`);
    showToast('Report CSV downloaded', 'success');
  };

  return (
    <div className="space-y-6 p-6 pb-20">
      <PageHeader
        title="Report centre"
        description="Pick a report, set a date range, and export CSV"
        breadcrumbs={
          <Breadcrumbs items={[{ label: 'Overview', onClick: () => window.location.assign('/') }, { label: 'Reports' }]} />
        }
        primaryAction={{
          label: 'Export CSV',
          onClick: handleExport,
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
      </div>
    </div>
  );
}
