/**
 * Pilot verified inverter map entrypoint.
 *
 * NO register addresses are shipped as "production-ready" in this repository.
 * Obtain the official manufacturer / installer register map, fill the equipment
 * dossier, then add:
 *   gateway/maps/vendor/<manufacturer>/<model>/<firmware-version>.ts
 * and point `resolvePilotVerifiedInverterMap()` at that module.
 */

import type { VerifiedInverterMap } from "../../verified-inverter/types.js";

/**
 * Returns the attested pilot inverter map once onboarded.
 * Until then, fails closed so guessed maps cannot enter the runtime.
 */
export const resolvePilotVerifiedInverterMap = (): VerifiedInverterMap => {
  throw new Error(
    "Pilot verified inverter map is not onboarded. " +
      "Record manufacturer/model/firmware and official register-map version in " +
      "docs/INVERTER_INTEGRATION.md, then add gateway/maps/vendor/<mfr>/<model>/<fw>.ts " +
      "with provenanceAttested:true transcribed from the vendor PDF — never invent addresses."
  );
};
