import type { Role } from "@prisma/client";

jest.mock("../src/lib/prisma.js", () => ({
  prisma: {
    alarmEvent: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    },
    alarmRule: {
      findMany: jest.fn(),
      create: jest.fn()
    },
    alarmAcknowledgement: {
      create: jest.fn()
    },
    incident: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn()
    },
    incidentTimeline: {
      create: jest.fn()
    },
    organisationMembership: {
      findMany: jest.fn().mockResolvedValue([{ organisationId: "org-1" }])
    },
    siteMembership: {
      findMany: jest.fn().mockResolvedValue([{ siteId: "site-1", site: { organisationId: "org-1" } }])
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({ siteId: null, site: null })
    },
    site: {
      findUnique: jest.fn().mockResolvedValue({ organisationId: "org-1" })
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({ id: "audit-1" })
    },
    $transaction: jest.fn(async (input: unknown) => {
      if (typeof input === "function") {
        return input({
          incident: { create: jest.fn().mockResolvedValue({ id: "inc-1", organisationId: "org-1", siteId: "site-1", title: "Test" }) },
          alarmEvent: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) }
        });
      }
      return input;
    })
  }
}));

jest.mock("../src/services/audit-log.service.js", () => ({
  recordAuditLog: jest.fn().mockResolvedValue(undefined)
}));

import { prisma } from "../src/lib/prisma.js";
import {
  alarmEventScopeWhere,
  listAlarmEvents,
  raiseAlarmEvent
} from "../src/services/alarm.service.js";
import {
  proposeCommandOnly,
  proposeCommandInputSchema,
  redactSecrets,
  resolveZoltAccessScope,
  zoltPrepareStep
} from "../src/services/zolt-hardening.js";

describe("PR5 alarms tenant scope", () => {
  const actor = { id: "user-1", role: "operator" };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("scopes alarm event queries to tenant memberships", async () => {
    (prisma.alarmEvent.findMany as jest.Mock).mockResolvedValue([]);

    await listAlarmEvents(actor, { siteId: "site-1" });

    expect(prisma.alarmEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          siteId: "site-1"
        })
      })
    );
  });

  it("exports alarmEventScopeWhere for organisation tenants", () => {
    const where = alarmEventScopeWhere({
      kind: "organisation",
      organisationIds: ["org-1"]
    });

    expect(where).toEqual({ organisationId: { in: ["org-1"] } });
  });

  it("raises alarm events within accessible sites", async () => {
    (prisma.alarmEvent.create as jest.Mock).mockResolvedValue({
      id: "evt-1",
      organisationId: "org-1",
      siteId: "site-1",
      title: "High export",
      message: "Threshold exceeded"
    });

    const event = await raiseAlarmEvent(
      {
        organisationId: "org-1",
        siteId: "site-1",
        title: "High export",
        message: "Threshold exceeded"
      },
      actor
    );

    expect(event.id).toBe("evt-1");
    expect(prisma.alarmEvent.create).toHaveBeenCalled();
  });
});

describe("PR5 Zolt hardening", () => {
  it("redacts bearer tokens and api keys from prompts", () => {
    const input = "token=super-secret Authorization: Bearer abc.def.ghi api_key=xyz";
    const redacted = redactSecrets(input);

    expect(redacted).not.toContain("super-secret");
    expect(redacted).not.toContain("abc.def.ghi");
    expect(redacted).toContain("[REDACTED]");
  });

  it("requires tool choice on prepare step zero", () => {
    expect(zoltPrepareStep({ stepNumber: 0 })).toEqual({ toolChoice: "required" });
    expect(zoltPrepareStep({ stepNumber: 1 })).toEqual({});
  });

  it("proposeCommandOnly returns proposal without execution", async () => {
    const input = proposeCommandInputSchema.parse({
      organisationId: "org-1",
      siteId: "site-1",
      commandType: "curtail_export",
      rationale: "Reduce export during congestion window"
    });

    const result = await proposeCommandOnly(
      input,
      { id: "user-1", role: "operator" },
      { kind: "site", siteIds: ["site-1"], organisationIds: ["org-1"] }
    );

    expect(result.executed).toBe(false);
    expect(result.physicalCommandExecutionEnabled).toBe(false);
    expect(result.status).toBe("proposal_only");
    expect(result.proposal.commandType).toBe("curtail_export");
  });

  it("rejects cross-tenant command proposals", async () => {
    const input = proposeCommandInputSchema.parse({
      organisationId: "org-other",
      siteId: "site-1",
      commandType: "setpoint_change",
      rationale: "Attempt cross-tenant command"
    });

    await expect(
      proposeCommandOnly(
        input,
        { id: "user-1", role: "operator" },
        { kind: "site", siteIds: ["site-1"], organisationIds: ["org-1"] }
      )
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe("resolveZoltAccessScope import surface", () => {
  it("re-exports role-aware scope resolution", async () => {
    const scope = await resolveZoltAccessScope("user-1", "operator" as Role);
    expect(scope.kind === "site" || scope.kind === "organisation" || scope.kind === "global").toBe(true);
  });
});
