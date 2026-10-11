import { createOperatorDecision, type OperatorDecisionValue } from '../services/api';

export type DecisionStage =
  | 'proposed'
  | 'reviewed'
  | 'approved'
  | 'rejected'
  | 'assigned'
  | 'completed'
  | 'verified'
  | 'model_review_requested'
  | 'diagnostics_run'
  | 'recovery_case_updated'
  | 'conditions_recorded'
  | 'proposal_opened'
  | 'dismissed';

export type DecisionEntry = {
  id: string;
  entityType: 'recommendation' | 'insight' | 'optimisation' | 'recovery_case' | 'forecast' | 'diagnostics' | 'model_review';
  entityId: string;
  title: string;
  stage: DecisionStage;
  actorName: string;
  actorRole: string;
  reason: string;
  expectedOutcome: string;
  conditions?: string;
  assignedReviewer?: string;
  createdAt: string;
  persisted?: boolean;
};

const STORAGE_KEY = 'gridflex_decision_log_v1';

const STAGE_TO_API: Partial<Record<DecisionStage, OperatorDecisionValue>> = {
  approved: 'approved',
  rejected: 'rejected',
  dismissed: 'dismissed',
  assigned: 'assigned',
  reviewed: 'reviewed',
  completed: 'completed',
  verified: 'verified',
  model_review_requested: 'model_review_requested',
  conditions_recorded: 'conditions_recorded',
  proposal_opened: 'proposal_opened',
  recovery_case_updated: 'recovery_case_updated'
};

const readAll = (): DecisionEntry[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DecisionEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeAll = (entries: DecisionEntry[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, 500)));
};

export const listDecisions = (entityId?: string): DecisionEntry[] => {
  const all = readAll();
  if (!entityId) return all;
  return all.filter((row) => row.entityId === entityId);
};

export const latestDecisionFor = (entityId: string): DecisionEntry | undefined => {
  return listDecisions(entityId)[0];
};

export const recordDecision = (
  input: Omit<DecisionEntry, 'id' | 'createdAt' | 'persisted'> & { createdAt?: string }
): DecisionEntry => {
  const entry: DecisionEntry = {
    ...input,
    id: `dec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: input.createdAt ?? new Date().toISOString(),
    persisted: false
  };
  const next = [entry, ...readAll()];
  writeAll(next);
  return entry;
};

/** Local + backend audit persistence. Local always succeeds; API failures stay offline. */
export const persistDecision = async (
  input: Omit<DecisionEntry, 'id' | 'createdAt' | 'persisted'> & { createdAt?: string }
): Promise<DecisionEntry> => {
  const entry = recordDecision(input);
  const apiDecision = STAGE_TO_API[input.stage];
  if (!apiDecision) return entry;

  try {
    await createOperatorDecision({
      entityType: input.entityType,
      entityId: input.entityId,
      title: input.title,
      decision: apiDecision,
      reason: input.reason,
      expectedOutcome: input.expectedOutcome,
      conditions: input.conditions,
      assignedReviewer: input.assignedReviewer
    });
    const all = readAll().map((row) => (row.id === entry.id ? { ...row, persisted: true } : row));
    writeAll(all);
    return { ...entry, persisted: true };
  } catch {
    return entry;
  }
};
