const durationPattern = /^(\d+)([smhd])$/i;

export const durationToMs = (value: string): number => {
  const match = value.trim().match(durationPattern);
  if (!match) {
    throw new Error(`Invalid duration "${value}". Use formats like 15m, 12h, 30d.`);
  }

  const amountPart = match[1];
  const unitPart = match[2];
  if (!amountPart || !unitPart) {
    throw new Error(`Invalid duration "${value}".`);
  }

  const amount = Number(amountPart);
  const unit = unitPart.toLowerCase();
  const unitMs: Record<string, number> = {
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000
  };

  const multiplier = unitMs[unit];
  if (!multiplier) {
    throw new Error(`Unsupported duration unit in "${value}".`);
  }

  return amount * multiplier;
};
