import React, { useEffect, useState } from 'react';
import { GitCommit, Container } from 'lucide-react';
import { fetchPlatformHealth } from '../services/api';
import { PageHeader } from '../components/PageHeader';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { DataStateBanner } from '../components/DataFetchState';

export function EnvironmentReleasePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gitSha, setGitSha] = useState<string | null>(null);
  const [imageDigest, setImageDigest] = useState<string | null>(null);
  const [timestamp, setTimestamp] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const health = await fetchPlatformHealth();
        if (!active) return;
        setGitSha(health.release.gitSha);
        setImageDigest(health.release.imageDigest);
        setTimestamp(health.timestamp);
        setError(null);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to reach /api/health.');
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
        title="Environment & release"
        description="Build identity from the platform health endpoint"
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Overview', onClick: () => window.location.assign('/') },
              { label: 'Help', onClick: () => window.location.assign('/help') },
              { label: 'Release' }
            ]}
          />
        }
      />

      <DataStateBanner
        loading={loading}
        error={error}
        empty={false}
        tone="analyst"
        onRetry={() => window.location.reload()}
      />

      {!loading && !error && (
        <dl className="max-w-lg divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-3 px-6 py-4">
            <GitCommit className="h-5 w-5 text-emerald-400" />
            <div className="flex-1">
              <dt className="text-sm text-slate-500">release.gitSha</dt>
              <dd className="font-mono text-sm text-slate-100">{gitSha ?? 'null — not set in environment'}</dd>
            </div>
          </div>
          <div className="flex items-center gap-3 px-6 py-4">
            <Container className="h-5 w-5 text-emerald-400" />
            <div className="flex-1">
              <dt className="text-sm text-slate-500">release.imageDigest</dt>
              <dd className="break-all font-mono text-sm text-slate-100">
                {imageDigest ?? 'null — not set in environment'}
              </dd>
            </div>
          </div>
          {timestamp && (
            <div className="px-6 py-4">
              <dt className="text-sm text-slate-500">Health check time</dt>
              <dd className="text-sm text-slate-300">{new Date(timestamp).toLocaleString()}</dd>
            </div>
          )}
        </dl>
      )}
    </div>
  );
}
