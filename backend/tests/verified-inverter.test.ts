import fs from "node:fs";
import path from "node:path";

import {
  decodeRegisterWords,
  planRegisterBatches,
  VerifiedReadOnlyInverterAdapter,
  createFixtureModbusTransport,
  parseVerifiedInverterMap,
  PILOT_MODBUS_ALLOWED_FUNCTION_CODES,
  PILOT_MODBUS_FORBIDDEN_FUNCTION_CODES,
  type RegisterDefinition,
  type VerifiedInverterMap
} from "../src/gateway/verified-inverter/index.js";
import { resolvePilotVerifiedInverterMap } from "../src/gateway/maps/vendor/resolve-pilot-map.js";

const fixtureMap = (): VerifiedInverterMap =>
  parseVerifiedInverterMap({
    fictitious: false,
    provenanceAttested: true,
    mapPath: "vendor/test-fixture/decoder/v1",
    schemaVersion: "verified-inverter-v1",
    addressingMode: "zero_based",
    equipment: {
      manufacturer: "TestFixtureCorp",
      model: "DecoderHarness-1",
      firmwareVersion: "fixture-1.0",
      communicationModule: "fixture-tcp",
      transport: "modbus_tcp",
      registerMapVersion: "FIXTURE-NOT-VENDOR",
      registerMapSource: "CI decoder fixtures only — not a plant register map",
      slaveId: 1,
      signednessNotes: "Fixture int16/int32 two's complement",
      byteOrderNotes: "Fixture exercises ABCD and CDAB"
    },
    registers: [
      {
        key: "active_power_kw",
        address: 10,
        length: 2,
        dataType: "int32",
        wordOrder: "ABCD",
        scale: 0.1,
        unit: "kW",
        access: "read",
        min: -2000,
        max: 5000
      },
      {
        key: "reactive_power_kvar",
        address: 12,
        length: 2,
        dataType: "int32",
        wordOrder: "CDAB",
        scale: 0.1,
        unit: "kVAr",
        access: "read"
      },
      {
        key: "voltage_v",
        address: 20,
        length: 1,
        dataType: "uint16",
        wordOrder: "ABCD",
        scale: 0.1,
        unit: "V",
        access: "read"
      },
      {
        key: "current_a",
        address: 21,
        length: 1,
        dataType: "uint16",
        wordOrder: "ABCD",
        scale: 0.01,
        unit: "A",
        access: "read"
      },
      {
        key: "frequency_hz",
        address: 22,
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
        address: 30,
        length: 2,
        dataType: "uint32",
        wordOrder: "ABCD",
        scale: 0.1,
        unit: "kWh",
        access: "read"
      },
      {
        key: "lifetime_energy_kwh",
        address: 32,
        length: 2,
        dataType: "uint32",
        wordOrder: "ABCD",
        scale: 1,
        unit: "kWh",
        access: "read"
      },
      {
        key: "inverter_state",
        address: 40,
        length: 1,
        dataType: "uint16",
        wordOrder: "ABCD",
        scale: 1,
        unit: "enum",
        access: "read"
      },
      {
        key: "alarm_code",
        address: 41,
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
        address: 42,
        length: 1,
        dataType: "int16",
        wordOrder: "ABCD",
        scale: 0.1,
        unit: "celsius",
        access: "read",
        unavailableRaw: [-32768]
      }
    ]
  });

describe("verified inverter decoder fixtures", () => {
  it("decodes ABCD int32 active power including negatives", () => {
    const def = fixtureMap().registers.find((r) => r.key === "active_power_kw")!;
    // raw = -1234 → engineering -123.4 kW with scale 0.1
    const rawHigh = 0xffff;
    const rawLow = (0x10000 - 1234) & 0xffff;
    const decoded = decodeRegisterWords(def, [rawHigh, rawLow]);
    expect(decoded.engineeringValue).toBeCloseTo(-123.4, 5);
    expect(decoded.quality).toBe("good");
    expect(decoded.rawRegisters).toEqual([rawHigh, rawLow]);
  });

  it("decodes CDAB word order for reactive power", () => {
    const def = fixtureMap().registers.find((r) => r.key === "reactive_power_kvar")!;
    // Logical ABCD value 5000 with scale 0.1 → 500.0 ; stored as CDAB so words swapped
    const hi = 0;
    const lo = 5000;
    const decoded = decodeRegisterWords(def, [lo, hi]); // CDAB input order
    expect(decoded.engineeringValue).toBeCloseTo(500.0, 5);
  });

  it("flags unavailable sentinel and max uint16", () => {
    const alarm = fixtureMap().registers.find((r) => r.key === "alarm_code")!;
    const unavailable = decodeRegisterWords(alarm, [0xffff]);
    expect(unavailable.unavailable).toBe(true);
    expect(unavailable.engineeringValue).toBeNull();
    expect(unavailable.quality).toBe("uncertain");

    const voltage = fixtureMap().registers.find((r) => r.key === "voltage_v")!;
    const maxed = decodeRegisterWords(voltage, [0xffff]);
    expect(maxed.engineeringValue).toBeCloseTo(6553.5, 5);
  });

  it("marks out-of-range frequency as bad quality", () => {
    const freq = fixtureMap().registers.find((r) => r.key === "frequency_hz")!;
    const decoded = decodeRegisterWords(freq, [6000]); // 60.00 Hz > max 55
    expect(decoded.rangeViolation).toBe(true);
    expect(decoded.quality).toBe("bad");
  });

  it("plans bounded contiguous batches", () => {
    const batches = planRegisterBatches(fixtureMap().registers, 32);
    expect(batches.length).toBeGreaterThan(0);
    for (const batch of batches) {
      expect(batch.quantity).toBeLessThanOrEqual(32);
    }
  });
});

