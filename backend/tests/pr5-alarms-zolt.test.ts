import { proposeCommandOnly, redactSecrets, zoltPrepareStep } from "../src/services/zolt-hardening.js";
jest.mock("../src/middleware/permissions.js", () => ({
  assertOrganisationAccess: jest.fn(), assertSiteAccess: jest.fn().mockResolvedValue(undefined), resolveAccessScope: jest.fn().mockResolvedValue({ kind: "global" })
}));
describe("PR5 Zolt hardening", () => {
  it("redacts bearer tokens and secret-like strings", () => {
    const input = "Authorization: Bearer abc.def.ghi api_key=super-secret";
    expect(redactSecrets(input)).not.toContain("abc.def.ghi");
    expect(redactSecrets(input)).toContain("[REDACTED]");
  });
  it("requires a tool on the first prepare step", () => {
    expect(zoltPrepareStep({ stepNumber: 0 })).toEqual({ toolChoice: "required" });
    expect(zoltPrepareStep({ stepNumber: 1 })).toEqual({});
  });
  it("returns proposal-only command payloads without execution", async () => {
    const result = await proposeCommandOnly({ organisationId: "org-1", siteId: "site-1", commandType: "curtailment.setpoint", rationale: "Reduce export during congestion." }, { id: "user-1" }, { kind: "global" });
    expect(result.status).toBe("proposal_only");
    expect(result.executed).toBe(false);
    expect(result.physicalCommandExecutionEnabled).toBe(false);
  });
});
