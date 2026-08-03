/**
 * Bootstrap AWS KMS resources for GridFlex device-secret vault (#45).
 *
 * Safe defaults: fails closed without credentials and without an explicit allow flag.
 * Never prints secret access keys to the report file; if an access key is created,
 * it is written once to a gitignored path and omitted from console after the run.
 *
 *   BOOTSTRAP_AWS_KMS_ALLOW=true node scripts/bootstrap-aws-kms.mjs
 *
 * Optional env:
 *   AWS_REGION / AWS_DEFAULT_REGION (default eu-west-1)
 *   KMS_KEY_ALIAS (default alias/gridflex-device-secrets)
 *   KMS_IAM_USER (default gridflex-kms-vault)
 *   CREATE_IAM_ACCESS_KEY=true  — also create access key for the IAM user
 *   KMS_BOOTSTRAP_OUTPUT — report path
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const allow = process.env.BOOTSTRAP_AWS_KMS_ALLOW === "true";
if (!allow) {
  console.error("Refusing to run without BOOTSTRAP_AWS_KMS_ALLOW=true");
  process.exit(2);
}

const region =
  (process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "eu-west-1").trim() || "eu-west-1";
const aliasName = (process.env.KMS_KEY_ALIAS || "alias/gridflex-device-secrets").trim();
const iamUser = (process.env.KMS_IAM_USER || "gridflex-kms-vault").trim();
const createAccessKey = process.env.CREATE_IAM_ACCESS_KEY === "true";
const outFile =
  process.env.KMS_BOOTSTRAP_OUTPUT ||
  path.resolve("go-live-reports", "aws-kms-bootstrap.json");
const secretOutFile = path.resolve("go-live-reports", "aws-kms-bootstrap.access-key.json");

const aws = (args, { json = true } = {}) => {
  const result = spawnSync("aws", [...args, ...(json ? ["--output", "json"] : []), "--region", region], {
    encoding: "utf8",
    shell: true,
    env: process.env
  });
  if (result.status !== 0) {
    const err = (result.stderr || result.stdout || "aws failed").trim();
    throw new Error(err);
  }
  const text = (result.stdout || "").trim();
  if (!json || !text) {
    return text;
  }
  return JSON.parse(text);
};

const main = async () => {
  const report = {
    generatedAt: new Date().toISOString(),
    region,
    aliasName,
    iamUser,
    steps: [],
    pass: false,
    blockers: [],
    renderEnv: {},
    nextActions: []
  };

  let identity;
  try {
    identity = aws(["sts", "get-caller-identity"]);
    report.steps.push({ step: "sts.get-caller-identity", ok: true, account: identity.Account });
  } catch (error) {
    report.blockers.push(
      `No usable AWS credentials (${error instanceof Error ? error.message : String(error)}). Run aws configure or set AWS_ACCESS_KEY_ID/SECRET.`
    );
    await writeReport(report);
    console.log(
      JSON.stringify(
        { pass: false, blockers: report.blockers, reportPath: outFile },
        null,
        2
      )
    );
    process.exit(2);
  }

  const accountId = identity.Account;
  let keyId;
  let keyArn;

  try {
    const existing = aws(["kms", "list-aliases"]);
    const hit = (existing.Aliases || []).find((a) => a.AliasName === aliasName);
    if (hit?.TargetKeyId) {
      keyId = hit.TargetKeyId;
      const desc = aws(["kms", "describe-key", "--key-id", keyId]);
      keyArn = desc.KeyMetadata.Arn;
      report.steps.push({ step: "kms.reuse-alias", ok: true, keyId });
    } else {
      const created = aws([
        "kms",
        "create-key",
        "--description",
        "GridFlex device HMAC vault",
        "--key-usage",
        "ENCRYPT_DECRYPT",
        "--origin",
        "AWS_KMS"
      ]);
      keyId = created.KeyMetadata.KeyId;
      keyArn = created.KeyMetadata.Arn;
      aws(["kms", "create-alias", "--alias-name", aliasName, "--target-key-id", keyId], {
        json: false
      });
      report.steps.push({ step: "kms.create-key+alias", ok: true, keyId });
    }
  } catch (error) {
    report.blockers.push(`KMS key/alias failed: ${error instanceof Error ? error.message : String(error)}`);
    await writeReport(report);
    process.exit(1);
  }

  const policyName = "GridFlexKmsVaultMinimal";
  const policyDoc = {
    Version: "2012-10-17",
    Statement: [
      {
        Sid: "GridFlexDeviceVault",
        Effect: "Allow",
        Action: ["kms:Encrypt", "kms:Decrypt", "kms:DescribeKey"],
        Resource: keyArn
      }
    ]
  };

  try {
    try {
      aws(["iam", "get-user", "--user-name", iamUser]);
      report.steps.push({ step: "iam.user.exists", ok: true });
    } catch {
      aws(["iam", "create-user", "--user-name", iamUser]);
      report.steps.push({ step: "iam.user.created", ok: true });
    }

    // Put inline policy (idempotent overwrite)
    aws(
      [
        "iam",
        "put-user-policy",
        "--user-name",
        iamUser,
        "--policy-name",
        policyName,
        "--policy-document",
        JSON.stringify(policyDoc)
      ],
      { json: false }
    );
    report.steps.push({ step: "iam.put-user-policy", ok: true, policyName });

    if (createAccessKey) {
      const key = aws(["iam", "create-access-key", "--user-name", iamUser]);
      const material = {
        generatedAt: new Date().toISOString(),
        warning: "Copy into Render secrets then delete this file. Never commit.",
        UserName: key.AccessKey.UserName,
        AccessKeyId: key.AccessKey.AccessKeyId,
        SecretAccessKey: key.AccessKey.SecretAccessKey,
        AWS_REGION: region,
        AWS_KMS_KEY_ID: keyArn
      };
      await fs.mkdir(path.dirname(secretOutFile), { recursive: true });
      await fs.writeFile(secretOutFile, `${JSON.stringify(material, null, 2)}\n`, "utf8");
      report.steps.push({
        step: "iam.create-access-key",
        ok: true,
        accessKeyIdLast4: String(key.AccessKey.AccessKeyId).slice(-4),
        secretPath: secretOutFile
      });
    }
  } catch (error) {
    report.blockers.push(`IAM setup failed: ${error instanceof Error ? error.message : String(error)}`);
    await writeReport(report);
    process.exit(1);
  }

  report.renderEnv = {
    DEVICE_SECRET_VAULT_PROVIDER: "aws_kms",
    AWS_KMS_KEY_ID: keyArn,
    AWS_REGION: region,
    AWS_ACCESS_KEY_ID: createAccessKey ? "(see go-live-reports/aws-kms-bootstrap.access-key.json)" : "(create access key or attach existing)",
    AWS_SECRET_ACCESS_KEY: createAccessKey ? "(see access-key file — do not commit)" : "(secret manager)"
  };
  report.pass = report.blockers.length === 0;
  report.nextActions = [
    "Set Render backend env from report.renderEnv (never commit secrets)",
    "Delete go-live-reports/aws-kms-bootstrap.access-key.json after copying to Render",
    "Redeploy backend; require log event device_secret_vault.round_trip_ok",
    "ROUND_TRIP=true DEVICE_SECRET_VAULT_PROVIDER=aws_kms AWS_KMS_KEY_ID=... npm run verify:kms-readiness",
    "Record fingerprints only in docs/runbooks/credential-rotation-rehearsal.md"
  ];
  report.accountId = accountId;
  report.keyId = keyId;
  report.keyArn = keyArn;

  await writeReport(report);
  console.log(
    JSON.stringify(
      {
        pass: report.pass,
        keyArn,
        region,
        iamUser,
        accessKeyCreated: createAccessKey,
        reportPath: outFile,
        secretPath: createAccessKey ? secretOutFile : null,
        blockers: report.blockers
      },
      null,
      2
    )
  );
  process.exit(report.pass ? 0 : 1);
};

const writeReport = async (report) => {
  await fs.mkdir(path.dirname(outFile), { recursive: true });
  await fs.writeFile(outFile, `${JSON.stringify(report, null, 2)}\n`, "utf8");
};

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
