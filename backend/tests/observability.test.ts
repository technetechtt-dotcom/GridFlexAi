import { redactMeta, redactString } from "../src/observability/redact.js";
import { resolveTraceIds, runWithLogContext, getLogContext } from "../src/observability/log-context.js";
import { platformMetrics } from "../src/services/platform-metrics.service.js";
import { logger } from "../src/utils/logger.js";

describe("observability redaction", () => {
  it("redacts bearer tokens and jwt-like strings", () => {
    expect(redactString("Authorization: Bearer abcdefghijklmnop")).toContain("[REDACTED]");
    expect(redactString("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.aaa.bbb")).toContain("[REDACTED]");
  });

  it("redacts sensitive object keys", () => {
    const out = redactMeta({
      password: "super-secret",
      signature: "deadbeef",
      ok: "fine",
      nested: { apiKey: "x", value: 1 }
    });
    expect(out?.password).toBe("[REDACTED]");
    expect(out?.signature).toBe("[REDACTED]");
    expect(out?.ok).toBe("fine");
    expect((out?.nested as { apiKey: string }).apiKey).toBe("[REDACTED]");
  });
});

describe("trace context", () => {
  it("generates W3C traceparent ids", () => {
    const ids = resolveTraceIds(null);
    expect(ids.traceId).toHaveLength(32);
    expect(ids.spanId).toHaveLength(16);
    expect(ids.traceparent.startsWith("00-")).toBe(true);
  });

  it("continues incoming trace id", () => {
    const parent = "00-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbb-01";
    const ids = resolveTraceIds(parent);
    expect(ids.traceId).toBe("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    expect(ids.spanId).not.toBe("bbbbbbbbbbbbbbbb");
  });

  it("propagates ALS context", () => {
    runWithLogContext({ requestId: "r1", traceId: "t1", deviceId: "d1" }, () => {
      expect(getLogContext()).toMatchObject({ requestId: "r1", traceId: "t1", deviceId: "d1" });
    });
  });
});

describe("prometheus metrics", () => {
  it("exposes counters without high-cardinality device labels", () => {
    platformMetrics.recordIngestAccepted();
    platformMetrics.recordSignatureFailure();
    platformMetrics.recordReplayAttempt();
    platformMetrics.recordRequest("POST", "/api/edge-data", 201, 12);
    const text = platformMetrics.toPrometheus();
    expect(text).toContain("gridflex_ingest_accepted_total");
    expect(text).toContain("gridflex_signature_failures_total");
    expect(text).toContain("gridflex_replay_attempts_total");
    expect(text).not.toMatch(/deviceId=/);
    expect(text).not.toMatch(/organisationId=/);
  });
});

describe("structured logger smoke", () => {
  it("emits without throwing when event logging", () => {
    expect(() => logger.event("test.event", { durationMs: 1, token: "secret" })).not.toThrow();
  });
});
