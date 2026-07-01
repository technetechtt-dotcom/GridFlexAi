import React, { useEffect, useState } from 'react';
import { Database, Download, Search, Server } from 'lucide-react';
import { fetchReadings, fetchNodes, type BackendReading, type BackendNode } from '../../services/api';

export function AdminDataPage() {
  const [readings, setReadings] = useState<BackendReading[]>([]);
  const [nodes, setNodes] = useState<BackendNode[]>([]);
  const [loading, setLoading] = useState(false);

  const [selectedNode, setSelectedNode] = useState<string>('');
  const [limit, setLimit] = useState<number>(50);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchReadings({ nodeId: selectedNode || undefined, limit });
      setReadings(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchNodes().then(setNodes);
    void loadData();
  }, [selectedNode, limit]);

  const handleExport = () => {
    const csvContent = [
      ['ID', 'Node ID', 'Timestamp', 'Voltage (V)', 'Current (A)', 'Power (kW)', 'Energy Today (kWh)', 'Inverter (kW)', 'Curtailment (kW)'],
      ...readings.map(r => [
        r.id, r.nodeId, new Date(r.timestamp).toISOString(),
        r.voltage, r.current, r.power, r.energyToday || '', r.inverterPower || '', r.curtailment || ''
      ])
    ].map(e => e.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gridflex_readings_${new Date().toISOString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Data Explorer</h2>
          <p className="text-sm text-slate-400">View and export raw telemetry data from all nodes.</p>
        </div>
        <button
          onClick={handleExport}
          disabled={readings.length === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      <div className="flex flex-wrap gap-4 items-center bg-slate-900 p-4 rounded-xl border border-slate-700">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-slate-400 mb-1">Filter by Node</label>
          <div className="relative">
            <Server className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <select
              value={selectedNode}
              onChange={e => setSelectedNode(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-200 focus:border-emerald-500 outline-none"
            >
              <option value="">All Nodes</option>
              {nodes.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Limit Results</label>
          <select
            value={limit}
            onChange={e => setLimit(Number(e.target.value))}
            className="w-32 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:border-emerald-500 outline-none"
          >
            <option value={50}>50 rows</option>
            <option value={100}>100 rows</option>
            <option value={500}>500 rows</option>
          </select>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-800/50 border-b border-slate-700">
              <tr>
                <th className="px-4 py-3 font-semibold text-slate-300">Timestamp</th>
                <th className="px-4 py-3 font-semibold text-slate-300">Node</th>
                <th className="px-4 py-3 font-semibold text-slate-300">Power (kW)</th>
                <th className="px-4 py-3 font-semibold text-slate-300">Voltage (V)</th>
                <th className="px-4 py-3 font-semibold text-slate-300">Current (A)</th>
                <th className="px-4 py-3 font-semibold text-slate-300">Curtailment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Loading data...</td></tr>
              ) : readings.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No readings found.</td></tr>
              ) : (
                readings.map(r => (
                  <tr key={r.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-2 font-medium text-slate-300">{new Date(r.timestamp).toLocaleString()}</td>
                    <td className="px-4 py-2 text-emerald-400 font-mono text-xs">{r.node?.name || r.nodeId}</td>
                    <td className="px-4 py-2 text-cyan-300">{r.power.toFixed(2)}</td>
                    <td className="px-4 py-2 text-slate-400">{r.voltage.toFixed(1)}</td>
                    <td className="px-4 py-2 text-slate-400">{r.current.toFixed(1)}</td>
                    <td className="px-4 py-2 text-amber-400">{r.curtailment !== null ? `${r.curtailment.toFixed(2)} kW` : '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
