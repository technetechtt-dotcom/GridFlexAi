import { Prisma } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/AppError.js";
import { recordAuditLog } from "./audit-log.service.js";
import { createOperatorDecision } from "./operator-decision.service.js";

export type OnboardingActor = { id: string; name: string; role: string };

export const ONBOARDING_STEPS = [
  { id: "organisation", title: "Create organisation", detail: "Register tenant legal entity and timezone" },
  { id: "site", title: "Add site", detail: "Create site code, location, and access scope" },
  { id: "plants_devices", title: "Register plants and devices", detail: "Nameplate capacity, export limit, edge nodes" },
  { id: "inverters", title: "Capture inverter details", detail: "Make/model, AC rating, communication path" },
  { id: "tariffs", title: "Add tariffs", detail: "TOU / export / demand charge schedule" },
  { id: "baseline", title: "Define baseline", detail: "Pre-pilot curtailment and demand baseline method" },
  { id: "telemetry_test", title: "Test telemetry", detail: "Signed ingest, freshness, provenance labels" },
  { id: "go_live", title: "Approve go-live", detail: "Advisory-only commissioning approval" },
  { id: "physical_lock", title: "Record physical-execution lock", detail: "Confirm PILOT_LOCK_PHYSICAL_EXECUTION remains true" }
] as const;

const toDto = (row: {
  id: string;
  organisationId: string | null;
  siteId: string | null;
  stepId: string;
  title: string;
  status: string;
  notes: string;
  evidence: Prisma.JsonValue;
  updatedById: string | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  updatedBy?: { name: string } | null;
}) => ({
  id: row.id,
  organisationId: row.organisationId,
  siteId: row.siteId,
  stepId: row.stepId,
  title: row.title,
  status: row.status,
  notes: row.notes,
  evidence: row.evidence,
  updatedById: row.updatedById,
  updatedByName: row.updatedBy?.name ?? null,
  completedAt: row.completedAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString()
});

export const listOnboardingProgress = async (organisationId?: string) => {
  const where: Prisma.PilotOnboardingProgressWhereInput = {};
  if (organisationId) where.organisationId = organisationId;

  const rows = await prisma.pilotOnboardingProgress.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }],
    include: { updatedBy: { select: { name: true } } }
  });

  const byStep = new Map(rows.map((row) => [row.stepId, toDto(row)]));
  return ONBOARDING_STEPS.map((step) => {
    const existing = byStep.get(step.id);
    if (existing) return { ...existing, detail: step.detail };
    return {
      id: `virtual-${step.id}`,
      organisationId: organisationId ?? null,
      siteId: null,
      stepId: step.id,
      title: step.title,
      detail: step.detail,
      status: "open",
      notes: "",
      evidence: {},
      updatedById: null,
      updatedByName: null,
      completedAt: null,
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString()
    };
  });
};

export const upsertOnboardingStep = async (
  input: {
    organisationId?: string;
    siteId?: string;
    stepId: string;
    status: "open" | "complete" | "blocked";
    notes?: string;
    evidence?: Prisma.InputJsonValue;
  },
  actor: OnboardingActor
) => {
  const catalogue = ONBOARDING_STEPS.find((s) => s.id === input.stepId);
  if (!catalogue) throw new AppError("Unknown onboarding step.", 400);

  const orgKey = input.organisationId ?? null;
  const existing = await prisma.pilotOnboardingProgress.findFirst({
    where: { organisationId: orgKey, stepId: input.stepId }
  });

  const completedAt = input.status === "complete" ? new Date() : null;
  let row;
  if (existing) {
    const updateData: Prisma.PilotOnboardingProgressUncheckedUpdateInput = {
      status: input.status,
      notes: input.notes ?? existing.notes,
      updatedById: actor.id,
      completedAt,
      title: catalogue.title
    };
    if (input.evidence !== undefined) updateData.evidence = input.evidence;
    else if (existing.evidence !== null) updateData.evidence = existing.evidence as Prisma.InputJsonValue;
    if (input.siteId !== undefined) updateData.siteId = input.siteId;
    else if (existing.siteId) updateData.siteId = existing.siteId;

    row = await prisma.pilotOnboardingProgress.update({
      where: { id: existing.id },
      data: updateData,
      include: { updatedBy: { select: { name: true } } }
    });
  } else {
    const createData: Prisma.PilotOnboardingProgressUncheckedCreateInput = {
      stepId: input.stepId,
      title: catalogue.title,
      status: input.status,
      notes: input.notes ?? "",
      evidence: input.evidence ?? {},
      updatedById: actor.id,
      completedAt
    };
    if (orgKey) createData.organisationId = orgKey;
    if (input.siteId) createData.siteId = input.siteId;

    row = await prisma.pilotOnboardingProgress.create({
      data: createData,
      include: { updatedBy: { select: { name: true } } }
    });
  }

  await recordAuditLog({
    action: "pilot_onboarding.update",
    entityType: "PilotOnboardingProgress",
    entityId: row.id,
    message: `${catalogue.title} → ${input.status}`,
    userId: actor.id,
    organisationId: input.organisationId,
    siteId: input.siteId
  });

  await createOperatorDecision(
    {
      organisationId: input.organisationId,
      siteId: input.siteId,
      entityType: "diagnostics",
      entityId: `pilot-onboarding-${input.stepId}`,
      title: catalogue.title,
      decision: input.status === "complete" ? "completed" : "conditions_recorded",
      reason: input.notes || `Onboarding step ${input.status}`,
      previousState: existing?.status ?? "open",
      newState: input.status,
      expectedOutcome: catalogue.detail
    },
    actor
  );

  return { ...toDto(row), detail: catalogue.detail };
};
