import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Sliders,
  Play,
  Save,
  RotateCcw,
  TrendingUp,
  ArrowRight,
  Droplet,
  Zap,
  Activity } from
'lucide-react';
import { PromptInput } from '../components/PromptInput';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer } from
'recharts';
import { Page } from '../components/Sidebar';
import { SimulationBanner } from '../components/SimulationBanner';
import { usePilotStore } from '../store/pilotStore';
import { optimizeGETTopology } from '../services/api';
interface ScenarioSimulationProps {
  onNavigate: (page: Page) => void;
}
export function ScenarioSimulation({ onNavigate }: ScenarioSimulationProps) {
  const { submitPrompt } = usePilotStore();
  const [batteryCap, setBatteryCap] = useState(150);
  const [solarVar, setSolarVar] = useState(0);
  const [windVar, setWindVar] = useState(0);
  const [electrolyzer, setElectrolyzer] = useState(0);
  const [enableGet, setEnableGet] = useState(true);
  const [topologyFlex, setTopologyFlex] = useState(40);
  const [getResult, setGetResult] = useState<Awaited<ReturnType<typeof optimizeGETTopology>> | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  useEffect(() => {
    void optimizeGETTopology().then(setGetResult);
  }, []);
  const runSimulation = () => {
    setIsSimulating(true);
    setTimeout(() => {
      setIsSimulating(false);
      if (enableGet) {
        void optimizeGETTopology().then(setGetResult);
      }
    }, 2000);
  };
  const scenarioData = useMemo(() => {
    const baseRevenue = 2.1;
    const baseCurtailment = 4.2;
    const baseStability = 85;
    const batteryEffect = (batteryCap - 150) / 150;
    const solarEffect = solarVar / 100;
    const windEffect = windVar / 100;
    const h2Effect = electrolyzer / 100;
    const getEffect = enableGet ? topologyFlex / 100 : 0;
    // Simple simulation logic
    const scenarioRevenue =
    baseRevenue * (
    1 + batteryEffect * 0.15 + h2Effect * 0.12 + windEffect * 0.05 + getEffect * 0.08);
    const scenarioCurtailment = Math.max(
      0,
      baseCurtailment * (
      1 - batteryEffect * 0.3 - h2Effect * 0.45 - getEffect * 0.22 + solarEffect * 0.1)
    );
    const scenarioStability = Math.min(
      99,
      baseStability + batteryEffect * 5 + h2Effect * 8 + getEffect * 4
    );
    const h2Production = electrolyzer * 7.2; // kg per MW per hour approx
    const h2Revenue = h2Production * 0.045; // R millions
    const totalRevenue = scenarioRevenue + h2Revenue;
    return {
      chartData: [
      {
        name: 'Baseline',
        revenue: baseRevenue,
        curtailment: baseCurtailment,
        stability: baseStability
      },
      {
        name: 'Scenario',
        revenue: Number(totalRevenue.toFixed(2)),
        curtailment: Number(scenarioCurtailment.toFixed(1)),
        stability: Math.round(scenarioStability)
      }],

      h2Production: Math.round(h2Production),
      h2Revenue: Number(h2Revenue.toFixed(3)),
      curtailmentReduction: Number(
        (baseCurtailment - scenarioCurtailment).toFixed(1)
      ),
      stabilityScore: Math.round(scenarioStability),
      getCapacityGain: Math.round((getResult?.transferCapacityGainPercent ?? 18) * (enableGet ? topologyFlex / 40 : 0)),
      getCongestionReduction: Math.round((getResult?.congestionReductionPercent ?? 12) * (enableGet ? topologyFlex / 40 : 0))
    };
  }, [batteryCap, solarVar, windVar, electrolyzer, enableGet, topologyFlex, getResult]);
  return (
    <div className="space-y-6 p-6 pb-20">
      <SimulationBanner featureName="Scenario simulation / topology optimisation" />
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">
            Scenario Simulation
          </h2>
          <p className="text-slate-400">
            "What-if" analysis for capacity planning and operations
          </p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => onNavigate('forecast-accuracy')}
            className="flex items-center px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors">

            <TrendingUp className="w-4 h-4 mr-2" />
            View Forecast Accuracy
          </button>
          <button className="flex items-center px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors">
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset
          </button>
          <button
            className="flex items-center px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors font-medium shadow-lg shadow-emerald-500/20"
            onClick={runSimulation}>

            {isSimulating ?
            <span className="animate-pulse">Simulating...</span> :

            <>
                <Play className="w-4 h-4 mr-2" />
                Run Simulation
              </>
            }
          </button>
        </div>
      </div>

      {/* AI Prompt */}
      <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
        <PromptInput
          onSubmit={(val) => submitPrompt(val, 'scenario')}
          placeholder="Describe a scenario (e.g., 'What if battery capacity doubles and wind drops 20%?')"
          templates={[
          {
            label: 'Battery Expansion',
            prompt:
            'Simulate impact of adding 100MWh battery storage at Upington'
          },
          {
            label: 'High Wind Event',
            prompt:
            'Scenario: Wind generation increases by 40% across all nodes'
          },
          {
            label: 'HyShift Integration',
            prompt:
            'Add 50MW electrolyzer load at Coega and re-run curtailment analysis'
          }]
          } />

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls Panel */}
        <motion.div
          initial={{
            opacity: 0,
            x: -20
          }}
          animate={{
            opacity: 1,
            x: 0
          }}
          className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-8">

          <div className="flex items-center space-x-2 mb-6">
            <Sliders className="w-5 h-5 text-emerald-500" />
            <h3 className="text-lg font-semibold text-slate-100">Parameters</h3>
          </div>

          <div className="space-y-6">
            <div>
              <div className="flex justify-between mb-2">
                <label className="text-sm font-medium text-slate-300">
                  Battery Capacity (MWh)
                </label>
                <span className="text-sm text-emerald-400 font-mono">
                  {batteryCap} MWh
                </span>
              </div>
              <input
                type="range"
                min="50"
                max="500"
                step="10"
                value={batteryCap}
                onChange={(e) => setBatteryCap(Number(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500" />

            </div>

            <div>
              <div className="flex justify-between mb-2">
                <label className="text-sm font-medium text-slate-300">
                  Solar Forecast Variance
                </label>
                <span className="text-sm text-cyan-400 font-mono">
                  {solarVar > 0 ? '+' : ''}
                  {solarVar}%
                </span>
              </div>
              <input
                type="range"
                min="-30"
                max="30"
                step="5"
                value={solarVar}
                onChange={(e) => setSolarVar(Number(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500" />

            </div>

            <div>
              <div className="flex justify-between mb-2">
                <label className="text-sm font-medium text-slate-300">
                  Wind Forecast Variance
                </label>
                <span className="text-sm text-cyan-400 font-mono">
                  {windVar > 0 ? '+' : ''}
                  {windVar}%
                </span>
              </div>
              <input
                type="range"
                min="-30"
                max="30"
                step="5"
                value={windVar}
                onChange={(e) => setWindVar(Number(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500" />

            </div>

            <div className="pt-6 border-t border-slate-700">
              <div className="flex justify-between mb-2">
                <label className="text-sm font-medium text-slate-300 flex items-center">
                  Electrolyzer Load (HyShift)
                  <span className="ml-2 text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/30">
                    ACTIVE
                  </span>
                </label>
                <span className="text-sm text-purple-400 font-mono">
                  {electrolyzer} MW
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="10"
                value={electrolyzer}
                onChange={(e) => setElectrolyzer(Number(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500" />

              {electrolyzer > 0 &&
              <button
                onClick={() => onNavigate('hyshift')}
                className="mt-4 w-full flex items-center justify-center px-3 py-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 text-sm font-medium rounded-lg border border-purple-500/20 transition-colors">

                  Go to HyShift Control <ArrowRight className="w-4 h-4 ml-2" />
                </button>
              }
            </div>

            <div className="pt-6 border-t border-slate-700">
              <div className="flex justify-between mb-2">
                <label className="text-sm font-medium text-slate-300">
                  Grid-Enhancing Tech (GETs)
                </label>
                <button
                  onClick={() => setEnableGet(!enableGet)}
                  className={`text-xs px-2 py-1 rounded border ${enableGet ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300' : 'bg-slate-900 border-slate-700 text-slate-500'}`}>
                  {enableGet ? 'Enabled' : 'Disabled'}
                </button>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-xs text-slate-500">Topology Flex</span>
                <span className="text-sm text-cyan-400 font-mono">
                  {topologyFlex}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={topologyFlex}
                onChange={(e) => setTopologyFlex(Number(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                disabled={!enableGet} />

            </div>
          </div>
        </motion.div>

        {/* Results Panel */}
        <motion.div
          initial={{
            opacity: 0,
            x: 20
          }}
          animate={{
            opacity: 1,
            x: 0
          }}
          transition={{
            delay: 0.1
          }}
          className="lg:col-span-2 space-y-6">

          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-slate-100 mb-6">
              Simulation Results
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="h-[250px]">
                <h4 className="text-sm font-medium text-slate-400 mb-4 text-center">
                  Revenue Impact (R Millions)
                </h4>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={scenarioData.chartData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#334155"
                      vertical={false} />

                    <XAxis
                      dataKey="name"
                      stroke="#94a3b8"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false} />

                    <YAxis
                      stroke="#94a3b8"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false} />

                    <Tooltip
                      cursor={{
                        fill: '#334155',
                        opacity: 0.2
                      }}
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        color: '#f1f5f9'
                      }} />

                    <Bar
                      dataKey="revenue"
                      fill="#10b981"
                      radius={[4, 4, 0, 0]}
                      barSize={40} />

                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="h-[250px]">
                <h4 className="text-sm font-medium text-slate-400 mb-4 text-center">
                  Curtailment Rate (%)
                </h4>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={scenarioData.chartData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#334155"
                      vertical={false} />

                    <XAxis
                      dataKey="name"
                      stroke="#94a3b8"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false} />

                    <YAxis
                      stroke="#94a3b8"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false} />

                    <Tooltip
                      cursor={{
                        fill: '#334155',
                        opacity: 0.2
                      }}
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        color: '#f1f5f9'
                      }} />

                    <Bar
                      dataKey="curtailment"
                      fill="#f59e0b"
                      radius={[4, 4, 0, 0]}
                      barSize={40} />

                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
              <h4 className="text-sm font-medium text-slate-300 mb-2">
                AI Analysis
              </h4>
                  <p className="text-sm text-slate-400">
                Increasing battery capacity to{' '}
                <span className="text-emerald-400 font-mono">
                  {batteryCap} MWh
                </span>{' '}
                reduces curtailment by approximately
                <span className="text-emerald-400 font-bold"> 50%</span>{' '}
                compared to baseline.
                {electrolyzer > 0 &&
                <span>
                    {' '}
                    Adding{' '}
                    <span className="text-purple-400">
                      {electrolyzer} MW
                    </span>{' '}
                    of flexible electrolyzer load further stabilizes the grid
                    during peak solar hours.
                  </span>
                }
                {enableGet &&
                <span>
                    {' '}
                    GET optimization contributes approximately
                    {' '}
                    <span className="text-cyan-400 font-bold">
                      {scenarioData.getCongestionReduction}%
                    </span>
                    {' '}
                    additional congestion relief.
                  </span>
                }
              </p>
            </div>
          </div>

          {electrolyzer > 0 &&
          <motion.div
            initial={{
              opacity: 0,
              y: 10
            }}
            animate={{
              opacity: 1,
              y: 0
            }}
            className="bg-slate-800 border border-purple-500/30 rounded-xl p-6 relative overflow-hidden">

              <div className="absolute top-0 left-0 w-1 h-full bg-purple-500" />
              <div className="flex items-center space-x-2 mb-6">
                <Droplet className="w-5 h-5 text-purple-400" />
                <h3 className="text-lg font-semibold text-slate-100">
                  HyShift Impact Analysis
                </h3>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-purple-500/10 p-4 rounded-lg border border-purple-500/20">
                  <p className="text-xs text-purple-300 mb-1">H₂ Production</p>
                  <p className="text-xl font-bold text-purple-400">
                    {scenarioData.h2Production} kg
                  </p>
                </div>
                <div className="bg-purple-500/10 p-4 rounded-lg border border-purple-500/20">
                  <p className="text-xs text-purple-300 mb-1">Add. Revenue</p>
                  <p className="text-xl font-bold text-purple-400">
                    R{scenarioData.h2Revenue}M
                  </p>
                </div>
                <div className="bg-amber-500/10 p-4 rounded-lg border border-amber-500/20">
                  <p className="text-xs text-amber-300 mb-1">
                    Curtailment Saved
                  </p>
                  <p className="text-xl font-bold text-amber-400">
                    {scenarioData.curtailmentReduction}%
                  </p>
                </div>
                <div className="bg-emerald-500/10 p-4 rounded-lg border border-emerald-500/20">
                  <p className="text-xs text-emerald-300 mb-1">
                    Grid Stability
                  </p>
                  <p className="text-xl font-bold text-emerald-400">
                    {scenarioData.stabilityScore}/100
                  </p>
                </div>
              </div>
            </motion.div>
          }

          {enableGet &&
          <motion.div
            initial={{
              opacity: 0,
              y: 10
            }}
            animate={{
              opacity: 1,
              y: 0
            }}
            className="bg-slate-800 border border-cyan-500/30 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-slate-100 mb-3">
                GET Optimization Summary
              </h3>
              <p className="text-sm text-slate-300 mb-3">
                {getResult?.recommendedTopology ??
                'Running optimization for topology reconfiguration...'}
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-cyan-500/10 p-4 rounded-lg border border-cyan-500/20">
                  <p className="text-xs text-cyan-300 mb-1">Capacity Gain</p>
                  <p className="text-xl font-bold text-cyan-400">
                    +{scenarioData.getCapacityGain}%
                  </p>
                </div>
                <div className="bg-emerald-500/10 p-4 rounded-lg border border-emerald-500/20">
                  <p className="text-xs text-emerald-300 mb-1">
                    HyShift Reroute
                  </p>
                  <p className="text-xl font-bold text-emerald-400">
                    {getResult?.rerouteToElectrolyzerMW ?? 0} MW
                  </p>
                </div>
              </div>
            </motion.div>
          }
        </motion.div>
      </div>
    </div>);

}
