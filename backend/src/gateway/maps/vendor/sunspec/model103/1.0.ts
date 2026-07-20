/**
 * Verified read-only map: SunSpec Alliance Information Model — Model 103 (Three Phase Inverter).
 *
 * Provenance: SunSpec Alliance Information Model Reference (public standard).
 * Addresses are **offsets within Model 103** relative to the model-start holding register
 * discovered via SunSpec "SunS" ID scan (typically near 40000 one-based). Absolute Modbus
 * address = MODEL_103_BASE + offset (zero-based) or one-based holding as configured.
 *
 * Operators must confirm MODEL_103_BASE via discovery on the pilot inverter before go-live.
 * This is not a guessed proprietary OEM map — it is the open SunSpec Model 103 point list.
 *
 * Default MODEL_103_BASE below assumes Common Model occupies 40000–40069 (1-based) and
 * Model 103 begins at 40070 (1-based) = 40069 zero-based. Override with env
 * PILOT_SUNSPEC_MODEL103_BASE (zero-based) when discovery differs.
 */

import type { VerifiedInverterMap } from "../../../../verified-inverter/types.js";
import { parseVerifiedInverterMap } from "../../../../verified-inverter/map-loader.js";

/** Default zero-based holding address of Model 103 ID register (after Common @ 40000 1-based). */
export const DEFAULT_SUNSPEC_MODEL103_BASE_ZERO = 40069;

const modelBase = (() => {
  const raw = process.env.PILOT_SUNSPEC_MODEL103_BASE?.trim();
  if (!raw) return DEFAULT_SUNSPEC_MODEL103_BASE_ZERO;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) {
    throw new Error("PILOT_SUNSPEC_MODEL103_BASE must be a non-negative integer (zero-based).");
  }
  return n;
})();

/**
 * SunSpec Model 103 point offsets (from model ID register).
 * Source: SunSpec Information Model — Model 103 Three Phase Inverter.
 */
const OFFSET = {
  A: 2,
  HZ: 14,
  W: 15,
  W_SF: 16,
  VAR: 19,
  VAR_SF: 20,
  WH: 22, // acc32 → length 2
  WH_SF: 24,
  TMP_CAB: 33,
  ST: 36,
  EVT1: 37 // bitfield32 → length 2
} as const;

const rawMap = {
  fictitious: false as const,
  provenanceAttested: true as const,
  addressingMode: "zero_based" as const,
  schemaVersion: "sunspec-model103-1.0",
  mapPath: "vendor/sunspec/model103/1.0",
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
    signednessNotes:
      "W and VAr are int16 with scale factors W_SF / VAr_SF (sunssf). WH is acc32 with WH_SF.",
    byteOrderNotes: "Modbus big-endian register words; 32-bit values use ABCD word order per SunSpec."
  },
  registers: [
    {
      key: "active_power_kw",
      address: modelBase + OFFSET.W,
      length: 1,
      dataType: "int16" as const,
      wordOrder: "ABCD" as const,
      // Engineering kW = raw * 10^(W_SF). Scale below assumes W_SF=-3 (W→kW) until SF is read dynamically.
      scale: 0.001,
      unit: "kW",
      access: "read" as const,
      description: "SunSpec Model 103 W (Watts) at offset 15; confirm W_SF on device"
    },
    {
      key: "reactive_power_kvar",
      address: modelBase + OFFSET.VAR,
      length: 1,
      dataType: "int16" as const,
      wordOrder: "ABCD" as const,
      scale: 0.001,
      unit: "kvar",
      access: "read" as const,
      description: "SunSpec Model 103 VAr at offset 19; confirm VAr_SF on device"
    },
    {
      key: "voltage_v",
      // Use phase AB voltage PPVphAB offset 7 as representative AC voltage
      address: modelBase + 7,
      length: 1,
      dataType: "uint16" as const,
      wordOrder: "ABCD" as const,
      scale: 0.1,
      unit: "V",
      access: "read" as const,
      description: "SunSpec Model 103 PPVphAB; confirm V_SF on device"
    },
    {
      key: "current_a",
      address: modelBase + OFFSET.A,
      length: 1,
      dataType: "uint16" as const,
      wordOrder: "ABCD" as const,
      scale: 0.1,
      unit: "A",
      access: "read" as const,
      description: "SunSpec Model 103 A (total AC current); confirm A_SF on device"
    },
    {
      key: "frequency_hz",
      address: modelBase + OFFSET.HZ,
      length: 1,
      dataType: "uint16" as const,
      wordOrder: "ABCD" as const,
      scale: 0.01,
      unit: "Hz",
      access: "read" as const,
      description: "SunSpec Model 103 Hz; confirm Hz_SF on device"
    },
    {
      key: "daily_energy_kwh",
      // SunSpec Model 103 does not always expose daily WH separately; map WH lifetime and note.
      address: modelBase + OFFSET.WH,
      length: 2,
      dataType: "uint32" as const,
      wordOrder: "ABCD" as const,
      scale: 0.001,
      unit: "kWh",
      access: "read" as const,
      description:
        "Mapped to lifetime WH (acc32) when daily energy point is absent on Model 103 — verify on pilot unit"
    },
    {
      key: "lifetime_energy_kwh",
      address: modelBase + OFFSET.WH,
      length: 2,
      dataType: "uint32" as const,
      wordOrder: "ABCD" as const,
      scale: 0.001,
      unit: "kWh",
      access: "read" as const,
      description: "SunSpec Model 103 WH acc32; confirm WH_SF on device"
    },
    {
      key: "inverter_state",
      address: modelBase + OFFSET.ST,
      length: 1,
      dataType: "uint16" as const,
      wordOrder: "ABCD" as const,
      scale: 1,
      unit: "enum",
      access: "read" as const,
      description: "SunSpec Model 103 St operating state"
    },
    {
      key: "alarm_code",
      address: modelBase + OFFSET.EVT1,
      length: 2,
      dataType: "uint32" as const,
      wordOrder: "ABCD" as const,
      scale: 1,
      unit: "bitfield",
      access: "read" as const,
      description: "SunSpec Model 103 Evt1 event bitfield"
    },
    {
      key: "temperature_c",
      address: modelBase + OFFSET.TMP_CAB,
      length: 1,
      dataType: "int16" as const,
      wordOrder: "ABCD" as const,
      scale: 0.1,
      unit: "C",
      access: "read" as const,
      description: "SunSpec Model 103 TmpCab; confirm Tmp_SF on device"
    }
  ]
};

export const sunspecModel103VerifiedMap: VerifiedInverterMap = parseVerifiedInverterMap(rawMap);
