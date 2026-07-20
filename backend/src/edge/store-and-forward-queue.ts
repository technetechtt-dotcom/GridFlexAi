/**
 * Host-side contract mirror of the ESP32 LittleFS store-and-forward queue.
 * Used in CI to prove: measure → enqueue → upload → ACK-only delete,
 * exponential backoff with jitter, storage limits, no silent overwrite.
 */

export type QueuedTelemetryRecord = {
  messageId: string;
  sequenceNumber: number;
  measuredAt: string;
  payload: Record<string, unknown>;
  retryCount: number;
};

export type PersistentQueueOptions = {
  maxRecords: number;
  baseBackoffMs?: number;
  maxBackoffMs?: number;
};

export class PersistentStoreAndForwardQueue {
  private readonly records: QueuedTelemetryRecord[] = [];
  private readonly maxRecords: number;
  private readonly baseBackoffMs: number;
  private readonly maxBackoffMs: number;
  private nextSequence = 1;

  constructor(options: PersistentQueueOptions) {
    this.maxRecords = options.maxRecords;
    this.baseBackoffMs = options.baseBackoffMs ?? 1_000;
    this.maxBackoffMs = options.maxBackoffMs ?? 300_000;
  }

  get depth(): number {
    return this.records.length;
  }

  get sequenceCursor(): number {
    return this.nextSequence;
  }

  /** Restore cursor after reboot (persisted separately on device). */
  restoreSequenceCursor(next: number): void {
    if (!Number.isSafeInteger(next) || next < 1) {
      throw new Error("Invalid sequence cursor.");
    }
    this.nextSequence = next;
  }

  /**
   * Enqueue a local measurement. Never overwrites unsent records —
   * rejects when the queue is full.
   */
  enqueue(payload: Record<string, unknown>, measuredAtIso: string, messageId: string): QueuedTelemetryRecord {
    if (this.records.length >= this.maxRecords) {
      throw new Error("Persistent queue full — refusing to overwrite unsent records.");
    }
    const record: QueuedTelemetryRecord = {
      messageId,
      sequenceNumber: this.nextSequence,
      measuredAt: measuredAtIso,
      payload: { ...payload },
      retryCount: 0
    };
    this.nextSequence += 1;
    this.records.push(record);
    return record;
  }

  peek(): QueuedTelemetryRecord | null {
    return this.records[0] ?? null;
  }

  /** Remove head only after server acknowledgement of that sequence. */
  acknowledge(sequenceNumber: number): boolean {
    const head = this.records[0];
    if (!head || head.sequenceNumber !== sequenceNumber) {
      return false;
    }
    this.records.shift();
    return true;
  }

  markUploadFailure(): number {
    const head = this.records[0];
    if (!head) return 0;
    head.retryCount += 1;
    return this.computeBackoffMs(head.retryCount);
  }

  computeBackoffMs(retryCount: number, random: () => number = Math.random): number {
    const exp = Math.min(this.maxBackoffMs, this.baseBackoffMs * 2 ** Math.max(0, retryCount - 1));
    const jitter = Math.floor(random() * Math.max(1, exp * 0.2));
    return Math.min(this.maxBackoffMs, exp + jitter);
  }

  /** Simulate reboot persistence — returns a deep copy of remaining records. */
  snapshotForReboot(): QueuedTelemetryRecord[] {
    return this.records.map((r) => ({
      ...r,
      payload: { ...r.payload }
    }));
  }

  loadAfterReboot(snapshot: QueuedTelemetryRecord[], nextSequence: number): void {
    this.records.length = 0;
    for (const record of snapshot) {
      this.records.push({
        ...record,
        payload: { ...record.payload }
      });
    }
    this.restoreSequenceCursor(nextSequence);
  }
}
