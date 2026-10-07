import request from "supertest";

import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { signAccessToken } from "../src/utils/jwt.js";
import { buildRecoveryReportHtml } from "../src/services/recovery.service.js";
import { analyseRecoveryOpportunity } from "../src/domain/recovery-engine.js";

jest.mock("../src/lib/prisma.js", () => ({
  prisma: {
    $queryRaw: jest.fn().mockResolvedValue([{ one: 1 }]),
    organisationMembership: {
      findMany: jest.fn()
    },
    siteMembership: {
      findMany: jest.fn()
    },
    user: {
      findUnique: jest.fn()
    },
    site: {
      findUnique: jest.fn()
    },
    plant: {
      findUnique: jest.fn()
    },
    recoveryAnalysisRun: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn()
    },
    recoveryReview: {
      create: jest.fn()
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({})
    },
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        recoveryReview: { create: jest.fn().mockResolvedValue({}) },
        recoveryAnalysisRun: { update: jest.fn().mockResolvedValue({ id: "ra-1", status: "confirmed" }) }
      })
    )
  }
}));

const tokenFor = (role: "admin" | "manager" | "operator", id = "user-1") =>
  signAccessToken({
    sub: id,
    email: `${role}@gridflex.ai`,
    name: role,
    role
  });

const samples = [
  {
    timestamp: "2026-10-06T08:00:00.000Z",
    expectedPowerKw: 700,
    actualPowerKw: 478,
    exportLimitKw: 480,
    irradianceWm2: 800,
    inverterAvailable: true,
    gridInstructionActive: false
  }
];

describe("Recovery API routes", () => {
  const app = createApp();

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.organisationMembership.findMany as jest.Mock).mockResolvedValue([
      { organisationId: "org-a" }
    ]);
    (prisma.siteMembership.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ siteId: null, site: null });
    (prisma.site.findUnique as jest.Mock).mockResolvedValue({ organisationId: "org-a" });
    (prisma.plant.findUnique as jest.Mock).mockResolvedValue({
      id: "plant-1",
      siteId: "site-a",
      organisationId: "org-a",
      exportCapacityKw: 480,
      dataSourceType: "simulated"
    });
  });

  it("rejects unauthenticated analyse requests", async () => {
    const response = await request(app).post("/api/recovery/analyse").send({ samples });
    expect(response.status).toBe(401);
  });

  it("analyses authenticated samples without persistence", async () => {
    const response = await request(app)
      .post("/api/recovery/analyse")
      .set("Authorization", `Bearer ${tokenFor("operator")}`)
      .send({ samples });

    expect(response.status).toBe(200);
    expect(response.body.data.dominantCause).toBe("export_limit");
    expect(response.body.data.algorithmVersion).toMatch(/^recovery-engine@/);
    expect(response.body.data.intervals).toHaveLength(1);
  });

  it("denies persist into an organisation outside the caller scope", async () => {
    const response = await request(app)
      .post("/api/recovery/analyse")
      .set("Authorization", `Bearer ${tokenFor("manager")}`)
      .send({
        samples,
        persist: true,
        organisationId: "org-other"
      });

    expect(response.status).toBe(403);
    expect(prisma.recoveryAnalysisRun.create).not.toHaveBeenCalled();
  });

  it("persists analysis when organisation is in scope", async () => {
    (prisma.recoveryAnalysisRun.create as jest.Mock).mockResolvedValue({
      id: "ra-1",
      status: "open",
      dominantCause: "export_limit",
      algorithmVersion: "recovery-engine@1.1.0",
      lostEnergyKwh: 37,
      environment: "simulation"
    });

    const response = await request(app)
      .post("/api/recovery/analyse")
      .set("Authorization", `Bearer ${tokenFor("manager")}`)
      .send({
        samples,
        persist: true,
        organisationId: "org-a",
        siteId: "site-a",
        plantId: "plant-1"
      });

    expect(response.status).toBe(201);
    expect(response.body.persisted.id).toBe("ra-1");
    expect(prisma.recoveryAnalysisRun.create).toHaveBeenCalled();
  });

  it("lists only analyses for the caller's organisation scope", async () => {
    (prisma.recoveryAnalysisRun.findMany as jest.Mock).mockResolvedValue([
      { id: "ra-1", organisationId: "org-a" }
    ]);

    const response = await request(app)
      .get("/api/recovery/analyses")
      .set("Authorization", `Bearer ${tokenFor("manager")}`);

    expect(response.status).toBe(200);
    expect(prisma.recoveryAnalysisRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organisationId: { in: ["org-a"] }
        })
      })
    );
  });

  it("denies cross-tenant get of a recovery analysis", async () => {
    (prisma.recoveryAnalysisRun.findUnique as jest.Mock).mockResolvedValue({
      id: "ra-2",
      organisationId: "org-b",
      siteId: "site-b",
      analysisJson: {},
      plant: null,
      site: null,
      evidence: [],
      opportunities: [],
      reviews: []
    });

    const response = await request(app)
      .get("/api/recovery/analyses/ra-2")
      .set("Authorization", `Bearer ${tokenFor("manager")}`);

    expect(response.status).toBe(403);
  });

  it("escapes hostile content in branded HTML reports", () => {
    const poisoned = analyseRecoveryOpportunity([
      {
        timestamp: "2026-10-06T08:00:00.000Z",
        expectedPowerKw: 700,
        actualPowerKw: 40,
        irradianceWm2: 10,
        inverterAvailable: false,
        gridInstructionActive: false
      }
    ]);
    poisoned.recommendation = `<img src=x onerror=alert(1)>`;
    poisoned.causeLabel = `Fault</title><script>alert(1)</script>`;
    poisoned.opportunities[0]!.label = `Battery<script>alert(2)</script>`;

    const html = buildRecoveryReportHtml(poisoned, `Report <script>alert(3)</script>`);
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).not.toContain("<script>alert(2)</script>");
    expect(html).not.toContain("<script>alert(3)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });

  it("returns HTML report for an in-scope analysis", async () => {
    const analysis = analyseRecoveryOpportunity(samples);
    (prisma.recoveryAnalysisRun.findUnique as jest.Mock).mockResolvedValue({
      id: "ra-1",
      organisationId: "org-a",
      siteId: "site-a",
      analysisJson: analysis,
      plant: { id: "plant-1", name: "Demo Plant", code: "DEMO", dataSourceType: "simulated" },
      site: { id: "site-a", name: "Site A", code: "A" },
      evidence: [],
      opportunities: [],
      reviews: []
    });

    const response = await request(app)
      .get("/api/recovery/analyses/ra-1/report")
      .set("Authorization", `Bearer ${tokenFor("admin")}`);

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/text\/html/);
    expect(response.text).toContain("GridFlex AI Recovery Report");
    expect(response.text).toContain("Advisory only");
  });
});
