/**
 * Verify device-secret vault / AWS KMS readiness for staging & production (#45).
 *
 * Modes:
 *   CHECK_ONLY (default) — validate env presence + document blockers; exit 0 if
 *     all required vars are set for aws_kms, else exit 2 with a checklist.
 *   ROUND_TRIP=true — also run backend vault round-trip (requires working AWS
 *     credentials and network). Fail closed on encrypt/decrypt errors.
 *
 * Never prints secret values. Console output is presence/blocker only;
 * the JSON report on disk uses redacted placeholders.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const outFile =
  process.env.KMS_READINESS_OUTPUT ||
  path.resolve("go-live-reports", "kms-readiness.json");

const requiredForAwsKms = [
  "DEVICE_SECRET_VAULT_PROVIDER",
  "AWS_KMS_KEY_ID",
  "AWS_REGION"
];

const credentialSources = ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_PROFILE", "AWS_ROLE_ARN"];

const isSet = (value) => typeof value === "string" && value.trim().length > 0;

const main = async () => {
  const env = process.env;
  const provider = isSet(env.DEVICE_SECRET_VAULT_PROVIDER) ? env.DEVICE_SECRET_VAULT_PROVIDER.trim() : "";
  const report = {
    startedAt: new Date().toISOString(),
    target: isSet(env.KMS_READINESS_TARGET) ? env.KMS_READINESS_TARGET.trim() : "unspecified",
    provider: provider || null,
    checks: {},
    blockers: [],
    pass: false
  };

  for (const key of requiredForAwsKms) {
    const present = isSet(env[key]);
    report.checks[key] = { present };
    if (!present) {
      report.blockers.push(`Missing required env: ${key}`);
    }
  }

  if (provider && provider !== "aws_kms") {
    report.blockers.push(
      `DEVICE_SECRET_VAULT_PROVIDER must be aws_kms for staging/prod (got non-aws_kms value).`
    );
  }

  if (provider === "local") {
    report.blockers.push("local vault does not satisfy issue #45.");
  }

  const credSourcesPresent = credentialSources.filter((key) => isSet(env[key]));
  report.checks.awsCredentialSource = {
    present: credSourcesPresent.length > 0,
    sourceCount: credSourcesPresent.length
  };
  if (credSourcesPresent.length === 0) {
    report.blockers.push(
      "No AWS credential source found (AWS_ACCESS_KEY_ID/SECRET, AWS_PROFILE, or AWS_ROLE_ARN)."
    );
  }

  const awsCli = spawnSync("aws", ["--version"], { encoding: "utf8", shell: true });
  report.checks.awsCli = {
    present: awsCli.status === 0
  };
  if (awsCli.status !== 0) {
    report.blockers.push("AWS CLI not available on this workstation.");
  }

  if (env.ROUND_TRIP === "true") {
    if (report.blockers.length > 0) {
      report.blockers.push("Skipping ROUND_TRIP because prerequisite blockers remain.");
    } else {
      const round = spawnSync(
        process.platform === "win32" ? "npx.cmd" : "npx",
        ["tsx", "src/scripts/verify-device-secret-vault.ts"],
        {
          cwd: path.resolve("backend"),
          encoding: "utf8",
          shell: true,
          env: process.env
        }
      );
      report.checks.roundTrip = {
        exitCode: round.status,
        ok: round.status === 0
      };
      if (round.status !== 0) {
        report.blockers.push("Vault round-trip script failed (exit non-zero).");
      }
    }
  }

  report.pass = report.blockers.length === 0;
  report.completedAt = new Date().toISOString();
  report.nextActions = report.pass
    ? [
        "Record device_secret_vault.round_trip_ok from staging/prod boot logs",
        "Provision + rotate one device credential; log fingerprints only in secret-rotation-log.md",
        "Update SECRETS_INVENTORY.md last-rotated dates"
      ]
    : [
        "Install/configure AWS CLI and IAM user/role with kms:Encrypt/Decrypt/DescribeKey",
        "Create CMK (see docs/runbooks/aws-kms-setup.md)",
        "Set Render env: DEVICE_SECRET_VAULT_PROVIDER=aws_kms, AWS_KMS_KEY_ID, AWS_REGION, credentials",
        "Redeploy and confirm round_trip_ok, then re-run with ROUND_TRIP=true"
      ];

  await fs.mkdir(path.dirname(outFile), { recursive: true });
  await fs.writeFile(outFile, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  // Presence/blocker summary only — no env values.
  console.log(
    JSON.stringify(
      {
        pass: report.pass,
        blockerCount: report.blockers.length,
        blockers: report.blockers,
        checks: Object.fromEntries(
          Object.entries(report.checks).map(([k, v]) => [k, { present: Boolean(v.present), ...(v.ok !== undefined ? { ok: v.ok } : {}) }])
        ),
        reportPath: outFile
      },
      null,
      2
    )
  );
  process.exit(report.pass ? 0 : 2);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
