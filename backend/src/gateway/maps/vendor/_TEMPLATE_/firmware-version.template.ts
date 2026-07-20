/**
 * TEMPLATE ONLY — copy to gateway/maps/vendor/<manufacturer>/<model>/<firmware>.ts
 * after obtaining the official register map. Replace every TBD and every address
 * with values transcribed from the manufacturer / authorized installer document.
 *
 * Do NOT commit guessed addresses. Do NOT copy from fictitious-examples.ts.
 */

import type { VerifiedInverterMap } from "../../../verified-inverter/types.js";

export const TEMPLATE_VERIFIED_INVERTER_MAP: VerifiedInverterMap = {
  fictitious: false,
  provenanceAttested: true,
  mapPath: "vendor/TBD_MANUFACTURER/TBD_MODEL/TBD_FIRMWARE",
  schemaVersion: "verified-inverter-v1",
  addressingMode: "zero_based",
  equipment: {
    manufacturer: "TBD_MANUFACTURER",
    model: "TBD_MODEL",
    firmwareVersion: "TBD_FIRMWARE",
    communicationModule: "TBD_COMM_MODULE",
    transport: "modbus_tcp",
    registerMapVersion: "TBD_MAP_REVISION",
    registerMapSource: "TBD_VENDOR_PDF_OR_NDA_TICKET",
    slaveId: 1,
    signednessNotes: "TBD — copy signed/unsigned rules from vendor map.",
    byteOrderNotes: "TBD — copy word/byte order (ABCD/CDAB/…) from vendor map."
  },
  registers: [
    // Addresses below are PLACEHOLDERS (0) and must be replaced from the official map.
    // Leaving them as 0 is intentional so this template cannot be used as-is in production
    // without deliberate transcription review.
    {
      key: "active_power_kw",
      address: 0,
      length: 2,
      dataType: "int32",
      wordOrder: "ABCD",
      scale: 0.1,
      unit: "kW",
      access: "read",
      min: -100,
      max: 5000,
      description: "TBD — active power from official map"
    },
    {
      key: "reactive_power_kvar",
      address: 0,
      length: 2,
      dataType: "int32",
      wordOrder: "ABCD",
      scale: 0.1,
      unit: "kVAr",
      access: "read"
    },
    {
      key: "voltage_v",
      address: 0,
      length: 1,
      dataType: "uint16",
      wordOrder: "ABCD",
      scale: 0.1,
      unit: "V",
      access: "read"
    },
    {
      key: "current_a",
      address: 0,
      length: 1,
      dataType: "uint16",
      wordOrder: "ABCD",
      scale: 0.01,
      unit: "A",
      access: "read"
    },
    {
      key: "frequency_hz",
      address: 0,
      length: 1,
      dataType: "uint16",
      wordOrder: "ABCD",
      scale: 0.01,
      unit: "Hz",
      access: "read",
      min: 45,
      max: 55
    },
    {
      key: "daily_energy_kwh",
      address: 0,
      length: 2,
      dataType: "uint32",
      wordOrder: "ABCD",
      scale: 0.1,
      unit: "kWh",
      access: "read"
    },
    {
      key: "lifetime_energy_kwh",
      address: 0,
      length: 2,
      dataType: "uint32",
      wordOrder: "ABCD",
      scale: 1,
      unit: "kWh",
      access: "read"
    },
    {
      key: "inverter_state",
      address: 0,
      length: 1,
      dataType: "uint16",
      wordOrder: "ABCD",
      scale: 1,
      unit: "enum",
      access: "read"
    },
    {
      key: "alarm_code",
      address: 0,
      length: 1,
      dataType: "uint16",
      wordOrder: "ABCD",
      scale: 1,
      unit: "code",
      access: "read",
      unavailableRaw: [0xffff]
    },
    {
      key: "temperature_c",
      address: 0,
      length: 1,
      dataType: "int16",
      wordOrder: "ABCD",
      scale: 0.1,
      unit: "celsius",
      access: "read",
      unavailableRaw: [-32768]
    }
  ]
};
