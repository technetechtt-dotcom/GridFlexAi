import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GitCommit, Container, ShieldAlert, ShieldCheck } from 'lucide-react';
import { fetchPlatformHealth } from '../services/api';
import { PageHeader } from '../components/PageHeader';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { DataStateBanner } from '../components/DataFetchState';
import { useAuth } from '../context/AuthContext';
import { canAccessOpsCenter } from '../lib/roles';

export function EnvironmentReleasePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = canAccessOpsCenter(user?.role);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gitSha, setGitSha] = useState<string | null>(null);
  const [imageDigest, setImageDigest] = useState<string | null>(null);
  const [timestamp, setTimestamp] = useState<string | null>(null);
  const [identityValid, setIdentityValid] = useState<boolean | null>(null);
  const [identityRequired, setIdentityRequired] = useState<boolean | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const health = await fetchPlatformHealth();
        if (!active) return;
        setGitSha(health.release.gitSha);
        setImageDigest(health.release.imageDigest);
        setTimestamp(health.timestamp);
        setIdentityValid(health.releaseIdentityValid ?? Boolean(health.release.gitSha && health.release.imageDigest));
        setIdentityRequired(health.releaseIdentityRequired ?? null);
        setStatus(health.status);
        setError(null);
      } catch (err) {
        if (!active) return;
        // Ready probe may return 503 when identity missing — still parse body if present
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

  if (!isAdmin) {
    return (
      <div className="space-y-6 p-6 pb-20">
        <PageHeader
          title="Environment & release"
          description="Administrator access required"
          breadcrumbs={
            <Breadcrumbs items={[{ label: 'Overview', onClick: () => navigate('/') }, { label: 'Release' }]} />
          }
        />
        <p className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Release identity is restricted to Ops Center roles.
        </p>
      </div>
    );
  }

  const identityOk = Boolean(gitSha && imageDigest);

  return (
    <div className="space-y-6 p-6 pb-20">
      <PageHeader
        title="System status & release identity"
        description="Administrator view of digest-pinned build identity from /api/health"
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Overview', onClick: () => navigate('/') },
              { label: 'Help', onClick: () => navigate('/help') },
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

      {!loading && (
        <div
          className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
            identityOk
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
              : 'border-red-500/30 bg-red-500/10 text-red-100'
          }`}>
          {identityOk ? <ShieldCheck className="mt-0.5 h-5 w-5" /> : <ShieldAlert className="mt-0.5 h-5 w-5" />}
          <div>
            <p className="font-medium">
              {identityOk
                ? 'Release identity present — digest-pinned deployment can be verified'
                : 'Release identity missing — host may be source-built; do not treat as production'}
            </p>
            <p className="mt-1 text-xs opacity-80">
              health.status={status ?? '—'} · required={String(identityRequired)} · valid={String(identityValid)}
            </p>
          </div>
        </div>
      )}

      {!loading && !error && (
        <dl className="max-w-2xl divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-900/50">
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

      <p className="max-w-2xl text-xs text-slate-500">
        Production deployments must set RELEASE_GIT_SHA and RELEASE_IMAGE_DIGEST to the signed Cosign digest. Readiness
        (/api/health) returns 503 when identity is required but missing.
      </p>
    </div>
  );
}
