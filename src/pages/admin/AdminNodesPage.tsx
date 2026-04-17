import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { useRealTime } from '../../context/RealTimeContext';
import { fetchAdminNodesOverview, type AdminMonitoringNode } from '../../services/api';
import { useAdminRefresh } from './AdminLayout';

const POLL_MS = 15000;

export function AdminNodesPage() {
  const { autoRefresh, refreshTick } = useAdminRefresh();
  const { backendNodes } = useRealTime();
  const [nodes, setNodes] = useState<AdminMonitoringNode[]>([]);
  const [error, setError] = useState<string | null>(null);

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
    <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
      {error && <div className="mb-3 rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700 text-left text-slate-400">
              <th className="px-3 py-2">Node</th>
              <th className="px-3 py-2">Location</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Last Seen</th>
              <th className="px-3 py-2">Readings</th>
            </tr>
          </thead>
          <tbody>
            {mergedNodes.map((node) => (
              <tr key={node.id} className="border-b border-slate-800 text-slate-200">
                <td className="px-3 py-2">{node.name}</td>
                <td className="px-3 py-2">{node.location}</td>
                <td className="px-3 py-2">
                  <span className={`rounded px-2 py-1 text-xs ${
                  node.status === 'online' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'
                  }`}>
                    {node.status}
                  </span>
                </td>
                <td className="px-3 py-2">{node.lastSeen ? new Date(node.lastSeen).toLocaleString() : 'Never'}</td>
                <td className="px-3 py-2">{node.readingsCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

