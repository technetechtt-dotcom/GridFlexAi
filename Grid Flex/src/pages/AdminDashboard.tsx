import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, ShieldCheck, Server, AlertTriangle, Activity, ArrowRight, Trash2, Save } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';

import { KPICard } from '../components/KPICard';
import type { Page } from '../components/Sidebar';
import {
  createAdminApiCredential,
  createAdminClient,
  createAdminSite,
  deleteAdminApiCredential,
  deleteAdminClient,
  deleteAdminSite,
  fetchAdminApiCredentials,
  fetchAdminClients,
  fetchAdminDashboardSummary,
  fetchAdminNodes,
  fetchAdminSites,
  type AdminApiCredential,
  type AdminClient,
  type AdminDashboardSummary,
  type AdminNode,
  type AdminSite,
  updateAdminNode } from
'../services/api';

interface AdminDashboardProps {
  onNavigate: (page: Page) => void;
}

const emptyState: AdminDashboardSummary = {
  generatedAt: new Date().toISOString(),
  overview: {
    usersTotal: 0,
    activeSessions: 0,
    nodesTotal: 0,
    nodesOnline: 0,
    nodesOffline: 0,
    staleNodes: 0,
    readings24h: 0
  },
  alerts: {
    offlineNodes: 0,
    staleNodes: 0,
    highCurtailmentNodes: 0
  },
  providerHealth: {
    forecastSolar: 'closed',
    openWeather: 'closed',
    openWeatherConfigured: false,
    accuWeather: 'closed',
    accuWeatherConfigured: false
  },
  ingestionHourly: [],
  recentUsers: [],
  nodes: []
};

const toLabel = (state: 'closed' | 'open' | 'half-open') => {
  if (state === 'closed') return 'Healthy';
  if (state === 'half-open') return 'Recovering';
  return 'Degraded';
};

