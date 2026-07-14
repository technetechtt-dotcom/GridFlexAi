import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Plus, RotateCcw, Save, Server, Wrench } from 'lucide-react';
import { NodeTable } from '../../components/nodes/NodeTable';
import { StatusBadge } from '../../components/StatusBadge';
import { useRealTime } from '../../context/RealTimeContext';
import {
  createNode,
  deleteNode,
  fetchAdminSites,
  fetchNodes,
  runNodeBulkAction,
  updateNode,
  type AdminSite,
  type BackendNode,
  type NodeStatus
} from '../../services/api';
import { useAdminRefresh } from './AdminLayout';

const POLL_MS = 15000;

type NodeFormState = {
  id?: string;
  name: string;
  serialNumber: string;
  siteId: string;
  location: string;
  latitude: string;
  longitude: string;
  status: NodeStatus;
  firmwareVersion: string;
  batteryLevel: string;
  signalStrength: string;
  isActive: boolean;
};

const emptyForm: NodeFormState = {
  name: '',
  serialNumber: '',
  siteId: '',
  location: '',
  latitude: '',
  longitude: '',
  status: 'offline',
  firmwareVersion: '',
  batteryLevel: '',
  signalStrength: '',
  isActive: true
};

const parseNullableNumber = (value: string) => {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const nodeToForm = (node: BackendNode): NodeFormState => ({
  id: node.id,
  name: node.name,
  serialNumber: node.serialNumber ?? '',
  siteId: node.siteId ?? '',
  location: node.location,
  latitude: typeof node.latitude === 'number' ? String(node.latitude) : '',
  longitude: typeof node.longitude === 'number' ? String(node.longitude) : '',
  status: node.status,
  firmwareVersion: node.firmwareVersion ?? '',
  batteryLevel: typeof node.batteryLevel === 'number' ? String(node.batteryLevel) : '',
  signalStrength: typeof node.signalStrength === 'number' ? String(node.signalStrength) : '',
  isActive: node.isActive !== false
});

const statusFilterOptions: Array<'all' | NodeStatus> = ['all', 'online', 'offline', 'maintenance'];

export function AdminNodesPage() {
  const { autoRefresh, refreshTick, triggerRefresh } = useAdminRefresh();
  const { backendNodes } = useRealTime();
  const [nodes, setNodes] = useState<BackendNode[]>([]);
  const [sites, setSites] = useState<AdminSite[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [siteFilter, setSiteFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | NodeStatus>('all');
  const [form, setForm] = useState<NodeFormState>(emptyForm);
  const [formOpen, setFormOpen] = useState(false);
  const [detailNode, setDetailNode] = useState<BackendNode | null>(null);
  const [bulkSiteId, setBulkSiteId] = useState('');
  const [bulkStatus, setBulkStatus] = useState<NodeStatus>('maintenance');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [nodeRows, siteRows] = await Promise.all([
        fetchNodes({
          search: search.trim() || undefined,
          siteId: siteFilter === 'all' ? undefined : siteFilter,
          status: statusFilter === 'all' ? undefined : statusFilter
        }),
        fetchAdminSites()
      ]);
      setNodes(nodeRows);
      setSites(siteRows);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load node management data.');
    }
  }, [search, siteFilter, statusFilter]);

  useEffect(() => {
    void load();
  }, [load, refreshTick]);

  useEffect(() => {
    if (!autoRefresh) return undefined;
    const timer = window.setInterval(() => {
      void load();
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [autoRefresh, load]);

  const mergedNodes = useMemo(() => {
    return nodes.map((node) => {
      const liveNode = backendNodes.find((item) => item.id === node.id);
      return liveNode ? { ...node, ...liveNode } : node;
    });
  }, [backendNodes, nodes]);

  const fleetAlerts = useMemo(() => mergedNodes.flatMap((node) => node.alerts.map((alert) => ({ node, alert }))), [mergedNodes]);
  const selectedCount = selectedIds.size;

  const resetForm = () => {
    setForm(emptyForm);
    setFormOpen(false);
  };

  const submitForm = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        serialNumber: form.serialNumber.trim(),
        siteId: form.siteId || null,
        location: form.location.trim(),
        latitude: parseNullableNumber(form.latitude),
        longitude: parseNullableNumber(form.longitude),
        status: form.status,
        firmwareVersion: form.firmwareVersion.trim() || null,
        batteryLevel: parseNullableNumber(form.batteryLevel),
        signalStrength: parseNullableNumber(form.signalStrength),
        isActive: form.isActive
      };

      if (form.id) {
        await updateNode(form.id, payload);
        setMessage(`Updated ${payload.name}.`);
      } else {
        await createNode(payload);
        setMessage(`Created ${payload.name}.`);
      }
      resetForm();
      triggerRefresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to save node.');
    } finally {
      setBusy(false);
    }
  };

  const toggleNode = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds((prev) => {
      if (mergedNodes.length > 0 && mergedNodes.every((node) => prev.has(node.id))) {
        return new Set();
      }
      return new Set(mergedNodes.map((node) => node.id));
    });
  };

  const runBulk = async (action: 'assignSite' | 'updateStatus' | 'remoteRestart') => {
    if (selectedIds.size === 0) return;
    setBusy(true);
    try {
      const nodeIds = Array.from(selectedIds);
      const result = await runNodeBulkAction({
        nodeIds,
        action,
        siteId: action === 'assignSite' ? bulkSiteId || null : undefined,
        status: action === 'updateStatus' ? bulkStatus : undefined
      });
      setMessage(`${result.affected} node${result.affected === 1 ? '' : 's'} updated.`);
      setSelectedIds(new Set());
      triggerRefresh();
    } catch (bulkError) {
      setError(bulkError instanceof Error ? bulkError.message : 'Bulk action failed.');
    } finally {
      setBusy(false);
    }
  };

  const restartNode = async (node: BackendNode) => {
    setBusyId(node.id);
    try {
      await runNodeBulkAction({ nodeIds: [node.id], action: 'remoteRestart' });
      setMessage(`Remote restart requested for ${node.name}.`);
      triggerRefresh();
    } catch (restartError) {
      setError(restartError instanceof Error ? restartError.message : 'Remote restart failed.');
    } finally {
      setBusyId(null);
    }
  };

  const removeNode = async (node: BackendNode) => {
    if (!confirm(`Delete ${node.name}? This removes its readings, logs, and maintenance requests.`)) return;
    setBusyId(node.id);
    try {
      await deleteNode(node.id);
      setMessage(`Deleted ${node.name}.`);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(node.id);
        return next;
      });
      triggerRefresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete node.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Node Management</h2>
          <p className="text-sm text-slate-400">CRUD, assignment, live health, and fleet actions for Edge Nodes.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setForm(emptyForm);
            setFormOpen(true);
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500"
        >
          <Plus className="h-4 w-4" />
          New Node
        </button>
      </div>

      {(error || message) && (
        <div className={`rounded-lg border px-3 py-2 text-sm ${error ? 'border-red-500/30 bg-red-500/10 text-red-300' : 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200'}`}>
          {error ?? message}
        </div>
      )}

      <div className="grid gap-3 rounded-lg border border-slate-700 bg-slate-900/70 p-4 xl:grid-cols-[1fr_180px_180px]">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search serial, node, site, or location"
          className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-400"
        />
        <select
          value={siteFilter}
          onChange={(event) => setSiteFilter(event.target.value)}
          className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
        >
          <option value="all">All sites</option>
          {sites.map((site) => (
            <option key={site.id} value={site.id}>{site.name}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as 'all' | NodeStatus)}
          className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
        >
          {statusFilterOptions.map((status) => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <div className="grid gap-3 rounded-lg border border-slate-700 bg-slate-900/70 p-4 lg:grid-cols-[1fr_auto_auto_auto]">
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <Server className="h-4 w-4 text-emerald-300" />
              {selectedCount} selected
            </div>
            <select
              value={bulkSiteId}
              onChange={(event) => setBulkSiteId(event.target.value)}
              className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            >
              <option value="">Unassigned</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>{site.name}</option>
              ))}
            </select>
            <button
              type="button"
              disabled={busy || selectedCount === 0}
              onClick={() => void runBulk('assignSite')}
              className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-200 hover:bg-cyan-500/20 disabled:opacity-50"
            >
              Assign Site
            </button>
            <div className="flex gap-2">
              <select
                value={bulkStatus}
                onChange={(event) => setBulkStatus(event.target.value as NodeStatus)}
                className="min-w-0 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              >
                <option value="online">online</option>
                <option value="offline">offline</option>
                <option value="maintenance">maintenance</option>
              </select>
              <button
                type="button"
                disabled={busy || selectedCount === 0}
                onClick={() => void runBulk('updateStatus')}
                className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200 hover:bg-amber-500/20 disabled:opacity-50"
              >
                Set
              </button>
              <button
                type="button"
                disabled={busy || selectedCount === 0}
                onClick={() => void runBulk('remoteRestart')}
                className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 disabled:opacity-50"
                title="Remote restart"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-slate-700 bg-slate-900">
            <NodeTable
              nodes={mergedNodes}
              selectedIds={selectedIds}
              busyId={busyId}
              onToggleNode={toggleNode}
              onToggleAll={toggleAll}
              onView={setDetailNode}
              onEdit={(node) => {
                setForm(nodeToForm(node));
                setFormOpen(true);
              }}
              onRestart={(node) => void restartNode(node)}
              onDelete={(node) => void removeNode(node)}
            />
          </div>
        </div>

        <aside className="space-y-4">
          {formOpen && (
            <form onSubmit={submitForm} className="space-y-3 rounded-lg border border-slate-700 bg-slate-900 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-100">{form.id ? 'Edit Node' : 'Create Node'}</h3>
                <button type="button" onClick={resetForm} className="text-xs text-slate-400 hover:text-slate-100">Close</button>
              </div>
              <input required value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="Name" className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100" />
              <input required value={form.serialNumber} onChange={(event) => setForm((prev) => ({ ...prev, serialNumber: event.target.value }))} placeholder="Serial number" className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100" />
              <select value={form.siteId} onChange={(event) => setForm((prev) => ({ ...prev, siteId: event.target.value }))} className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100">
                <option value="">Unassigned</option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>{site.name}</option>
                ))}
              </select>
              <input required value={form.location} onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))} placeholder="Location" className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100" />
              <div className="grid grid-cols-2 gap-2">
                <input value={form.latitude} onChange={(event) => setForm((prev) => ({ ...prev, latitude: event.target.value }))} placeholder="Latitude" className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100" />
                <input value={form.longitude} onChange={(event) => setForm((prev) => ({ ...prev, longitude: event.target.value }))} placeholder="Longitude" className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100" />
              </div>
              <select value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as NodeStatus }))} className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100">
                <option value="online">online</option>
                <option value="offline">offline</option>
                <option value="maintenance">maintenance</option>
              </select>
              <div className="grid grid-cols-3 gap-2">
                <input value={form.firmwareVersion} onChange={(event) => setForm((prev) => ({ ...prev, firmwareVersion: event.target.value }))} placeholder="Firmware" className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100" />
                <input value={form.batteryLevel} onChange={(event) => setForm((prev) => ({ ...prev, batteryLevel: event.target.value }))} placeholder="Battery %" className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100" />
                <input value={form.signalStrength} onChange={(event) => setForm((prev) => ({ ...prev, signalStrength: event.target.value }))} placeholder="Signal" className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100" />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={form.isActive} onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))} className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-emerald-500" />
                Active
              </label>
              <button disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50">
                <Save className="h-4 w-4" />
                Save Node
              </button>
            </form>
          )}

          <div className="space-y-3 rounded-lg border border-slate-700 bg-slate-900 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-100">Fleet Alerts</h3>
              <AlertTriangle className="h-4 w-4 text-amber-300" />
            </div>
            {fleetAlerts.length === 0 ? (
              <p className="text-sm text-slate-500">No active node alerts.</p>
            ) : (
              fleetAlerts.slice(0, 8).map(({ node, alert }) => (
                <button
                  key={`${node.id}-${alert.id}`}
                  type="button"
                  onClick={() => setDetailNode(node)}
                  className="w-full rounded-md border border-slate-800 bg-slate-950/60 p-3 text-left hover:border-amber-400/30"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-slate-100">{alert.title}</p>
                    <StatusBadge status={alert.severity === 'critical' ? 'critical' : 'warning'} label={alert.severity} />
                  </div>
                  <p className="mt-1 text-xs text-slate-400">{node.name} - {alert.message}</p>
                </button>
              ))
            )}
          </div>

          {detailNode && (
            <div className="space-y-3 rounded-lg border border-slate-700 bg-slate-900 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-100">{detailNode.name}</h3>
                <StatusBadge status={detailNode.statusBadge} label={detailNode.statusBadge === 'warning' ? 'Warning' : detailNode.status} />
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md border border-slate-800 bg-slate-950/60 p-2">
                  <p className="text-slate-500">Serial</p>
                  <p className="mt-1 truncate text-slate-200">{detailNode.serialNumber ?? detailNode.id}</p>
                </div>
                <div className="rounded-md border border-slate-800 bg-slate-950/60 p-2">
                  <p className="text-slate-500">Firmware</p>
                  <p className="mt-1 text-slate-200">{detailNode.firmwareVersion ?? 'N/A'}</p>
                </div>
                <div className="rounded-md border border-slate-800 bg-slate-950/60 p-2">
                  <p className="text-slate-500">Battery</p>
                  <p className="mt-1 text-slate-200">{typeof detailNode.batteryLevel === 'number' ? `${Math.round(detailNode.batteryLevel)}%` : 'N/A'}</p>
                </div>
                <div className="rounded-md border border-slate-800 bg-slate-950/60 p-2">
                  <p className="text-slate-500">Signal</p>
                  <p className="mt-1 text-slate-200">{typeof detailNode.signalStrength === 'number' ? Math.round(detailNode.signalStrength) : 'N/A'}</p>
                </div>
              </div>
              <p className="text-xs text-slate-400">{detailNode.location}</p>
              <p className="text-xs text-slate-500">Last seen {detailNode.lastSeen ? new Date(detailNode.lastSeen).toLocaleString() : 'Never'}</p>
            </div>
          )}

          <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
              <Wrench className="h-4 w-4 text-cyan-300" />
              Maintenance Queue
            </div>
            <p className="mt-2 text-2xl font-semibold text-slate-100">
              {mergedNodes.reduce((total, node) => total + node.openMaintenanceRequests, 0)}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
