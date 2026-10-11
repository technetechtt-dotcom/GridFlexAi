import {
  createRecoveryCaseRemote,
  listRecoveryCasesRemote,
  updateRecoveryCaseRemote,
  type RecoveryCaseDto
} from '../services/api';

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

const toLocal = (row: RecoveryCaseDto): RecoveryCase => ({
  id: row.id,
  caseNumber: row.caseNumber,
  title: row.title,
  plantLabel: row.plantLabel,
  owner: row.owner,
  engineeringReviewer: row.engineeringReviewer,
  status: row.status as RecoveryCaseStatus,
  selectedOption: row.selectedOption,
  evidenceNotes: row.evidenceNotes,
  evidenceAttachments: row.evidenceAttachments ?? [],
  predictedSavingsZar: row.predictedSavingsZar,
  realisedSavingsZar: row.realisedSavingsZar,
  actualRecoveredEnergyKwh: row.actualRecoveredEnergyKwh,
  realisationRevenueZar: row.realisationRevenueZar,
  implementationDate: row.implementationDate,
  closedAt: row.closedAt,
  verificationNotes: row.verificationNotes,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  history: (row.history ?? []).map((h) => ({
    at: h.at,
    actor: h.actor,
    note: h.note,
    status: h.status as RecoveryCaseStatus
  }))
});

export const listRecoveryCases = async (): Promise<RecoveryCase[]> => {
  const rows = await listRecoveryCasesRemote();
  return rows.map(toLocal);
};

export const createRecoveryCase = async (input: {
  title: string;
  plantLabel: string;
  owner: string;
  predictedSavingsZar?: number | null;
  engineeringReviewer?: string | null;
}): Promise<RecoveryCase> => {
  const row = await createRecoveryCaseRemote({
    title: input.title,
    plantLabel: input.plantLabel,
    predictedSavingsZar: input.predictedSavingsZar,
    engineeringReviewer: input.engineeringReviewer
  });
  return toLocal(row);
};

export const advanceRecoveryCase = async (
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
  _actor: string,
  note: string
): Promise<RecoveryCase | null> => {
  const row = await updateRecoveryCaseRemote(id, {
    note,
    status: patch.status,
    ownerName: patch.owner,
    engineeringReviewer: patch.engineeringReviewer,
    selectedOption: patch.selectedOption,
    evidenceNotes: patch.evidenceNotes,
    evidenceAttachments: patch.evidenceAttachments,
    realisedSavingsZar: patch.realisedSavingsZar,
    realisationRevenueZar: patch.realisationRevenueZar,
    predictedSavingsZar: patch.predictedSavingsZar,
    actualRecoveredEnergyKwh: patch.actualRecoveredEnergyKwh,
    implementationDate: patch.implementationDate,
    closedAt: patch.closedAt,
    verificationNotes: patch.verificationNotes
  });
  return toLocal(row);
};
