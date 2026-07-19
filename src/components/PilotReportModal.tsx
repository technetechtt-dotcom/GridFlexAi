import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  FileDown,
  CheckCircle2,
  Droplet,
  Zap,
  TrendingUp,
  Activity,
  Wind } from
'lucide-react';
import { generatePilotReport, PilotReport } from '../services/api';
import { cn } from '../lib/utils';
import { SimulationBanner } from './SimulationBanner';
interface PilotReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}
export function PilotReportModal({ isOpen, onClose }: PilotReportModalProps) {
  const [report, setReport] = useState<PilotReport | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      generatePilotReport().
      then((data) => {
        setReport(data);
        setLoading(false);
      }).
      catch(() => setLoading(false));
    }
  }, [isOpen]);
  if (!isOpen) return null;
  return (
    <AnimatePresence>
      {isOpen &&
      <>
          {/* Backdrop */}
          <motion.div
          initial={{
            opacity: 0
          }}
          animate={{
            opacity: 1
          }}
          exit={{
            opacity: 0
          }}
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />


          {/* Modal */}
          <motion.div
          initial={{
            opacity: 0,
            scale: 0.95,
            y: 20
          }}
          animate={{
            opacity: 1,
            scale: 1,
            y: 0
          }}
          exit={{
            opacity: 0,
            scale: 0.95,
            y: 20
          }}
          className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none">

            <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden pointer-events-auto flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="p-6 border-b border-slate-800 flex justify-between items-start bg-slate-900/50">
                <div>
                  <h2 className="text-xl font-bold text-slate-100 flex items-center">
                    <FileDown className="w-5 h-5 mr-2 text-emerald-500" />
                    Pilot Performance Report
                  </h2>
                  <p className="text-sm text-slate-400 mt-1">
                    Northern Cape Pilot — Prieska • Kathu • Boegoebaai
                  </p>
                </div>
                <button
                onClick={onClose}
                className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors">

                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 overflow-y-auto">
                <SimulationBanner
                  featureName="Pilot performance report"
                  detail="Data provenance: simulated and calculated demonstration values. This is not a report of measured plant performance."
                />
                {loading ?
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                    <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-slate-400">
                      Generating report data...
                    </p>
                  </div> :
              report ?
              <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-sm text-emerald-400 font-medium">
                            Simulated Revenue Uplift
                          </span>
                          <TrendingUp className="w-4 h-4 text-emerald-500" />
                        </div>
                        <div className="text-2xl font-bold text-emerald-400">
                          R{report.revenueUplift.toLocaleString()}
                        </div>
                        <div className="text-xs text-emerald-500/70 mt-1">
                          +14.2% vs baseline
                        </div>
                      </div>

                      <div className="bg-purple-500/10 border border-purple-500/20 p-4 rounded-xl">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-sm text-purple-400 font-medium">
                            Simulated H₂ Production
                          </span>
                          <Droplet className="w-4 h-4 text-purple-500" />
                        </div>
                        <div className="text-2xl font-bold text-purple-400">
                          {report.h2Produced.toLocaleString()} kg
                        </div>
                        <div className="text-xs text-purple-500/70 mt-1">
                          98% purity grade
                        </div>
                      </div>

                      <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-sm text-amber-400 font-medium">
                            Simulated Curtailment Reduction
                          </span>
                          <Zap className="w-4 h-4 text-amber-500" />
                        </div>
                        <div className="text-2xl font-bold text-amber-400">
                          {report.curtailmentSaved} MWh
                        </div>
                        <div className="text-xs text-amber-500/70 mt-1">
                          Redirected to electrolyzer
                        </div>
                      </div>

                      <div className="bg-cyan-500/10 border border-cyan-500/20 p-4 rounded-xl">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-sm text-cyan-400 font-medium">
                            Estimated CO₂ Avoided
                          </span>
                          <Wind className="w-4 h-4 text-cyan-500" />
                        </div>
                        <div className="text-2xl font-bold text-cyan-400">
                          {report.co2Avoided} tons
                        </div>
                        <div className="text-xs text-cyan-500/70 mt-1">
                          Equivalent to 5,400 trees
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-sm font-medium text-slate-300">
                          Simulated Stability Score
                        </span>
                        <span className="text-sm font-bold text-emerald-400">
                          {report.gridStabilityScore}/100
                        </span>
                      </div>
                      <div className="w-full bg-slate-700 rounded-full h-2 mb-2">
                        <div
                      className="bg-emerald-500 h-2 rounded-full transition-all duration-1000"
                      style={{
                        width: `${report.gridStabilityScore}%`
                      }} />

                      </div>
                      <p className="text-xs text-slate-400">
                        HyShift operations maintained frequency stability within
                        0.05Hz deviation limits during all dispatch events.
                      </p>
                    </div>
                  </div> :

              <div className="text-center text-slate-400 py-8">
                    Failed to load report data.
                  </div>
              }
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-slate-800 bg-slate-900/50 flex justify-end space-x-3">
                <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors">

                  Close
                </button>
                <button
                disabled
                title="A provenance-labelled PDF export is not implemented yet"
                className="flex cursor-not-allowed items-center rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-slate-400">

                  <FileDown className="w-4 h-4 mr-2" />
                  PDF Export Unavailable
                </button>
              </div>
            </div>
          </motion.div>
        </>
      }
    </AnimatePresence>);

}