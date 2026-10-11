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
  | 'recovery_case_updated';

export type DecisionEntry = {
  id: string;
  entityType: 'recommendation' | 'insight' | 'optimisation' | 'recovery_case' | 'forecast' | 'diagnostics';
  entityId: string;
  title: string;
  stage: DecisionStage;
  actorName: string;
  actorRole: string;
  reason: string;
  expectedOutcome: string;
  createdAt: string;
};

const STORAGE_KEY = 'gridflex_decision_log_v1';

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

export const recordDecision = (
  input: Omit<DecisionEntry, 'id' | 'createdAt'> & { createdAt?: string }
): DecisionEntry => {
  const entry: DecisionEntry = {
    ...input,
    id: `dec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: input.createdAt ?? new Date().toISOString()
  };
  const next = [entry, ...readAll()];
  writeAll(next);
  return entry;
};
