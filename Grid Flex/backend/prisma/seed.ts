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

  const site = await prisma.site.upsert({
    where: { code: "UPINGTON-NC-01" },
    update: {
      name: "Upington Solar Hub",
      location: "Northern Cape, South Africa",
      timezone: "Africa/Johannesburg",
      clientId: client.id
    },
    create: {
      clientId: client.id,
      name: "Upington Solar Hub",
      code: "UPINGTON-NC-01",
      location: "Northern Cape, South Africa",
      timezone: "Africa/Johannesburg"
    }
  });

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
      name: "Upington Solar Farm Node",
      location: "Upington Solar Farm, Northern Cape, South Africa",
      latitude: -28.454,
      longitude: 21.242,
      status: NodeStatus.online,
      lastSeen: new Date()
    },
    create: {
      id: "upington-solar-farm-node",
      site: {
        connect: {
          id: site.id
        }
      },
      name: "Upington Solar Farm Node",
      location: "Upington Solar Farm, Northern Cape, South Africa",
      latitude: -28.454,
      longitude: 21.242,
      status: NodeStatus.online,
      lastSeen: new Date()
    }
  });

  const existingNodeReadingCount = await prisma.sensorReading.count({
    where: {
      nodeId: node.id
    }
  });

  if (existingNodeReadingCount === 0) {
    await prisma.sensorReading.create({
      data: {
        nodeId: node.id,
        voltage: 401.2,
        current: 129.4,
        power: 51.9,
        energyToday: 312.6,
        inverterPower: 49.8,
        curtailment: 1.3,
        timestamp: new Date()
      }
    });
  }

  // eslint-disable-next-line no-console
  console.log(`Seed complete.`);
  if (process.env.NODE_ENV === "production") {
    console.log(`Admin user: ${admin.email}`);
    console.log(`Developer user: ${developer.email}`);
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
