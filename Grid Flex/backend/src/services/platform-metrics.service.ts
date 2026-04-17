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
};

class PlatformMetrics {
  private readonly startedAt = new Date();
  private readonly routes = new Map<string, RouteMetrics>();
  private totalRequests = 0;
  private totalError4xx = 0;
  private totalError5xx = 0;
  private totalLatencyMs = 0;
  private socketConnections = 0;

  private routeKey(method: string, path: string): string {
    return `${method.toUpperCase()} ${path}`;
  }

  recordRequest(method: string, path: string, statusCode: number, latencyMs: number): void {
    this.totalRequests += 1;
    this.totalLatencyMs += latencyMs;

    if (statusCode >= 400 && statusCode < 500) {
      this.totalError4xx += 1;
    } else if (statusCode >= 500) {
      this.totalError5xx += 1;
    }

    const key = this.routeKey(method, path);
    let metrics = this.routes.get(key);
    if (!metrics) {
      metrics = {
        path,
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

  snapshot(): PlatformMetricsSnapshot {
    const totalRequests = this.totalRequests || 1;

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
      socketConnections: this.socketConnections
    };
  }
}

export const platformMetrics = new PlatformMetrics();

