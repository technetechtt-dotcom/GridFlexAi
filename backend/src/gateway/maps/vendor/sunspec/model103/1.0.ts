/**
 * Verified read-only map: SunSpec Alliance Model 103 (Three Phase Inverter).
 *
 * - Addresses are relative to discovered model base (see sunspec-discovery.ts).
 * - Scale factors use SunSpec sunssf (engineering = raw * 10^SF).
 * - No false daily_energy mapping — Model 103 exposes lifetime WH only.
 *
 * Set PILOT_SUNSPEC_MODEL103_BASE to a discovered zero-based model ID address,
 * or leave default and run discovery against the unit before go-live.
 */

import type { VerifiedInverterMap } from "../../../../verified-inverter/types.js";
import { parseVerifiedInverterMap } from "../../../../verified-inverter/map-loader.js";
import { DEFAULT_SUNSPEC_MODEL103_BASE_ZERO } from "./base.js";

const modelBase = (() => {
  const raw = process.env.PILOT_SUNSPEC_MODEL103_BASE?.trim();
  if (!raw) return DEFAULT_SUNSPEC_MODEL103_BASE_ZERO;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) {
    throw new Error("PILOT_SUNSPEC_MODEL103_BASE must be a non-negative integer (zero-based).");
  }
  return n;
})();

/** Official Model 103 point offsets from model ID register (SunSpec Alliance reference). */
const O = {
  A: 2,
  A_SF: 6,
  PPV_AB: 7,
  V_SF: 13,
  HZ: 14,
  HZ_SF: 15,
  W: 16,
  W_SF: 17,
  VAR: 20,
  VAR_SF: 21,
  WH: 24,
  WH_SF: 26,
  TMP_CAB: 33,
  TMP_SF: 37,
  ST: 38,
  EVT1: 40
} as const;

