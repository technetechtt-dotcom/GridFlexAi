/**
 * Bootstrap AWS KMS resources for GridFlex device-secret vault (#45).
 *
 * Fail-closed:
 *   - requires BOOTSTRAP_AWS_KMS_ALLOW=true
 *   - never uses a shell (no interpolation of alias/user/region)
 *   - validates region / alias / IAM user
 *   - confines reports to go-live-reports/
 *   - never prints SecretAccessKey
 *   - long-lived IAM access keys require dual confirmation
 *
 *   BOOTSTRAP_AWS_KMS_ALLOW=true node scripts/bootstrap-aws-kms.mjs
 *   BOOTSTRAP_AWS_KMS_ALLOW=true DRY_RUN=true node scripts/bootstrap-aws-kms.mjs
 *   node scripts/bootstrap-aws-kms.mjs --self-test
 *
 * Optional env:
 *   AWS_REGION / AWS_DEFAULT_REGION (default eu-west-1)
 *   EXPECTED_AWS_ACCOUNT_ID — refuse to run against any other account
 *   KMS_KEY_ALIAS (default alias/gridflex-device-secrets)
 *   KMS_IAM_USER (default gridflex-kms-vault)
 *   CREATE_IAM_ACCESS_KEY=true
 *   CONFIRM_CREATE_ACCESS_KEY=I_UNDERSTAND_LONG_LIVED_KEYS
 *   KMS_BOOTSTRAP_OUTPUT — report path (must stay under go-live-reports/)
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const REPORTS_DIR = path.resolve("go-live-reports");
const ACCESS_KEY_CONFIRM = "I_UNDERSTAND_LONG_LIVED_KEYS";
const REGION_RE = /^[a-z]{2}-[a-z]+-\d+$/;
const ALIAS_RE = /^alias\/[A-Za-z0-9/_-]{1,240}$/;
const IAM_USER_RE = /^[\w+=,.@-]{1,64}$/;
const ACCOUNT_RE = /^\d{12}$/;
const SECRET_RE =
  /AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|SecretAccessKey|aws_secret_access_key|["'][A-Za-z0-9/+=]{40}["']/gi;

export const redact = (value) => String(value ?? "").replace(SECRET_RE, "[REDACTED]");

export const validateRegion = (value) => {
  const region = String(value || "").trim();
  if (!REGION_RE.test(region)) {
    throw new Error("AWS_REGION must look like eu-west-1");
  }
  return region;
};

export const validateAlias = (value) => {
  const alias = String(value || "").trim();
  if (!ALIAS_RE.test(alias) || alias.includes("..")) {
    throw new Error("KMS_KEY_ALIAS must be alias/<safe-name>");
  }
  return alias;
};

export const validateIamUser = (value) => {
  const user = String(value || "").trim();
  if (!IAM_USER_RE.test(user)) {
    throw new Error("KMS_IAM_USER contains unsupported characters");
  }
  return user;
};

export const confineOutputPath = (candidate, fallbackName) => {
  const resolved = path.resolve(candidate || path.join(REPORTS_DIR, fallbackName));
  const relative = path.relative(REPORTS_DIR, resolved);
  if (
    relative.startsWith("..") ||
    path.isAbsolute(relative) ||
    relative.includes("..") ||
    path.dirname(resolved) !== REPORTS_DIR
  ) {
    throw new Error("Output path must be a file directly under go-live-reports/");
  }
  if (!/^[A-Za-z0-9._-]+$/.test(path.basename(resolved))) {
    throw new Error("Output filename must be alphanumeric plus . _ -");
  }
  return resolved;
};

export const accessKeyRequested = (env = process.env) => {
  if (env.CREATE_IAM_ACCESS_KEY !== "true") {
    return false;
  }
  if (env.CONFIRM_CREATE_ACCESS_KEY !== ACCESS_KEY_CONFIRM) {
    throw new Error(
      "CREATE_IAM_ACCESS_KEY=true also requires CONFIRM_CREATE_ACCESS_KEY=I_UNDERSTAND_LONG_LIVED_KEYS"
    );
  }
  return true;
};

const asAccount = (value) => (ACCOUNT_RE.test(String(value || "")) ? String(value) : null);
const asKeyId = (value) =>
  typeof value === "string" && /^[0-9a-f-]{8,64}$/i.test(value) ? value : null;
const asKeyArn = (value) =>
  typeof value === "string" && /^arn:aws:kms:[a-z0-9-]+:\d{12}:key\/[0-9a-f-]+$/i.test(value)
    ? value
    : null;

const aws = (args, { json = true, region } = {}) => {
  const argv = [...args];
  if (json) {
    argv.push("--output", "json");
  }
  if (region) {
    argv.push("--region", region);
  }
  let stdout = "";
  try {
    stdout = execFileSync(awsBin, argv, {
      encoding: "utf8",
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env
    });
  } catch (error) {
    const stderr = redact(error?.stderr || error?.message || "aws failed");
    throw new Error(stderr.trim() || "aws failed");
  }
  const text = String(stdout || "").trim();
  if (!json || !text) {
    return text;
  }
  return JSON.parse(text);
};

const runSelfTest = () => {
  const cases = [];
  const check = (name, fn) => {
    try {
      fn();
      cases.push({ name, ok: true });
    } catch (error) {
      cases.push({ name, ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  };

  check("region accepts eu-west-1", () => {
    if (validateRegion("eu-west-1") !== "eu-west-1") throw new Error("mismatch");
  });
  check("region rejects injection", () => {
    try {
      validateRegion("eu-west-1; rm -rf /");
      throw new Error("accepted");
    } catch (error) {
      if (String(error.message).includes("accepted")) throw error;
    }
  });
  check("alias rejects traversal", () => {
    try {
      validateAlias("alias/../admin");
      throw new Error("accepted");
    } catch (error) {
      if (String(error.message).includes("accepted")) throw error;
    }
  });
  check("iam user rejects spaces", () => {
    try {
      validateIamUser("gridflex kms");
      throw new Error("accepted");
    } catch (error) {
      if (String(error.message).includes("accepted")) throw error;
    }
  });
  check("output path confined", () => {
    try {
      confineOutputPath("../secrets.json", "aws-kms-bootstrap.json");
      throw new Error("accepted");
    } catch (error) {
      if (String(error.message).includes("accepted")) throw error;
    }
  });
  check("redact access key id", () => {
    const out = redact("id AKIAIOSFODNN7EXAMPLE leftover");
    if (out.includes("AKIAIOSFODNN7EXAMPLE")) throw new Error("not redacted");
  });
  check("access key dual confirm", () => {
    try {
      accessKeyRequested({ CREATE_IAM_ACCESS_KEY: "true" });
      throw new Error("accepted");
    } catch (error) {
      if (String(error.message).includes("accepted")) throw error;
    }
    if (accessKeyRequested({ CREATE_IAM_ACCESS_KEY: "true", CONFIRM_CREATE_ACCESS_KEY: ACCESS_KEY_CONFIRM }) !== true) {
      throw new Error("dual confirm failed");
    }
  });

  const failed = cases.filter((item) => !item.ok);
  console.log(JSON.stringify({ selfTest: true, pass: failed.length === 0, cases }, null, 2));
  process.exit(failed.length === 0 ? 0 : 1);
};

if (process.argv.includes("--self-test")) {
  runSelfTest();
}

const allow = process.env.BOOTSTRAP_AWS_KMS_ALLOW === "true";
if (!allow) {
  console.error("Refusing to run without BOOTSTRAP_AWS_KMS_ALLOW=true");
  process.exit(2);
}

const dryRun = process.env.DRY_RUN === "true";
const region = validateRegion(process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "eu-west-1");
const aliasName = validateAlias(process.env.KMS_KEY_ALIAS || "alias/gridflex-device-secrets");
const iamUser = validateIamUser(process.env.KMS_IAM_USER || "gridflex-kms-vault");
const expectedAccount = (process.env.EXPECTED_AWS_ACCOUNT_ID || "").trim();
if (expectedAccount && !ACCOUNT_RE.test(expectedAccount)) {
  throw new Error("EXPECTED_AWS_ACCOUNT_ID must be a 12-digit account id");
}
const createAccessKey = accessKeyRequested();
const outFile = confineOutputPath(process.env.KMS_BOOTSTRAP_OUTPUT, "aws-kms-bootstrap.json");
const secretOutFile = confineOutputPath(undefined, "aws-kms-bootstrap.access-key.json");

const writeReport = async (report) => {
  await fs.mkdir(REPORTS_DIR, { recursive: true });
  const safe = {
    ...report,
    blockers: (report.blockers || []).map(redact)
  };
  await fs.writeFile(outFile, `${JSON.stringify(safe, null, 2)}\n`, "utf8");
};

const main = async () => {
  const report = {
    generatedAt: new Date().toISOString(),
    dryRun,
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
    identity = aws(["sts", "get-caller-identity"], { json: true, region });
    const account = asAccount(identity.Account);
    if (!account) {
      throw new Error("sts returned an unexpected account id");
    }
    identity.Account = account;
    report.steps.push({ step: "sts.get-caller-identity", ok: true, account });
    if (expectedAccount && identity.Account !== expectedAccount) {
      throw new Error(`AWS account ${identity.Account} does not match EXPECTED_AWS_ACCOUNT_ID`);
    }
  } catch (error) {
    report.blockers.push(
      `No usable AWS credentials (${error instanceof Error ? error.message : String(error)}). Run aws configure or set AWS_ACCESS_KEY_ID/SECRET.`
    );
    await writeReport(report);
    console.log(JSON.stringify({ pass: false, blockers: report.blockers, reportPath: outFile }, null, 2));
    process.exit(2);
  }

  const accountId = identity.Account;
  let keyId;
  let keyArn;

  try {
    const existing = aws(["kms", "list-aliases"], { json: true, region });
    const hit = (existing.Aliases || []).find((a) => a.AliasName === aliasName);
    if (hit?.TargetKeyId) {
      keyId = asKeyId(hit.TargetKeyId);
      const desc = aws(["kms", "describe-key", "--key-id", keyId], { json: true, region });
      keyArn = asKeyArn(desc.KeyMetadata.Arn);
      if (!keyId || !keyArn) {
        throw new Error("KMS describe-key returned unexpected identifiers");
      }
      report.steps.push({ step: "kms.reuse-alias", ok: true, keyId });
    } else if (dryRun) {
      report.steps.push({ step: "kms.create-key+alias", ok: true, dryRun: true });
    } else {
      const created = aws(
        [
          "kms",
          "create-key",
          "--description",
          "GridFlex device HMAC vault",
          "--key-usage",
          "ENCRYPT_DECRYPT",
          "--origin",
          "AWS_KMS"
        ],
        { json: true, region }
      );
      keyId = asKeyId(created.KeyMetadata.KeyId);
      keyArn = asKeyArn(created.KeyMetadata.Arn);
      if (!keyId || !keyArn) {
        throw new Error("KMS create-key returned unexpected identifiers");
      }
      aws(["kms", "create-alias", "--alias-name", aliasName, "--target-key-id", keyId], {
        json: false,
        region
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
        Resource: keyArn || "arn:aws:kms:*:*:key/*"
      }
    ]
  };

  try {
    if (dryRun) {
      report.steps.push({ step: "iam.user+policy", ok: true, dryRun: true, policyName });
    } else {
      try {
        aws(["iam", "get-user", "--user-name", iamUser], { json: true, region });
        report.steps.push({ step: "iam.user.exists", ok: true });
      } catch {
        aws(["iam", "create-user", "--user-name", iamUser], { json: true, region });
        report.steps.push({ step: "iam.user.created", ok: true });
      }

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
        { json: false, region }
      );
      report.steps.push({ step: "iam.put-user-policy", ok: true, policyName });

      if (createAccessKey) {
        const key = aws(["iam", "create-access-key", "--user-name", iamUser], { json: true, region });
        const material = {
          generatedAt: new Date().toISOString(),
          warning: "Copy into Render secrets then delete this file. Never commit.",
          UserName: key.AccessKey.UserName,
          AccessKeyId: key.AccessKey.AccessKeyId,
          SecretAccessKey: key.AccessKey.SecretAccessKey,
          AWS_REGION: region,
          AWS_KMS_KEY_ID: keyArn
        };
        await fs.mkdir(REPORTS_DIR, { recursive: true });
        await fs.writeFile(secretOutFile, `${JSON.stringify(material, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
        report.steps.push({
          step: "iam.create-access-key",
          ok: true,
          accessKeyIdLast4: String(key.AccessKey.AccessKeyId).slice(-4)
        });
      }
    }
  } catch (error) {
    report.blockers.push(`IAM setup failed: ${error instanceof Error ? error.message : String(error)}`);
    await writeReport(report);
    process.exit(1);
  }

  report.renderEnv = {
    DEVICE_SECRET_VAULT_PROVIDER: "aws_kms",
    AWS_KMS_KEY_ID: keyArn || "(created on apply)",
    AWS_REGION: region,
    AWS_ACCESS_KEY_ID: createAccessKey ? "(one-time file under go-live-reports/; never commit)" : "(prefer IAM role; else create access key with dual confirm)",
    AWS_SECRET_ACCESS_KEY: "(secret manager — never commit)"
  };
  report.pass = report.blockers.length === 0;
  report.nextActions = [
    "Set Render backend env from report.renderEnv (never commit secrets)",
    "Delete go-live-reports/aws-kms-bootstrap.access-key.json after copying to Render if created",
    "Redeploy backend; require log event device_secret_vault.round_trip_ok",
    "ROUND_TRIP=true DEVICE_SECRET_VAULT_PROVIDER=aws_kms AWS_KMS_KEY_ID=... npm run verify:kms-readiness",
    "Record fingerprints only in docs/runbooks/credential-rotation-rehearsal.md"
  ];
  report.accountId = accountId;
  report.keyId = keyId || null;
  report.keyArn = keyArn || null;

  await writeReport(report);
  console.log(
    JSON.stringify(
      {
        pass: report.pass,
        dryRun,
        keyArn: keyArn || null,
        region,
        iamUser,
        accessKeyCreated: Boolean(createAccessKey && !dryRun),
        reportPath: outFile,
        blockers: report.blockers
      },
      null,
      2
    )
  );
  process.exit(report.pass ? 0 : 1);
};

main().catch((error) => {
  console.error(redact(error instanceof Error ? error.message : String(error)));
  process.exit(1);
});
