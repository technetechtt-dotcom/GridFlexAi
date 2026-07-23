/**
 * Local alert webhook fire-drill (dispatcher path).
 *
 * Usage:
 *   ALERT_FIRE_DRILL_ALLOW=true npx tsx scripts/alert-webhook-fire-drill.ts
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
  const outputFile =
    process.env.ALERT_FIRE_DRILL_OUTPUT ??
    path.resolve(process.cwd(), "..", "go-live-reports", "alert-webhook-fire-drill.json");

  process.env.ALERT_WEBHOOK_ENABLED = "true";
  process.env.ALERT_WEBHOOK_URL = `http://127.0.0.1:${port}/hook`;
  process.env.ALERT_WEBHOOK_TOKEN = token;
  process.env.ALERT_WEBHOOK_COOLDOWN_MS = "0";
  process.env.ALERT_WEBHOOK_INCLUDE_INFO = "false";

  const received: Array<Record<string, unknown>> = [];

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
    received.push({
      at: new Date().toISOString(),
      authOk: auth === `Bearer ${token}`,
      alertId: body.alertId ?? null,
      severity: body.severity ?? null,
      title: body.title ?? null,
      service: body.service ?? null,
      environment: body.environment ?? null
    });
    res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ ok: true }));
  });

  await new Promise<void>((resolve) => {
    server.listen(port, "127.0.0.1", () => resolve());
  });

  const { dispatchAlert } = await import("../src/observability/alert-dispatcher.js");

  const result = await dispatchAlert({
    alertId: "fire_drill.critical.edge_auth",
    severity: "critical",
    title: "Fire-drill critical alert",
    detail: "Controlled ALERT_WEBHOOK delivery rehearsal — no production incident.",
    firedAt: new Date().toISOString(),
    traceId: "fire-drill-trace"
  });

  await new Promise((r) => setTimeout(r, 300));
  server.close();

  const report = {
    mode: "alert-webhook-fire-drill",
    generatedAt: new Date().toISOString(),
    commitSha: process.env.GIT_COMMIT_SHA ?? null,
    scope: "local-loopback-receiver",
    note: "Proves dispatcher delivery path. Does not prove Render ALERT_WEBHOOK_* is configured.",
    dispatchResult: result,
    receivedCount: received.length,
    received,
    checks: {
      deliveredFlag: result.delivered === true,
      receiverGotPayload: received.length === 1,
      authMatched: received[0]?.authOk === true,
      severityCritical: received[0]?.severity === "critical"
    }
  };

  const failed = Object.values(report.checks).some((value) => value !== true);
  await fs.mkdir(path.dirname(outputFile), { recursive: true });
  const json = `${JSON.stringify(report, null, 2)}\n`;
  await fs.writeFile(outputFile, json, "utf8");
  const sha256 = createHash("sha256").update(json).digest("hex");
  await fs.writeFile(`${outputFile}.sha256`, `${sha256}  ${path.basename(outputFile)}\n`, "utf8");

  process.stdout.write(`${JSON.stringify({ ok: !failed, evidence: outputFile, sha256, checks: report.checks })}\n`);
  if (failed) process.exit(1);
};

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exit(1);
});
