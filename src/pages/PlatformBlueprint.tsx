import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Database,
  Cpu,
  Layout,
  Server,
  Shield,
  ArrowRight,
  CheckCircle2,
  Clock } from
'lucide-react';
import { Page } from '../components/Sidebar';
interface PlatformBlueprintProps {
  onNavigate: (page: Page) => void;
}
export function PlatformBlueprint({ onNavigate }: PlatformBlueprintProps) {
  const [activeTab, setActiveTab] = useState<
    'architecture' | 'modules' | 'data' | 'roadmap'>(
    'architecture');
  const tabs = [
  {
    id: 'architecture',
    label: 'Architecture'
  },
  {
    id: 'modules',
    label: 'Core Modules'
  },
  {
    id: 'data',
    label: 'Data Sources'
  },
  {
    id: 'roadmap',
    label: 'Launch Roadmap'
  }];

  return (
    <div className="space-y-6 p-6 pb-20">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-100">
          Platform Blueprint
        </h2>
        <p className="text-slate-400">
          Technical specification and implementation roadmap
        </p>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-slate-800 p-1 rounded-lg border border-slate-700 w-fit mb-8">
        {tabs.map((tab) =>
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id as any)}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === tab.id ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'}`}>

            {tab.label}
          </button>
        )}
      </div>

      <div className="min-h-[500px]">
        {activeTab === 'architecture' &&
        <motion.div
          initial={{
            opacity: 0
          }}
          animate={{
            opacity: 1
          }}
          className="space-y-8">

            <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Server className="w-32 h-32 text-slate-400" />
              </div>

              <h3 className="text-xl font-bold text-slate-100 mb-8">
                System Architecture
              </h3>

              <div className="flex flex-col md:flex-row items-stretch justify-between gap-4 relative">
                {/* Layer 1: Ingestion */}
                <div className="flex-1 bg-slate-900/50 border border-slate-700 rounded-lg p-6 flex flex-col items-center text-center z-10">
                  <div className="bg-blue-500/20 p-3 rounded-full mb-4">
                    <Database className="w-6 h-6 text-blue-400" />
                  </div>
                  <h4 className="font-semibold text-slate-200 mb-2">
                    Data Ingestion Layer
                  </h4>
                  <ul className="text-sm text-slate-400 space-y-1">
                    <li>SCADA / EMS Streams</li>
                    <li>Weather APIs (Solar/Wind)</li>
                    <li>Market Pricing Data</li>
                  </ul>
                </div>

                <div className="hidden md:flex items-center justify-center text-slate-600">
                  <ArrowRight className="w-6 h-6" />
                </div>

                {/* Layer 2: Processing */}
                <div className="flex-1 bg-slate-900/50 border border-slate-700 rounded-lg p-6 flex flex-col items-center text-center z-10">
                  <div className="bg-purple-500/20 p-3 rounded-full mb-4">
                    <Cpu className="w-6 h-6 text-purple-400" />
                  </div>
                  <h4 className="font-semibold text-slate-200 mb-2">
                    AI Processing Engine
                  </h4>
                  <ul className="text-sm text-slate-400 space-y-1">
                    <li>Congestion Forecasting Model</li>
                    <li>Dispatch Optimization Solver</li>
                    <li>LLM Reasoning Core</li>
                  </ul>
                </div>

                <div className="hidden md:flex items-center justify-center text-slate-600">
                  <ArrowRight className="w-6 h-6" />
                </div>

                {/* Layer 3: Presentation */}
                <div className="flex-1 bg-slate-900/50 border border-slate-700 rounded-lg p-6 flex flex-col items-center text-center z-10">
                  <div className="bg-emerald-500/20 p-3 rounded-full mb-4">
                    <Layout className="w-6 h-6 text-emerald-400" />
                  </div>
                  <h4 className="font-semibold text-slate-200 mb-2">
                    Presentation Layer
                  </h4>
                  <ul className="text-sm text-slate-400 space-y-1">
                    <li>React Dashboard</li>
                    <li>Interactive Visualizations</li>
                    <li>Natural Language Interface</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                <h4 className="flex items-center font-semibold text-slate-100 mb-4">
                  <Shield className="w-5 h-5 mr-2 text-emerald-500" />
                  Security & Compliance
                </h4>
                <ul className="space-y-3 text-sm text-slate-400">
                  <li className="flex items-start">
                    <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-500 mt-0.5" />{' '}
                    End-to-end encryption for SCADA data streams
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-500 mt-0.5" />{' '}
                    Role-based access control (RBAC) for operators
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-500 mt-0.5" />{' '}
                    Local data residency compliance (POPIA)
                  </li>
                </ul>
              </div>
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                <h4 className="flex items-center font-semibold text-slate-100 mb-4">
                  <Server className="w-5 h-5 mr-2 text-cyan-500" />
                  Integration Points
                </h4>
                <ul className="space-y-3 text-sm text-slate-400">
                  <li className="flex items-start">
                    <CheckCircle2 className="w-4 h-4 mr-2 text-cyan-500 mt-0.5" />{' '}
                    REST API for external reporting tools
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="w-4 h-4 mr-2 text-cyan-500 mt-0.5" />{' '}
                    WebSocket feeds for real-time dashboard updates
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="w-4 h-4 mr-2 text-cyan-500 mt-0.5" />{' '}
                    CSV/JSON export for offline analysis
                  </li>
                </ul>
              </div>
            </div>
          </motion.div>
        }

        {activeTab === 'modules' &&
        <motion.div
          initial={{
            opacity: 0
          }}
          animate={{
            opacity: 1
          }}
          className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {[
          {
            title: 'Congestion Forecasting',
            desc: 'Predicts grid bottlenecks 6-72h in advance using weather and historical load data.',
            inputs: 'Weather forecast, Grid topology, Historical load',
            outputs: 'Heatmap, Risk alerts, Curtailment probability',
            target: 'congestion' as Page
          },
          {
            title: 'Dispatch Optimization',
            desc: 'Real-time control recommendations for battery charging/discharging and generation curtailment.',
            inputs: 'Real-time generation, Battery SOC, Market prices',
            outputs: 'Dispatch schedule, Revenue impact analysis',
            target: 'dispatch' as Page
          },
          {
            title: 'Scenario Simulation',
            desc: "Digital twin environment for 'what-if' analysis of capacity expansion and operational changes.",
            inputs: 'Asset parameters, Weather scenarios, Demand curves',
            outputs: 'Financial projections, Grid stability scores',
            target: 'scenario' as Page
          },
          {
            title: 'HyShift Integration',
            desc: 'Future module for managing green hydrogen electrolyzer loads as flexible grid assets.',
            inputs:
            'Hydrogen demand, Water availability, Electrolyzer specs',
            outputs: 'Production schedule, Load shifting opportunities',
            target: 'scenario' as Page
          }].
          map((mod, i) =>
          <div
            key={i}
            onClick={() => onNavigate(mod.target)}
            className="bg-slate-800 border border-slate-700 rounded-xl p-6 hover:border-emerald-500/50 transition-colors cursor-pointer group">

                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-bold text-emerald-400">
                    {mod.title}
                  </h3>
                  <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition-colors" />
                </div>
                <p className="text-slate-300 mb-4 text-sm">{mod.desc}</p>
                <div className="space-y-2">
                  <div className="text-xs">
                    <span className="text-slate-500 font-semibold uppercase tracking-wider">
                      Inputs:
                    </span>
                    <span className="text-slate-400 ml-2">{mod.inputs}</span>
                  </div>
                  <div className="text-xs">
                    <span className="text-slate-500 font-semibold uppercase tracking-wider">
                      Outputs:
                    </span>
                    <span className="text-slate-400 ml-2">{mod.outputs}</span>
                  </div>
                </div>
              </div>
          )}
          </motion.div>
        }

        {activeTab === 'data' &&
        <motion.div
          initial={{
            opacity: 0
          }}
          animate={{
            opacity: 1
          }}
          className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">

            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-400 uppercase bg-slate-900/50">
                <tr>
                  <th className="px-6 py-4">Data Source</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Refresh Rate</th>
                  <th className="px-6 py-4">Integration Method</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {[
              {
                source: 'SCADA / EMS',
                type: 'Generation & Grid Status',
                rate: '1 min',
                method: 'MQTT / OPC-UA'
              },
              {
                source: 'Weather Services',
                type: 'Solar/Wind Forecasts',
                rate: '15 min',
                method: 'REST API (JSON)'
              },
              {
                source: 'Battery BMS',
                type: 'SOC, SOH, Temp',
                rate: '5 sec',
                method: 'Modbus TCP / API'
              },
              {
                source: 'Market / PPA',
                type: 'Pricing & Revenue Rules',
                rate: 'Daily',
                method: 'CSV / Database Sync'
              },
              {
                source: 'Grid Operator',
                type: 'Curtailment Instructions',
                rate: 'Real-time',
                method: 'Signal / API'
              }].
              map((row, i) =>
              <tr key={i} className="hover:bg-slate-700/30">
                    <td className="px-6 py-4 font-medium text-slate-200">
                      {row.source}
                    </td>
                    <td className="px-6 py-4 text-slate-400">{row.type}</td>
                    <td className="px-6 py-4 text-slate-400">{row.rate}</td>
                    <td className="px-6 py-4 text-cyan-400 font-mono text-xs">
                      {row.method}
                    </td>
                  </tr>
              )}
              </tbody>
            </table>
          </motion.div>
        }

        {activeTab === 'roadmap' &&
        <motion.div
          initial={{
            opacity: 0
          }}
          animate={{
            opacity: 1
          }}
          className="space-y-8 relative">

            <div className="absolute left-8 top-8 bottom-8 w-0.5 bg-slate-700" />

            {[
          {
            phase: 'Phase 1: Advisory Mode',
            time: 'Months 0-3',
            items: [
            'Congestion forecasting (72h)',
            'Basic dispatch recommendations',
            'Dashboard implementation'],

            status: 'current'
          },
          {
            phase: 'Phase 2: Simulation & Control',
            time: 'Months 3-6',
            items: [
            'Scenario simulation engine',
            'Battery auto-dispatch integration',
            'Advanced revenue analytics'],

            status: 'upcoming'
          },
          {
            phase: 'Phase 3: Full Ecosystem',
            time: 'Months 6-12',
            items: [
            'HyShift electrolyzer integration',
            'Multi-site fleet optimization',
            'Automated market bidding'],

            status: 'future'
          }].
          map((phase, i) =>
          <div key={i} className="relative flex items-start ml-2">
                <div
              className={`absolute left-0 w-12 h-12 rounded-full border-4 flex items-center justify-center z-10 bg-slate-900 ${phase.status === 'current' ? 'border-emerald-500 text-emerald-500' : 'border-slate-700 text-slate-500'}`}>

                  <Clock className="w-5 h-5" />
                </div>
                <div className="ml-20 bg-slate-800 border border-slate-700 rounded-xl p-6 flex-1">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3
                    className={`text-lg font-bold ${phase.status === 'current' ? 'text-emerald-400' : 'text-slate-200'}`}>

                        {phase.phase}
                      </h3>
                      <p className="text-sm text-slate-500">{phase.time}</p>
                    </div>
                    {phase.status === 'current' &&
                <span className="bg-emerald-500/10 text-emerald-400 text-xs px-2 py-1 rounded border border-emerald-500/20">
                        In Progress
                      </span>
                }
                  </div>
                  <ul className="space-y-2">
                    {phase.items.map((item, j) =>
                <li
                  key={j}
                  className="flex items-center text-slate-300 text-sm">

                        <div
                    className={`w-1.5 h-1.5 rounded-full mr-2 ${phase.status === 'current' ? 'bg-emerald-500' : 'bg-slate-600'}`} />

                        {item}
                      </li>
                )}
                  </ul>
                </div>
              </div>
          )}
          </motion.div>
        }
      </div>
    </div>);

}