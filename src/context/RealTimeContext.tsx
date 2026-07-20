import React, { useEffect, useMemo, useState, createContext, useContext, type ReactNode } from 'react';
import {
  fetchNodes,
  fetchDashboardSummary,
  fetchForecast,
  fetchIoTEdgeAssets,
  fetchProactiveAlerts,
  fetchOperatingMode,
  type BackendNode,
  type BackendReading,
  type IoTEdgeAsset,
  type NodeStatus,
  type ProactiveAlert } from
'../services/api';
import {
  closeLiveSocketClient,
  closeSimulationSocketClient,
  getLiveSocketClient,
  getSimulationSocketClient,
  type NodeStatusUpdatePayload } from
'../services/socket';
import { buildProvenance, type Provenance } from '../lib/operatingMode';
interface GridMetrics {
  frequency: number;
  voltage: number;
  totalGeneration: number;
  demand: number;
  lastUpdated: Date;
  provenance: Provenance;
}
interface RealTimeContextType {
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
const RealTimeContext = createContext<RealTimeContextType | undefined>(
  undefined
);

const healthFromNodeStatus = (status: NodeStatus | undefined): IoTEdgeAsset['health'] => {
  if (status === 'offline') return 'critical';
  if (status === 'maintenance') return 'degraded';
  return 'good';
};

export function RealTimeProvider({ children }: {children: ReactNode;}) {
  const DEFAULT_NODE_SELECTION = ['All Nodes'];
  const [metrics, setMetrics] = useState<GridMetrics>({
    frequency: 50.0,
    voltage: 0,
    totalGeneration: 0,
    demand: 0,
    lastUpdated: new Date(0),
    provenance: buildProvenance({
      sourceType: 'estimated',
      sourceId: 'bootstrap',
      quality: 'stale',
      measuredAt: new Date(0),
      receivedAt: new Date(),
      unit: 'kW'
    })
  });
  const [isConnected, setIsConnected] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [proactiveAlerts, setProactiveAlerts] = useState<ProactiveAlert[]>([]);
  const [iotAssets, setIotAssets] = useState<IoTEdgeAsset[]>([]);
  const [backendNodes, setBackendNodes] = useState<BackendNode[]>([]);
  const [selectedNodeNames, setSelectedNodeNamesState] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('gridflex_selected_nodes');
      if (!stored) {
        return DEFAULT_NODE_SELECTION;
      }
      const parsed = JSON.parse(stored) as unknown;
      if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string') && parsed.length > 0) {
        return parsed;
      }
    } catch {
      // Ignore malformed persisted node scope and fall back to defaults.
    }
    return DEFAULT_NODE_SELECTION;
  });
  const [microgridMode, setMicrogridMode] = useState(false);

  const availableNodeNames = useMemo(() => {
    const nodeNames = Array.from(new Set(iotAssets.map((asset) => asset.name).filter(Boolean)));
    return ['All Nodes', ...nodeNames];
  }, [iotAssets]);

  const metricsStale = useMemo(() => {
    if (metrics.lastUpdated.getTime() <= 0) return true;
    return Date.now() - metrics.lastUpdated.getTime() > 60_000;
  }, [metrics.lastUpdated, nowTick]);

  useEffect(() => {
    const tick = setInterval(() => setNowTick(Date.now()), 5000);
    return () => clearInterval(tick);
  }, []);

  const setSelectedNodeNames = (nodes: string[]) => {
    const sanitized = Array.from(new Set(nodes.filter(Boolean)));
    setSelectedNodeNamesState(sanitized.length ? sanitized : DEFAULT_NODE_SELECTION);
  };

  const toggleSelectedNode = (nodeName: string) => {
    setSelectedNodeNamesState((prev) => {
      if (nodeName === 'All Nodes') {
        return DEFAULT_NODE_SELECTION;
      }

      const next = prev.includes(nodeName) ?
      prev.filter((item) => item !== nodeName) :
      [...prev.filter((item) => item !== 'All Nodes'), nodeName];

      return next.length ? next : DEFAULT_NODE_SELECTION;
    });
  };

  useEffect(() => {
    localStorage.setItem('gridflex_selected_nodes', JSON.stringify(selectedNodeNames));
  }, [selectedNodeNames]);

  useEffect(() => {
    setSelectedNodeNamesState((prev) => {
      if (prev.includes('All Nodes')) {
        return prev;
      }

      const validSelections = prev.filter((nodeName) => availableNodeNames.includes(nodeName));
      return validSelections.length ? validSelections : DEFAULT_NODE_SELECTION;
    });
  }, [availableNodeNames]);

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      try {
        const [alerts, assets, nodes, summary, forecast, modeInfo] = await Promise.all([
        fetchProactiveAlerts(),
        fetchIoTEdgeAssets(),
        fetchNodes(),
        fetchDashboardSummary(),
        fetchForecast({
          lat: -28.4478,
          lon: 21.2561,
          capacity: 220
        }),
        fetchOperatingMode()]);
        if (!mounted) return;
        setProactiveAlerts(alerts);
        setIotAssets(assets);
        setBackendNodes(nodes);
        const nextDemand = forecast.hourly[0]?.estimatedPowerKw ?
        Math.max(forecast.hourly[0].estimatedPowerKw * 0.97, 0) :
        Math.max(summary.averages.power * 0.96, 0);
        const measuredAt = summary.latestTimestamp ? new Date(summary.latestTimestamp) : new Date();
        const sourceType =
          modeInfo.defaultTelemetryEnvironment === 'simulation'
            ? 'simulated'
            : summary.averages.power > 0
              ? 'measured'
              : 'estimated';
        setMetrics((prev) => ({
          ...prev,
          voltage: summary.averages.voltage || prev.voltage,
          totalGeneration: summary.averages.power || prev.totalGeneration,
          demand: nextDemand,
          lastUpdated: measuredAt,
          provenance: buildProvenance({
            sourceType,
            sourceId: modeInfo.simulationRunId ?? 'dashboard-summary',
            quality: summary.averages.power > 0 ? 'good' : 'stale',
            measuredAt,
            receivedAt: new Date(),
            unit: 'kW'
          })
        }));
      } catch {
        if (!mounted) return;
        const [alerts, assets, nodes] = await Promise.all([
        fetchProactiveAlerts(),
        fetchIoTEdgeAssets(),
        fetchNodes()]);
        if (!mounted) return;
        setProactiveAlerts(alerts);
        setIotAssets(assets);
        setBackendNodes(nodes);
      }
    };

    void bootstrap();

    const socket = getLiveSocketClient();
    let simulationSocket: ReturnType<typeof getSimulationSocketClient> | null = null;

    const onConnect = () => {
      if (!mounted) return;
      setIsConnected(true);
    };
    const onDisconnect = () => {
      if (!mounted) return;
      setIsConnected(false);
    };
    const applyReading = (reading: BackendReading, sourceType: 'measured' | 'simulated') => {
      if (!mounted) return;
      const measuredAt = new Date(reading.timestamp);
      setMetrics((prev) => ({
        // Keep frequency tightly bounded around nominal to avoid jittery UX.
        frequency: Number((50 + Math.max(-0.03, Math.min(0.03, (reading.power - prev.totalGeneration) / 500))).toFixed(2)),
        voltage: reading.voltage,
        totalGeneration: reading.power,
        demand: Math.max(reading.power * 0.95, 0),
        lastUpdated: measuredAt,
        provenance: buildProvenance({
          sourceType,
          sourceId: reading.nodeId,
          quality: 'good',
          measuredAt,
          receivedAt: new Date(),
          unit: 'kW'
        })
      }));

      setIotAssets((prev) => {
        const idx = prev.findIndex((asset) => asset.id === reading.nodeId);
        if (idx === -1) {
          const name = reading.node?.name ?? 'Edge Node';
          const location = reading.node?.location ?? 'Unknown';
          return [{
            id: reading.nodeId,
            name,
            type: 'microgrid',
            location,
            health: 'good',
            powerMw: Number(reading.power.toFixed(1)),
            edgeForecastConfidence: 0.92
          }, ...prev];
        }
        return prev.map((asset) =>
        asset.id === reading.nodeId ?
        {
          ...asset,
          powerMw: Number(reading.power.toFixed(1)),
          health: healthFromNodeStatus(reading.node?.status)
        } :
        asset
        );
      });
      setBackendNodes((prev) =>
      prev.map((node) =>
      node.id === reading.nodeId ?
      {
        ...node,
        status: reading.node?.status ?? node.status,
        lastSeen: reading.timestamp,
        lastReading: reading
      } :
      node
      )
      );
    };
    const onLiveReading = (reading: BackendReading) => applyReading(reading, 'measured');
    const onLiveReadingFromSimulation = (reading: BackendReading) => applyReading(reading, 'simulated');

    void fetchOperatingMode().then((modeInfo) => {
      if (!mounted) return;
      if (modeInfo.mode === 'SIMULATION' || modeInfo.mode === 'HIL') {
        simulationSocket = getSimulationSocketClient();
        simulationSocket.on('simulation-reading', onLiveReadingFromSimulation);
      }
    });

    const onNodeStatusUpdate = (node: NodeStatusUpdatePayload) => {
      if (!mounted) return;
      setIotAssets((prev) => {
        const exists = prev.some((asset) => asset.id === node.id);
        if (!exists) return prev;
        return prev.map((asset) =>
        asset.id === node.id ?
        {
          ...asset,
          name: node.name,
          location: node.location,
          health: healthFromNodeStatus(node.status)
        } :
        asset
        );
      });
      setBackendNodes((prev) =>
      prev.map((assetNode) =>
      assetNode.id === node.id ?
      {
        ...assetNode,
        name: node.name,
        location: node.location,
        status: node.status,
        statusBadge: node.status,
        firmwareVersion: node.firmwareVersion ?? assetNode.firmwareVersion,
        batteryLevel: node.batteryLevel ?? assetNode.batteryLevel,
        signalStrength: node.signalStrength ?? assetNode.signalStrength,
        lastSeen: node.lastSeen ?? assetNode.lastSeen
      } :
      assetNode
      )
      );
    };
    const onNewNode = (node: NodeStatusUpdatePayload) => {
      if (!mounted) return;
      setIotAssets((prev) => {
        if (prev.some((asset) => asset.id === node.id)) {
          return prev;
        }
        return [{
          id: node.id,
          name: node.name,
          type: 'microgrid',
          location: node.location,
          health: healthFromNodeStatus(node.status),
          powerMw: 0,
          edgeForecastConfidence: 0.78
        }, ...prev];
      });
      setBackendNodes((prev) => {
        if (prev.some((assetNode) => assetNode.id === node.id)) {
          return prev;
        }

        return [{
          id: node.id,
          deviceKey: null,
          serialNumber: node.serialNumber,
          siteId: null,
          site: null,
          name: node.name,
          location: node.location,
          latitude: null,
          longitude: null,
          status: node.status,
          statusBadge: node.status,
          firmwareVersion: node.firmwareVersion,
          batteryLevel: node.batteryLevel,
          signalStrength: node.signalStrength,
          healthScore: node.status === 'online' ? 80 : node.status === 'maintenance' ? 60 : 25,
          alerts: [],
          isActive: true,
          lastSeen: node.lastSeen,
          installedAt: node.createdAt,
          lastRestartedAt: null,
          createdAt: node.createdAt,
          updatedAt: new Date().toISOString(),
          readingsCount: 0,
          openMaintenanceRequests: 0,
          latestReadingSummary: {
            latestTimestamp: null,
            latestPowerKw: null,
            latestVoltage: null,
            latestCurrent: null,
            avgPower24h: null,
            samples24h: 0,
            energyTodayKwh: null
          },
          lastReading: null
        }, ...prev];
      });
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('live-reading', onLiveReading);
    socket.on('node-status-update', onNodeStatusUpdate);
    socket.on('new-node', onNewNode);

    // No client-side Math.random() telemetry. Simulation is published by the backend on /simulation.
    return () => {
      mounted = false;
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('live-reading', onLiveReading);
      socket.off('node-status-update', onNodeStatusUpdate);
      socket.off('new-node', onNewNode);
      if (simulationSocket) {
        simulationSocket.off('simulation-reading', onLiveReadingFromSimulation);
      }
      closeLiveSocketClient();
      closeSimulationSocketClient();
      setIsConnected(false);
    };
  }, [microgridMode]);
  return (
    <RealTimeContext.Provider
      value={{
        metrics,
        isConnected,
        metricsStale,
        proactiveAlerts,
        iotAssets,
        backendNodes,
        availableNodeNames,
        selectedNodeNames,
        setSelectedNodeNames,
        toggleSelectedNode,
        microgridMode,
        setMicrogridMode
      }}>

      {children}
    </RealTimeContext.Provider>);

}
export function useRealTime() {
  const context = useContext(RealTimeContext);
  if (context === undefined) {
    throw new Error('useRealTime must be used within a RealTimeProvider');
  }
  return context;
}
