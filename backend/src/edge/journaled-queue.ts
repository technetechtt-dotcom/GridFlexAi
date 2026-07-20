/**
 * Host mirror of firmware journaled dual-meta queue for power-loss stage tests.
 */
export type JournalOp = "enqueue" | "ack" | "retry" | null;

export type JournaledRecord = {
  messageId: string;
  sequenceNumber: number;
  measuredAt: string;
  payload: Record<string, unknown>;
  retryCount: number;
};

type Meta = {
  gen: number;
  head: number;
  tail: number;
  count: number;
  nextSequence: number;
};

export class JournaledStoreAndForwardQueue {
  readonly slots: Map<number, JournaledRecord> = new Map();
  metaA: Meta | null = null;
  metaB: Meta | null = null;
  journal: {
    op: JournalOp;
    slot: number;
    sequence: number;
    count: number;
    tail: number;
    nextSequence: number;
    head: number;
  } | null = null;
  private active: "a" | "b" = "a";
  private readonly maxRecords: number;

  constructor(maxRecords = 100) {
    this.maxRecords = maxRecords;
    this.metaA = { gen: 1, head: 0, tail: 0, count: 0, nextSequence: 1 };
  }

  get meta(): Meta {
    const a = this.metaA;
    const b = this.metaB;
    if (a && (!b || a.gen >= b.gen)) return a;
    if (b) return b;
    return { gen: 0, head: 0, tail: 0, count: 0, nextSequence: 1 };
  }

  get depth(): number {
    return this.meta.count;
  }

  /** Simulate crash after writing journal, before data (enqueue). */
  beginEnqueueJournal(payload: Record<string, unknown>, measuredAt: string, messageId: string): void {
    const m = this.meta;
    if (m.count >= this.maxRecords) throw new Error("full");
    this.journal = {
      op: "enqueue",
      slot: m.tail,
      sequence: m.nextSequence,
      count: m.count + 1,
      tail: (m.tail + 1) % this.maxRecords,
      nextSequence: m.nextSequence + 1,
      head: m.head
    };
    this._pending = { messageId, sequenceNumber: m.nextSequence, measuredAt, payload, retryCount: 0 };
  }

  private _pending: JournaledRecord | null = null;

  /** Complete data write after journal (or crash before calling). */
  completeEnqueueData(): void {
    if (!this.journal || this.journal.op !== "enqueue" || !this._pending) {
      throw new Error("no enqueue journal");
    }
    this.slots.set(this.journal.slot, { ...this._pending });
  }

  commitMetaFromJournal(): void {
    if (!this.journal) throw new Error("no journal");
    const j = this.journal;
    const next: Meta = {
      gen: this.meta.gen + 1,
      head: j.head,
      tail: j.tail,
      count: j.count,
      nextSequence: j.nextSequence
    };
    if (this.active === "a") {
      this.metaB = next;
      this.active = "b";
    } else {
      this.metaA = next;
      this.active = "a";
    }
  }

  clearJournal(): void {
    this.journal = null;
    this._pending = null;
  }

  /** Boot recovery — mirrors firmware recoverJournal. */
  recoverAfterCrash(): void {
    if (!this.journal) return;
    const j = this.journal;
    if (j.op === "enqueue") {
      const rec = this.slots.get(j.slot);
      if (rec && rec.sequenceNumber === j.sequence) {
        this.commitMetaFromJournal();
      } else {
        this.slots.delete(j.slot);
      }
    } else if (j.op === "ack") {
      this.commitMetaFromJournal();
      this.slots.delete(j.slot);
    }
    this.clearJournal();
  }

  enqueue(payload: Record<string, unknown>, measuredAt: string, messageId: string): void {
    this.beginEnqueueJournal(payload, measuredAt, messageId);
    this.completeEnqueueData();
    this.commitMetaFromJournal();
    this.clearJournal();
  }

  peek(): JournaledRecord | null {
    const m = this.meta;
    if (m.count === 0) return null;
    return this.slots.get(m.head) ?? null;
  }

  acknowledge(sequence: number): boolean {
    const head = this.peek();
    if (!head || head.sequenceNumber !== sequence) return false;
    const m = this.meta;
    const oldHead = m.head;
    this.journal = {
      op: "ack",
      slot: oldHead,
      sequence,
      count: m.count - 1,
      tail: m.tail,
      nextSequence: m.nextSequence,
      head: (oldHead + 1) % this.maxRecords
    };
    this.commitMetaFromJournal();
    this.slots.delete(oldHead);
    this.clearJournal();
    return true;
  }
}
