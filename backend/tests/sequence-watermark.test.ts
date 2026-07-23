/**
 * Sequence watermark monotonicity / restart / overflow behaviour via auth middleware helpers.
 * Full HTTP route coverage remains in edge-auth-v1.routes.test.ts.
 */
import { parseSequenceNumber, SEQUENCE_INT4_MAX, sequenceLessThan } from "../src/utils/sequence-number.js";

describe("sequence watermark monotonicity", () => {
  it("rejects regressions after a restart watermark", () => {
    const last = parseSequenceNumber(SEQUENCE_INT4_MAX + 10n);
    const nextOk = last + 1n;
    const regression = last - 1n;
    expect(sequenceLessThan(regression, last)).toBe(true);
    expect(sequenceLessThan(nextOk, last)).toBe(false);
  });

  it("treats equal sequences as idempotent candidates (not regression)", () => {
    const last = 100n;
    expect(sequenceLessThan(last, last)).toBe(false);
  });

  it("survives INT4 boundary crossing for monotonic advance", () => {
    const last = SEQUENCE_INT4_MAX;
    const next = SEQUENCE_INT4_MAX + 1n;
    expect(sequenceLessThan(last, next)).toBe(true);
    expect(parseSequenceNumber(next.toString())).toBe(next);
  });
});
