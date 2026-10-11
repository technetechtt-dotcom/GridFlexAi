export type RecoveryCaseStatus =
  | 'draft'
  | 'assigned'
  | 'evidence_attached'
  | 'option_selected'
  | 'pending_engineering'
  | 'implementing'
  | 'completed'
  | 'verified'
  | 'closed';

export type RecoveryCase = {
  id: string;
  caseNumber: string;
  title: string;
  plantLabel: string;
  owner: string;
  engineeringReviewer: string | null;
  status: RecoveryCaseStatus;
  selectedOption: string | null;
  evidenceNotes: string;
  evidenceAttachments: string[];
  predictedSavingsZar: number | null;
  realisedSavingsZar: number | null;
  actualRecoveredEnergyKwh: number | null;
  realisationRevenueZar: number | null;
  implementationDate: string | null;
  closedAt: string | null;
  verificationNotes: string;
  createdAt: string;
  updatedAt: string;
  history: Array<{ at: string; actor: string; note: string; status: RecoveryCaseStatus }>;
};

const STORAGE_KEY = 'gridflex_recovery_cases_v1';

const migrate = (row: Partial<RecoveryCase> & { id: string; title: string; plantLabel: string; owner: string; status: RecoveryCaseStatus; createdAt: string; updatedAt: string; history: RecoveryCase['history'] }): RecoveryCase => {
  const fallbackNumber = `RC-${row.id.replace(/\D/g, '').slice(-6) || Date.now().toString().slice(-6)}`;
  return {
    id: row.id,
    caseNumber: row.caseNumber ?? fallbackNumber,
    title: row.title,
    plantLabel: row.plantLabel,
    owner: row.owner,
    engineeringReviewer: row.engineeringReviewer ?? null,
    status: row.status,
    selectedOption: row.selectedOption ?? null,
    evidenceNotes: row.evidenceNotes ?? '',
    evidenceAttachments: Array.isArray(row.evidenceAttachments) ? row.evidenceAttachments : [],
    predictedSavingsZar: row.predictedSavingsZar ?? null,
    realisedSavingsZar: row.realisedSavingsZar ?? null,
    actualRecoveredEnergyKwh: row.actualRecoveredEnergyKwh ?? null,
    realisationRevenueZar: row.realisationRevenueZar ?? row.realisedSavingsZar ?? null,
    implementationDate: row.implementationDate ?? null,
    closedAt: row.closedAt ?? null,
    verificationNotes: row.verificationNotes ?? '',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    history: row.history ?? []
  };
};

const readAll = (): RecoveryCase[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<Partial<RecoveryCase> & { id: string; title: string; plantLabel: string; owner: string; status: RecoveryCaseStatus; createdAt: string; updatedAt: string; history: RecoveryCase['history'] }>;
    return Array.isArray(parsed) ? parsed.map(migrate) : [];
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
  const next = migrate(row);
  const idx = all.findIndex((item) => item.id === row.id);
  if (idx >= 0) all[idx] = next;
  else all.unshift(next);
  writeAll(all);
  return next;
};

export const createRecoveryCase = (input: {
  title: string;
  plantLabel: string;
  owner: string;
  predictedSavingsZar?: number | null;
  engineeringReviewer?: string | null;
}): RecoveryCase => {
  const now = new Date().toISOString();
  const seq = String(Date.now()).slice(-6);
  const row: RecoveryCase = {
    id: `rc-${Date.now()}`,
    caseNumber: `RC-${new Date().getFullYear()}-${seq}`,
    title: input.title,
    plantLabel: input.plantLabel,
    owner: input.owner,
    engineeringReviewer: input.engineeringReviewer ?? null,
    status: 'draft',
    selectedOption: null,
    evidenceNotes: '',
    evidenceAttachments: [],
    predictedSavingsZar: input.predictedSavingsZar ?? null,
    realisedSavingsZar: null,
    actualRecoveredEnergyKwh: null,
    realisationRevenueZar: null,
    implementationDate: null,
    closedAt: null,
    verificationNotes: '',
    createdAt: now,
    updatedAt: now,
    history: [{ at: now, actor: input.owner, note: 'Case created', status: 'draft' }]
  };
  return upsertRecoveryCase(row);
};

export const advanceRecoveryCase = (
  id: string,
  patch: Partial<
    Pick<
      RecoveryCase,
      | 'status'
      | 'owner'
      | 'engineeringReviewer'
      | 'selectedOption'
      | 'evidenceNotes'
      | 'evidenceAttachments'
      | 'realisedSavingsZar'
      | 'realisationRevenueZar'
      | 'predictedSavingsZar'
      | 'actualRecoveredEnergyKwh'
      | 'implementationDate'
      | 'closedAt'
      | 'verificationNotes'
    >
  >,
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
