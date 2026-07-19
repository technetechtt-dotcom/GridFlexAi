#!/usr/bin/env python3
from __future__ import annotations
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCHEMA = ROOT / "prisma" / "schema.prisma"

ENUMS = """
enum AlarmSeverity {
  info
  warning
  major
  critical
}

enum AlarmStatus {
  active
  acknowledged
  cleared
  suppressed
}

enum AlarmComparator {
  gt
  gte
  lt
  lte
  eq
  neq
}

enum IncidentStatus {
  open
  investigating
  mitigated
  resolved
  closed
}

"""

MODELS = """
model AlarmRule {
  id              String          @id @default(cuid())
  organisationId  String
  organisation    Organisation    @relation(fields: [organisationId], references: [id], onDelete: Cascade)
  siteId          String?
  site            Site?           @relation(fields: [siteId], references: [id], onDelete: SetNull)
  plantId         String?
  plant           Plant?          @relation(fields: [plantId], references: [id], onDelete: SetNull)
  assetId         String?
  asset           Asset?          @relation(fields: [assetId], references: [id], onDelete: SetNull)
  name            String
  description     String?
  metricKey       String
  comparator      AlarmComparator @default(gt)
  threshold       Float
  severity        AlarmSeverity   @default(warning)
  enabled         Boolean         @default(true)
  cooldownSeconds Int             @default(300)
  metadata        Json?
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
  events          AlarmEvent[]

  @@index([organisationId])
  @@index([siteId])
  @@index([plantId])
  @@index([assetId])
}

model AlarmEvent {
  id               String                 @id @default(cuid())
  organisationId   String
  organisation     Organisation           @relation(fields: [organisationId], references: [id], onDelete: Cascade)
  siteId           String
  site             Site                   @relation(fields: [siteId], references: [id], onDelete: Cascade)
  plantId          String?
  plant            Plant?                 @relation(fields: [plantId], references: [id], onDelete: SetNull)
  assetId          String?
  asset            Asset?                 @relation(fields: [assetId], references: [id], onDelete: SetNull)
  ruleId           String?
  rule             AlarmRule?             @relation(fields: [ruleId], references: [id], onDelete: SetNull)
  incidentId       String?
  incident         Incident?              @relation(fields: [incidentId], references: [id], onDelete: SetNull)
  severity         AlarmSeverity          @default(warning)
  status           AlarmStatus            @default(active)
  title            String
  message          String
  metricKey        String?
  metricValue      Float?
  threshold        Float?
  startedAt        DateTime               @default(now())
  clearedAt        DateTime?
  metadata         Json?
  acknowledgements AlarmAcknowledgement[]

  @@index([organisationId, status, startedAt])
  @@index([siteId, status, startedAt])
  @@index([incidentId])
}

model AlarmAcknowledgement {
  id             String     @id @default(cuid())
  alarmEventId   String
  alarmEvent     AlarmEvent @relation(fields: [alarmEventId], references: [id], onDelete: Cascade)
  userId         String
  user           User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  note           String?
  acknowledgedAt DateTime   @default(now())

  @@index([alarmEventId])
  @@index([userId])
}

model Incident {
  id             String             @id @default(cuid())
  organisationId String
  organisation   Organisation       @relation(fields: [organisationId], references: [id], onDelete: Cascade)
  siteId         String
  site           Site               @relation(fields: [siteId], references: [id], onDelete: Cascade)
  plantId        String?
  plant          Plant?             @relation(fields: [plantId], references: [id], onDelete: SetNull)
  title          String
  summary        String?
  severity       AlarmSeverity      @default(major)
  status         IncidentStatus     @default(open)
  openedById     String
  openedBy       User               @relation("IncidentOpenedBy", fields: [openedById], references: [id], onDelete: Restrict)
  openedAt       DateTime           @default(now())
  resolvedAt     DateTime?
  metadata       Json?
  alarmEvents    AlarmEvent[]
  timeline       IncidentTimeline[]

  @@index([organisationId, status, openedAt])
  @@index([siteId, status, openedAt])
}

model IncidentTimeline {
  id          String   @id @default(cuid())
  incidentId  String
  incident    Incident @relation(fields: [incidentId], references: [id], onDelete: Cascade)
  actorUserId String
  actorUser   User     @relation(fields: [actorUserId], references: [id], onDelete: Restrict)
  eventType   String
  message     String
  metadata    Json?
  createdAt   DateTime @default(now())

  @@index([incidentId, createdAt])
}
"""


def main() -> None:
    text = SCHEMA.read_text(encoding="utf-8")
    if "model AlarmRule" not in text:
        text = text.replace(
            "enum PlantStatus {\n  planned\n  operational\n  maintenance\n  decommissioned\n  simulated\n}\n\n/// Advisory optimisation run lifecycle.",
            "enum PlantStatus {\n  planned\n  operational\n  maintenance\n  decommissioned\n  simulated\n}\n\n" + ENUMS + "/// Advisory optimisation run lifecycle.",
        )
        text = text.replace(
            "  siteMemberships          SiteMembership[]\n  optimizationRuns         OptimizationRun[]\n",
            "  siteMemberships          SiteMembership[]\n  optimizationRuns         OptimizationRun[]\n  alarmAcknowledgements    AlarmAcknowledgement[]\n  incidentsOpened          Incident[]             @relation(\"IncidentOpenedBy\")\n  incidentTimelineEntries  IncidentTimeline[]\n",
        )
        text = text.replace(
            "  auditLogs         AuditLog[]\n  optimizationRuns OptimizationRun[]\n",
            "  auditLogs         AuditLog[]\n  alarmRules        AlarmRule[]\n  alarmEvents       AlarmEvent[]\n  incidents         Incident[]\n  optimizationRuns OptimizationRun[]\n",
        )
        text = text.replace(
            "  telemetry           TelemetryReading[]\n  optimizationRuns    OptimizationRun[]\n\n  @@index([clientId])",
            "  telemetry           TelemetryReading[]\n  alarmRules          AlarmRule[]\n  alarmEvents         AlarmEvent[]\n  incidents           Incident[]\n  optimizationRuns    OptimizationRun[]\n\n  @@index([clientId])",
        )
        text = text.replace(
            "  telemetry           TelemetryReading[]\n  optimizationRuns    OptimizationRun[]\n\n  @@unique([organisationId, code])",
            "  telemetry           TelemetryReading[]\n  alarmRules          AlarmRule[]\n  alarmEvents         AlarmEvent[]\n  incidents           Incident[]\n  optimizationRuns    OptimizationRun[]\n\n  @@unique([organisationId, code])",
        )
        text = text.replace(
            "  telemetry                    TelemetryReading[]\n  bessModelConfig              BessModelConfig?",
            "  telemetry                    TelemetryReading[]\n  alarmRules                   AlarmRule[]\n  alarmEvents                  AlarmEvent[]\n  bessModelConfig              BessModelConfig?",
        )
        text = text.rstrip() + "\n" + MODELS + "\n"
        SCHEMA.write_text(text, encoding="utf-8")
    subprocess.run(["npx", "prisma", "generate"], cwd=ROOT, check=True)


if __name__ == "__main__":
    main()
