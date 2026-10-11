import { createOperatorDecision, listOperatorDecisions, type OperatorDecisionValue } from '../services/api';

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
  previousState?: string;
  newState?: string;
  relatedAlarmId?: string;
  relatedRecoveryCaseId?: string;
  modelVersion?: string;
  createdAt: string;
  persisted?: boolean;
};

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

/** In-memory session cache only — not a source of truth. */
let sessionCache: DecisionEntry[] = [];

export const listDecisions = (entityId?: string): DecisionEntry[] => {
  if (!entityId) return sessionCache;
  return sessionCache.filter((row) => row.entityId === entityId);
};

export const latestDecisionFor = (entityId: string): DecisionEntry | undefined => {
  return listDecisions(entityId)[0];
};

export const hydrateDecisionsFromApi = async (params?: {
  entityType?: string;
  entityId?: string;
}): Promise<DecisionEntry[]> => {
  const rows = await listOperatorDecisions({
    entityType: params?.entityType,
    entityId: params?.entityId,
    limit: 200
  });
  const mapped: DecisionEntry[] = rows.map((row) => {
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    return {
      id: row.id,
      entityType: row.entityType as DecisionEntry['entityType'],
      entityId: row.entityId ?? '',
      title: typeof meta.title === 'string' ? meta.title : row.message ?? row.entityType,
      stage: (row.decision ?? row.action.replace('operator.decision.', '')) as DecisionStage,
      actorName: typeof meta.actorName === 'string' ? meta.actorName : 'Operator',
      actorRole: typeof meta.actorRole === 'string' ? meta.actorRole : 'operator',
      reason: typeof meta.reason === 'string' ? meta.reason : row.message ?? '',
      expectedOutcome: typeof meta.expectedOutcome === 'string' ? meta.expectedOutcome : '',
      conditions: typeof meta.conditions === 'string' ? meta.conditions : undefined,
      assignedReviewer: typeof meta.assignedReviewer === 'string' ? meta.assignedReviewer : undefined,
      previousState: typeof meta.previousState === 'string' ? meta.previousState : undefined,
      newState: typeof meta.newState === 'string' ? meta.newState : undefined,
      createdAt: row.createdAt,
      persisted: true
    };
  });
  sessionCache = mapped;
  return mapped;
};

/** @deprecated Operational decisions must use persistDecision (Postgres). */
export const recordDecision = (
  input: Omit<DecisionEntry, 'id' | 'createdAt' | 'persisted'> & { createdAt?: string }
): DecisionEntry => {
  const entry: DecisionEntry = {
    ...input,
    id: `pending-${Date.now()}`,
    createdAt: input.createdAt ?? new Date().toISOString(),
    persisted: false
  };
  sessionCache = [entry, ...sessionCache].slice(0, 200);
  return entry;
};

export const persistDecision = async (
  input: Omit<DecisionEntry, 'id' | 'createdAt' | 'persisted'> & { createdAt?: string }
): Promise<DecisionEntry> => {
  const apiDecision = STAGE_TO_API[input.stage];
  if (!apiDecision) {
    return recordDecision(input);
  }

  const remote = await createOperatorDecision({
    entityType: input.entityType,
    entityId: input.entityId,
    title: input.title,
    decision: apiDecision,
    reason: input.reason,
    expectedOutcome: input.expectedOutcome,
    conditions: input.conditions,
    assignedReviewer: input.assignedReviewer,
    previousState: input.previousState,
    newState: input.newState ?? input.stage,
    relatedAlarmId: input.relatedAlarmId,
    relatedRecoveryCaseId: input.relatedRecoveryCaseId,
    modelVersion: input.modelVersion
  });

  const entry: DecisionEntry = {
    ...input,
    id: remote.id,
    createdAt: remote.createdAt,
    persisted: true
  };
  sessionCache = [entry, ...sessionCache.filter((row) => row.id !== entry.id)].slice(0, 200);
  return entry;
};
