import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Battery, MapPin, RadioTower, RefreshCcw, Send, Wrench, Zap } from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { NodeCard } from '../components/nodes/NodeCard';
import { StatusBadge } from '../components/StatusBadge';
import { useRealTime } from '../context/RealTimeContext';
import {
  fetchNodeDetail,
  fetchNodes,
  requestNodeMaintenance,
  type BackendNode,
  type BackendNodeDetail,
  type NodeStatus
} from '../services/api';

type ChartRow = {
  time: string;
  power: number;
  voltage: number;
};

type NodeFilter = 'all' | NodeStatus | 'warning';

const statusOptions: NodeFilter[] = ['all', 'online', 'warning', 'offline', 'maintenance'];

const getNodeStatusFilter = (value: NodeFilter) => value === 'all' || value === 'warning' ? undefined : value;

export function NodeDashboard() {
  const { backendNodes } = useRealTime();
  const [nodes, setNodes] = useState<BackendNode[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<BackendNodeDetail | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<NodeFilter>('all');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [maintenanceType, setMaintenanceType] = useState('Inspection');
  const [maintenanceDescription, setMaintenanceDescription] = useState('');
  const [maintenanceMessage, setMaintenanceMessage] = useState<string | null>(null);

  const loadNodes = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchNodes({
        search: search.trim() || undefined,
        status: getNodeStatusFilter(statusFilter)
      });
      const warningFiltered = statusFilter === 'warning' ? rows.filter((node) => node.statusBadge === 'warning') : rows;
      setNodes(warningFiltered);
      setSelectedId((prev) => prev ?? warningFiltered[0]?.id ?? null);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load nodes.');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadNodes();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [loadNodes]);

  const mergedNodes = useMemo(() => {
    return nodes.map((node) => {
      const liveNode = backendNodes.find((item) => item.id === node.id);
      return liveNode ? { ...node, ...liveNode } : node;
    });
  }, [backendNodes, nodes]);

  const selectedNode = useMemo(
    () => mergedNodes.find((node) => node.id === selectedId) ?? mergedNodes[0] ?? null,
    [mergedNodes, selectedId]
  );

  useEffect(() => {
    if (!selectedNode) {
      setSelectedDetail(null);
      return;
    }
    let active = true;
    const loadDetail = async () => {
      setDetailLoading(true);
      try {
        const detail = await fetchNodeDetail(selectedNode.id);
        if (active) setSelectedDetail(detail);
      } catch {
        if (active) setSelectedDetail(null);
      } finally {
        if (active) setDetailLoading(false);
      }
    };
    void loadDetail();
    return () => {
      active = false;
    };
  }, [selectedNode]);

  const detailNode = selectedDetail ?? selectedNode;
  const chartRows: ChartRow[] = useMemo(() => {
    if (!selectedDetail) return [];
    return selectedDetail.readings.slice().reverse().map((reading) => ({
      time: new Date(reading.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      power: Number(reading.power.toFixed(1)),
      voltage: Number(reading.voltage.toFixed(1))
    }));
  }, [selectedDetail]);

  const submitMaintenance = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!detailNode || maintenanceDescription.trim().length < 5) return;
    try {
      await requestNodeMaintenance(detailNode.id, {
        issueType: maintenanceType,
        description: maintenanceDescription.trim()
      });
      setMaintenanceDescription('');
      setMaintenanceMessage('Maintenance request submitted.');
      const detail = await fetchNodeDetail(detailNode.id);
      setSelectedDetail(detail);
    } catch (submitError) {
      setMaintenanceMessage(submitError instanceof Error ? submitError.message : 'Failed to submit request.');
    }
  };

  return (
    <div className="space-y-6 p-6 pb-20">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Node Dashboard</h2>
          <p className="text-slate-400">Assigned edge nodes and live telemetry</p>
        </div>
        <button
          type="button"
          onClick={() => void loadNodes()}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
        >
          <RefreshCcw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      <div className="grid gap-3 rounded-lg border border-slate-700 bg-slate-900/70 p-4 lg:grid-cols-[1fr_auto]">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by node, site, serial, or location"
          className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-400"
        />
        <div className="flex flex-wrap gap-2">
          {statusOptions.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`rounded-md border px-3 py-2 text-xs font-medium capitalize ${
                statusFilter === status
                  ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-300'
                  : 'border-slate-700 bg-slate-950 text-slate-400 hover:text-slate-100'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
        <div className="space-y-4">
          {loading ? (
            <div className="rounded-lg border border-slate-700 bg-slate-900 p-8 text-center text-sm text-slate-400">Loading nodes...</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {mergedNodes.map((node) => (
                <NodeCard
                  key={node.id}
                  node={node}
                  selected={node.id === detailNode?.id}
                  onClick={(nextNode) => setSelectedId(nextNode.id)}
                />
              ))}
              {mergedNodes.length === 0 && (
                <div className="rounded-lg border border-slate-700 bg-slate-900 p-8 text-center text-sm text-slate-400 md:col-span-2">
                  No nodes match the current filters.
                </div>
              )}
            </div>
          )}
        </div>

        <aside className="space-y-4 rounded-lg border border-slate-700 bg-slate-900/80 p-4">
          {!detailNode ? (
            <div className="py-10 text-center text-sm text-slate-500">Select a node to view details.</div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-100">{detailNode.name}</h3>
                  <p className="text-xs text-slate-500">{detailNode.serialNumber ?? detailNode.id}</p>
                </div>
                <StatusBadge status={detailNode.statusBadge} label={detailNode.statusBadge === 'warning' ? 'Warning' : detailNode.status} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Battery', value: typeof detailNode.batteryLevel === 'number' ? `${Math.round(detailNode.batteryLevel)}%` : 'N/A', icon: Battery },
                  { label: 'Signal', value: typeof detailNode.signalStrength === 'number' ? Math.round(detailNode.signalStrength).toString() : 'N/A', icon: RadioTower },
                  { label: 'Health', value: `${detailNode.healthScore}%`, icon: Wrench },
                  { label: 'Power', value: typeof detailNode.lastReading?.power === 'number' ? `${detailNode.lastReading.power.toFixed(1)} kW` : 'N/A', icon: Zap }
                ].map((item) => (
                  <div key={item.label} className="rounded-md border border-slate-800 bg-slate-950/60 p-3">
                    <span className="flex items-center gap-1.5 text-xs text-slate-500">
                      <item.icon className="h-3.5 w-3.5 text-emerald-300" />
                      {item.label}
                    </span>
                    <p className="mt-2 font-mono text-lg text-slate-100">{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-md border border-slate-800 bg-slate-950/60 p-3">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-100">Live Data</span>
                  {detailLoading && <span className="text-xs text-slate-500">Syncing...</span>}
                </div>
                <div className="h-56">
                  {chartRows.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartRows}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                        <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f1f5f9' }} />
                        <Line type="monotone" dataKey="power" stroke="#10b981" strokeWidth={2} dot={false} name="Power kW" />
                        <Line type="monotone" dataKey="voltage" stroke="#06b6d4" strokeWidth={2} dot={false} name="Voltage" />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-slate-500">No readings available.</div>
                  )}
                </div>
              </div>

              <div className="rounded-md border border-slate-800 bg-slate-950/60 p-3">
                <span className="flex items-center gap-1.5 text-sm font-medium text-slate-100">
                  <MapPin className="h-4 w-4 text-cyan-300" />
                  Location
                </span>
                <p className="mt-2 text-sm text-slate-400">{detailNode.site ? `${detailNode.site.name} - ${detailNode.site.location}` : detailNode.location}</p>
                {typeof detailNode.latitude === 'number' && typeof detailNode.longitude === 'number' && (
                  <p className="mt-1 font-mono text-xs text-slate-500">{detailNode.latitude.toFixed(5)}, {detailNode.longitude.toFixed(5)}</p>
                )}
              </div>

              {detailNode.alerts.length > 0 && (
                <div className="space-y-2 rounded-md border border-amber-500/20 bg-amber-500/5 p-3">
                  <span className="flex items-center gap-1.5 text-sm font-medium text-amber-200">
                    <AlertTriangle className="h-4 w-4" />
                    Alerts
                  </span>
                  {detailNode.alerts.map((alert) => (
                    <div key={alert.id} className="text-xs text-amber-100/90">
                      <p className="font-medium">{alert.title}</p>
                      <p className="text-amber-100/70">{alert.message}</p>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={submitMaintenance} className="space-y-3 rounded-md border border-slate-800 bg-slate-950/60 p-3">
                <span className="text-sm font-medium text-slate-100">Request Maintenance</span>
                <select
                  value={maintenanceType}
                  onChange={(event) => setMaintenanceType(event.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                >
                  <option>Inspection</option>
                  <option>Battery</option>
                  <option>Signal</option>
                  <option>Firmware</option>
                  <option>Physical damage</option>
                </select>
                <textarea
                  value={maintenanceDescription}
                  onChange={(event) => setMaintenanceDescription(event.target.value)}
                  rows={3}
                  placeholder="Describe the issue"
                  className="w-full resize-none rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-400"
                />
                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500"
                >
                  <Send className="h-4 w-4" />
                  Submit
                </button>
                {maintenanceMessage && <p className="text-xs text-cyan-300">{maintenanceMessage}</p>}
              </form>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
