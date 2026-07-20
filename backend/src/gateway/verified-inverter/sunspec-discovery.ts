/**
 * SunSpec Modbus discovery helpers (public Information Model).
 */

export const SUNSPEC_ID = 0x53756e53; // "SunS"

export type SunSpecDiscoveryResult = {
  commonBaseZero: number;
  modelBaseZero: number;
  modelId: number;
  modelLength: number;
};

/**
 * Scan holding registers for SunSpec header and model ID.
 */
export const discoverSunSpecModel = async (
  readHolding: (startZero: number, quantity: number) => Promise<number[]>,
  options?: {
    modelId?: number;
    probeBases?: number[];
    maxModels?: number;
  }
): Promise<SunSpecDiscoveryResult> => {
  const modelId = options?.modelId ?? 103;
  const probes = options?.probeBases ?? [0, 39999, 49999];
  const maxModels = options?.maxModels ?? 32;

  let commonBase: number | null = null;
  for (const base of probes) {
    try {
      const words = await readHolding(base, 2);
      const id = ((words[0]! & 0xffff) << 16) | (words[1]! & 0xffff);
      if (id === SUNSPEC_ID) {
        commonBase = base;
        break;
      }
    } catch {
      // try next probe
    }
  }
  if (commonBase === null) {
    throw new Error('SunSpec identifier "SunS" not found at probe bases.');
  }

  let cursor = commonBase + 2;
  for (let i = 0; i < maxModels; i++) {
    const header = await readHolding(cursor, 2);
    const id = header[0]! & 0xffff;
    const length = header[1]! & 0xffff;
    if (id === 0xffff || length === 0) {
      break;
    }
    if (id === modelId) {
      return {
        commonBaseZero: commonBase,
        modelBaseZero: cursor,
        modelId: id,
        modelLength: length
      };
    }
    cursor += 2 + length;
  }

  throw new Error(`SunSpec model ${modelId} not found after Common block.`);
};
