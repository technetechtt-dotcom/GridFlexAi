/**
 * In-process counters + Prometheus text exposition.
 * Label cardinality is intentionally low (no deviceId / organisationId labels).
 */

export type RouteMetrics = {
  path: string;
  method: string;
  count: number;
  error4xx: number;
  error5xx: number;
  totalLatencyMs: number;
};

export type PlatformMetricsSnapshot = {
  startedAt: string;
  totalRequests: number;
  totalError4xx: number;
  totalError5xx: number;
  avgLatencyMs: number;
  routes: RouteMetrics[];
  socketConnections: number;
  ingestAccepted: number;
  ingestRejected: number;
  signatureFailures: number;
  replayAttempts: number;
  redisAvailable: boolean | null;
  forecastProviderErrors: number;
  alarmGenerated: number;
  optimisationDurationMsTotal: number;
  optimisationRuns: number;
  physicalSafetyViolations: number;
  processRssBytes: number;
  processHeapUsedBytes: number;
};

class PlatformMetrics {
  private readonly startedAt = new Date();
  private readonly routes = new Map<string, RouteMetrics>();
  private totalRequests = 0;
  private totalError4xx = 0;
  private totalError5xx = 0;
  private totalLatencyMs = 0;
  private socketConnections = 0;
  private latencySamples: number[] = [];
  private ingestAccepted = 0;
  private ingestRejected = 0;
  private signatureFailures = 0;
  private replayAttempts = 0;
  private redisAvailable: boolean | null = null;
  private forecastProviderErrors = 0;
  private alarmGenerated = 0;
  private optimisationDurationMsTotal = 0;
  private optimisationRuns = 0;
  private physicalSafetyViolations = 0;
  private dbQueryMsTotal = 0;
  private dbQueryCount = 0;

  private routeKey(method: string, path: string): string {
    return `${method.toUpperCase()} ${path}`;
  }

