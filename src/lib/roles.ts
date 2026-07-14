export type AppRole = 'operator' | 'manager' | 'admin' | 'developer';

/** Ops Center is restricted to platform staff only. */
export const OPS_CENTER_ROLES: readonly AppRole[] = ['admin', 'developer'] as const;

export const canAccessOpsCenter = (role: string | null | undefined): boolean =>
  Boolean(role && (OPS_CENTER_ROLES as readonly string[]).includes(role));

export const isPlantManager = (role: string | null | undefined): boolean => role === 'manager';
