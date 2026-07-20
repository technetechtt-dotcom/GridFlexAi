/**
 * Pilot verified inverter map entrypoint.
 *
 * Default: SunSpec Alliance Model 103 (public standard) — read-only.
 * Site-specific OEM maps may replace this after dossier + PDF transcription.
 *
 * Set PILOT_INVERTER_MAP=none to fail closed (no map) for benches without inverters.
 * Set PILOT_INVERTER_MAP=sunspec_model103 (default) to use the verified SunSpec map.
 */

import type { VerifiedInverterMap } from "../../verified-inverter/types.js";
import { sunspecModel103VerifiedMap } from "./sunspec/model103/1.0.js";

export const resolvePilotVerifiedInverterMap = (): VerifiedInverterMap => {
  const selection = (process.env.PILOT_INVERTER_MAP ?? "sunspec_model103").trim().toLowerCase();

  if (selection === "none" || selection === "off") {
    throw new Error(
      "Pilot verified inverter map disabled (PILOT_INVERTER_MAP=none). " +
        "Enable sunspec_model103 or add gateway/maps/vendor/<mfr>/<model>/<fw>.ts."
    );
  }

  if (selection === "sunspec_model103" || selection === "sunspec") {
    return sunspecModel103VerifiedMap;
  }

  throw new Error(
    `Unknown PILOT_INVERTER_MAP="${selection}". Supported: sunspec_model103 | none. ` +
      "For OEM-specific maps, add vendor/<mfr>/<model>/<fw>.ts and extend this resolver."
  );
};
