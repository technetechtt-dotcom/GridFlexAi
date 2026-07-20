/**
 * Modbus RTU CRC-16 (poly 0xA001) — mirrors firmware/GridFlexEdge/modbus_rtu.h.
 */
export const crc16Modbus = (data: Uint8Array | number[]): number => {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i += 1) {
    crc ^= data[i]! & 0xff;
    for (let b = 0; b < 8; b += 1) {
      if (crc & 1) crc = (crc >>> 1) ^ 0xa001;
      else crc >>>= 1;
    }
  }
  return crc & 0xffff;
};

export type ParsedFc03 = {
  ok: true;
  slave: number;
  registers: number[];
} | {
  ok: false;
  reason: "truncated" | "crc" | "function" | "length" | "slave" | "oversized";
};

/** Parse a complete FC03 response frame (including CRC). */
export const parseFc03Response = (
  frame: Uint8Array,
  expectedSlave: number,
  expectedQty: number
): ParsedFc03 => {
  const expectLen = 5 + expectedQty * 2;
  if (frame.length < 5) return { ok: false, reason: "truncated" };
  if (frame.length > expectLen) return { ok: false, reason: "oversized" };
  if (frame.length < expectLen) return { ok: false, reason: "truncated" };
  if (frame[0] !== expectedSlave) return { ok: false, reason: "slave" };
  if (frame[1] !== 0x03) return { ok: false, reason: "function" };
  if (frame[2] !== expectedQty * 2) return { ok: false, reason: "length" };
  const body = frame.subarray(0, frame.length - 2);
  const gotCrc = frame[frame.length - 2]! | (frame[frame.length - 1]! << 8);
  if (gotCrc !== crc16Modbus(body)) return { ok: false, reason: "crc" };
  const registers: number[] = [];
  for (let i = 0; i < expectedQty; i += 1) {
    registers.push((frame[3 + i * 2]! << 8) | frame[4 + i * 2]!);
  }
  return { ok: true, slave: expectedSlave, registers };
};

export const buildFc03Response = (slave: number, registers: number[]): Uint8Array => {
  const qty = registers.length;
  const frame = new Uint8Array(5 + qty * 2);
  frame[0] = slave;
  frame[1] = 0x03;
  frame[2] = qty * 2;
  for (let i = 0; i < qty; i += 1) {
    frame[3 + i * 2] = (registers[i]! >> 8) & 0xff;
    frame[4 + i * 2] = registers[i]! & 0xff;
  }
  const crc = crc16Modbus(frame.subarray(0, frame.length - 2));
  frame[frame.length - 2] = crc & 0xff;
  frame[frame.length - 1] = (crc >> 8) & 0xff;
  return frame;
};
