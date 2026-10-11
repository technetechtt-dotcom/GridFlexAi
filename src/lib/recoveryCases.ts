export type RecoveryCaseStatus =
  | 'draft'
  | 'assigned'
  | 'evidence_attached'
  | 'option_selected'
  | 'pending_engineering'
  | 'implementing'
  | 'completed'
  | 'verified';

export type RecoveryCase = {
  id: string;
  title: string;
  plantLabel: string;
  owner: string;
  status: RecoveryCaseStatus;
  selectedOption: string | null;
  evidenceNotes: string;
  predictedSavingsZar: number | null;
  realisedSavingsZar: number | null;
  createdAt: string;
  updatedAt: string;
  history: Array<{ at: string; actor: string; note: string; status: RecoveryCaseStatus }>;
};

const STORAGE_KEY = 'gridflex_recovery_cases_v1';

const readAll = (): RecoveryCase[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecoveryCase[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeAll = (rows: RecoveryCase[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows.slice(0, 200)));
};

export const listRecoveryCases = (): RecoveryCase[] => readAll();

export const upsertRecoveryCase = (row: RecoveryCase): RecoveryCase => {
  const all = readAll();
  const idx = all.findIndex((item) => item.id === row.id);
  if (idx >= 0) all[idx] = row;
  else all.unshift(row);
  writeAll(all);
  return row;
};

export const createRecoveryCase = (input: {
  title: string;
  plantLabel: string;
  owner: string;
  predictedSavingsZar?: number | null;
}): RecoveryCase => {
  const now = new Date().toISOString();
  const row: RecoveryCase = {
    id: `rc-${Date.now()}`,
    title: input.title,
    plantLabel: input.plantLabel,
    owner: input.owner,
    status: 'draft',
    selectedOption: null,
    evidenceNotes: '',
    predictedSavingsZar: input.predictedSavingsZar ?? null,
    realisedSavingsZar: null,
    createdAt: now,
    updatedAt: now,
    history: [{ at: now, actor: input.owner, note: 'Case created', status: 'draft' }]
  };
  return upsertRecoveryCase(row);
};

export const advanceRecoveryCase = (
  id: string,
  patch: Partial<Pick<RecoveryCase, 'status' | 'owner' | 'selectedOption' | 'evidenceNotes' | 'realisedSavingsZar' | 'predictedSavingsZar'>>,
  actor: string,
  note: string
): RecoveryCase | null => {
  const current = readAll().find((row) => row.id === id);
  if (!current) return null;
  const next: RecoveryCase = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
    history: [
      {
        at: new Date().toISOString(),
        actor,
        note,
        status: patch.status ?? current.status
      },
      ...current.history
    ]
  };
  return upsertRecoveryCase(next);
};
