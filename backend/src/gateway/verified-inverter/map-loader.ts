import { z } from "zod";

import type { VerifiedInverterMap } from "./types.js";
import { PILOT_INVERTER_READ_KEYS } from "./types.js";

const registerDefinitionSchema = z.object({
  key: z.string().min(1),
  address: z.number().int().nonnegative(),
  length: z.number().int().positive().max(2),
  dataType: z.enum(["uint16", "int16", "uint32", "int32"]),
  wordOrder: z.enum(["ABCD", "CDAB", "BADC", "DCBA"]),
  scale: z.number().finite(),
  unit: z.string().min(1),
  access: z.literal("read"),
  min: z.number().optional(),
  max: z.number().optional(),
  unavailableRaw: z.array(z.number()).optional(),
  description: z.string().optional()
});

const equipmentSchema = z.object({
  manufacturer: z.string().min(1),
  model: z.string().min(1),
  firmwareVersion: z.string().min(1),
  communicationModule: z.string().min(1),
  transport: z.enum(["modbus_tcp", "modbus_rtu"]),
  registerMapVersion: z.string().min(1),
  registerMapSource: z.string().min(1),
  baudRate: z.number().int().positive().optional(),
  parity: z.enum(["none", "even", "odd"]).optional(),
  stopBits: z.union([z.literal(1), z.literal(2)]).optional(),
  slaveId: z.number().int().positive().max(247),
  signednessNotes: z.string().min(1),
  byteOrderNotes: z.string().min(1)
});

const verifiedMapSchema = z.object({
  fictitious: z.literal(false),
  provenanceAttested: z.literal(true),
  equipment: equipmentSchema,
  addressingMode: z.enum(["zero_based", "one_based_holding"]),
  schemaVersion: z.string().min(1),
  mapPath: z.string().min(1),
  registers: z.array(registerDefinitionSchema).min(1)
});

/**
 * Parse and gate a verified inverter map.
 * Rejects fictitious maps, write access, and maps that claim to be examples.
 */
export const parseVerifiedInverterMap = (input: unknown): VerifiedInverterMap => {
  const parsed = verifiedMapSchema.parse(input);

  if (
    parsed.equipment.manufacturer.toLowerCase().includes("example") ||
    parsed.equipment.model.toLowerCase().includes("demo") ||
    parsed.mapPath.toLowerCase().includes("fictitious")
  ) {
    throw new Error(
      "Verified inverter maps must not use example/demo/fictitious identity. Obtain the official vendor map."
    );
  }

  for (const reg of parsed.registers) {
    if (reg.access !== "read") {
      throw new Error(`Pilot register ${reg.key} must be access:"read" for the pilot.`);
    }
    if ((reg.dataType === "uint32" || reg.dataType === "int32") && reg.length !== 2) {
      throw new Error(`Register ${reg.key}: 32-bit types require length 2.`);
    }
    if ((reg.dataType === "uint16" || reg.dataType === "int16") && reg.length !== 1) {
      throw new Error(`Register ${reg.key}: 16-bit types require length 1.`);
    }
  }

  const keys = new Set(parsed.registers.map((r) => r.key));
  // temperature_c is optional ("where available"); all other pilot keys are required.
  for (const required of PILOT_INVERTER_READ_KEYS) {
    if (required === "temperature_c") continue;
    if (!keys.has(required)) {
      throw new Error(`Verified map missing required pilot read key: ${required}`);
    }
  }

  return {
    fictitious: parsed.fictitious,
    provenanceAttested: parsed.provenanceAttested,
    addressingMode: parsed.addressingMode,
    schemaVersion: parsed.schemaVersion,
    mapPath: parsed.mapPath,
    equipment: {
      manufacturer: parsed.equipment.manufacturer,
      model: parsed.equipment.model,
      firmwareVersion: parsed.equipment.firmwareVersion,
      communicationModule: parsed.equipment.communicationModule,
      transport: parsed.equipment.transport,
      registerMapVersion: parsed.equipment.registerMapVersion,
      registerMapSource: parsed.equipment.registerMapSource,
      slaveId: parsed.equipment.slaveId,
      signednessNotes: parsed.equipment.signednessNotes,
      byteOrderNotes: parsed.equipment.byteOrderNotes,
      ...(parsed.equipment.baudRate !== undefined ? { baudRate: parsed.equipment.baudRate } : {}),
      ...(parsed.equipment.parity !== undefined ? { parity: parsed.equipment.parity } : {}),
      ...(parsed.equipment.stopBits !== undefined ? { stopBits: parsed.equipment.stopBits } : {})
    },
    registers: parsed.registers.map((reg) => {
      const next = {
        key: reg.key,
        address: reg.address,
        length: reg.length,
        dataType: reg.dataType,
        wordOrder: reg.wordOrder,
        scale: reg.scale,
        unit: reg.unit,
        access: reg.access
      } as VerifiedInverterMap["registers"][number];
      if (reg.min !== undefined) next.min = reg.min;
      if (reg.max !== undefined) next.max = reg.max;
      if (reg.unavailableRaw !== undefined) next.unavailableRaw = reg.unavailableRaw;
      if (reg.description !== undefined) next.description = reg.description;
      return next;
    })
  };
};

export const assertNoWriteRegisters = (map: VerifiedInverterMap): void => {
  for (const reg of map.registers) {
    if (reg.access !== "read") {
      throw new Error(`Write-capable register ${reg.key} is forbidden in pilot adapter.`);
    }
  }
};
