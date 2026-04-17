import React from 'react';
import {
  ArrowLeft,
  Check,
  AlertTriangle,
  Battery,
  Zap,
  ArrowRight,
  Droplet } from
'lucide-react';
import { motion } from 'framer-motion';
import { Page } from '../components/Sidebar';
interface AllRecommendationsProps {
  onNavigate: (page: Page) => void;
}
const recommendations = [
{
  id: 1,
  type: 'curtailment',
  title: 'Curtail Upington Solar',
  description:
  'Reduce output by 15MW during 14:00-16:00 to avoid grid congestion.',
  impact: '+R12,500 revenue preserved',
  status: 'pending'
},
{
  id: 2,
  type: 'battery',
  title: 'Battery Charge Cycle',
  description:
  'Charge De Aar BESS at max rate (10MW) from 11:00-13:00 using excess solar.',
  impact: 'Optimize for evening peak',
  status: 'pending'
},
{
  id: 3,
  type: 'dispatch',
  title: 'Increase Wind Dispatch',
  description:
  'Ramp up Cookhouse wind farm to 95% capacity for evening peak demand.',
  impact: 'Meet contract obligation',
  status: 'approved'
},
{
  id: 4,
  type: 'hyshift',
  title: 'Route 25 MW to Electrolyzer',
  description:
  'Redirect excess solar at Upington (14:00-16:00) to electrolyzer instead of curtailing.',
  impact: 'Avoids curtailment + produces 180 kg H₂',
  status: 'pending'
},
{
  id: 5,
  type: 'maintenance',
  title: 'Schedule Inverter Check',
  description:
  'Schedule maintenance for Inverter 3 at Cookhouse due to efficiency drop.',
  impact: 'Prevent potential failure',
  status: 'pending'
},
{
  id: 6,
  type: 'dispatch',
  title: 'Shift Load to Battery',
  description:
  'Shift 5MW load to battery during 18:00-19:00 peak pricing window.',
  impact: '+R5,000 cost saving',
  status: 'pending'
}];

export function AllRecommendations({ onNavigate }: AllRecommendationsProps) {
  return (
    <div className="space-y-6 p-6 pb-20">
      <div className="flex items-center space-x-4 mb-6">
        <button
          onClick={() => onNavigate('dashboard')}
          className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors">

          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-slate-100">
            All Recommendations
          </h2>
          <p className="text-slate-400">
            Actionable AI-driven dispatch and operational advice
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {recommendations.map((rec, i) =>
        <motion.div
          key={rec.id}
          initial={{
            opacity: 0,
            y: 10
          }}
          animate={{
            opacity: 1,
            y: 0
          }}
          transition={{
            delay: i * 0.05
          }}
          className="bg-slate-800 border border-slate-700 rounded-xl p-6 hover:border-slate-600 transition-all group">

            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-slate-900 rounded-lg">
                  {rec.type === 'curtailment' &&
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                }
                  {rec.type === 'battery' &&
                <Battery className="w-5 h-5 text-emerald-500" />
                }
                  {rec.type === 'dispatch' &&
                <Zap className="w-5 h-5 text-cyan-500" />
                }
                  {rec.type === 'maintenance' &&
                <Zap className="w-5 h-5 text-purple-500" />
                }
                  {rec.type === 'hyshift' &&
                <Droplet className="w-5 h-5 text-purple-500" />
                }
                </div>
                <div>
                  <h3 className="font-semibold text-slate-100">{rec.title}</h3>
                  <p className="text-sm text-slate-400">{rec.description}</p>
                </div>
              </div>
              {rec.status === 'approved' ?
            <span className="text-xs text-emerald-500 flex items-center bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">
                  <Check className="w-3 h-3 mr-1" /> Approved
                </span> :

            <span className="text-xs text-slate-500 bg-slate-700/50 px-2 py-1 rounded">
                  Pending
                </span>
            }
            </div>

            <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-700/50">
              <span className="text-sm font-medium text-emerald-400">
                {rec.impact}
              </span>
              {rec.status === 'pending' &&
            <div className="flex space-x-2">
                  <button className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium rounded-lg transition-colors">
                    Dismiss
                  </button>
                  <button className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center">
                    Approve <ArrowRight className="w-4 h-4 ml-2" />
                  </button>
                </div>
            }
            </div>
          </motion.div>
        )}
      </div>
    </div>);

}