describe("verified read-only inverter adapter", () => {
  it("reads through fixture transport and retains raw registers", async () => {
    const map = fixtureMap();
    const bank = new Map<number, number>([
      [10, 0],
      [11, 9500], // 950.0 kW
      [12, 100], // CDAB reactive: logical 100 → need swap; put lo at 12, hi at 13
      [13, 0],
      [20, 4000], // 400.0 V
      [21, 12000], // 120.00 A
      [22, 5001], // 50.01 Hz
      [30, 0],
      [31, 42000], // 4200.0 kWh daily
      [32, 0],
      [33, 1_000_000],
      [40, 1],
      [41, 0],
      [42, 350] // 35.0 C
    ]);

    const adapter = new VerifiedReadOnlyInverterAdapter(
      map,
      { host: "127.0.0.1", maxReconnectAttempts: 1 },
      () => createFixtureModbusTransport(bank)
    );

    await adapter.connect();
    const values = await adapter.readAll();
    const byKey = Object.fromEntries(values.map((v) => [v.key, v]));

    expect(byKey.active_power_kw?.engineeringValue).toBeCloseTo(950.0, 5);
    expect(byKey.frequency_hz?.engineeringValue).toBeCloseTo(50.01, 5);
    expect(byKey.daily_energy_kwh?.engineeringValue).toBeCloseTo(4200.0, 5);
    expect(byKey.active_power_kw?.rawRegisters).toEqual([0, 9500]);
    expect(byKey.active_power_kw?.sourceType).toBe("measured");
    expect(adapter.health().connected).toBe(true);
    expect(adapter.health().totalReads).toBeGreaterThan(0);

    await expect(adapter.writePoint("active_power_kw", 1)).rejects.toThrow(/read-only/i);
    await adapter.disconnect();
  });

  it("reconnects after transport failure with limited backoff attempts", async () => {
    let calls = 0;
    const map = fixtureMap();
    const adapter = new VerifiedReadOnlyInverterAdapter(
      map,
      {
        host: "127.0.0.1",
        maxReconnectAttempts: 3,
        reconnectBaseMs: 1,
        reconnectMaxMs: 2
      },
      () => {
        calls += 1;
        if (calls < 3) {
          return {
            isConnected: () => false,
            connect: async () => {
              throw new Error("link down");
            },
            disconnect: async () => undefined,
            readHoldingRegisters: async () => []
          };
        }
        return createFixtureModbusTransport(new Map([[10, 0], [11, 0], [12, 0], [13, 0], [20, 0], [21, 0], [22, 5000], [30, 0], [31, 0], [32, 0], [33, 0], [40, 0], [41, 0], [42, 0]]));
      }
    );

    await adapter.connect();
    expect(adapter.health().reconnectAttempts).toBeGreaterThanOrEqual(3);
    expect(adapter.health().connected).toBe(true);
    await adapter.disconnect();
  });
});

describe("pilot map gate and write-function policy", () => {
  it("fails closed until an official vendor map is onboarded", () => {
    expect(() => resolvePilotVerifiedInverterMap()).toThrow(/not onboarded/i);
  });

  it("documents only FC03 as allowed and forbids write FCs", () => {
    expect(PILOT_MODBUS_ALLOWED_FUNCTION_CODES).toEqual([0x03]);
    expect(PILOT_MODBUS_FORBIDDEN_FUNCTION_CODES).toEqual(
      expect.arrayContaining([0x05, 0x06, 0x0f, 0x10])
    );
  });

  it("source tree for verified inverter contains no write function-code builders", () => {
    const dir = path.resolve(__dirname, "../src/gateway/verified-inverter");
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".ts"));
    const blob = files.map((f) => fs.readFileSync(path.join(dir, f), "utf8")).join("\n");
    expect(blob).not.toMatch(/writeSingleRegister|writeMultipleRegisters|writeCoil/i);
    expect(blob).not.toMatch(/pdu\.writeUInt8\(\s*0x0[56f]|pdu\.writeUInt8\(\s*0x10/i);
    expect(blob).toMatch(/FC_READ_HOLDING\s*=\s*0x03/);
  });

  it("rejects maps that look like examples", () => {
    expect(() =>
      parseVerifiedInverterMap({
        ...fixtureMap(),
        equipment: { ...fixtureMap().equipment, manufacturer: "ExampleVendor" }
      })
    ).toThrow(/official vendor map/i);
  });
});

describe("register definition access is read-only", () => {
  it("every fixture register is access read", () => {
    for (const reg of fixtureMap().registers as RegisterDefinition[]) {
      expect(reg.access).toBe("read");
    }
  });
});
