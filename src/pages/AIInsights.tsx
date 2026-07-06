import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Bot,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Zap,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Droplet } from
'lucide-react';
import { motion } from 'framer-motion';
import { Page } from '../components/Sidebar';
import { useRealTime } from '../context/RealTimeContext';
import { buildForecastProfilesFromNodes, fetchForecast, fetchForecastProvidersStatus } from '../services/api';
interface AIInsightsProps {
  onNavigate: (page: Page) => void;
}
const insights = [
{
  id: 1,
  title: 'Congestion Pattern Detected',
  desc: 'Recurring congestion at Upington node between 13:00-15:00 correlates with high solar irradiance (>950 W/m²).',
  type: 'Pattern',
  color: 'text-purple-400',
  bg: 'bg-purple-500/10',
  border: 'border-purple-500/20',
  icon: Sparkles,
  time: '2 hours ago',
  confidence: 94,
  action: 'View Congestion Forecast',
  target: 'congestion' as Page
},
{
  id: 2,
  title: 'Revenue Opportunity',
  desc: 'Price arbitrage opportunity identified: Charge De Aar BESS at 11:00 (R0.85/kWh) and discharge at 19:00 (R3.20/kWh).',
  type: 'Opportunity',
  color: 'text-emerald-400',
  bg: 'bg-emerald-500/10',
  border: 'border-emerald-500/20',
  icon: TrendingUp,
  time: '45 min ago',
  confidence: 98,
  action: 'View Revenue Detail',
  target: 'revenue-detail' as Page
},
{
  id: 7,
  title: 'HyShift Schedule Optimization',
  desc: 'Electrolyzer at Upington can absorb 25MW excess during 92% congestion window (14:00-16:00). Expected yield: 180 kg H₂ at R42/kg LCOH.',
  type: 'Opportunity',
  color: 'text-purple-400',
  bg: 'bg-purple-500/10',
  border: 'border-purple-500/20',
  icon: Droplet,
  time: '5 min ago',
  confidence: 96,
  action: 'Open HyShift Control',
  target: 'hyshift' as Page
},
{
  id: 8,
  title: 'LCOH Below Target at Prieska',
  desc: 'Capturing 80% of curtailed energy at Prieska node yields LCOH of R38.50/kg — 14% below target. Recommend increasing electrolyzer capacity allocation.',
  type: 'Pattern',
  color: 'text-cyan-400',
  bg: 'bg-cyan-500/10',
  border: 'border-cyan-500/20',
  icon: TrendingUp,
  time: '1 hour ago',
  confidence: 91,
  action: 'Run Scenario',
  target: 'scenario' as Page
},
{
  id: 3,
  title: 'Maintenance Anomaly',
  desc: 'Inverter 3 at Cookhouse showing 5% efficiency drop compared to peer units. Possible dust accumulation or cooling fault.',
  type: 'Anomaly',
  color: 'text-amber-400',
  bg: 'bg-amber-500/10',
  border: 'border-amber-500/20',
  icon: AlertTriangle,
  time: '12 min ago',
  confidence: 89,
  action: 'Schedule Maintenance',
  target: 'dispatch-status' as Page
},
{
  id: 4,
  title: 'Demand Surge Predicted',
  desc: 'Evening peak demand expected to exceed 900MW at 18:30. Recommend pre-charging BESS to 95%.',
  type: 'Forecast',
  color: 'text-cyan-400',
  bg: 'bg-cyan-500/10',
  border: 'border-cyan-500/20',
  icon: Zap,
  time: 'Just now',
  confidence: 92,
  action: 'View Dispatch',
  target: 'dispatch' as Page
},
{
  id: 5,
  title: 'Contract Compliance Risk',
  desc: 'Cookhouse wind output trending 8% below PPA minimum for this billing period. 3 days remaining to recover.',
  type: 'Risk',
  color: 'text-red-400',
  bg: 'bg-red-500/10',
  border: 'border-red-500/20',
  icon: AlertTriangle,
  time: '3 hours ago',
  confidence: 99,
  action: 'View KPI Report',
  target: 'kpi' as Page
},
{
  id: 6,
  title: 'Optimization Success',
  desc: "Yesterday's AI dispatch saved R45,000 vs manual baseline. Battery arbitrage contributed 62% of savings.",
  type: 'Result',
  color: 'text-emerald-400',
  bg: 'bg-emerald-500/10',
  border: 'border-emerald-500/20',
  icon: CheckCircle2,
  time: '1 day ago',
  confidence: 100,
  action: 'View Revenue Detail',
  target: 'revenue-detail' as Page
}];

