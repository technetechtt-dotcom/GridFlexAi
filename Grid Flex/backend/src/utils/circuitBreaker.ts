type CircuitState = "closed" | "open" | "half-open";

type CircuitBreakerConfig = {
  failureThreshold: number;
  openMs: number;
  onStateChange?: (state: CircuitState, failures: number) => void;
};

type CircuitMetrics = {
  failures: number;
  state: CircuitState;
  openedAt: number | null;
};

export type CircuitBreakerSnapshot = {
  failures: number;
  state: CircuitState;
  openedAt: number | null;
  nextAttemptInMs: number;
};

export class CircuitBreaker {
  private readonly failureThreshold: number;
  private readonly openMs: number;
  private readonly onStateChange: ((state: CircuitState, failures: number) => void) | undefined;
  private metrics: CircuitMetrics;

  constructor(config: CircuitBreakerConfig) {
    this.failureThreshold = config.failureThreshold;
    this.openMs = config.openMs;
    this.onStateChange = config.onStateChange;
    this.metrics = {
      failures: 0,
      state: "closed",
      openedAt: null
    };
  }

  public canExecute(): boolean {
    if (this.metrics.state === "closed") {
      return true;
    }

    if (this.metrics.state === "open") {
      const now = Date.now();
      const openedAt = this.metrics.openedAt ?? now;
      if (now - openedAt >= this.openMs) {
        this.setState("half-open", this.metrics.failures, this.metrics.openedAt);
        return true;
      }
      return false;
    }

    return true;
  }

  public onSuccess(): void {
    this.setState("closed", 0, null);
  }

  public onFailure(): void {
    const failures = this.metrics.failures + 1;
    if (failures >= this.failureThreshold || this.metrics.state === "half-open") {
      this.setState("open", failures, Date.now());
      return;
    }

    this.metrics = {
      ...this.metrics,
      failures
    };
  }

  public snapshot(): CircuitBreakerSnapshot {
    const now = Date.now();
    const openedAt = this.metrics.openedAt;
    const nextAttemptInMs =
    this.metrics.state === "open" && openedAt !== null ?
    Math.max(0, this.openMs - (now - openedAt)) :
    0;

    return {
      failures: this.metrics.failures,
      state: this.metrics.state,
      openedAt,
      nextAttemptInMs
    };
  }

  private setState(state: CircuitState, failures: number, openedAt: number | null): void {
    const hasStateChanged = this.metrics.state !== state;
    this.metrics = {
      failures,
      state,
      openedAt
    };

    if (hasStateChanged && this.onStateChange) {
      this.onStateChange(state, failures);
    }
  }
}
