import React, { useEffect, useMemo, useState } from 'react';
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
import { useAuth } from '../context/AuthContext';
import { listDecisions, persistDecision, type DecisionStage } from '../lib/decisionLog';
import { listOperatorDecisions } from '../services/api';

interface AllRecommendationsProps {
  onNavigate: (page: Page) => void;
}

type RecStatus = 'proposed' | 'reviewed' | 'approved' | 'rejected' | 'assigned' | 'completed' | 'verified';

type Recommendation = {
  id: number;
  type: string;
  title: string;
  description: string;
  impact: string;
  status: RecStatus;
  assignee?: string;
};

const initialRecommendations: Recommendation[] = [
  {
    id: 1,
    type: 'curtailment',
    title: 'Curtail Upington Solar',
    description: 'Reduce output by 15MW during 14:00-16:00 to avoid grid congestion.',
    impact: '+R12,500 revenue preserved (illustrative)',
    status: 'proposed'
  },
  {
    id: 2,
    type: 'battery',
    title: 'Battery Charge Cycle',
    description: 'Charge De Aar BESS at max rate (10MW) from 11:00-13:00 using excess solar.',
    impact: 'Optimize for evening peak (illustrative)',
    status: 'proposed'
  },
  {
    id: 3,
    type: 'dispatch',
    title: 'Increase Wind Dispatch',
    description: 'Ramp up NC Demo Plant wind capacity to 95% for evening peak demand (illustrative).',
    impact: 'Meet contract obligation (illustrative)',
    status: 'reviewed'
  },
  {
    id: 4,
    type: 'hyshift',
    title: 'Route 25 MW to Electrolyzer',
    description: 'Redirect excess solar at Upington (14:00-16:00) to electrolyzer instead of curtailing.',
    impact: 'Avoids curtailment + produces 180 kg H₂ (illustrative)',
    status: 'proposed'
  },
  {
    id: 5,
    type: 'maintenance',
    title: 'Schedule Inverter Check',
    description: 'Schedule maintenance for Inverter 3 at NC Demo Plant due to efficiency drop.',
    impact: 'Prevent potential failure',
    status: 'proposed'
  },
  {
    id: 6,
    type: 'dispatch',
    title: 'Shift Load to Battery',
    description: 'Shift 5MW load to battery during 18:00-19:00 peak pricing window.',
    impact: '+R5,000 cost saving (illustrative)',
    status: 'proposed'
  }
];

const nextAfterApprove: RecStatus[] = ['approved', 'assigned', 'completed', 'verified'];

const toRecStatus = (value: string | undefined): RecStatus | null => {
  if (
    value === 'proposed' ||
    value === 'reviewed' ||
    value === 'approved' ||
    value === 'rejected' ||
    value === 'assigned' ||
    value === 'completed' ||
    value === 'verified'
  ) {
    return value;
  }
  if (value === 'dismissed') return 'rejected';
  return null;
};

