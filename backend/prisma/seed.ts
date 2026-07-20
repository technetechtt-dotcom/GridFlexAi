import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { NodeStatus, PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();
const defaultPassword = (): string => randomBytes(12).toString("base64url");

const run = async () => {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@gridflex.ai";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? defaultPassword();
  const developerEmail = process.env.SEED_DEVELOPER_EMAIL ?? "dev@gridflex.ai";
  const developerPassword = process.env.SEED_DEVELOPER_PASSWORD ?? defaultPassword();

  if (
    process.env.NODE_ENV === "production" &&
    (!process.env.SEED_ADMIN_PASSWORD || !process.env.SEED_DEVELOPER_PASSWORD)
  ) {
    throw new Error("SEED_ADMIN_PASSWORD and SEED_DEVELOPER_PASSWORD are required in production.");
  }

  const hashedPassword = await bcrypt.hash(adminPassword, 12);
  const hashedDevPassword = await bcrypt.hash(developerPassword, 12);

  const admin = await prisma.user.upsert({
    where: {
      email: adminEmail
    },
    update: {
      name: "GridFlex Admin",
      password: hashedPassword,
      role: Role.admin,
      status: "active"
    },
    create: {
      email: adminEmail,
      name: "GridFlex Admin",
      password: hashedPassword,
      role: Role.admin,
      status: "active"
    }
  });

  const developer = await prisma.user.upsert({
    where: {
      email: developerEmail
    },
    update: {
      name: "GridFlex Developer",
      password: hashedDevPassword,
      role: Role.developer,
      status: "active"
    },
    create: {
      email: developerEmail,
      name: "GridFlex Developer",
      password: hashedDevPassword,
      role: Role.developer,
      status: "active"
    }
  });

  const client = await prisma.client.upsert({
    where: { slug: "gridflex-demo-client" },
    update: {
      name: "GridFlex Demo Client",
      status: "active",
      contactEmail: "ops@gridflex.ai"
    },
    create: {
      name: "GridFlex Demo Client",
      slug: "gridflex-demo-client",
      status: "active",
      contactEmail: "ops@gridflex.ai"
    }
  });

  const organisation = await prisma.organisation.upsert({
    where: { slug: "gridflex-demo-client" },
    update: {
      name: "GridFlex Northern Cape Demo Org",
      status: "active",
      timezone: "Africa/Johannesburg"
    },
    create: {
      name: "GridFlex Northern Cape Demo Org",
      slug: "gridflex-demo-client",
      status: "active",
      timezone: "Africa/Johannesburg"
    }
  });

  await prisma.client.update({
    where: { id: client.id },
    data: { organisationId: organisation.id }
  });

  const site = await prisma.site.upsert({
    where: { code: "UPINGTON-NC-01" },
    update: {
      name: "Upington Solar Hub",
      location: "Northern Cape, South Africa",
      timezone: "Africa/Johannesburg",
      clientId: client.id,
      organisationId: organisation.id
    },
    create: {
      clientId: client.id,
      organisationId: organisation.id,
      name: "Upington Solar Hub",
      code: "UPINGTON-NC-01",
      location: "Northern Cape, South Africa",
      timezone: "Africa/Johannesburg"
    }
  });

  const plant = await prisma.plant.upsert({
    where: {
      organisationId_code: {
        organisationId: organisation.id,
        code: "UPINGTON-PV-DEMO"
      }
    },
    update: {
      name: "Upington PV Demonstration Plant",
      siteId: site.id,
      installedCapacityKw: 50000,
      exportCapacityKw: 45000,
      latitude: -28.454,
      longitude: 21.242,
      status: "simulated",
      dataSourceType: "simulated"
    },
    create: {
      id: "plant-upington-pv-demo",
      organisationId: organisation.id,
      siteId: site.id,
      name: "Upington PV Demonstration Plant",
      code: "UPINGTON-PV-DEMO",
      technology: "solar_pv",
      installedCapacityKw: 50000,
      exportCapacityKw: 45000,
      latitude: -28.454,
      longitude: 21.242,
      status: "simulated",
      dataSourceType: "simulated"
    }
  });

  const gatewayAsset = await prisma.asset.upsert({
    where: { id: "asset-upington-edge-gateway" },
    update: {
      plantId: plant.id,
      name: "Upington Edge Gateway",
      type: "edge_gateway",
      status: "simulated",
      dataSourceType: "simulated"
    },
    create: {
      id: "asset-upington-edge-gateway",
      plantId: plant.id,
      name: "Upington Edge Gateway",
      type: "edge_gateway",
      status: "simulated",
      dataSourceType: "simulated",
      state: {
        create: {
          operatingState: "simulated",
          available: true
        }
      }
    }
  });

  await prisma.asset.upsert({
    where: { id: "asset-upington-inverter-sim" },
    update: {
      plantId: plant.id,
      parentAssetId: gatewayAsset.id,
      name: "Simulated Inverter Block A",
      type: "inverter",
      ratedPowerKw: 5000,
      status: "simulated",
      dataSourceType: "simulated"
    },
    create: {
      id: "asset-upington-inverter-sim",
      plantId: plant.id,
      parentAssetId: gatewayAsset.id,
      name: "Simulated Inverter Block A",
      type: "inverter",
      ratedPowerKw: 5000,
      status: "simulated",
      dataSourceType: "simulated",
      state: {
        create: {
          operatingState: "simulated",
          available: true
        }
      }
    }
  });

  const bessAsset = await prisma.asset.upsert({
    where: { id: "asset-upington-bess-sim" },
    update: {
      plantId: plant.id,
      parentAssetId: gatewayAsset.id,
      name: "Simulated BESS Block A",
      type: "bess",
      ratedPowerKw: 2000,
      ratedEnergyKwh: 4000,
      status: "simulated",
      dataSourceType: "simulated"
    },
    create: {
      id: "asset-upington-bess-sim",
      plantId: plant.id,
      parentAssetId: gatewayAsset.id,
      name: "Simulated BESS Block A",
      type: "bess",
      ratedPowerKw: 2000,
      ratedEnergyKwh: 4000,
      status: "simulated",
      dataSourceType: "simulated",
      state: { create: { operatingState: "simulated", available: true } }
    }
  });

  await prisma.bessModelConfig.upsert({
    where: { assetId: bessAsset.id },
    update: {
      ratedPowerKw: 2000,
      ratedEnergyKwh: 4000,
      maxChargePowerKw: 2000,
      maxDischargePowerKw: 2000,
      simulationMode: true,
      configSource: "operator_entered"
    },
    create: {
      assetId: bessAsset.id,
      ratedPowerKw: 2000,
      ratedEnergyKwh: 4000,
      minSocPercent: 10,
      maxSocPercent: 90,
      chargeEfficiency: 0.95,
      dischargeEfficiency: 0.95,
      maxChargePowerKw: 2000,
      maxDischargePowerKw: 2000,
      rampLimitKwPerMin: 500,
      degradationCostZarPerMwh: 120,
      reserveSocPercent: 15,
      minOperatingTempC: 5,
      maxOperatingTempC: 45,
      warrantyCycleLimit: 6000,
      simulationMode: true,
      configSource: "operator_entered"
    }
  });

  await prisma.bessOperatingState.upsert({
    where: { assetId: bessAsset.id },
    update: {
      socPercent: 55,
      socSource: "simulated",
      socQuality: "unverified",
      simulationMode: true,
      asOf: new Date()
    },
    create: {
      assetId: bessAsset.id,
      socPercent: 55,
      socSource: "simulated",
      socQuality: "unverified",
      chargePowerKw: 0,
      dischargePowerKw: 0,
      operatingState: "standby",
      simulationMode: true,
      asOf: new Date()
    }
  });

  const electrolyserAsset = await prisma.asset.upsert({
    where: { id: "asset-upington-electrolyser-sim" },
    update: {
      plantId: plant.id,
      parentAssetId: gatewayAsset.id,
      name: "Simulated Electrolyser Train 1",
      type: "electrolyser",
      ratedPowerKw: 1500,
      status: "simulated",
      dataSourceType: "simulated"
    },
    create: {
      id: "asset-upington-electrolyser-sim",
      plantId: plant.id,
      parentAssetId: gatewayAsset.id,
      name: "Simulated Electrolyser Train 1",
      type: "electrolyser",
      ratedPowerKw: 1500,
      status: "simulated",
      dataSourceType: "simulated",
      state: { create: { operatingState: "simulated", available: true } }
    }
  });

  await prisma.electrolyserModelConfig.upsert({
    where: { assetId: electrolyserAsset.id },
    update: {
      maxLoadKw: 1500,
      minStableLoadKw: 300,
      simulationMode: true,
      configSource: "operator_entered"
    },
    create: {
      assetId: electrolyserAsset.id,
      technology: "alkaline",
      minStableLoadKw: 300,
      maxLoadKw: 1500,
      rampRateKwPerMin: 250,
      startUpTimeMin: 15,
      shutDownTimeMin: 10,
      minRunTimeMin: 30,
      efficiencyKwhPerKg: 52,
      waterLitresPerKg: 10,
      hydrogenStorageCapacityKg: 2000,
      hydrogenSalePriceZarPerKg: 85,
      operatingCostZarPerHour: 400,
      minOperatingTempC: 40,
      maxOperatingTempC: 90,
      maintenanceWindowActive: false,
      simulationMode: true,
      configSource: "operator_entered"
    }
  });

  await prisma.electrolyserOperatingState.upsert({
    where: { assetId: electrolyserAsset.id },
    update: {
      loadPowerKw: 0,
      loadSource: "simulated",
      loadQuality: "unverified",
      storageLevelKg: 400,
      simulationMode: true,
      asOf: new Date()
    },
    create: {
      assetId: electrolyserAsset.id,
      loadPowerKw: 0,
      loadSource: "simulated",
      loadQuality: "unverified",
      productionKgPerHour: 0,
      storageLevelKg: 400,
      stackTemperatureC: 65,
      operatingMode: "standby",
      runTimeMinutes: 0,
      simulationMode: true,
      asOf: new Date()
    }
  });

  const { TELEMETRY_KEYS, TELEMETRY_KEYS_BY_ASSET_TYPE } = await import("../src/domain/telemetry-keys.js");
  for (const key of TELEMETRY_KEYS_BY_ASSET_TYPE.inverter ?? []) {
    const def = TELEMETRY_KEYS[key];
    await prisma.telemetryPointDefinition.upsert({
      where: { assetId_key: { assetId: "asset-upington-inverter-sim", key: def.key } },
      update: {
        displayName: def.displayName,
        unit: def.unit,
        dataType: def.dataType,
        sourceType: "simulated",
        minimumValidValue: def.minimumValidValue ?? null,
        maximumValidValue: def.maximumValidValue ?? null,
        writable: def.writable,
        critical: def.critical
      },
      create: {
        assetId: "asset-upington-inverter-sim",
        key: def.key,
        displayName: def.displayName,
        unit: def.unit,
        dataType: def.dataType,
        sourceType: "simulated",
        minimumValidValue: def.minimumValidValue ?? null,
        maximumValidValue: def.maximumValidValue ?? null,
        writable: def.writable,
        critical: def.critical
      }
    });
  }

  const node = await prisma.edgeNode.upsert({
    where: {
      id: "upington-solar-farm-node"
    },
    update: {
      site: {
        connect: {
          id: site.id
        }
      },
      asset: {
        connect: {
          id: gatewayAsset.id
        }
      },
      name: "Upington Solar Farm Node",
      location: "Upington Solar Farm, Northern Cape, South Africa",
      latitude: -28.454,
      longitude: 21.242,
      status: NodeStatus.online,
      healthState: "online",
      lastSeen: new Date()
    },
    create: {
      id: "upington-solar-farm-node",
      site: {
        connect: {
          id: site.id
        }
      },
      asset: {
        connect: {
          id: gatewayAsset.id
        }
      },
      name: "Upington Solar Farm Node",
      location: "Upington Solar Farm, Northern Cape, South Africa",
      latitude: -28.454,
      longitude: 21.242,
      status: NodeStatus.online,
      healthState: "online",
      lastSeen: new Date()
    }
  });

  await prisma.organisationMembership.upsert({
    where: {
      organisationId_userId: {
        organisationId: organisation.id,
        userId: admin.id
      }
    },
    update: {
      role: "super_admin",
      status: "active"
    },
    create: {
      organisationId: organisation.id,
      userId: admin.id,
      role: "super_admin",
      status: "active"
    }
  });

  const existingNodeReadingCount = await prisma.sensorReading.count({
    where: {
      nodeId: node.id
    }
  });

  if (existingNodeReadingCount === 0) {
    const now = new Date();
    await prisma.sensorReading.create({
      data: {
        nodeId: node.id,
        voltage: 401.2,
        current: 129.4,
        power: 51.9,
        energyToday: 312.6,
        inverterPower: 49.8,
        curtailment: 1.3,
        timestamp: now,
        deviceTimestamp: now,
        ingestedAt: now,
        sourceType: "simulated",
        quality: "unverified",
        schemaVersion: "1",
        sourceAssetId: gatewayAsset.id,
        powerUnit: "kW",
        voltageUnit: "V",
        currentUnit: "A"
      }
    });
  }

  // eslint-disable-next-line no-console
  console.log(`Seed complete.`);
  console.log(`Demo organisation: ${organisation.slug}`);
  console.log(`Demo plant: ${plant.code} (status=simulated)`);
  if (process.env.NODE_ENV === "production") {
    console.log(`Admin user: ${admin.email}`);
    console.log(`Developer user: ${developer.email}`);
    console.log("Passwords were supplied via SEED_*_PASSWORD and are not printed.");
    return;
  }

  console.log(`Admin user: ${admin.email} | password: ${adminPassword}`);
  console.log(`Developer user: ${developer.email} | password: ${developerPassword}`);
};

run()
.catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Seed failed:", error);
  process.exit(1);
})
.finally(async () => {
  await prisma.$disconnect();
});
