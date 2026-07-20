export type { RegisterDefinition, VerifiedInverterMap, EquipmentIdentity } from "./types.js";
export { PILOT_INVERTER_READ_KEYS } from "./types.js";
export { decodeRegisterWords, planRegisterBatches } from "./decode.js";
export { parseVerifiedInverterMap, assertNoWriteRegisters } from "./map-loader.js";
export {
  VerifiedReadOnlyInverterAdapter,
  PILOT_MODBUS_ALLOWED_FUNCTION_CODES,
  PILOT_MODBUS_FORBIDDEN_FUNCTION_CODES
} from "./adapter.js";
export {
  createModbusTcpReadonlyTransport,
  createFixtureModbusTransport
} from "./modbus-tcp-transport.js";
export { discoverSunSpecModel, SUNSPEC_ID } from "./sunspec-discovery.js";
export type { SunSpecDiscoveryResult } from "./sunspec-discovery.js";