const filters = [
'All',
'Pattern',
'Opportunity',
'Anomaly',
'Forecast',
'Risk',
'Result'];

export function AIInsights({ onNavigate }: AIInsightsProps) {
  const { availableNodeNames, selectedNodeNames, toggleSelectedNode, backendNodes } = useRealTime();
  const [activeFilter, setActiveFilter] = useState('All');
  const [insightRows, setInsightRows] = useState(insights);
  const hasSpecificNodeScope = !selectedNodeNames.includes('All Nodes');
  const selectedScopeLabel = hasSpecificNodeScope ? selectedNodeNames.join(', ') : 'All Nodes';

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const scopedProfiles = buildForecastProfilesFromNodes(backendNodes, selectedNodeNames);
        const primaryProfile = scopedProfiles[0];
        if (!primaryProfile) {
          return;
        }

        const [forecast, providers] = await Promise.all([
        fetchForecast({
          lat: primaryProfile.lat,
          lon: primaryProfile.lon,
          capacity: primaryProfile.capacity
        }),
        fetchForecastProvidersStatus()]);

        if (!active) return;

        const peakHour = forecast.hourly.reduce(
          (best, row) => row.estimatedPowerKw > best.estimatedPowerKw ? row : best,
          forecast.hourly[0]
        );
        const peakTime = peakHour ?
        new Date(peakHour.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) :
        'N/A';
        const providerHealth = [
        providers.providers.forecastSolar.state,
        providers.providers.openWeather.state,
        providers.providers.accuWeather.state].
        every((state) => state === 'closed');

        const dynamic = [{
          ...insights[0],
          desc: `Hybrid forecast flags a peak production ramp near ${peakTime}; expected cloud cover ${
          forecast.hourly[0]?.cloudCoverPct ?? 0
          }% may amplify corridor volatility.`,
          confidence: providerHealth ? 96 : 88,
          time: 'Live'
        },
        {
          ...insights[1],
          desc: `Daily estimated energy for ${primaryProfile.name}: ${Math.round(forecast.daily[0]?.estimatedEnergyKwh ?? 0)} kWh. Dispatch opportunity improves when cache source is warm.`,
          time: 'Live'
        },
        ...insights.slice(2)];
        setInsightRows(dynamic);
      } catch {
        // Keep initial curated insights during backend outages.
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [backendNodes, selectedNodeNames]);
  const scopedInsights = useMemo(() => {
    if (!hasSpecificNodeScope) {
      return insightRows;
    }

    const matchesScope = (text: string) => selectedNodeNames.some((nodeName) => text.toLowerCase().includes(nodeName.toLowerCase()));
    const scoped = insightRows.filter((insight) => matchesScope(`${insight.title} ${insight.desc}`));
    return scoped.length ? scoped : insightRows.slice(0, 2);
  }, [hasSpecificNodeScope, insightRows, selectedNodeNames]);

  const filteredInsights =
  activeFilter === 'All' ?
  scopedInsights :
  scopedInsights.filter((i) => i.type === activeFilter);
  return (
    <div className="space-y-6 p-6 pb-20">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => onNavigate('dashboard')}
            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors">

            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-slate-100">AI Insights</h2>
            <p className="text-slate-400">
              Deep learning analysis and strategic alerts
            </p>
          </div>
        </div>
        <button
          onClick={() => onNavigate('ai-assistant')}
          className="flex items-center px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors font-medium shadow-lg shadow-emerald-500/20">

          <Bot className="w-4 h-4 mr-2" />
          Ask Zolt AI
        </button>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-100">Shared node scope</p>
            <p className="text-xs text-slate-400">Filtering AI insight cards for: {selectedScopeLabel}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {availableNodeNames.map((nodeName) =>
            <button
              key={nodeName}
              onClick={() => toggleSelectedNode(nodeName)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${selectedNodeNames.includes(nodeName) ? 'bg-cyan-500/15 border-cyan-400/40 text-cyan-300' : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'}`}>
              {nodeName}
            </button>
            )}
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
        {
          label: 'Total Insights',
          value: String(scopedInsights.length),
          color: 'text-slate-200'
        },
        {
          label: 'Acted On',
          value: '8',
          color: 'text-emerald-400'
        },
        {
          label: 'Dismissed',
          value: '2',
          color: 'text-slate-400'
        },
        {
          label: 'Pending',
          value: String(filteredInsights.length),
          color: 'text-amber-400'
        }].
        map((stat, i) =>
        <div
          key={i}
          className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex flex-col items-center justify-center">

            <span className="text-xs text-slate-500 uppercase tracking-wider mb-1">
              {stat.label}
            </span>
            <span className={`text-2xl font-bold ${stat.color}`}>
              {stat.value}
            </span>
          </div>
        )}
      </div>

      {/* Filter Bar */}
      <div className="flex space-x-2 overflow-x-auto pb-2">
        {filters.map((filter) =>
        <button
          key={filter}
          onClick={() => setActiveFilter(filter)}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${activeFilter === filter ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200 border border-slate-700'}`}>

            {filter}
          </button>
        )}
      </div>

      {/* Insights Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredInsights.map((insight, i) =>
        <motion.div
          key={insight.id}
          initial={{
            opacity: 0,
            y: 20
          }}
          animate={{
            opacity: 1,
            y: 0
          }}
          transition={{
            delay: i * 0.1
          }}
          className={`p-6 rounded-xl border flex flex-col h-full ${insight.bg} ${insight.border}`}>

            <div className="flex justify-between items-start mb-4">
              <div
              className={`p-2 rounded-lg bg-slate-900/50 ${insight.color}`}>

                <insight.icon className="w-5 h-5" />
              </div>
              <div className="flex flex-col items-end">
                <span className="text-xs text-slate-400 flex items-center mb-1">
                  <Clock className="w-3 h-3 mr-1" /> {insight.time}
                </span>
                <span className="text-xs font-medium bg-slate-900/50 px-2 py-0.5 rounded text-slate-300 border border-slate-700/50">
                  {insight.confidence}% confidence
                </span>
              </div>
            </div>

            <div className="flex-1 mb-6">
              <div className="flex items-center space-x-2 mb-2">
                <h3 className={`font-semibold ${insight.color}`}>
                  {insight.title}
                </h3>
                <span
                className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-900/30 ${insight.color}`}>

                  {insight.type}
                </span>
              </div>
              <p className="text-slate-300 text-sm leading-relaxed">
                {insight.desc}
              </p>
            </div>

            <div className="space-y-3">
              <button
              onClick={() => onNavigate(insight.target)}
              className="w-full py-2 bg-slate-900/50 hover:bg-slate-900 text-slate-200 text-sm font-medium rounded-lg border border-slate-700/50 hover:border-slate-600 transition-colors flex items-center justify-center">

                {insight.action} <ArrowRight className="w-4 h-4 ml-2" />
              </button>
              <div className="flex space-x-2">
                <button className="flex-1 py-1.5 bg-transparent hover:bg-slate-900/30 text-slate-400 hover:text-slate-300 text-xs font-medium rounded-lg transition-colors">
                  Dismiss
                </button>
                <button className="flex-1 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 hover:text-emerald-300 text-xs font-medium rounded-lg transition-colors">
                  Act on This
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>);

}
