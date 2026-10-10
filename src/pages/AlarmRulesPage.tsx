import React, { useEffect, useState } from 'react';
import { BellRing } from 'lucide-react';
import { fetchAlarmEvents, type AlarmCentreEvent } from '../services/api';
import { PageHeader } from '../components/PageHeader';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { DataStateBanner } from '../components/DataFetchState';

export function AlarmRulesPage() {
  const [events, setEvents] = useState<AlarmCentreEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const rows = await fetchAlarmEvents({ status: 'open' });
        if (!active) return;
        setEvents(rows.slice(0, 20));
        setError(null);
      } catch (err) {
        if (!active) return;
        setEvents([]);
        setError(err instanceof Error ? err.message : 'Unable to load alarm events.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-6 p-6 pb-20">
      <PageHeader
        title="Alarm rules & events"
        description="Operational alarms (read-only stub — rule editing coming soon)"
        breadcrumbs={
          <Breadcrumbs items={[{ label: 'Overview', onClick: () => window.location.assign('/') }, { label: 'Alarms' }]} />
        }
      />

      <p className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
        Alarm configuration is not editable in the pilot UI. Physical actuation remains disabled.
      </p>

      <DataStateBanner
        loading={loading}
        error={error}
        empty={!loading && !error && events.length === 0}
        emptyMessage="No open alarm events."
        tone="operations"
        onRetry={() => window.location.reload()}
      />

      <ul className="space-y-3">
        {events.map((ev) => (
          <li key={ev.id} className="flex gap-3 rounded-lg border border-slate-800 bg-slate-900/50 p-4">
            <BellRing className="h-5 w-5 shrink-0 text-amber-400" />
            <div>
              <p className="font-medium text-slate-100">{ev.title}</p>
              <p className="text-xs text-slate-500">
                {ev.severity} · {ev.status} · {new Date(ev.startedAt).toLocaleString()}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
