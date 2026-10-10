import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Factory, Plus } from 'lucide-react';
import { fetchPlants, type PlantSummary } from '../services/api';
import { PageHeader } from '../components/PageHeader';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { DataStateBanner } from '../components/DataFetchState';

export function PlantPortfolioPage() {
  const [plants, setPlants] = useState<PlantSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const rows = await fetchPlants();
        if (!active) return;
        setPlants(rows);
        setError(null);
      } catch (err) {
        if (!active) return;
        setPlants([]);
        setError(err instanceof Error ? err.message : 'Unable to load plants.');
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
        title="Plant portfolio"
        description="Registered generation and flexible assets (read-only in pilot)"
        breadcrumbs={
          <Breadcrumbs items={[{ label: 'Overview', onClick: () => window.location.assign('/') }, { label: 'Plants' }]} />
        }
      />

      <DataStateBanner
        loading={loading}
        error={error}
        empty={!loading && !error && plants.length === 0}
        emptyMessage="No plants are registered for your organisation yet."
        tone="operations"
        onRetry={() => {
          setLoading(true);
          setError(null);
          void fetchPlants()
            .then(setPlants)
            .catch((e) => setError(e instanceof Error ? e.message : 'Retry failed'))
            .finally(() => setLoading(false));
        }}
      />

      {!loading && plants.length > 0 && (
        <ul className="grid gap-4 md:grid-cols-2">
          {plants.map((plant) => (
            <li
              key={plant.id}
              className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
              <div className="flex items-start gap-3">
                <Factory className="h-5 w-5 shrink-0 text-emerald-400" />
                <div>
                  <h2 className="font-semibold text-slate-100">{plant.name}</h2>
                  <p className="text-xs text-slate-500">{plant.code ?? plant.id}</p>
                  <p className="mt-2 text-sm text-slate-400">
                    Installed {plant.installedCapacityKw?.toLocaleString() ?? '—'} kW · Export{' '}
                    {plant.exportCapacityKw?.toLocaleString() ?? '—'} kW
                  </p>
                  <p className="text-xs text-slate-500 capitalize">Source: {plant.dataSourceType}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!loading && plants.length === 0 && !error && (
        <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center">
          <p className="text-slate-400">Onboard a plant via Ops Center when your tenant is provisioned.</p>
          <Link
            to="/ops"
            className="mt-4 inline-flex items-center text-sm font-medium text-emerald-400 hover:text-emerald-300">
            <Plus className="mr-1 h-4 w-4" />
            Open Ops Center
          </Link>
        </div>
      )}
    </div>
  );
}