export function AllRecommendations({ onNavigate }: AllRecommendationsProps) {
  const { showToast } = useToast();
  const { user } = useAuth();
  const [recommendations, setRecommendations] = useState(initialRecommendations);
  const [tick, setTick] = useState(0);
  const actor = user?.name ?? 'Operator';

  useEffect(() => {
    let active = true;
    const hydrate = async () => {
      const local = listDecisions().filter((d) => d.entityType === 'recommendation');
      let apiRows: Awaited<ReturnType<typeof listOperatorDecisions>> = [];
      try {
        apiRows = await listOperatorDecisions({ entityType: 'recommendation', limit: 200 });
      } catch {
        apiRows = [];
      }
      if (!active) return;

      const latest = new Map<string, RecStatus>();
      for (const row of [...apiRows].reverse()) {
        if (!row.entityId) continue;
        const status = toRecStatus(row.decision ?? row.action.replace('operator.decision.', ''));
        if (status) latest.set(row.entityId, status);
      }
      for (const row of [...local].reverse()) {
        const status = toRecStatus(row.stage);
        if (status) latest.set(row.entityId, status);
      }

      setRecommendations((prev) =>
        prev.map((rec) => {
          const status = latest.get(String(rec.id));
          return status ? { ...rec, status } : rec;
        })
      );
      setTick((v) => v + 1);
    };
    void hydrate();
    return () => {
      active = false;
    };
  }, []);

  const decisions = useMemo(() => {
    void tick;
    return listDecisions();
  }, [tick]);

  const record = async (
    rec: Recommendation,
    stage: DecisionStage,
    reason: string,
    expectedOutcome: string
  ) => {
    try {
      await persistDecision({
        entityType: 'recommendation',
        entityId: String(rec.id),
        title: rec.title,
        stage,
        actorName: actor,
        actorRole: user?.role ?? 'operator',
        reason,
        expectedOutcome,
        previousState: rec.status,
        newState: stage
      });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not persist decision', 'error');
    }
    setTick((v) => v + 1);
  };

  const dismiss = (rec: Recommendation) => {
    setRecommendations((prev) =>
      prev.map((row) => (row.id === rec.id ? { ...row, status: 'rejected' } : row))
    );
    void record(rec, 'rejected', 'Dismissed by operator', 'No further action; advisory closed');
    showToast(`Dismissed "${rec.title}"`, 'info');
  };

  const approve = (rec: Recommendation) => {
    setRecommendations((prev) =>
      prev.map((row) => (row.id === rec.id ? { ...row, status: 'approved' } : row))
    );
    void record(rec, 'approved', 'Approved as advisory intent', rec.impact);
    showToast(`Approved "${rec.title}" (advisory only — no plant command)`, 'success');
  };

  const advance = (rec: Recommendation) => {
    const idx = nextAfterApprove.indexOf(rec.status);
    const nxt = nextAfterApprove[idx + 1];
    if (!nxt) return;
    setRecommendations((prev) =>
      prev.map((row) =>
        row.id === rec.id
          ? { ...row, status: nxt, assignee: nxt === 'assigned' ? actor : row.assignee }
          : row
      )
    );
    void record(rec, nxt, `Advanced workflow to ${nxt}`, rec.impact);
    showToast(`Moved "${rec.title}" → ${nxt}`, 'success');
  };

  const markReviewed = (rec: Recommendation) => {
    setRecommendations((prev) =>
      prev.map((row) => (row.id === rec.id ? { ...row, status: 'reviewed' } : row))
    );
    void record(rec, 'reviewed', 'Marked reviewed', 'Ready for approve/reject decision');
    showToast(`Reviewed "${rec.title}"`, 'info');
  };

  return (
    <div className="space-y-6 p-6 pb-20">
      <div className="mb-6 flex items-center space-x-4">
        <button
          type="button"
          onClick={() => onNavigate('dashboard')}
          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-slate-100">All Recommendations</h2>
          <p className="text-slate-400">
            Proposed → Reviewed → Approved/rejected → Assigned → Completed → Verified
          </p>
        </div>
      </div>

      <p className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-sm text-amber-100">
        Approving records operator intent only — physical execution remains locked. Impacts labelled
        illustrative are not customer settlement results.
      </p>

      <div className="space-y-4">
        {recommendations.map((rec, i) => (
          <motion.div
            key={rec.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-xl border border-slate-700 bg-slate-800 p-6">
            <div className="mb-2 flex items-start justify-between gap-3">
              <div className="flex items-center space-x-3">
                <div className="rounded-lg bg-slate-900 p-2">
                  {rec.type === 'curtailment' && <AlertTriangle className="h-5 w-5 text-amber-500" />}
                  {rec.type === 'battery' && <Battery className="h-5 w-5 text-emerald-500" />}
                  {rec.type === 'dispatch' && <Zap className="h-5 w-5 text-cyan-500" />}
                  {rec.type === 'maintenance' && <Zap className="h-5 w-5 text-violet-400" />}
                  {rec.type === 'hyshift' && <Droplet className="h-5 w-5 text-sky-400" />}
                </div>
                <div>
                  <h3 className="font-semibold text-slate-100">{rec.title}</h3>
                  <p className="text-sm text-slate-400">{rec.description}</p>
                </div>
              </div>
              <span className="shrink-0 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs capitalize text-slate-300">
                {rec.status}
                {rec.assignee ? ` · ${rec.assignee}` : ''}
              </span>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-700/50 pt-4">
              <span className="text-sm font-medium text-emerald-400">{rec.impact}</span>
              <div className="flex flex-wrap gap-2">
                {rec.status === 'proposed' && (
                  <>
                    <button
                      type="button"
                      onClick={() => markReviewed(rec)}
                      className="rounded-lg bg-slate-700 px-3 py-2 text-sm text-slate-100 hover:bg-slate-600">
                      Mark reviewed
                    </button>
                    <button
                      type="button"
                      onClick={() => dismiss(rec)}
                      className="rounded-lg bg-slate-700 px-3 py-2 text-sm text-slate-100 hover:bg-slate-600">
                      Dismiss
                    </button>
                    <button
                      type="button"
                      onClick={() => approve(rec)}
                      className="inline-flex items-center rounded-lg bg-emerald-500 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-600">
                      Approve <ArrowRight className="ml-1 h-4 w-4" />
                    </button>
                  </>
                )}
                {rec.status === 'reviewed' && (
                  <>
                    <button
                      type="button"
                      onClick={() => dismiss(rec)}
                      className="rounded-lg bg-slate-700 px-3 py-2 text-sm text-slate-100 hover:bg-slate-600">
                      Dismiss
                    </button>
                    <button
                      type="button"
                      onClick={() => approve(rec)}
                      className="inline-flex items-center rounded-lg bg-emerald-500 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-600">
                      Approve <Check className="ml-1 h-4 w-4" />
                    </button>
                  </>
                )}
                {nextAfterApprove.includes(rec.status) && rec.status !== 'verified' && rec.status !== 'rejected' && (
                  <button
                    type="button"
                    onClick={() => advance(rec)}
                    className="rounded-lg border border-emerald-500/40 px-3 py-2 text-sm text-emerald-300 hover:bg-emerald-500/10">
                    Advance workflow
                  </button>
                )}
                {rec.status === 'rejected' && (
                  <span className="inline-flex items-center text-xs text-slate-400">
                    <X className="mr-1 h-3 w-3" /> Dismissed
                  </span>
                )}
              </div>
            </div>

            <details className="mt-3 text-xs text-slate-500">
              <summary className="cursor-pointer text-slate-400">Decision history</summary>
              <ul className="mt-2 space-y-1">
                {decisions
                  .filter((d) => d.entityId === String(rec.id))
                  .map((d) => (
                    <li key={d.id}>
                      {new Date(d.createdAt).toLocaleString()} · {d.actorName} ({d.actorRole}) ·{' '}
                      {d.stage}: {d.reason} — {d.expectedOutcome}
                    </li>
                  ))}
              </ul>
            </details>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
