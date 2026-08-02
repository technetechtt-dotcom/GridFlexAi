/**
 * Local alert webhook fire-drill (dispatcher path).
 *
 * Usage:
 *   ALERT_FIRE_DRILL_ALLOW=true npx tsx scripts/alert-webhook-fire-drill.ts
 *
 * Proves happy path + negative paths (disabled webhook, bad token, cooldown).
 * Does not prove Render ALERT_WEBHOOK_* configuration.
 */
import http from "node:http";
import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const main = async () => {
  if (process.env.ALERT_FIRE_DRILL_ALLOW !== "true") {
    throw new Error("Refusing to run without ALERT_FIRE_DRILL_ALLOW=true");
  }

  const port = Number.parseInt(process.env.ALERT_FIRE_DRILL_PORT ?? "9876", 10);
  const token = process.env.ALERT_FIRE_DRILL_TOKEN ?? `drill-${randomBytes(8).toString("hex")}`;
  const outputFile = path.resolve(process.cwd(), "..", "go-live-reports", "alert-webhook-fire-drill.json");

  const received: Array<Record<string, unknown>> = [];
  let rejectAuth = false;

  const server = http.createServer(async (req, res) => {
    if (req.method !== "POST" || req.url !== "/hook") {
      res.writeHead(404).end("not found");
      return;
    }
    const auth = req.headers.authorization ?? "";
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const raw = Buffer.concat(chunks).toString("utf8");
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      body = { raw };
    }
    const authOk = auth === `Bearer ${token}`;
    received.push({
      at: new Date().toISOString(),
      authOk,
      alertId: body.alertId ?? null,
      severity: body.severity ?? null,
      title: body.title ?? null,
      service: body.service ?? null,
      environment: body.environment ?? null,
      rejectedByReceiver: rejectAuth && !authOk
    });
    if (rejectAuth && !authOk) {
      res.writeHead(401, { "content-type": "application/json" }).end(JSON.stringify({ ok: false }));
      return;
    }
    res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ ok: true, ack: true }));
  });

  await new Promise<void>((resolve) => {
    server.listen(port, "127.0.0.1", () => resolve());
  });

  process.env.ALERT_WEBHOOK_ENABLED = "false";
  process.env.ALERT_WEBHOOK_URL = `http://127.0.0.1:${port}/hook`;
  process.env.ALERT_WEBHOOK_TOKEN = token;
  process.env.ALERT_WEBHOOK_COOLDOWN_MS = "0";
  process.env.ALERT_WEBHOOK_INCLUDE_INFO = "false";
  // Ensure empty .env placeholders do not break coerce.number
  if (!process.env.ALERT_WEBHOOK_TIMEOUT_MS?.trim()) {
    process.env.ALERT_WEBHOOK_TIMEOUT_MS = "5000";
  }

  const dispatcher = await import("../src/observability/alert-dispatcher.js");
  const { env } = await import("../src/config/env.js");

  const phases: Record<string, unknown> = {};

  // Phase A — disabled
  (env as { ALERT_WEBHOOK_ENABLED: boolean }).ALERT_WEBHOOK_ENABLED = false;
  const disabled = await dispatcher.dispatchAlert({
    alertId: "fire_drill.disabled",
    severity: "critical",
    title: "Should skip — disabled",
    detail: "negative path",
    firedAt: new Date().toISOString()
  });
  phases.disabled = disabled;

  // Phase B — happy path
  (env as { ALERT_WEBHOOK_ENABLED: boolean }).ALERT_WEBHOOK_ENABLED = true;
  (env as { ALERT_WEBHOOK_URL?: string }).ALERT_WEBHOOK_URL = `http://127.0.0.1:${port}/hook`;
  (env as { ALERT_WEBHOOK_TOKEN?: string }).ALERT_WEBHOOK_TOKEN = token;
  (env as { ALERT_WEBHOOK_COOLDOWN_MS: number }).ALERT_WEBHOOK_COOLDOWN_MS = 0;
  const beforeHappy = received.length;
  const happy = await dispatcher.dispatchAlert({
    alertId: "fire_drill.critical.edge_auth",
    severity: "critical",
    title: "Fire-drill critical alert",
    detail: "Controlled ALERT_WEBHOOK delivery rehearsal — no production incident.",
    firedAt: new Date().toISOString(),
    traceId: "fire-drill-trace"
  });
  await new Promise((r) => setTimeout(r, 300));
  const happyReceived = received.slice(beforeHappy);
  phases.happy = { dispatch: happy, received: happyReceived };

  // Phase C — cooldown
  (env as { ALERT_WEBHOOK_COOLDOWN_MS: number }).ALERT_WEBHOOK_COOLDOWN_MS = 60000;
  const cooldown = await dispatcher.dispatchAlert({
    alertId: "fire_drill.critical.edge_auth",
    severity: "critical",
    title: "Should skip — cooldown",
    detail: "negative path",
    firedAt: new Date().toISOString()
  });
  phases.cooldown = cooldown;

  // Phase D — bad token (receiver rejects; dispatcher may still report delivered on HTTP)
  rejectAuth = true;
  (env as { ALERT_WEBHOOK_COOLDOWN_MS: number }).ALERT_WEBHOOK_COOLDOWN_MS = 0;
  (env as { ALERT_WEBHOOK_TOKEN?: string }).ALERT_WEBHOOK_TOKEN = "wrong-token";
  const beforeBad = received.length;
  const badToken = await dispatcher.dispatchAlert({
    alertId: "fire_drill.bad_token",
    severity: "critical",
    title: "Fire-drill bad token",
    detail: "negative path",
    firedAt: new Date().toISOString()
  });
  await new Promise((r) => setTimeout(r, 300));
  phases.badToken = { dispatch: badToken, received: received.slice(beforeBad) };

  // Simulated operator acknowledgement timestamp (local drill only).
  const acknowledgedAt = new Date().toISOString();
  phases.acknowledgement = {
    alertId: "fire_drill.critical.edge_auth",
    acknowledgedAt,
    acknowledger: "local-fire-drill",
    note: "Simulated ack for catalog drill; Render on-call ack remains Open."
  };

  server.close();

  const checks = {
    disabledSkipped: disabled.delivered === false && disabled.skipped === "webhook_disabled",
    happyDelivered: happy.delivered === true,
    happyReceiverGotPayload: happyReceived.length === 1,
    happyAuthMatched: happyReceived[0]?.authOk === true,
    happySeverityCritical: happyReceived[0]?.severity === "critical",
    cooldownSkipped: cooldown.delivered === false && cooldown.skipped === "cooldown",
    badTokenRejectedByDispatcher: badToken.delivered === false,
    acknowledgementRecorded: Boolean(acknowledgedAt)
  };

  const report = {
    mode: "alert-webhook-fire-drill",
    generatedAt: new Date().toISOString(),
    commitSha: process.env.GIT_COMMIT_SHA ?? null,
    scope: "local-loopback-receiver",
    note: "Proves dispatcher delivery + negative paths. Does not prove Render ALERT_WEBHOOK_* is configured.",
    phases,
    receivedCount: received.length,
    checks
  };

  const failed = Object.values(checks).some((value) => value !== true);
  await fs.mkdir(path.dirname(outputFile), { recursive: true });
  const json = `${JSON.stringify(report, null, 2)}\n`;
  await fs.writeFile(outputFile, json, "utf8");
  const sha256 = createHash("sha256").update(json).digest("hex");
  await fs.writeFile(`${outputFile}.sha256`, `${sha256}  ${path.basename(outputFile)}\n`, "utf8");

  process.stdout.write(`${JSON.stringify({ ok: !failed, evidence: outputFile, sha256, checks })}\n`);
  if (failed) process.exit(1);
};

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exit(1);
});