  /** Collapse high-cardinality path segments (ids) for metric labels. */
  normalizePath(path: string): string {
    return path
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi, "/:id")
      .replace(/\/c[a-z0-9]{20,}/gi, "/:id")
      .replace(/\/\d+/g, "/:id");
  }

  recordRequest(method: string, path: string, statusCode: number, latencyMs: number): void {
    const normalized = this.normalizePath(path);
    this.totalRequests += 1;
    this.totalLatencyMs += latencyMs;
    this.latencySamples.push(latencyMs);
    if (this.latencySamples.length > 2000) {
      this.latencySamples = this.latencySamples.slice(-1000);
    }

    if (statusCode >= 400 && statusCode < 500) {
      this.totalError4xx += 1;
    } else if (statusCode >= 500) {
      this.totalError5xx += 1;
    }

    const key = this.routeKey(method, normalized);
    let metrics = this.routes.get(key);
    if (!metrics) {
      metrics = {
        path: normalized,
        method: method.toUpperCase(),
        count: 0,
        error4xx: 0,
        error5xx: 0,
        totalLatencyMs: 0
      };
      this.routes.set(key, metrics);
    }

    metrics.count += 1;
    metrics.totalLatencyMs += latencyMs;
    if (statusCode >= 400 && statusCode < 500) {
      metrics.error4xx += 1;
    } else if (statusCode >= 500) {
      metrics.error5xx += 1;
    }
  }

  incrementSocketConnections(): void {
    this.socketConnections += 1;
  }

  decrementSocketConnections(): void {
    if (this.socketConnections > 0) {
      this.socketConnections -= 1;
    }
  }

  recordIngestAccepted(): void {
    this.ingestAccepted += 1;
  }

  recordIngestRejected(): void {
    this.ingestRejected += 1;
  }

  recordSignatureFailure(): void {
    this.signatureFailures += 1;
  }

  recordReplayAttempt(): void {
    this.replayAttempts += 1;
  }

  setRedisAvailable(ok: boolean): void {
    this.redisAvailable = ok;
  }

  recordForecastProviderError(): void {
    this.forecastProviderErrors += 1;
  }

  recordAlarmGenerated(): void {
    this.alarmGenerated += 1;
  }

  recordOptimisation(durationMs: number): void {
    this.optimisationRuns += 1;
    this.optimisationDurationMsTotal += durationMs;
  }

  recordPhysicalSafetyViolation(): void {
    this.physicalSafetyViolations += 1;
  }

  recordDbQuery(durationMs: number): void {
    this.dbQueryCount += 1;
    this.dbQueryMsTotal += durationMs;
  }

  percentileLatency(p: number): number {
    if (this.latencySamples.length === 0) return 0;
    const sorted = [...this.latencySamples].sort((a, b) => a - b);
    const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
    return Number(sorted[idx]!.toFixed(2));
  }

  snapshot(): PlatformMetricsSnapshot {
    const totalRequests = this.totalRequests || 1;
    const mem = process.memoryUsage();

    return {
      startedAt: this.startedAt.toISOString(),
      totalRequests: this.totalRequests,
      totalError4xx: this.totalError4xx,
      totalError5xx: this.totalError5xx,
      avgLatencyMs: Number((this.totalLatencyMs / totalRequests).toFixed(2)),
      routes: Array.from(this.routes.values()).map((route) => ({
        ...route,
        totalLatencyMs: Number(route.totalLatencyMs.toFixed(2))
      })),
      socketConnections: this.socketConnections,
      ingestAccepted: this.ingestAccepted,
      ingestRejected: this.ingestRejected,
      signatureFailures: this.signatureFailures,
      replayAttempts: this.replayAttempts,
      redisAvailable: this.redisAvailable,
      forecastProviderErrors: this.forecastProviderErrors,
      alarmGenerated: this.alarmGenerated,
      optimisationDurationMsTotal: this.optimisationDurationMsTotal,
      optimisationRuns: this.optimisationRuns,
      physicalSafetyViolations: this.physicalSafetyViolations,
      processRssBytes: mem.rss,
      processHeapUsedBytes: mem.heapUsed
    };
  }

  /** Prometheus exposition format (no high-cardinality labels). */
  toPrometheus(): string {
    const s = this.snapshot();
    const lines: string[] = [
      "# HELP gridflex_http_requests_total Total HTTP requests",
      "# TYPE gridflex_http_requests_total counter",
      `gridflex_http_requests_total ${s.totalRequests}`,
      "# HELP gridflex_http_errors_4xx_total HTTP 4xx responses",
      "# TYPE gridflex_http_errors_4xx_total counter",
      `gridflex_http_errors_4xx_total ${s.totalError4xx}`,
      "# HELP gridflex_http_errors_5xx_total HTTP 5xx responses",
      "# TYPE gridflex_http_errors_5xx_total counter",
      `gridflex_http_errors_5xx_total ${s.totalError5xx}`,
      "# HELP gridflex_http_latency_ms_avg Average HTTP latency milliseconds",
      "# TYPE gridflex_http_latency_ms_avg gauge",
      `gridflex_http_latency_ms_avg ${s.avgLatencyMs}`,
      "# HELP gridflex_http_latency_ms_p95 Approximate p95 HTTP latency",
      "# TYPE gridflex_http_latency_ms_p95 gauge",
      `gridflex_http_latency_ms_p95 ${this.percentileLatency(95)}`,
      "# HELP gridflex_ingest_accepted_total Edge ingest accepted",
      "# TYPE gridflex_ingest_accepted_total counter",
      `gridflex_ingest_accepted_total ${s.ingestAccepted}`,
      "# HELP gridflex_ingest_rejected_total Edge ingest rejected",
      "# TYPE gridflex_ingest_rejected_total counter",
      `gridflex_ingest_rejected_total ${s.ingestRejected}`,
      "# HELP gridflex_signature_failures_total Edge signature failures",
      "# TYPE gridflex_signature_failures_total counter",
      `gridflex_signature_failures_total ${s.signatureFailures}`,
      "# HELP gridflex_replay_attempts_total Edge nonce replay attempts",
      "# TYPE gridflex_replay_attempts_total counter",
      `gridflex_replay_attempts_total ${s.replayAttempts}`,
      "# HELP gridflex_socket_connections Current Socket.IO connections",
      "# TYPE gridflex_socket_connections gauge",
      `gridflex_socket_connections ${s.socketConnections}`,
      "# HELP gridflex_forecast_provider_errors_total Forecast provider errors",
      "# TYPE gridflex_forecast_provider_errors_total counter",
      `gridflex_forecast_provider_errors_total ${s.forecastProviderErrors}`,
      "# HELP gridflex_alarms_generated_total Alarms generated",
      "# TYPE gridflex_alarms_generated_total counter",
      `gridflex_alarms_generated_total ${s.alarmGenerated}`,
      "# HELP gridflex_optimisation_duration_ms_total Optimisation duration sum",
      "# TYPE gridflex_optimisation_duration_ms_total counter",
      `gridflex_optimisation_duration_ms_total ${s.optimisationDurationMsTotal}`,
      "# HELP gridflex_physical_safety_violations_total Physical execution safety violations",
      "# TYPE gridflex_physical_safety_violations_total counter",
      `gridflex_physical_safety_violations_total ${s.physicalSafetyViolations}`,
      "# HELP gridflex_process_resident_memory_bytes Process RSS",
      "# TYPE gridflex_process_resident_memory_bytes gauge",
      `gridflex_process_resident_memory_bytes ${s.processRssBytes}`,
      "# HELP gridflex_process_heap_used_bytes Process heap used",
      "# TYPE gridflex_process_heap_used_bytes gauge",
      `gridflex_process_heap_used_bytes ${s.processHeapUsedBytes}`,
      "# HELP gridflex_db_query_ms_avg Average recorded DB query latency",
      "# TYPE gridflex_db_query_ms_avg gauge",
      `gridflex_db_query_ms_avg ${this.dbQueryCount ? Number((this.dbQueryMsTotal / this.dbQueryCount).toFixed(2)) : 0}`,
      "# HELP gridflex_redis_up Redis availability (1=up,0=down,-1=unknown)",
      "# TYPE gridflex_redis_up gauge",
      `gridflex_redis_up ${s.redisAvailable === null ? -1 : s.redisAvailable ? 1 : 0}`
    ];

    for (const route of s.routes) {
      const labels = `method="${route.method}",path="${route.path.replace(/"/g, "")}"`;
      lines.push(`gridflex_http_route_requests_total{${labels}} ${route.count}`);
    }

    return `${lines.join("\n")}\n`;
  }
}

export const platformMetrics = new PlatformMetrics();
