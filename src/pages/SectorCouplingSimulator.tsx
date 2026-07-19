import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Factory, Truck, Fuel, Ship } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip } from
'recharts';
import { Page } from '../components/Sidebar';
import { SimulationBanner } from '../components/SimulationBanner';

interface SectorCouplingSimulatorProps {
  onNavigate: (page: Page) => void;
}

export function SectorCouplingSimulator({ onNavigate }: SectorCouplingSimulatorProps) {
  const [electrolyzerMw, setElectrolyzerMw] = useState(40);
  const [exportSplit, setExportSplit] = useState(55);
  const [evShare, setEvShare] = useState(25);

  const metrics = useMemo(() => {
    const productionKgH = electrolyzerMw * 7.1;
    const exportKgH = productionKgH * (exportSplit / 100);
    const localKgH = productionKgH - exportKgH;
    const evKgH = localKgH * (evShare / 100);
    const industryKgH = localKgH - evKgH;
    const lcoh = Math.max(32, 46 - electrolyzerMw * 0.08 - exportSplit * 0.03);
    const avoidedCo2 = productionKgH * 0.011;
    return {
      productionKgH: Math.round(productionKgH),
      exportKgH: Math.round(exportKgH),
      evKgH: Math.round(evKgH),
      industryKgH: Math.round(industryKgH),
      lcoh: Number(lcoh.toFixed(2)),
      avoidedCo2: Number(avoidedCo2.toFixed(2))
    };
  }, [electrolyzerMw, exportSplit, evShare]);

  const chartData = [
  {
    segment: 'Export',
    value: metrics.exportKgH
  },
  {
    segment: 'Industry',
    value: metrics.industryKgH
  },
  {
    segment: 'EV/Fleet',
    value: metrics.evKgH
  }];

  return (
    <div className="space-y-6 p-6 pb-20">
      <SimulationBanner featureName="Sector coupling / LCOH / hydrogen allocation" />
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => onNavigate('hyshift')}
            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-slate-100">
              Sector Coupling Simulator
            </h2>
            <p className="text-slate-400">
              Hydrogen allocation across export, industry, and EV transport
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div
          initial={{
            opacity: 0,
            x: -20
          }}
          animate={{
            opacity: 1,
            x: 0
          }}
          className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-6">
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-sm text-slate-300">Electrolyzer Capacity</label>
              <span className="text-cyan-300 text-sm">{electrolyzerMw} MW</span>
            </div>
            <input
              type="range"
              min="10"
              max="120"
              step="5"
              value={electrolyzerMw}
              onChange={(e) => setElectrolyzerMw(Number(e.target.value))}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500" />
          </div>
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-sm text-slate-300">H2 Export Split</label>
              <span className="text-emerald-300 text-sm">{exportSplit}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="90"
              step="5"
              value={exportSplit}
              onChange={(e) => setExportSplit(Number(e.target.value))}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500" />
          </div>
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-sm text-slate-300">EV/Fleet Share (local)</label>
              <span className="text-amber-300 text-sm">{evShare}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="80"
              step="5"
              value={evShare}
              onChange={(e) => setEvShare(Number(e.target.value))}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500" />
          </div>
        </motion.div>

        <motion.div
          initial={{
            opacity: 0,
            y: 20
          }}
          animate={{
            opacity: 1,
            y: 0
          }}
          transition={{
            delay: 0.1
          }}
          className="lg:col-span-2 bg-slate-800 border border-slate-700 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-slate-100 mb-6">
            H2 Allocation by Sector (kg/h)
          </h3>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="segment" stroke="#94a3b8" tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    color: '#f1f5f9'
                  }} />
                <Bar dataKey="value" fill="#22d3ee" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-slate-900/50 rounded-lg border border-slate-700 p-3">
              <p className="text-xs text-slate-500 mb-1 flex items-center">
                <Fuel className="w-3 h-3 mr-1" /> Total H2
              </p>
              <p className="text-lg font-bold text-slate-100">
                {metrics.productionKgH} kg/h
              </p>
            </div>
            <div className="bg-slate-900/50 rounded-lg border border-slate-700 p-3">
              <p className="text-xs text-slate-500 mb-1 flex items-center">
                <Ship className="w-3 h-3 mr-1" /> Export
              </p>
              <p className="text-lg font-bold text-emerald-300">
                {metrics.exportKgH} kg/h
              </p>
            </div>
            <div className="bg-slate-900/50 rounded-lg border border-slate-700 p-3">
              <p className="text-xs text-slate-500 mb-1 flex items-center">
                <Factory className="w-3 h-3 mr-1" /> Industry
              </p>
              <p className="text-lg font-bold text-cyan-300">
                {metrics.industryKgH} kg/h
              </p>
            </div>
            <div className="bg-slate-900/50 rounded-lg border border-slate-700 p-3">
              <p className="text-xs text-slate-500 mb-1 flex items-center">
                <Truck className="w-3 h-3 mr-1" /> EV/Fleet
              </p>
              <p className="text-lg font-bold text-amber-300">
                {metrics.evKgH} kg/h
              </p>
            </div>
          </div>
          <p className="text-sm text-slate-400 mt-5">
            Modeled LCOH: <span className="text-emerald-300 font-medium">R{metrics.lcoh}/kg</span>
            {' '}| Avoided CO2: <span className="text-cyan-300 font-medium">{metrics.avoidedCo2} tCO2e/h</span>
          </p>
        </motion.div>
      </div>
    </div>);
}
