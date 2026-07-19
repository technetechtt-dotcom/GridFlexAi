import { z } from "zod";

import type { GatewayProtocol, RegisterMapDocument, RegisterMapPoint } from "./types.js";

const pointSchema = z.object({
  key: z.string().min(1),
  address: z.string().min(1),
  dataType: z.enum(["bool", "int16", "uint16", "int32", "uint32", "float32", "string"]),
  unit: z.string().optional(),
  access: z.enum(["read", "write", "read_write"]),
  scale: z.number().optional(),
  description: z.string().optional()
});

const registerMapSchema = z.object({
  fictitious: z.boolean(),
  label: z.string().min(1),
  vendor: z.string().min(1),
  model: z.string().min(1),
  protocol: z.enum([
    "modbus_rtu",
    "modbus_tcp",
    "sunspec_modbus",
    "opc_ua",
    "mqtt",
    "rest",
    "iec_61850",
    "iec_60870_5_104",
    "dnp3"
  ]),
  schemaVersion: z.string().min(1),
  points: z.array(pointSchema).min(1)
});

export const parseRegisterMap = (input: unknown): RegisterMapDocument => {
  const parsed = registerMapSchema.parse(input);
  if (!parsed.fictitious && parsed.label.toLowerCase().includes("example")) {
    throw new Error("Example register maps must set fictitious=true.");
  }

  const points: RegisterMapPoint[] = parsed.points.map((point) => {
    const next: RegisterMapPoint = {
      key: point.key,
      address: point.address,
      dataType: point.dataType,
      access: point.access
    };
    if (point.unit !== undefined) next.unit = point.unit;
    if (point.scale !== undefined) next.scale = point.scale;
    if (point.description !== undefined) next.description = point.description;
    return next;
  });

  return {
    fictitious: parsed.fictitious,
    label: parsed.label,
    vendor: parsed.vendor,
    model: parsed.model,
    protocol: parsed.protocol,
    schemaVersion: parsed.schemaVersion,
    points
  };
};

export const assertProtocolMatches = (map: RegisterMapDocument, protocol: GatewayProtocol) => {
  if (map.protocol !== protocol) {
    throw new Error(`Register map protocol ${map.protocol} does not match adapter ${protocol}.`);
  }
};
