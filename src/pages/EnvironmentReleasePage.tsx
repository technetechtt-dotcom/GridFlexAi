import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GitCommit, Container, ShieldAlert, ShieldCheck } from 'lucide-react';
import { fetchPlatformHealth } from '../services/api';
import { PageHeader } from '../components/PageHeader';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { DataStateBanner } from '../components/DataFetchState';
import { useAuth } from '../context/useAuth';
import { canAccessOpsCenter } from '../lib/roles';
import { getFrontendReleaseIdentity } from '../lib/frontendRelease';

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

      {!loading && (
        <dl className="mt-4 max-w-2xl divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-900/50">
          <div className="px-6 py-4">
            <dt className="text-sm text-slate-500">Frontend VITE_RELEASE_GIT_SHA</dt>
            <dd className="font-mono text-sm text-slate-100">
              {getFrontendReleaseIdentity().gitSha ?? 'null — set at static build time'}
            </dd>
          </div>
          <div className="px-6 py-4">
            <dt className="text-sm text-slate-500">Frontend VITE_RELEASE_BUILD_ID</dt>
            <dd className="font-mono text-sm text-slate-100">
              {getFrontendReleaseIdentity().buildId ?? 'null'}
            </dd>
          </div>
          <div className="px-6 py-4">
            <dt className="text-sm text-slate-500">Frontend VITE_PUBLIC_ORIGIN</dt>
            <dd className="break-all font-mono text-sm text-slate-100">
              {getFrontendReleaseIdentity().publicOrigin ?? 'null'}
            </dd>
          </div>
        </dl>
      )}

      <p className="mt-4 max-w-2xl text-xs text-slate-500">
        Backend production must set RELEASE_GIT_SHA and RELEASE_IMAGE_DIGEST to the signed Cosign digest. Frontend static
        builds should set VITE_RELEASE_GIT_SHA (and optional VITE_RELEASE_BUILD_ID / VITE_PUBLIC_ORIGIN) so the demo UI
        can show FE release identity. /api/health returns 503 when backend identity is required but missing.
      </p>
    </div>
  );
}
