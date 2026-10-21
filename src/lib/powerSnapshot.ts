export type NodePowerSample = { nodeId: string; power: number; timestamp: string };

/** Sum each node once; expired, invalid and future readings are not current output. */
export function sumCurrentNodePower(samples: Iterable<NodePowerSample>, now = Date.now()): number {
  const latest = new Map<string, NodePowerSample>();
  for (const sample of samples) {
    const timestamp = Date.parse(sample.timestamp);
    if (!Number.isFinite(sample.power) || !Number.isFinite(timestamp) || timestamp > now || now - timestamp > 60_000) continue;
    const previous = latest.get(sample.nodeId);
    if (!previous || timestamp >= Date.parse(previous.timestamp)) latest.set(sample.nodeId, sample);
  }
  return [...latest.values()].reduce((sum, sample) => sum + sample.power, 0);
}
