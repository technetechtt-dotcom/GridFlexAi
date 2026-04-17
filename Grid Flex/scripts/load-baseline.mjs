const baseUrl = process.env.LOAD_BASE_URL ?? "http://localhost:4000";
const endpoint = process.env.LOAD_PATH ?? "/api/health/live";
const totalRequests = Number.parseInt(process.env.LOAD_REQUESTS ?? "200", 10);
const concurrency = Number.parseInt(process.env.LOAD_CONCURRENCY ?? "20", 10);
const timeoutMs = Number.parseInt(process.env.LOAD_TIMEOUT_MS ?? "10000", 10);
const p95BudgetMs = Number.parseInt(process.env.LOAD_P95_BUDGET_MS ?? "500", 10);
const token = process.env.LOAD_BEARER_TOKEN ?? "";

if (!Number.isFinite(totalRequests) || totalRequests <= 0) {
  throw new Error("LOAD_REQUESTS must be a positive integer.");
}
if (!Number.isFinite(concurrency) || concurrency <= 0) {
  throw new Error("LOAD_CONCURRENCY must be a positive integer.");
}

const targetUrl = new URL(endpoint, baseUrl).toString();

const timings = [];
let failed = 0;
let issued = 0;

const runOne = async () => {
  const started = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(targetUrl, {
      method: "GET",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      signal: controller.signal
    });
    if (!res.ok) {
      failed += 1;
    }
  } catch (_error) {
    failed += 1;
  } finally {
    clearTimeout(timeout);
    timings.push(performance.now() - started);
  }
};

const worker = async () => {
  while (true) {
    if (issued >= totalRequests) {
      return;
    }
    issued += 1;
    await runOne();
  }
};

const startedAt = performance.now();
await Promise.all(Array.from({ length: Math.min(concurrency, totalRequests) }, () => worker()));
const elapsedMs = performance.now() - startedAt;

const sorted = [...timings].sort((a, b) => a - b);
const percentile = (p) => {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index] ?? 0;
};

const successful = totalRequests - failed;
const p50 = percentile(50);
const p95 = percentile(95);
const p99 = percentile(99);
const avg = sorted.length > 0 ? sorted.reduce((sum, value) => sum + value, 0) / sorted.length : 0;
const rps = elapsedMs > 0 ? (totalRequests / elapsedMs) * 1000 : 0;

console.log("Load baseline complete");
console.log(`- Target: ${targetUrl}`);
console.log(`- Requests: ${totalRequests} (${successful} ok, ${failed} failed)`);
console.log(`- Concurrency: ${Math.min(concurrency, totalRequests)}`);
console.log(`- Throughput: ${rps.toFixed(2)} req/s`);
console.log(`- Avg: ${avg.toFixed(2)} ms`);
console.log(`- p50: ${p50.toFixed(2)} ms`);
console.log(`- p95: ${p95.toFixed(2)} ms`);
console.log(`- p99: ${p99.toFixed(2)} ms`);
console.log(`- p95 budget (${p95BudgetMs} ms): ${p95 <= p95BudgetMs ? "PASS" : "FAIL"}`);

if (p95 > p95BudgetMs || failed > 0) {
  process.exitCode = 1;
}
