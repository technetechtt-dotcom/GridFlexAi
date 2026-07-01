import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Power, RotateCcw, Activity } from 'lucide-react';

import { useRealTime } from '../../context/RealTimeContext';
import { fetchAdminNodesOverview, updateAdminNode, type AdminMonitoringNode } from '../../services/api';
import { useAdminRefresh } from './AdminLayout';

const POLL_MS = 15000;

export function AdminNodesPage() {
  const { autoRefresh, refreshTick, triggerRefresh } = useAdminRefresh();
  const { backendNodes } = useRealTime();
  const [nodes, setNodes] = useState<AdminMonitoringNode[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const rows = await fetchAdminNodesOverview();
      setNodes(rows);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load nodes.');
    }
  }, []);

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

  const toggleStatus = async (node: AdminMonitoringNode) => {
    if (!confirm(`Are you sure you want to force ${node.status === 'online' ? 'offline' : 'online'} for ${node.name}?`)) return;
    setProcessingId(node.id);
    try {
      await updateAdminNode(node.id, {
        status: node.status === 'online' ? 'offline' : 'online'
      });
      triggerRefresh();
    } catch (e) {
      alert('Failed to update node status.');
    } finally {
      setProcessingId(null);
    }
  };

  const mergedNodes = useMemo(() => {
    return nodes.map((node) => {
      const liveNode = backendNodes.find((item) => item.id === node.id);
      return {
        ...node,
        status: liveNode?.status ?? node.status,
        lastSeen: liveNode?.lastSeen ?? node.lastSeen
      };
    });
  }, [backendNodes, nodes]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Node Management</h2>
          <p className="text-sm text-slate-400">View and force-toggle states for all Edge Nodes.</p>
        </div>
      </div>
      <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
        {error && <div className="mb-3 rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>}
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-left text-slate-400">
                <th className="px-3 py-3">Node</th>
                <th className="px-3 py-3">Location</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Billing State</th>
                <th className="px-3 py-3">Last Seen</th>
                <th className="px-3 py-3">Readings</th>
                <th className="px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {mergedNodes.map((node) => (
                <tr key={node.id} className="border-b border-slate-800 text-slate-200 hover:bg-slate-800/30 transition-colors">
                  <td className="px-3 py-4 font-medium">{node.name}</td>
                  <td className="px-3 py-4 text-slate-400">{node.location}</td>
                  <td className="px-3 py-4">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                    node.status === 'online' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                    }`}>
                      {node.status === 'online' ? <Activity className="w-3 h-3" /> : <Power className="w-3 h-3" />}
                      {node.status}
                    </span>
                  </td>
                  <td className="px-3 py-4">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                      node.isActive !== false ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}>
                      {node.isActive !== false ? 'Active' : 'Suspended'}
                    </span>
                  </td>
                  <td className="px-3 py-4 text-slate-400">{node.lastSeen ? new Date(node.lastSeen).toLocaleString() : 'Never'}</td>
                  <td className="px-3 py-4 text-slate-400">{node.readingsCount}</td>
                  <td className="px-3 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        disabled={processingId === node.id}
                        onClick={async () => {
                          if (!confirm(`Are you sure you want to ${node.isActive !== false ? 'suspend' : 'activate'} billing state for ${node.name}?`)) return;
                          setProcessingId(node.id);
                          try {
                            await updateAdminNode(node.id, { isActive: node.isActive === false ? true : false });
                            triggerRefresh();
                          } catch (e) {
                            alert('Failed to update node active state.');
                          } finally {
                            setProcessingId(null);
                          }
                        }}
                        className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          node.isActive !== false ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20' : 'bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20'
                        }`}
                      >
                        {node.isActive !== false ? 'Suspend' : 'Activate'}
                      </button>
                      <button
                        disabled={processingId === node.id}
                        onClick={() => toggleStatus(node)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          node.status === 'online' ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                        }`}
                      >
                        <RotateCcw className={`w-3.5 h-3.5 ${processingId === node.id ? 'animate-spin' : ''}`} />
                        Force {node.status === 'online' ? 'Offline' : 'Online'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {mergedNodes.length === 0 && !error && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No nodes found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

