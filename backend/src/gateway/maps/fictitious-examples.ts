/**
 * FICTITIOUS EXAMPLE ONLY — not a real vendor register map.
 * Addresses below are placeholders for schema/tests and must never be used on plant equipment.
 */
export const FICTITIOUS_INVERTER_MODBUS_MAP = {
  fictitious: true,
  label: "FICTITIOUS EXAMPLE — demo inverter Modbus TCP map (not a real vendor map)",
  vendor: "ExampleVendor-NotReal",
  model: "DemoInverter-000",
  protocol: "modbus_tcp" as const,
  schemaVersion: "example-1",
  points: [
    {
      key: "active_power_kw",
      address: "EX-HOLDING-40001",
      dataType: "float32" as const,
      unit: "kW",
      access: "read" as const,
      description: "Fictitious active power holding register placeholder"
    },
    {
      key: "power_setpoint_kw",
      address: "EX-HOLDING-40100",
      dataType: "float32" as const,
      unit: "kW",
      access: "read_write" as const,
      description: "Fictitious setpoint placeholder — do not use on real devices"
    },
    {
      key: "grid_frequency_hz",
      address: "EX-INPUT-30010",
      dataType: "float32" as const,
      unit: "Hz",
      access: "read" as const
    }
  ]
};

/**
 * FICTITIOUS EXAMPLE ONLY — BESS placeholder map for simulated adapters.
 */
export const FICTITIOUS_BESS_MQTT_MAP = {
  fictitious: true,
  label: "FICTITIOUS EXAMPLE — demo BESS MQTT topic map (not a real vendor map)",
  vendor: "ExampleVendor-NotReal",
  model: "DemoBESS-000",
  protocol: "mqtt" as const,
  schemaVersion: "example-1",
  points: [
    {
      key: "state_of_charge_percent",
      address: "plant/demo/bess/soc",
      dataType: "float32" as const,
      unit: "percent",
      access: "read" as const
    },
    {
      key: "charge_power_setpoint_kw",
      address: "plant/demo/bess/setpoint",
      dataType: "float32" as const,
      unit: "kW",
      access: "read_write" as const,
      description: "Fictitious MQTT setpoint topic"
    }
  ]
};