export function AdminDashboard({ onNavigate }: AdminDashboardProps) {
  const [data, setData] = useState<AdminDashboardSummary>(emptyState);
  const [clients, setClients] = useState<AdminClient[]>([]);
  const [sites, setSites] = useState<AdminSite[]>([]);
  const [nodes, setNodes] = useState<AdminNode[]>([]);
  const [apiCredentials, setApiCredentials] = useState<AdminApiCredential[]>([]);
  const [clientForm, setClientForm] = useState({
    name: '',
    slug: '',
    contactEmail: ''
  });
  const [siteForm, setSiteForm] = useState({
    clientId: '',
    name: '',
    code: '',
    location: '',
    timezone: 'UTC'
  });
  const [credentialForm, setCredentialForm] = useState({
    provider: 'custom' as 'openai' | 'openweather' | 'accuweather' | 'custom',
    name: '',
    apiKey: '',
    clientId: '',
    siteId: '',
    notes: ''
  });
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadAll = async () => {
    const [summary, clientRows, siteRows, nodeRows, credentialRows] = await Promise.all([
      fetchAdminDashboardSummary(),
      fetchAdminClients(),
      fetchAdminSites(),
      fetchAdminNodes(),
      fetchAdminApiCredentials()
    ]);
    setData(summary);
    setClients(clientRows);
    setSites(siteRows);
    setNodes(nodeRows);
    setApiCredentials(credentialRows);
  };

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        await loadAll();
        if (!active) return;
      } catch {
        // Keep existing state if admin endpoint is temporarily unavailable.
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  const clientOptions = useMemo(
    () => clients.map((client) => ({ id: client.id, label: `${client.name} (${client.slug})` })),
    [clients]
  );

  const onCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientForm.name.trim() || !clientForm.slug.trim()) return;
    setBusy(true);
    setStatusMessage(null);
    try {
      await createAdminClient({
        name: clientForm.name.trim(),
        slug: clientForm.slug.trim(),
        contactEmail: clientForm.contactEmail.trim() || undefined
      });
      setClientForm({ name: '', slug: '', contactEmail: '' });
      await loadAll();
      setStatusMessage('Client created.');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Failed to create client.');
    } finally {
      setBusy(false);
    }
  };

  const onCreateSite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteForm.clientId || !siteForm.name.trim() || !siteForm.code.trim()) return;
    setBusy(true);
    setStatusMessage(null);
    try {
      await createAdminSite({
        clientId: siteForm.clientId,
        name: siteForm.name.trim(),
        code: siteForm.code.trim(),
        location: siteForm.location.trim() || 'Unknown',
        timezone: siteForm.timezone.trim() || 'UTC'
      });
      setSiteForm({
        clientId: '',
        name: '',
        code: '',
        location: '',
        timezone: 'UTC'
      });
      await loadAll();
      setStatusMessage('Site created.');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Failed to create site.');
    } finally {
      setBusy(false);
    }
  };

  const onCreateCredential = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!credentialForm.name.trim() || !credentialForm.apiKey.trim()) return;
    setBusy(true);
    setStatusMessage(null);
    try {
      await createAdminApiCredential({
        provider: credentialForm.provider,
        name: credentialForm.name.trim(),
        apiKey: credentialForm.apiKey.trim(),
        clientId: credentialForm.clientId || undefined,
        siteId: credentialForm.siteId || undefined,
        notes: credentialForm.notes.trim() || undefined
      });
      setCredentialForm({
        provider: 'custom',
        name: '',
        apiKey: '',
        clientId: '',
        siteId: '',
        notes: ''
      });
      await loadAll();
      setStatusMessage('API credential metadata added.');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Failed to create API credential.');
    } finally {
      setBusy(false);
    }
  };

  const removeEntity = async (
  kind: 'client' | 'site' | 'credential',
  id: string) => {
    setBusy(true);
    setStatusMessage(null);
    try {
      if (kind === 'client') {
        await deleteAdminClient(id);
      } else if (kind === 'site') {
        await deleteAdminSite(id);
      } else {
        await deleteAdminApiCredential(id);
      }
      await loadAll();
      setStatusMessage(`${kind} deleted.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : `Failed to delete ${kind}.`);
    } finally {
      setBusy(false);
    }
  };

  const saveNode = async (node: AdminNode, updates: Partial<AdminNode>) => {
    setBusy(true);
    setStatusMessage(null);
    try {
      await updateAdminNode(node.id, {
        siteId: updates.siteId ?? node.siteId,
        status: updates.status ?? node.status
      });
      await loadAll();
      setStatusMessage(`Node ${node.name} updated.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Failed to update node.');
    } finally {
      setBusy(false);
    }
  };

  const [nodeDrafts, setNodeDrafts] = useState<Record<string, {siteId: string | null;status: 'online' | 'offline';}>>({});

  useEffect(() => {
    setNodeDrafts((prev) => {
      const next = { ...prev };
      for (const node of nodes) {
        if (!next[node.id]) {
          next[node.id] = {
            siteId: node.siteId,
            status: node.status
          };
        }
      }
      return next;
    });
  }, [nodes]);

  return (
    <div className="space-y-6 p-6 pb-20">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Admin Dashboard</h2>
          <p className="text-slate-400">Backend operations, security posture, and ingestion health.</p>
        </div>
        <div className="text-xs text-slate-500">
          Updated {new Date(data.generatedAt).toLocaleTimeString()}
        </div>
      </div>
      {statusMessage &&
      <div className="text-xs text-cyan-200 bg-cyan-500/10 border border-cyan-500/30 rounded-lg px-3 py-2">
          {statusMessage}
        </div>
      }

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard title="Users" value={String(data.overview.usersTotal)} icon={Users} accentColor="cyan" delay={0.05} />
        <KPICard title="Active Sessions" value={String(data.overview.activeSessions)} icon={ShieldCheck} accentColor="emerald" delay={0.1} />
        <KPICard title="Nodes Online" value={`${data.overview.nodesOnline}/${data.overview.nodesTotal}`} icon={Server} accentColor="purple" delay={0.15} />
        <KPICard title="Readings (24h)" value={String(data.overview.readings24h)} icon={Activity} accentColor="amber" delay={0.2} />
        <KPICard title="Alert Nodes" value={String(data.alerts.offlineNodes + data.alerts.staleNodes)} icon={AlertTriangle} accentColor="red" delay={0.25} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-2 bg-slate-800 border border-slate-700 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-slate-100 mb-4">Ingestion Activity (24h)</h3>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.ingestionHourly}>
                <defs>
                  <linearGradient id="adminIngest" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="hour" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f1f5f9' }}
                  itemStyle={{ color: '#f1f5f9' }}
                />
                <Area type="monotone" dataKey="readings" stroke="#06b6d4" fill="url(#adminIngest)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-4">
          <h3 className="text-lg font-semibold text-slate-100">Provider Health</h3>
          {[
          { name: 'Forecast.Solar', value: toLabel(data.providerHealth.forecastSolar), state: data.providerHealth.forecastSolar },
          { name: 'OpenWeather', value: toLabel(data.providerHealth.openWeather), state: data.providerHealth.openWeather, configured: data.providerHealth.openWeatherConfigured },
          { name: 'AccuWeather', value: toLabel(data.providerHealth.accuWeather), state: data.providerHealth.accuWeather, configured: data.providerHealth.accuWeatherConfigured }].
          map((provider) =>
          <div key={provider.name} className="bg-slate-900/50 border border-slate-700/60 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">{provider.name}</span>
                <span
                className={`text-xs px-2 py-0.5 rounded ${
                provider.state === 'closed' ? 'bg-emerald-500/10 text-emerald-300' :
                provider.state === 'half-open' ? 'bg-amber-500/10 text-amber-300' :
                'bg-red-500/10 text-red-300'
                }`}>
                  {provider.value}
                </span>
              </div>
              {'configured' in provider &&
              <p className="text-[11px] text-slate-500 mt-1">
                  Configured: {provider.configured ? 'Yes' : 'No'}
                </p>
              }
            </div>
          )}
          <button
            onClick={() => onNavigate('provider-diagnostics')}
            className="w-full mt-1 py-2 text-sm text-cyan-300 hover:text-cyan-200 border border-cyan-500/20 hover:bg-cyan-500/10 rounded-lg transition-colors inline-flex items-center justify-center">
            Open Provider Diagnostics <ArrowRight className="w-3 h-3 ml-1.5" />
          </button>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-slate-100 mb-4">Newest Users</h3>
          <div className="space-y-2">
            {data.recentUsers.length === 0 &&
            <p className="text-sm text-slate-500">No user records available.</p>
            }
            {data.recentUsers.map((user) =>
            <div key={user.id} className="bg-slate-900/50 border border-slate-700/60 rounded-lg p-3">
                <p className="text-sm text-slate-200 font-medium">{user.name}</p>
                <p className="text-xs text-slate-400">{user.email}</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Created {new Date(user.createdAt).toLocaleString()}
                </p>
              </div>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-slate-100 mb-4">Node Health Snapshot</h3>
          <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
            {data.nodes.length === 0 &&
            <p className="text-sm text-slate-500">No node telemetry available.</p>
            }
            {data.nodes.map((node) =>
            <div key={node.id} className="bg-slate-900/50 border border-slate-700/60 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-200 font-medium">{node.name}</p>
                  <span className={`text-xs px-2 py-0.5 rounded ${node.status === 'online' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'}`}>
                    {node.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">{node.location}</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Last seen: {node.lastSeen ? new Date(node.lastSeen).toLocaleString() : 'Never'}
                </p>
                {node.latestReading &&
                <p className="text-[11px] text-slate-400 mt-1">
                  Power: {node.latestReading.powerKw.toFixed(1)} kW
                  {typeof node.latestReading.curtailmentKw === 'number' ? ` | Curtailment: ${node.latestReading.curtailmentKw.toFixed(1)} kW` : ''}
                </p>
                }
              </div>
            )}
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-slate-100 mb-4">Clients</h3>
          <form onSubmit={onCreateClient} className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-4">
            <input
              value={clientForm.name}
              onChange={(e) => setClientForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Client name"
              className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-slate-100"
            />
            <input
              value={clientForm.slug}
              onChange={(e) => setClientForm((prev) => ({ ...prev, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') }))}
              placeholder="client-slug"
              className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-slate-100"
            />
            <button disabled={busy} className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded px-3 py-2 text-sm font-medium">
              Add Client
            </button>
          </form>
          <div className="space-y-2 max-h-[260px] overflow-y-auto">
            {clients.map((client) =>
            <div key={client.id} className="bg-slate-900/50 border border-slate-700/60 rounded-lg p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-200 font-medium">{client.name}</p>
                  <p className="text-xs text-slate-400">{client.slug} • {client.siteCount} sites</p>
                </div>
                <button
                  onClick={() => void removeEntity('client', client.id)}
                  className="text-red-300 hover:text-red-200 p-1">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-slate-100 mb-4">Sites</h3>
          <form onSubmit={onCreateSite} className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
            <select
              value={siteForm.clientId}
              onChange={(e) => setSiteForm((prev) => ({ ...prev, clientId: e.target.value }))}
              className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-slate-100">
              <option value="">Select client</option>
              {clientOptions.map((option) =>
              <option key={option.id} value={option.id}>{option.label}</option>
              )}
            </select>
            <input
              value={siteForm.name}
              onChange={(e) => setSiteForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Site name"
              className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-slate-100"
            />
            <input
              value={siteForm.code}
              onChange={(e) => setSiteForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
              placeholder="SITE-CODE"
              className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-slate-100"
            />
            <input
              value={siteForm.location}
              onChange={(e) => setSiteForm((prev) => ({ ...prev, location: e.target.value }))}
              placeholder="Location"
              className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-slate-100"
            />
            <button disabled={busy} className="md:col-span-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded px-3 py-2 text-sm font-medium">
              Add Site
            </button>
          </form>
          <div className="space-y-2 max-h-[260px] overflow-y-auto">
            {sites.map((site) =>
            <div key={site.id} className="bg-slate-900/50 border border-slate-700/60 rounded-lg p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-200 font-medium">{site.name}</p>
                  <p className="text-xs text-slate-400">{site.code} • {site.client.name} • {site.nodeCount} nodes</p>
                </div>
                <button
                  onClick={() => void removeEntity('site', site.id)}
                  className="text-red-300 hover:text-red-200 p-1">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-slate-100 mb-4">Nodes</h3>
          <div className="space-y-2 max-h-[360px] overflow-y-auto">
            {nodes.map((node) => {
              const draft = nodeDrafts[node.id] ?? { siteId: node.siteId, status: node.status };
              return (
                <div key={node.id} className="bg-slate-900/50 border border-slate-700/60 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-200 font-medium">{node.name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded ${draft.status === 'online' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'}`}>
                      {draft.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <select
                      value={draft.siteId ?? ''}
                      onChange={(e) => setNodeDrafts((prev) => ({ ...prev, [node.id]: { ...draft, siteId: e.target.value || null } }))}
                      className="bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200">
                      <option value="">Unassigned</option>
                      {sites.map((site) =>
                      <option key={site.id} value={site.id}>{site.name}</option>
                      )}
                    </select>
                    <select
                      value={draft.status}
                      onChange={(e) => setNodeDrafts((prev) => ({ ...prev, [node.id]: { ...draft, status: e.target.value as 'online' | 'offline' } }))}
                      className="bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200">
                      <option value="online">online</option>
                      <option value="offline">offline</option>
                    </select>
                    <button
                      disabled={busy}
                      onClick={() => void saveNode(node, draft)}
                      className="bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 rounded px-2 py-1.5 text-xs font-medium inline-flex items-center justify-center">
                      <Save className="w-3 h-3 mr-1" /> Save
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65 }}
          className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-slate-100 mb-4">API Credentials Registry</h3>
          <form onSubmit={onCreateCredential} className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
            <select
              value={credentialForm.provider}
              onChange={(e) => setCredentialForm((prev) => ({ ...prev, provider: e.target.value as typeof prev.provider }))}
              className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-slate-100">
              <option value="openai">openai</option>
              <option value="openweather">openweather</option>
              <option value="accuweather">accuweather</option>
              <option value="custom">custom</option>
            </select>
            <input
              value={credentialForm.name}
              onChange={(e) => setCredentialForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Credential name"
              className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-slate-100"
            />
            <input
              value={credentialForm.apiKey}
              onChange={(e) => setCredentialForm((prev) => ({ ...prev, apiKey: e.target.value }))}
              placeholder="API key (stored as last 4 only)"
              className="md:col-span-2 bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-slate-100"
            />
            <select
              value={credentialForm.clientId}
              onChange={(e) => setCredentialForm((prev) => ({ ...prev, clientId: e.target.value }))}
              className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-slate-100">
              <option value="">No client scope</option>
              {clientOptions.map((option) =>
              <option key={option.id} value={option.id}>{option.label}</option>
              )}
            </select>
            <select
              value={credentialForm.siteId}
              onChange={(e) => setCredentialForm((prev) => ({ ...prev, siteId: e.target.value }))}
              className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-slate-100">
              <option value="">No site scope</option>
              {sites.map((site) =>
              <option key={site.id} value={site.id}>{site.name}</option>
              )}
            </select>
            <button disabled={busy} className="md:col-span-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded px-3 py-2 text-sm font-medium">
              Add API Credential
            </button>
          </form>
          <div className="space-y-2 max-h-[260px] overflow-y-auto">
            {apiCredentials.map((credential) =>
            <div key={credential.id} className="bg-slate-900/50 border border-slate-700/60 rounded-lg p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-200 font-medium">{credential.name}</p>
                  <p className="text-xs text-slate-400">
                    {credential.provider} • ••••{credential.keyLast4}
                    {credential.site ? ` • ${credential.site.name}` : credential.client ? ` • ${credential.client.name}` : ''}
                  </p>
                </div>
                <button
                  onClick={() => void removeEntity('credential', credential.id)}
                  className="text-red-300 hover:text-red-200 p-1">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
