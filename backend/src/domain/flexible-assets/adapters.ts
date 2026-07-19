import type { BessConfiguration, BessState } from "./bess.js";
import { defaultBessConfiguration, defaultSimulatedBessState } from "./bess.js";
import type { ElectrolyserConfiguration, ElectrolyserState } from "./electrolyser.js";
import {
  defaultElectrolyserConfiguration,
  defaultSimulatedElectrolyserState
} from "./electrolyser.js";

/**
 * Hardware adapter contracts only. No vendor Modbus/SunSpec register maps.
 * Simulated adapters never enable physical writes.
 */
export interface BessHardwareAdapter {
  readonly physicalWriteEnabled: boolean;
  readConfiguration(assetId: string): Promise<BessConfiguration>;
  readState(assetId: string): Promise<BessState>;
  /** Advisory / simulated path only ΓÇö implementations must refuse physical writes. */
  proposeSetpoint(assetId: string, targetKw: number): Promise<{ accepted: boolean; reason: string }>;
}

export interface ElectrolyserHardwareAdapter {
  readonly physicalWriteEnabled: boolean;
  readConfiguration(assetId: string): Promise<ElectrolyserConfiguration>;
  readState(assetId: string): Promise<ElectrolyserState>;
  proposeSetpoint(assetId: string, targetKw: number): Promise<{ accepted: boolean; reason: string }>;
}

export class SimulatedBessAdapter implements BessHardwareAdapter {
  readonly physicalWriteEnabled = false as const;

  async readConfiguration(assetId: string): Promise<BessConfiguration> {
    return defaultBessConfiguration(assetId);
  }

  async readState(assetId: string): Promise<BessState> {
    return defaultSimulatedBessState(assetId);
  }

  async proposeSetpoint(
    _assetId: string,
    _targetKw: number
  ): Promise<{ accepted: boolean; reason: string }> {
    return {
      accepted: false,
      reason: "SimulatedBessAdapter refuses physical writes (physicalWriteEnabled=false)"
    };
  }
}

export class SimulatedElectrolyserAdapter implements ElectrolyserHardwareAdapter {
  readonly physicalWriteEnabled = false as const;

  async readConfiguration(assetId: string): Promise<ElectrolyserConfiguration> {
    return defaultElectrolyserConfiguration(assetId);
  }

  async readState(assetId: string): Promise<ElectrolyserState> {
    return defaultSimulatedElectrolyserState(assetId);
  }

  async proposeSetpoint(
    _assetId: string,
    _targetKw: number
  ): Promise<{ accepted: boolean; reason: string }> {
    return {
      accepted: false,
      reason: "SimulatedElectrolyserAdapter refuses physical writes (physicalWriteEnabled=false)"
    };
  }
}
