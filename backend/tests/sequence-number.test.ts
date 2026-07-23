import {
  parseSequenceNumber,
  SEQUENCE_INT4_MAX,
  SEQUENCE_MAX,
  SequenceNumberError,
  sequenceLessThan,
  sequenceToCanonicalString,
  sequenceToJson,
  sequencesEqual
} from "../src/utils/sequence-number.js";
import { buildGridFlexV1Canonical } from "../src/utils/edgeDeviceAuth.js";

describe("sequence-number BIGINT helpers", () => {
  it("parses zero and small integers", () => {
    expect(parseSequenceNumber("0")).toBe(0n);
    expect(parseSequenceNumber(0)).toBe(0n);
    expect(parseSequenceNumber(42)).toBe(42n);
  });

  it("accepts values above INT4 max", () => {
    const above = SEQUENCE_INT4_MAX + 1n;
    expect(parseSequenceNumber(above.toString())).toBe(above);
    expect(sequenceToCanonicalString(above)).toBe("2147483648");
  });

  it("accepts BIGINT max and rejects overflow", () => {
    expect(parseSequenceNumber(SEQUENCE_MAX.toString())).toBe(SEQUENCE_MAX);
    expect(() => parseSequenceNumber((SEQUENCE_MAX + 1n).toString())).toThrow(SequenceNumberError);
  });

  it("rejects negatives, floats, and leading zeros", () => {
    expect(() => parseSequenceNumber("-1")).toThrow(SequenceNumberError);
    expect(() => parseSequenceNumber("1.5")).toThrow(SequenceNumberError);
    expect(() => parseSequenceNumber("01")).toThrow(SequenceNumberError);
    expect(() => parseSequenceNumber("abc")).toThrow(SequenceNumberError);
  });

  it("compares and encodes for JSON safely", () => {
    expect(sequenceLessThan(1, 2)).toBe(true);
    expect(sequencesEqual(SEQUENCE_INT4_MAX + 1n, "2147483648")).toBe(true);
    expect(sequenceToJson(42n)).toBe(42);
    expect(sequenceToJson(BigInt(Number.MAX_SAFE_INTEGER) + 1n)).toBe(
      (BigInt(Number.MAX_SAFE_INTEGER) + 1n).toString()
    );
    expect(sequenceToJson(SEQUENCE_INT4_MAX + 1n)).toBe(Number(SEQUENCE_INT4_MAX + 1n));
  });

  it("keeps GRIDFLEX-V1 canonical decimal form for large sequences", () => {
    const large = SEQUENCE_INT4_MAX + 99n;
    const canonical = buildGridFlexV1Canonical({
      deviceId: "dev-1",
      credentialId: "cred-1",
      keyVersion: 1,
      timestamp: "1700000000000",
      nonce: "abc",
      sequenceNumber: large,
      rawBody: Buffer.from("{}", "utf8")
    });
    expect(canonical.split("\n")[6]).toBe(large.toString());
  });
});
