import { createContext, useContext } from 'react';
import type { BackendNode, ProactiveAlert, IoTEdgeAsset } from '../services/api';
import type { Provenance } from '../lib/operatingMode';
export interface GridMetrics {
  frequency: number;
  voltage: number;
  totalGeneration: number;
  demand: number;
  lastUpdated: Date;
  provenance: Provenance;
}

export interface RealTimeContextType {
  metrics: GridMetrics;
  isConnected: boolean;
  metricsStale: boolean;
  proactiveAlerts: ProactiveAlert[];
  iotAssets: IoTEdgeAsset[];
  backendNodes: BackendNode[];
  availableNodeNames: string[];
  selectedNodeNames: string[];
  setSelectedNodeNames: (nodes: string[]) => void;
  toggleSelectedNode: (nodeName: string) => void;
  microgridMode: boolean;
  setMicrogridMode: (enabled: boolean) => void;
}

export const RealTimeContext = createContext<RealTimeContextType | undefined>(
  undefined
);

export function useRealTime() {
  const context = useContext(RealTimeContext);
  if (context === undefined) {
    throw new Error('useRealTime must be used within a RealTimeProvider');
  }
  return context;
}
