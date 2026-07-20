"""Apply PR3 additive BESS/electrolyser + advisory optimisation models to schema.prisma."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
schema_path = ROOT / "prisma" / "schema.prisma"
text = schema_path.read_text(encoding="utf-8")

if "model BessModelConfig" in text and "model OptimizationRun" in text:
    print("PR3 models already present")
    raise SystemExit(0)

# Strip any accidental PR2/PR5 leftovers if a concurrent agent polluted the file.
for junk in (
    "\nenum AlarmSeverity {",
    "\nenum CurtailmentCause {",
    "\nmodel AlarmRule {",
    "\nmodel CurtailmentEvent {",
    "\nmodel CommandRequest {",
):
    idx = text.find(junk)
    if idx > 0 and "model BessModelConfig" not in text[idx:]:
        # Only strip trailing junk blocks that appear after AuditLog / end region —
        # leave PR1 intact; we start from a clean PR1 schema.
        pass

if "enum OptimizationRunStatus" not in text:
    text = text.replace(
        """enum PlantStatus {
  planned
  operational
  maintenance
  decommissioned
  simulated
}
""",
        """enum PlantStatus {
  planned
  operational
  maintenance
  decommissioned
  simulated
}

/// Advisory optimisation run lifecycle. Never implies physical dispatch.
enum OptimizationRunStatus {
  pending
  running
  completed
  infeasible
  failed
}

enum DispatchScheduleStatus {
  advisory
  expired
  superseded
  rejected
}
""",
        1,
    )

if "optimizationRuns" not in text[text.find("model User {") : text.find("model User {") + 1200]:
    text = text.replace(
        "  siteMemberships          SiteMembership[]\n\n  @@index([managedById])",
        "  siteMemberships          SiteMembership[]\n  optimizationRuns         OptimizationRun[]\n\n  @@index([managedById])",
        1,
    )

if "optimizationRuns" not in text[text.find("model Organisation {") : text.find("model Organisation {") + 800]:
    text = text.replace(
        "  auditLogs    AuditLog[]\n\n  @@index([status])\n}\n\nmodel OrganisationMembership",
        "  auditLogs         AuditLog[]\n  optimizationRuns OptimizationRun[]\n\n  @@index([status])\n}\n\nmodel OrganisationMembership",
        1,
    )

if "optimizationRuns" not in text[text.find("model Site {") : text.find("model Site {") + 900]:
    text = text.replace(
        "  telemetry      TelemetryReading[]\n\n  @@index([clientId])\n  @@index([organisationId])\n}\n\nmodel Plant",
        "  telemetry           TelemetryReading[]\n  optimizationRuns    OptimizationRun[]\n\n  @@index([clientId])\n  @@index([organisationId])\n}\n\nmodel Plant",
        1,
    )

if "optimizationRuns" not in text[text.find("model Plant {") : text.find("model Plant {") + 1200]:
    text = text.replace(
        "  telemetry           TelemetryReading[]\n\n  @@unique([organisationId, code])\n  @@index([siteId])\n  @@index([organisationId, status])\n}\n\nmodel Asset",
        "  telemetry           TelemetryReading[]\n  optimizationRuns    OptimizationRun[]\n\n  @@unique([organisationId, code])\n  @@index([siteId])\n  @@index([organisationId, status])\n}\n\nmodel Asset",
        1,
    )

asset_marker = (
    "  pointDefinitions  TelemetryPointDefinition[]\n"
    "  telemetry         TelemetryReading[]\n\n"
    "  @@index([plantId, type])"
)
if "bessModelConfig" not in text and asset_marker in text:
    text = text.replace(
        asset_marker,
        """  pointDefinitions             TelemetryPointDefinition[]
  telemetry                    TelemetryReading[]
  bessModelConfig              BessModelConfig?
  bessState                    BessOperatingState?
  electrolyserModelConfig      ElectrolyserModelConfig?
  electrolyserState            ElectrolyserOperatingState?
  dispatchSchedules            DispatchSchedule[]

  @@index([plantId, type])""",
        1,
    )

MODEL_BLOCK = """

/// Configured BESS parameters. Distinguish configSource from measured state.
model BessModelConfig {
  id                        String         @id @default(cuid())
  assetId                   String         @unique
  asset                     Asset          @relation(fields: [assetId], references: [id], onDelete: Cascade)
  ratedPowerKw              Float
  ratedEnergyKwh            Float
  minSocPercent             Float          @default(10)
  maxSocPercent             Float          @default(90)
  chargeEfficiency          Float          @default(0.95)
  dischargeEfficiency       Float          @default(0.95)
  maxChargePowerKw          Float
  maxDischargePowerKw       Float
  rampLimitKwPerMin         Float          @default(500)
  degradationCostZarPerMwh  Float          @default(120)
  reserveSocPercent         Float          @default(15)
  minOperatingTempC         Float?
  maxOperatingTempC         Float?
  warrantyCycleLimit        Int?
  simulationMode            Boolean        @default(true)
  configSource              DataSourceType @default(operator_entered)
  metadata                  Json?
  createdAt                 DateTime       @default(now())
  updatedAt                 DateTime       @updatedAt
}

