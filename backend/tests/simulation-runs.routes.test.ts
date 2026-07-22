import type { NextFunction, Request, Response } from "express";
import request from "supertest";

const simulationRunCreate = jest.fn();
const simulationRunFindMany = jest.fn();
const simulationRunFindFirst = jest.fn();
const simulationRunUpdate = jest.fn();
const edgeNodeFindUnique = jest.fn();

jest.mock("../src/lib/prisma.js", () => ({
  prisma: {
    organisationMembership: {
      findMany: jest.fn(async ({ where }: { where: { userId: string } }) => [
        { organisationId: where.userId === "tenant-b-user" ? "org-b" : "org-a" }
      ])
    },
    siteMembership: {
      findMany: jest.fn(async ({ where }: { where: { userId: string } }) => {
        const tenant = where.userId === "tenant-b-user" ? "b" : "a";
        return [{ siteId: `site-${tenant}`, site: { organisationId: `org-${tenant}` } }];
      })
    },
    user: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        const tenant = where.id === "tenant-b-user" ? "b" : "a";
        return { siteId: `site-${tenant}`, site: { organisationId: `org-${tenant}` } };
      })
    },
    site: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => ({
        organisationId: where.id === "site-b" ? "org-b" : "org-a"
      }))
    },
    edgeNode: { findUnique: edgeNodeFindUnique },
    simulationRun: {
      create: simulationRunCreate,
      findMany: simulationRunFindMany,
      findFirst: simulationRunFindFirst,
      update: simulationRunUpdate
    }
  }
}));

jest.mock("../src/middleware/auth.js", () => ({
  authenticate: (req: Request, _res: Response, next: NextFunction) => {
    const userId = req.header("x-test-user") ?? "tenant-a-user";
    req.user = {
      id: userId,
      email: `${userId}@example.com`,
      name: userId,
      role: "operator"
    };
    next();
  },
  requireRoles: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  authorizeRoles: () => (_req: Request, _res: Response, next: NextFunction) => next()
}));

import { createApp } from "../src/app.js";

describe("tenant simulation run API", () => {
  const app = createApp();

  beforeEach(() => {
    jest.clearAllMocks();
    edgeNodeFindUnique.mockResolvedValue({
      id: "node-a",
      siteId: "site-a",
      site: { organisationId: "org-a" }
    });
    simulationRunCreate.mockResolvedValue({
      id: "run-a",
      organisationId: "org-a",
      siteId: "site-a",
      targetNodeId: "node-a",
      status: "running"
    });
    simulationRunFindMany.mockResolvedValue([]);
    simulationRunFindFirst.mockResolvedValue(null);
  });

  it("creates a persisted run only for a consistent authorized target", async () => {
    const response = await request(app)
      .post("/api/simulation/runs")
      .set("x-test-user", "tenant-a-user")
      .send({
        organisationId: "org-a",
        siteId: "site-a",
        targetNodeId: "node-a"
      });

    expect(response.status).toBe(201);
    expect(response.body.data.id).toBe("run-a");
    expect(simulationRunCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        organisationId: "org-a",
        siteId: "site-a",
        targetNodeId: "node-a",
        createdById: "tenant-a-user"
      })
    }));
  });

  it("rejects client-supplied run IDs", async () => {
    const response = await request(app)
      .post("/api/simulation/runs")
      .set("x-test-user", "tenant-a-user")
      .send({
        id: "public-tenant-run-id",
        organisationId: "org-a",
        siteId: "site-a",
        targetNodeId: "node-a"
      });

    expect(response.status).toBe(400);
    expect(simulationRunCreate).not.toHaveBeenCalled();
  });

  it("denies cross-tenant creation before looking up the target node", async () => {
    const response = await request(app)
      .post("/api/simulation/runs")
      .set("x-test-user", "tenant-a-user")
      .send({
        organisationId: "org-b",
        siteId: "site-b",
        targetNodeId: "node-b"
      });

    expect(response.status).toBe(403);
    expect(edgeNodeFindUnique).not.toHaveBeenCalled();
    expect(simulationRunCreate).not.toHaveBeenCalled();
  });

  it("rejects a target node from a different site", async () => {
    edgeNodeFindUnique.mockResolvedValue({
      id: "node-b",
      siteId: "site-b",
      site: { organisationId: "org-b" }
    });

    const response = await request(app)
      .post("/api/simulation/runs")
      .set("x-test-user", "tenant-a-user")
      .send({
        organisationId: "org-a",
        siteId: "site-a",
        targetNodeId: "node-b"
      });

    expect(response.status).toBe(400);
    expect(simulationRunCreate).not.toHaveBeenCalled();
  });

  it("scopes list and get queries to the caller's sites", async () => {
    await request(app)
      .get("/api/simulation/runs")
      .set("x-test-user", "tenant-a-user")
      .expect(200);

    const crossTenantGet = await request(app)
      .get("/api/simulation/runs/run-b")
      .set("x-test-user", "tenant-a-user");

    expect(crossTenantGet.status).toBe(404);
    expect(simulationRunFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        AND: [
          { siteId: { in: ["site-a"] } }
        ]
      }
    }));
    expect(simulationRunFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: "run-b",
        siteId: { in: ["site-a"] }
      }
    }));
  });

  it("stops an authorized persisted run", async () => {
    simulationRunFindFirst.mockResolvedValue({
      id: "run-a",
      organisationId: "org-a",
      siteId: "site-a",
      targetNodeId: "node-a",
      status: "running"
    });
    simulationRunUpdate.mockResolvedValue({
      id: "run-a",
      organisationId: "org-a",
      siteId: "site-a",
      targetNodeId: "node-a",
      status: "stopped"
    });

    const response = await request(app)
      .post("/api/simulation/runs/run-a/stop")
      .set("x-test-user", "tenant-a-user");

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("stopped");
    expect(simulationRunUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "run-a" },
      data: {
        status: "stopped",
        stoppedAt: expect.any(Date)
      }
    }));
  });
});
