import React, { useState } from 'react';
import {
  ArrowLeft,
  Check,
  AlertTriangle,
  Battery,
  Zap,
  ArrowRight,
  Droplet,
  X
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Page } from '../components/Sidebar';
import { useToast } from '../components/Toast';

interface AllRecommendationsProps {
  onNavigate: (page: Page) => void;
}

type RecStatus = 'pending' | 'approved' | 'rejected';

type Recommendation = {
  id: number;
  type: string;
  title: string;
  description: string;
  impact: string;
  status: RecStatus;
};

const initialRecommendations: Recommendation[] = [
  {
    id: 1,
    type: 'curtailment',
    title: 'Curtail Upington Solar',
    description: 'Reduce output by 15MW during 14:00-16:00 to avoid grid congestion.',
    impact: '+R12,500 revenue preserved',
    status: 'pending'
  },
  {
    id: 2,
    type: 'battery',
    title: 'Battery Charge Cycle',
    description: 'Charge De Aar BESS at max rate (10MW) from 11:00-13:00 using excess solar.',
    impact: 'Optimize for evening peak',
    status: 'pending'
  },
  {
    id: 3,
    type: 'dispatch',
    title: 'Increase Wind Dispatch',
    description: 'Ramp up Cookhouse wind farm to 95% capacity for evening peak demand.',
    impact: 'Meet contract obligation',
    status: 'approved'
  },
  {
    id: 4,
    type: 'hyshift',
    title: 'Route 25 MW to Electrolyzer',
    description: 'Redirect excess solar at Upington (14:00-16:00) to electrolyzer instead of curtailing.',
    impact: 'Avoids curtailment + produces 180 kg H₂',
    status: 'pending'
  },
  {
    id: 5,
    type: 'maintenance',
    title: 'Schedule Inverter Check',
    description: 'Schedule maintenance for Inverter 3 at Cookhouse due to efficiency drop.',
    impact: 'Prevent potential failure',
    status: 'pending'
  },
  {
    id: 6,
    type: 'dispatch',
    title: 'Shift Load to Battery',
    description: 'Shift 5MW load to battery during 18:00-19:00 peak pricing window.',
    impact: '+R5,000 cost saving',
    status: 'pending'
  }
];

export function AllRecommendations({ onNavigate }: AllRecommendationsProps) {
  const { showToast } = useToast();
  const [recommendations, setRecommendations] = useState(initialRecommendations);

  const updateStatus = (id: number, status: RecStatus, message: string) => {
    setRecommendations((prev) => prev.map((rec) => (rec.id === id ? { ...rec, status } : rec)));
    showToast(message, status === 'approved' ? 'success' : 'info');
  };

  return (
    <div className="space-y-6 p-6 pb-20">
      <div className="mb-6 flex items-center space-x-4">
        <button
          onClick={() => onNavigate('dashboard')}
          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-slate-100">All Recommendations</h2>
          <p className="text-slate-400">Actionable AI-driven dispatch and operational advice</p>
        </div>
      </div>

      <p className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-sm text-amber-100">
        Approving records operator intent only — physical execution remains locked in pilot mode.
      </p>

      <div className="space-y-4">
        {recommendations.map((rec, i) => (
          <motion.div
            key={rec.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="group rounded-xl border border-slate-700 bg-slate-800 p-6 transition-all hover:border-slate-600">
            <div className="mb-2 flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="rounded-lg bg-slate-900 p-2">
                  {rec.type === 'curtailment' && <AlertTriangle className="h-5 w-5 text-amber-500" />}
                  {rec.type === 'battery' && <Battery className="h-5 w-5 text-emerald-500" />}
                  {rec.type === 'dispatch' && <Zap className="h-5 w-5 text-cyan-500" />}
                  {rec.type === 'maintenance' && <Zap className="h-5 w-5 text-purple-500" />}
                  {rec.type === 'hyshift' && <Droplet className="h-5 w-5 text-purple-500" />}
                </div>
                <div>
                  <h3 className="font-semibold text-slate-100">{rec.title}</h3>
                  <p className="text-sm text-slate-400">{rec.description}</p>
                </div>
              </div>
              {rec.status === 'approved' ? (
                <span className="flex items-center rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-500">
                  <Check className="mr-1 h-3 w-3" /> Approved
                </span>
              ) : rec.status === 'rejected' ? (
                <span className="flex items-center rounded bg-slate-700/50 px-2 py-1 text-xs text-slate-400">
                  <X className="mr-1 h-3 w-3" /> Dismissed
                </span>
              ) : (
                <span className="rounded bg-slate-700/50 px-2 py-1 text-xs text-slate-500">Pending</span>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-slate-700/50 pt-4">
              <span className="text-sm font-medium text-emerald-400">{rec.impact}</span>
              {rec.status === 'pending' && (
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => updateStatus(rec.id, 'rejected', `Dismissed "${rec.title}"`)}
                    className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-600">
                    Dismiss
                  </button>
                  <button
                    type="button"
                    onClick={() => updateStatus(rec.id, 'approved', `Approved "${rec.title}" (advisory only)`)}
                    className="flex items-center rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-600">
                    Approve <ArrowRight className="ml-2 h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
