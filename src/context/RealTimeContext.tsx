import React, { useEffect, useMemo, useState, createContext, useContext, type ReactNode } from 'react';
import {
  buildForecastProfilesFromNodes,
  fetchNodes,
  fetchDashboardSummary,
  fetchForecast,
  fetchIoTEdgeAssets,
  fetchProactiveAlerts,
  type BackendNode,
  type BackendReading,
  type IoTEdgeAsset,
  type ProactiveAlert } from
'../services/api';
import {
  closeSocketClient,
  getSocketClient,
  type NodeStatusUpdatePayload } from
'../services/socket';
interface GridMetrics {
  frequency: number;
  voltage: number;
  totalGeneration: number;
  demand: number;
  lastUpdated: Date;
}
interface RealTimeContextType {
  metrics: GridMetrics;
  isConnected: boolean;
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
export function RealTimeProvider({ children }: {children: ReactNode;}) {
  const DEFAULT_NODE_SELECTION = ['All Nodes'];
  const [metrics, setMetrics] = useState<GridMetrics>({
    frequency: 50.0,
    voltage: 132.0,
    totalGeneration: 847,
    demand: 820,
    lastUpdated: new Date()
  });
  const [isConnected, setIsConnected] = useState(false);
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
        const [alerts, assets, nodes, summary, forecast] = await Promise.all([
        fetchProactiveAlerts(),
        fetchIoTEdgeAssets(),
        fetchNodes(),
        fetchDashboardSummary(),
        fetchForecast({
          lat: -28.4478,
          lon: 21.2561,
          capacity: 220
        })]);
        if (!mounted) return;
        setProactiveAlerts(alerts);
        setIotAssets(assets);
        setBackendNodes(nodes);
        const nextDemand = forecast.hourly[0]?.estimatedPowerKw ?
        Math.max(forecast.hourly[0].estimatedPowerKw * 0.97, 0) :
        Math.max(summary.averages.power * 0.96, 0);
        setMetrics((prev) => ({
          ...prev,
          voltage: summary.averages.voltage || prev.voltage,
          totalGeneration: summary.averages.power || prev.totalGeneration,
          demand: nextDemand,
          lastUpdated: summary.latestTimestamp ? new Date(summary.latestTimestamp) : new Date()
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

    const socket = getSocketClient();

    const onConnect = () => {
      if (!mounted) return;
      setIsConnected(true);
    };
    const onDisconnect = () => {
      if (!mounted) return;
      setIsConnected(false);
    };
    const onLiveReading = (reading: BackendReading) => {
      if (!mounted) return;
      setMetrics((prev) => ({
        // Keep frequency tightly bounded around nominal to avoid jittery UX.
        frequency: Number((50 + Math.max(-0.03, Math.min(0.03, (reading.power - prev.totalGeneration) / 500))).toFixed(2)),
        voltage: reading.voltage,
        totalGeneration: reading.power,
        demand: Math.max(reading.power * 0.95, 0),
        lastUpdated: new Date(reading.timestamp)
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
          health: reading.node?.status === 'offline' ? 'critical' : 'good'
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
          health: node.status === 'offline' ? 'critical' : 'good'
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
        status: node.status
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
          health: node.status === 'offline' ? 'critical' : 'good',
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
          name: node.name,
          location: node.location,
          latitude: null,
          longitude: null,
          status: node.status,
          lastSeen: null,
          createdAt: new Date().toISOString(),
          lastReading: null
        }, ...prev];
      });
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('live-reading', onLiveReading);
    socket.on('node-status-update', onNodeStatusUpdate);
    socket.on('new-node', onNewNode);

    const interval = setInterval(() => {
      if (socket.connected) return;

      setMetrics((prev) => ({
        frequency: 50.0 + (Math.random() - 0.5) * 0.1,
        voltage: 132.0 + (Math.random() - 0.5) * 2,
        totalGeneration: prev.totalGeneration + (Math.random() - 0.5) * 10,
        demand: prev.demand + (Math.random() - 0.5) * 15,
        lastUpdated: new Date()
      }));
      setIotAssets((prev) =>
      prev.map((asset) => ({
        ...asset,
        powerMw: Number((asset.powerMw + (Math.random() - 0.5) * 0.9).toFixed(1)),
        edgeForecastConfidence: Number(
          Math.min(
            0.99,
            Math.max(0.72, asset.edgeForecastConfidence + (Math.random() - 0.5) * 0.03)
          ).
          toFixed(2)
        )
      }))
      );
      if (Math.random() > 0.85) {
        setProactiveAlerts((prev) => {
          const nextAlert: ProactiveAlert = {
            id: `stream-${Date.now()}`,
            issuedAt: new Date(),
            severity: Math.random() > 0.7 ? 'high' : 'medium',
            title: microgridMode ?
            'Edge controller adjusted local dispatch' :
            'AI dispatch recommendation updated',
            recommendation: microgridMode ?
            'Microgrid controller shifted 2.4 MW from battery to feeder support.' :
            'Pre-charge storage before forecasted demand ramp at 18:00.',
            trigger: microgridMode ?
            'Remote telemetry variance exceeded threshold.' :
            'Probabilistic forecast confidence exceeded 85%.',
            actionPage: microgridMode ? 'scenario' : 'dispatch'
          };
          return [nextAlert, ...prev].slice(0, 8);
        });
      }
    }, 2000); // Update every 2 seconds
    return () => {
      mounted = false;
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('live-reading', onLiveReading);
      socket.off('node-status-update', onNodeStatusUpdate);
      socket.off('new-node', onNewNode);
      closeSocketClient();
      clearInterval(interval);
      setIsConnected(false);
    };
  }, [microgridMode]);
  return (
    <RealTimeContext.Provider
      value={{
        metrics,
        isConnected,
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
