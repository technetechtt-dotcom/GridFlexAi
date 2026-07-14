import React from 'react';
import { Edit3, Eye, RotateCcw, Trash2 } from 'lucide-react';
import type { BackendNode } from '../../services/api';
import { StatusBadge } from '../StatusBadge';
import { LiveStatusIndicator } from './LiveStatusIndicator';

type NodeTableProps = {
  nodes: BackendNode[];
  selectedIds: Set<string>;
  busyId?: string | null;
  onToggleNode: (id: string) => void;
  onToggleAll: () => void;
  onView: (node: BackendNode) => void;
  onEdit: (node: BackendNode) => void;
  onRestart: (node: BackendNode) => void;
  onDelete: (node: BackendNode) => void;
};

const healthTone = (score: number) =>
  score >= 75 ? 'text-emerald-300' :
  score >= 50 ? 'text-amber-300' :
  'text-red-300';

export function NodeTable({
  nodes,
  selectedIds,
  busyId,
  onToggleNode,
  onToggleAll,
  onView,
  onEdit,
  onRestart,
  onDelete
}: NodeTableProps) {
  const allSelected = nodes.length > 0 && nodes.every((node) => selectedIds.has(node.id));

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700 text-left text-slate-400">
            <th className="px-3 py-3">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={onToggleAll}
                className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-emerald-500"
                aria-label="Select all nodes"
              />
            </th>
            <th className="px-3 py-3">Node</th>
            <th className="px-3 py-3">Site</th>
            <th className="px-3 py-3">Status</th>
            <th className="px-3 py-3">Battery</th>
            <th className="px-3 py-3">Signal</th>
            <th className="px-3 py-3">Health</th>
            <th className="px-3 py-3">Last Seen</th>
            <th className="px-3 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {nodes.map((node) => (
            <tr key={node.id} className="border-b border-slate-800 text-slate-200 hover:bg-slate-800/30">
              <td className="px-3 py-4">
                <input
                  type="checkbox"
                  checked={selectedIds.has(node.id)}
                  onChange={() => onToggleNode(node.id)}
                  className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-emerald-500"
                  aria-label={`Select ${node.name}`}
                />
              </td>
              <td className="px-3 py-4">
                <p className="font-medium text-slate-100">{node.name}</p>
                <p className="text-xs text-slate-500">{node.serialNumber ?? node.id}</p>
              </td>
              <td className="px-3 py-4 text-slate-400">
                {node.site ? `${node.site.name} (${node.site.code})` : 'Unassigned'}
              </td>
              <td className="px-3 py-4">
                <div className="flex flex-col gap-2">
                  <StatusBadge status={node.statusBadge} label={node.statusBadge === 'warning' ? 'Warning' : node.status} />
                  <LiveStatusIndicator status={node.status} lastSeen={node.lastSeen} />
                </div>
              </td>
              <td className="px-3 py-4 font-mono text-slate-300">
                {typeof node.batteryLevel === 'number' ? `${Math.round(node.batteryLevel)}%` : 'N/A'}
              </td>
              <td className="px-3 py-4 font-mono text-slate-300">
                {typeof node.signalStrength === 'number' ? Math.round(node.signalStrength) : 'N/A'}
              </td>
              <td className={`px-3 py-4 font-mono ${healthTone(node.healthScore)}`}>
                {node.healthScore}%
              </td>
              <td className="px-3 py-4 text-slate-400">
                {node.lastSeen ? new Date(node.lastSeen).toLocaleString() : 'Never'}
              </td>
              <td className="px-3 py-4 text-right">
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => onView(node)}
                    className="rounded-md p-2 text-slate-400 hover:bg-slate-700 hover:text-slate-100"
                    title="View node"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onEdit(node)}
                    className="rounded-md p-2 text-cyan-300 hover:bg-cyan-500/10"
                    title="Edit node"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={busyId === node.id}
                    onClick={() => onRestart(node)}
                    className="rounded-md p-2 text-amber-300 hover:bg-amber-500/10 disabled:opacity-50"
                    title="Remote restart"
                  >
                    <RotateCcw className={`h-4 w-4 ${busyId === node.id ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(node)}
                    className="rounded-md p-2 text-red-300 hover:bg-red-500/10"
                    title="Delete node"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {nodes.length === 0 && (
            <tr>
              <td colSpan={9} className="px-4 py-8 text-center text-slate-500">No nodes match the current filters.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