const rawMap = {
  fictitious: false as const,
  provenanceAttested: true as const,
  addressingMode: "zero_based" as const,
  schemaVersion: "sunspec-model103-1.1",
  mapPath: "vendor/sunspec/model103/1.1",
  equipment: {
    manufacturer: "SunSpec Alliance",
    model: "Model103-ThreePhaseInverter",
    firmwareVersion: "information-model-ref",
    communicationModule: "Modbus TCP SunSpec",
    transport: "modbus_tcp" as const,
    registerMapVersion: "SunSpec Model 103",
    registerMapSource:
      "SunSpec Alliance Information Model Reference — Model 103 Three Phase Inverter (public standard)",
    slaveId: 1,
    signednessNotes: "W/VAr int16; WH acc32; SF points are sunssf (signed scale exponents).",
    byteOrderNotes: "Modbus big-endian register words; 32-bit values use ABCD word order per SunSpec."
  },
  registers: [
    {
      key: "sf_A",
      address: modelBase + O.A_SF,
      length: 1,
      dataType: "int16" as const,
      wordOrder: "ABCD" as const,
      scale: 1,
      unit: "sunssf",
      access: "read" as const,
      description: "A_SF",
      unavailableRaw: [-32768]
    },
    {
      key: "sf_V",
      address: modelBase + O.V_SF,
      length: 1,
      dataType: "int16" as const,
      wordOrder: "ABCD" as const,
      scale: 1,
      unit: "sunssf",
      access: "read" as const,
      description: "V_SF",
      unavailableRaw: [-32768]
    },
    {
      key: "sf_Hz",
      address: modelBase + O.HZ_SF,
      length: 1,
      dataType: "int16" as const,
      wordOrder: "ABCD" as const,
      scale: 1,
      unit: "sunssf",
      access: "read" as const,
      description: "Hz_SF",
      unavailableRaw: [-32768]
    },
    {
      key: "sf_W",
      address: modelBase + O.W_SF,
      length: 1,
      dataType: "int16" as const,
      wordOrder: "ABCD" as const,
      scale: 1,
      unit: "sunssf",
      access: "read" as const,
      description: "W_SF",
      unavailableRaw: [-32768]
    },
    {
      key: "sf_VAr",
      address: modelBase + O.VAR_SF,
      length: 1,
      dataType: "int16" as const,
      wordOrder: "ABCD" as const,
      scale: 1,
      unit: "sunssf",
      access: "read" as const,
      description: "VAr_SF",
      unavailableRaw: [-32768]
    },
    {
      key: "sf_WH",
      address: modelBase + O.WH_SF,
      length: 1,
      dataType: "int16" as const,
      wordOrder: "ABCD" as const,
      scale: 1,
      unit: "sunssf",
      access: "read" as const,
      description: "WH_SF",
      unavailableRaw: [-32768]
    },
    {
      key: "sf_Tmp",
      address: modelBase + O.TMP_SF,
      length: 1,
      dataType: "int16" as const,
      wordOrder: "ABCD" as const,
      scale: 1,
      unit: "sunssf",
      access: "read" as const,
      description: "Tmp_SF",
      unavailableRaw: [-32768]
    },
    {
      key: "active_power_kw",
      address: modelBase + O.W,
      length: 1,
      dataType: "int16" as const,
      wordOrder: "ABCD" as const,
      scale: 0.001,
      scaleMode: "sunssf" as const,
      scaleFactorKey: "sf_W",
      unit: "kW",
      access: "read" as const,
      unavailableRaw: [-32768],
      description: "SunSpec W (Watts) with W_SF; convert to kW after decode if needed"
    },
    {
      key: "reactive_power_kvar",
      address: modelBase + O.VAR,
      length: 1,
      dataType: "int16" as const,
      wordOrder: "ABCD" as const,
      scale: 0.001,
      scaleMode: "sunssf" as const,
      scaleFactorKey: "sf_VAr",
      unit: "kvar",
      access: "read" as const,
      unavailableRaw: [-32768]
    },
    {
      key: "voltage_v",
      address: modelBase + O.PPV_AB,
      length: 1,
      dataType: "uint16" as const,
      wordOrder: "ABCD" as const,
      scale: 0.1,
      scaleMode: "sunssf" as const,
      scaleFactorKey: "sf_V",
      unit: "V",
      access: "read" as const,
      unavailableRaw: [65535]
    },
    {
      key: "current_a",
      address: modelBase + O.A,
      length: 1,
      dataType: "uint16" as const,
      wordOrder: "ABCD" as const,
      scale: 0.1,
      scaleMode: "sunssf" as const,
      scaleFactorKey: "sf_A",
      unit: "A",
      access: "read" as const,
      unavailableRaw: [65535]
    },
    {
      key: "frequency_hz",
      address: modelBase + O.HZ,
      length: 1,
      dataType: "uint16" as const,
      wordOrder: "ABCD" as const,
      scale: 0.01,
      scaleMode: "sunssf" as const,
      scaleFactorKey: "sf_Hz",
      unit: "Hz",
      access: "read" as const,
      unavailableRaw: [65535]
    },
    {
      key: "lifetime_energy_kwh",
      address: modelBase + O.WH,
      length: 2,
      dataType: "uint32" as const,
      wordOrder: "ABCD" as const,
      scale: 0.001,
      scaleMode: "sunssf" as const,
      scaleFactorKey: "sf_WH",
      unit: "kWh",
      access: "read" as const,
      unavailableRaw: [4294967295],
      description: "Lifetime WH only — daily energy must be derived from deltas, not remapped"
    },
    {
      key: "inverter_state",
      address: modelBase + O.ST,
      length: 1,
      dataType: "uint16" as const,
      wordOrder: "ABCD" as const,
      scale: 1,
      unit: "enum",
      access: "read" as const,
      unavailableRaw: [65535]
    },
    {
      key: "alarm_code",
      address: modelBase + O.EVT1,
      length: 2,
      dataType: "uint32" as const,
      wordOrder: "ABCD" as const,
      scale: 1,
      unit: "bitfield",
      access: "read" as const,
      unavailableRaw: [4294967295]
    },
    {
      key: "temperature_c",
      address: modelBase + O.TMP_CAB,
      length: 1,
      dataType: "int16" as const,
      wordOrder: "ABCD" as const,
      scale: 0.1,
      scaleMode: "sunssf" as const,
      scaleFactorKey: "sf_Tmp",
      unit: "C",
      access: "read" as const,
      unavailableRaw: [-32768]
    }
  ]
};

export const sunspecModel103VerifiedMap: VerifiedInverterMap = parseVerifiedInverterMap(rawMap);
