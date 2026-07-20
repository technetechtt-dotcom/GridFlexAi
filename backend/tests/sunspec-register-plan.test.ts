import { expandKeysWithScaleFactors } from "../src/gateway/verified-inverter/register-plan.js";
import { decodeRegisterWords } from "../src/gateway/verified-inverter/decode.js";
import type { RegisterDefinition } from "../src/gateway/verified-inverter/types.js";

describe("SunSpec register plan + sentinels", () => {
  it("auto-includes referenced scale-factor keys for partial reads", () => {
    const registers = [
      { key: "active_power_kw", scaleFactorKey: "sf_W" },
      { key: "sf_W" },
      { key: "voltage_v", scaleFactorKey: "sf_V" },
      { key: "sf_V" }
    ];
    const expanded = expandKeysWithScaleFactors(registers, ["active_power_kw"]);
    expect(expanded).toEqual(expect.arrayContaining(["active_power_kw", "sf_W"]));
    expect(expanded).not.toContain("sf_V");
  });

  it("marks SunSpec int16 sentinel −32768 as unavailable", () => {
    const definition: RegisterDefinition = {
      key: "active_power_kw",
      address: 16,
      length: 1,
      dataType: "int16",
      wordOrder: "ABCD",
      scale: 0.001,
      scaleMode: "sunssf",
      scaleFactorKey: "sf_W",
      unit: "kW",
      access: "read",
      unavailableRaw: [-32768]
    };
    const decoded = decodeRegisterWords(definition, [0x8000], {
      scaleFactors: { sf_W: -3 }
    });
    expect(decoded.unavailable).toBe(true);
    expect(decoded.engineeringValue).toBeNull();
    expect(decoded.quality).toBe("uncertain");
  });

  it("rejects absurd sunssf by leaving engineering uncertain when SF missing", () => {
    const definition: RegisterDefinition = {
      key: "active_power_kw",
      address: 16,
      length: 1,
      dataType: "int16",
      wordOrder: "ABCD",
      scale: 0.001,
      scaleMode: "sunssf",
      scaleFactorKey: "sf_W",
      unit: "kW",
      access: "read"
    };
    const decoded = decodeRegisterWords(definition, [1000], { scaleFactors: {} });
    expect(decoded.quality).toBe("uncertain");
  });
});
