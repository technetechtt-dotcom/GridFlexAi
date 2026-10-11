-- Durable operator decisions, recovery cases, work orders, and invitations.

CREATE TABLE "OperatorDecision" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT,
    "siteId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "previousState" TEXT,
    "newState" TEXT,
    "conditions" TEXT,
    "assignedReviewer" TEXT,
    "expectedOutcome" TEXT,
    "relatedAlarmId" TEXT,
    "relatedRecoveryCaseId" TEXT,
    "releaseGitSha" TEXT,
    "modelVersion" TEXT,
    "actorUserId" TEXT,
    "actorRole" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperatorDecision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RecoveryCaseRecord" (
    "id" TEXT NOT NULL,
    "caseNumber" TEXT NOT NULL,
    "organisationId" TEXT,
    "siteId" TEXT,
    "title" TEXT NOT NULL,
    "plantLabel" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "ownerName" TEXT NOT NULL,
    "engineeringReviewer" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "selectedOption" TEXT,
    "evidenceNotes" TEXT NOT NULL DEFAULT '',
    "evidenceAttachments" JSONB NOT NULL DEFAULT '[]',
    "predictedSavingsZar" DOUBLE PRECISION,
    "realisedSavingsZar" DOUBLE PRECISION,
    "actualRecoveredEnergyKwh" DOUBLE PRECISION,
    "realisationRevenueZar" DOUBLE PRECISION,
    "implementationDate" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "verificationNotes" TEXT NOT NULL DEFAULT '',
    "history" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecoveryCaseRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkOrder" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT,
    "siteId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'open',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "assigneeUserId" TEXT,
    "createdById" TEXT,
    "dueAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "relatedEntityType" TEXT,
    "relatedEntityId" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserInvitation" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'operator',
    "organisationId" TEXT,
    "tokenHash" TEXT NOT NULL,
    "invitedById" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RecoveryCaseRecord_caseNumber_key" ON "RecoveryCaseRecord"("caseNumber");
CREATE UNIQUE INDEX "UserInvitation_tokenHash_key" ON "UserInvitation"("tokenHash");

CREATE INDEX "OperatorDecision_entityType_entityId_createdAt_idx" ON "OperatorDecision"("entityType", "entityId", "createdAt");
CREATE INDEX "OperatorDecision_organisationId_createdAt_idx" ON "OperatorDecision"("organisationId", "createdAt");
CREATE INDEX "OperatorDecision_siteId_createdAt_idx" ON "OperatorDecision"("siteId", "createdAt");
CREATE INDEX "OperatorDecision_actorUserId_createdAt_idx" ON "OperatorDecision"("actorUserId", "createdAt");
CREATE INDEX "OperatorDecision_decision_createdAt_idx" ON "OperatorDecision"("decision", "createdAt");

CREATE INDEX "RecoveryCaseRecord_organisationId_updatedAt_idx" ON "RecoveryCaseRecord"("organisationId", "updatedAt");
CREATE INDEX "RecoveryCaseRecord_siteId_updatedAt_idx" ON "RecoveryCaseRecord"("siteId", "updatedAt");
CREATE INDEX "RecoveryCaseRecord_ownerUserId_updatedAt_idx" ON "RecoveryCaseRecord"("ownerUserId", "updatedAt");
CREATE INDEX "RecoveryCaseRecord_status_updatedAt_idx" ON "RecoveryCaseRecord"("status", "updatedAt");

CREATE INDEX "WorkOrder_organisationId_status_updatedAt_idx" ON "WorkOrder"("organisationId", "status", "updatedAt");
CREATE INDEX "WorkOrder_assigneeUserId_status_idx" ON "WorkOrder"("assigneeUserId", "status");
CREATE INDEX "WorkOrder_createdById_createdAt_idx" ON "WorkOrder"("createdById", "createdAt");

CREATE INDEX "UserInvitation_email_createdAt_idx" ON "UserInvitation"("email", "createdAt");
CREATE INDEX "UserInvitation_organisationId_createdAt_idx" ON "UserInvitation"("organisationId", "createdAt");

ALTER TABLE "OperatorDecision" ADD CONSTRAINT "OperatorDecision_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OperatorDecision" ADD CONSTRAINT "OperatorDecision_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RecoveryCaseRecord" ADD CONSTRAINT "RecoveryCaseRecord_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RecoveryCaseRecord" ADD CONSTRAINT "RecoveryCaseRecord_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_assigneeUserId_fkey" FOREIGN KEY ("assigneeUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "UserInvitation" ADD CONSTRAINT "UserInvitation_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UserInvitation" ADD CONSTRAINT "UserInvitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
