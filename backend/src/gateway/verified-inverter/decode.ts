import type { DecodedRegisterValue, ModbusWordOrder, RegisterDataType, RegisterDefinition } from "./types.js";

const reorderWords = (words: number[], order: ModbusWordOrder): number[] => {
  if (words.length === 1) {
    return words;
  }
  if (words.length !== 2) {
    throw new Error(`Unsupported register length ${words.length} for word-order decode.`);
  }
  const [w0, w1] = words;
  switch (order) {
    case "ABCD":
      return [w0!, w1!];
    case "CDAB":
      return [w1!, w0!];
    case "BADC":
      return [((w0! & 0xff) << 8) | (w0! >> 8), ((w1! & 0xff) << 8) | (w1! >> 8)];
    case "DCBA":
      return [((w1! & 0xff) << 8) | (w1! >> 8), ((w0! & 0xff) << 8) | (w0! >> 8)];
    default:
      throw new Error(`Unknown word order: ${order as string}`);
  }
};

const wordsToSigned = (words: number[], dataType: RegisterDataType): number => {
  if (dataType === "uint16") {
    return words[0]! & 0xffff;
  }
  if (dataType === "int16") {
    const u = words[0]! & 0xffff;
    return u >= 0x8000 ? u - 0x10000 : u;
  }
  const hi = words[0]! & 0xffff;
  const lo = words[1]! & 0xffff;
  const unsigned = ((hi << 16) >>> 0) + lo;
  if (dataType === "uint32") {
    return unsigned;
  }
  return unsigned >= 0x8000_0000 ? unsigned - 0x1_0000_0000 : unsigned;
};

/**
 * Decode raw Modbus register words into an engineering value.
 * Does not invent addresses — caller supplies words already read for a RegisterDefinition.
 */
export const decodeRegisterWords = (
  definition: RegisterDefinition,
  rawRegisters: number[],
  options?: { measuredAt?: string; receivedAt?: string; calibrationVersion?: string }
): DecodedRegisterValue => {
  const measuredAt = options?.measuredAt ?? new Date().toISOString();
  const receivedAt = options?.receivedAt ?? measuredAt;

  if (rawRegisters.length !== definition.length) {
    return {
      key: definition.key,
      engineeringValue: null,
      unit: definition.unit,
      quality: "bad",
      sourceType: "measured",
      rawRegisters: [...rawRegisters],
      rawDecoded: null,
      unavailable: false,
      rangeViolation: false,
      measuredAt,
      receivedAt,
      ...(options?.calibrationVersion ? { calibrationVersion: options.calibrationVersion } : {})
    };
  }

  const ordered = reorderWords(rawRegisters, definition.wordOrder);
  const rawDecoded = wordsToSigned(ordered, definition.dataType);
  const unavailable = (definition.unavailableRaw ?? []).includes(rawDecoded);

  if (unavailable) {
    return {
      key: definition.key,
      engineeringValue: null,
      unit: definition.unit,
      quality: "uncertain",
      sourceType: "measured",
      rawRegisters: [...rawRegisters],
      rawDecoded,
      unavailable: true,
      rangeViolation: false,
      measuredAt,
      receivedAt,
      ...(options?.calibrationVersion ? { calibrationVersion: options.calibrationVersion } : {})
    };
  }

  const engineeringValue = rawDecoded * definition.scale;
  const rangeViolation =
    (typeof definition.min === "number" && engineeringValue < definition.min) ||
    (typeof definition.max === "number" && engineeringValue > definition.max);

  return {
    key: definition.key,
    engineeringValue,
    unit: definition.unit,
    quality: rangeViolation ? "bad" : "good",
    sourceType: "measured",
    rawRegisters: [...rawRegisters],
    rawDecoded,
    unavailable: false,
    rangeViolation,
    measuredAt,
    receivedAt,
    ...(options?.calibrationVersion ? { calibrationVersion: options.calibrationVersion } : {})
  };
};

/** Pack contiguous register definitions into bounded Modbus read batches. */
export const planRegisterBatches = (
  registers: RegisterDefinition[],
  maxRegistersPerBatch = 32
): Array<{ startAddress: number; quantity: number; keys: string[] }> => {
  const sorted = [...registers].sort((a, b) => a.address - b.address);
  const batches: Array<{ startAddress: number; quantity: number; keys: string[] }> = [];

  for (const reg of sorted) {
    const last = batches[batches.length - 1];
    const regEnd = reg.address + reg.length;
    if (
      last &&
      reg.address === last.startAddress + last.quantity &&
      last.quantity + reg.length <= maxRegistersPerBatch
    ) {
      last.quantity += reg.length;
      last.keys.push(reg.key);
      continue;
    }
    if (reg.length > maxRegistersPerBatch) {
      throw new Error(
        `Register ${reg.key} length ${reg.length} exceeds max batch size ${maxRegistersPerBatch}.`
      );
    }
    batches.push({
      startAddress: reg.address,
      quantity: reg.length,
      keys: [reg.key]
    });
    void regEnd;
  }

  return batches;
};
