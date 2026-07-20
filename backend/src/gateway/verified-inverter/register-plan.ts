/**
 * Expand requested register keys so every sunssf-referenced scale factor
 * is included in the same Modbus read plan (partial reads stay consistent).
 */
export const expandKeysWithScaleFactors = (
  registers: Array<{ key: string; scaleFactorKey?: string }>,
  keys: string[]
): string[] => {
  const byKey = new Map(registers.map((r) => [r.key, r]));
  const out = new Set<string>();
  for (const key of keys) {
    out.add(key);
    const def = byKey.get(key);
    if (def?.scaleFactorKey) {
      out.add(def.scaleFactorKey);
    }
  }
  return [...out];
};

/**
 * Shift all register addresses by delta (discovered model base − mapped base).
 */
export const rebaseRegisterAddresses = <T extends { address: number }>(
  registers: T[],
  delta: number
): T[] => registers.map((r) => ({ ...r, address: r.address + delta }));
