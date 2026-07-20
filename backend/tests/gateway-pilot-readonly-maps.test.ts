import { createModbusTcpAdapter, createMqttAdapter } from "../src/gateway/adapters.js";
import { FICTITIOUS_BESS_MQTT_MAP, FICTITIOUS_INVERTER_MODBUS_MAP } from "../src/gateway/maps/fictitious-examples.js";

describe("gateway pilot read-only maps", () => {
  it("rejects setpoint writes for fictitious inverter modbus map", async () => {
    const adapter = createModbusTcpAdapter(FICTITIOUS_INVERTER_MODBUS_MAP);
    await adapter.connect({
      protocol: "modbus_tcp",
      endpoint: "localhost:502",
      timeoutMs: 1000,
      retries: 1,
      readOnly: false,
      physicalCommandExecutionEnabled: true,
      pollingIntervalMs: 1000
    });

    await expect(adapter.writePoint("power_setpoint_kw", 123)).rejects.toThrow(/not writable/i);
  });

  it("rejects setpoint writes for fictitious BESS mqtt map", async () => {
    const adapter = createMqttAdapter(FICTITIOUS_BESS_MQTT_MAP);
    await adapter.connect({
      protocol: "mqtt",
      endpoint: "localhost",
      timeoutMs: 1000,
      retries: 1,
      readOnly: false,
      physicalCommandExecutionEnabled: true,
      pollingIntervalMs: 1000
    });

    await expect(adapter.writePoint("charge_power_setpoint_kw", 10)).rejects.toThrow(/not writable/i);
  });
});