model BessOperatingState {
  assetId                     String         @id
  asset                       Asset          @relation(fields: [assetId], references: [id], onDelete: Cascade)
  socPercent                  Float
  socSource                   DataSourceType @default(simulated)
  socQuality                  DataQuality    @default(unverified)
  temperatureC                Float?
  chargePowerKw               Float          @default(0)
  dischargePowerKw            Float          @default(0)
  availableChargePowerKw      Float?
  availableDischargePowerKw   Float?
  cycleCount                  Int?
  alarmState                  String?
  operatingState              String         @default("unknown")
  simulationMode              Boolean        @default(true)
  asOf                        DateTime?
  updatedAt                   DateTime       @updatedAt
}

/// Configured electrolyser parameters with provenance on configSource.
model ElectrolyserModelConfig {
  id                         String         @id @default(cuid())
  assetId                    String         @unique
  asset                      Asset          @relation(fields: [assetId], references: [id], onDelete: Cascade)
  technology                 String         @default("alkaline")
  minStableLoadKw            Float
  maxLoadKw                  Float
  rampRateKwPerMin           Float          @default(250)
  startUpTimeMin             Float          @default(15)
  shutDownTimeMin            Float          @default(10)
  minRunTimeMin              Float          @default(30)
  efficiencyKwhPerKg         Float          @default(52)
  waterLitresPerKg           Float          @default(10)
  hydrogenStorageCapacityKg  Float
  hydrogenSalePriceZarPerKg  Float          @default(85)
  operatingCostZarPerHour    Float          @default(400)
  minOperatingTempC          Float?
  maxOperatingTempC          Float?
  maintenanceWindowActive    Boolean        @default(false)
  simulationMode             Boolean        @default(true)
  configSource               DataSourceType @default(operator_entered)
  metadata                   Json?
  createdAt                  DateTime       @default(now())
  updatedAt                  DateTime       @updatedAt
}

model ElectrolyserOperatingState {
  assetId               String         @id
  asset                 Asset          @relation(fields: [assetId], references: [id], onDelete: Cascade)
  loadPowerKw           Float          @default(0)
  loadSource            DataSourceType @default(simulated)
  loadQuality           DataQuality    @default(unverified)
  productionKgPerHour   Float          @default(0)
  storageLevelKg        Float          @default(0)
  waterFlowLitrePerHour Float?
  stackTemperatureC     Float?
  operatingMode         String         @default("standby")
  alarmState            String?
  runTimeMinutes        Float          @default(0)
  simulationMode        Boolean        @default(true)
  asOf                  DateTime?
  updatedAt             DateTime       @updatedAt
}

model OptimizationRun {
  id                    String                @id @default(cuid())
  organisationId        String
  organisation          Organisation          @relation(fields: [organisationId], references: [id], onDelete: Cascade)
  siteId                String
  site                  Site                  @relation(fields: [siteId], references: [id], onDelete: Cascade)
  plantId               String
  plant                 Plant                 @relation(fields: [plantId], references: [id], onDelete: Cascade)
  objective             String
  status                OptimizationRunStatus @default(pending)
  solverVersion         String
  forecastVersion       String?
  inputs                Json
  assumptions           Json?
  result                Json?
  constraintViolations  Json?
  warnings              Json?
  baselineComparison    Json?
  expectedBenefitZar    Float?
  advisory              Boolean               @default(true)
  startedAt             DateTime?
  completedAt           DateTime?
  createdById           String?
  createdBy             User?                 @relation(fields: [createdById], references: [id], onDelete: SetNull)
  createdAt             DateTime              @default(now())
  updatedAt             DateTime              @updatedAt
  schedules             DispatchSchedule[]

  @@index([organisationId, createdAt])
  @@index([siteId, createdAt])
  @@index([plantId, createdAt])
  @@index([status])
  @@index([createdById])
}

model DispatchSchedule {
  id                String                 @id @default(cuid())
  optimizationRunId String
  optimizationRun   OptimizationRun        @relation(fields: [optimizationRunId], references: [id], onDelete: Cascade)
  assetId           String
  asset             Asset                  @relation(fields: [assetId], references: [id], onDelete: Cascade)
  intervalStart     DateTime
  intervalEnd       DateTime
  targetValue       Float
  unit              MeasurementUnit        @default(kW)
  expectedValue     Float?
  status            DispatchScheduleStatus @default(advisory)
  metadata          Json?
  createdAt         DateTime               @default(now())

  @@index([optimizationRunId, intervalStart])
  @@index([assetId, intervalStart])
  @@index([status])
}
"""

if "model BessModelConfig" not in text:
    # Append after AuditLog (end of PR1 schema)
    if not text.rstrip().endswith("}"):
        raise SystemExit("unexpected schema ending")
    text = text.rstrip() + "\n" + MODEL_BLOCK
elif "model OptimizationRun" not in text:
    raise SystemExit("BessModelConfig present but OptimizationRun missing")

schema_path.write_text(text if text.endswith("\n") else text + "\n", encoding="utf-8")
print("Applied PR3 schema models to", schema_path)
