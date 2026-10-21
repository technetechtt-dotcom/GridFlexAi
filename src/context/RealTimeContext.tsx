import { RealTimeContext, type GridMetrics } from './useRealTime';
import React, { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { sumCurrentNodePower, type NodePowerSample } from '../lib/powerSnapshot';
import {
  fetchNodes,
  fetchDashboardSummary,
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
import { buildProvenance } from '../lib/operatingMode';
import { useAuth } from './useAuth';




const healthFromNodeStatus = (status: NodeStatus | undefined): IoTEdgeAsset['health'] => {
  if (status === 'offline') return 'critical';
  if (status === 'maintenance') return 'degraded';
  return 'good';
};

const DEFAULT_NODE_SELECTION = ['All Nodes'];

export function RealTimeProvider({ children }: {children: ReactNode;}) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
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
  const powerByNode = useRef(new Map<string, NodePowerSample>());
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
    return nowTick - metrics.lastUpdated.getTime() > 60_000;
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
    powerByNode.current.clear();

    if (authLoading || !isAuthenticated) {
      return () => {
        mounted = false;
      };
    }

    const bootstrap = async () => {
      try {
        const [alerts, assets, nodes, summary, modeInfo] = await Promise.all([
        fetchProactiveAlerts(),
        fetchIoTEdgeAssets(),
        fetchNodes(),
        fetchDashboardSummary(),
        fetchOperatingMode()]);
        if (!mounted) return;
        setProactiveAlerts(alerts);
        setIotAssets(assets);
        setBackendNodes(nodes);
        for (const sample of summary.currentPower?.readings ?? []) {
          const previous = powerByNode.current.get(sample.nodeId);
          if (!previous || Date.parse(previous.timestamp) <= Date.parse(sample.timestamp)) powerByNode.current.set(sample.nodeId, sample);
        }
        const latestSnapshot = summary.currentPower?.readings[0]?.timestamp;
        const measuredAt = latestSnapshot ? new Date(latestSnapshot) : new Date(0);
        const hasMeasuredPower = (summary.currentPower?.nodesReporting ?? 0) > 0;
        const sourceType =
          modeInfo.defaultTelemetryEnvironment === 'simulation'
            ? 'simulated'
            : hasMeasuredPower
              ? 'measured'
              : 'estimated';
        setMetrics((prev) => ({
          ...prev,
          // Do not invent demand/frequency from forecast ratios.
          voltage: summary.averages.voltage,
          totalGeneration: sumCurrentNodePower(powerByNode.current.values()),
          demand: prev.demand,
          frequency: prev.frequency,
          lastUpdated: hasMeasuredPower ? measuredAt : new Date(0),
          provenance: buildProvenance({
            sourceType,
            sourceId: modeInfo.simulationRunId ?? 'dashboard-summary',
            quality: hasMeasuredPower ? 'good' : 'stale',
            measuredAt: hasMeasuredPower ? measuredAt : prev.lastUpdated,
            receivedAt: new Date(),
            unit: 'kW'
          })
        }));
      } catch {
        if (!mounted) return;
        try {
          const [alerts, assets, nodes] = await Promise.all([
          fetchProactiveAlerts(),
          fetchIoTEdgeAssets(),
          fetchNodes()]);
          if (!mounted) return;
          setProactiveAlerts(alerts);
          setIotAssets(assets);
          setBackendNodes(nodes);
        } catch {
          // Stay on bootstrap defaults until a later authenticated refresh succeeds.
        }
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
      const previous = powerByNode.current.get(reading.nodeId);
      if (previous && Date.parse(previous.timestamp) > measuredAt.getTime()) return;
      powerByNode.current.set(reading.nodeId, reading);
      setMetrics((prev) => ({
        // Hold last frequency — readings do not include measured Hz; do not invent from power delta.
        frequency: prev.frequency,
        voltage: reading.voltage,
        totalGeneration: sumCurrentNodePower(powerByNode.current.values()),
        // Hold last demand — no measured demand field on ingest readings.
        demand: prev.demand,
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
            powerMw: reading.power / 1000,
            edgeForecastConfidence: 0.92
          }, ...prev];
        }
        return prev.map((asset) =>
        asset.id === reading.nodeId ?
        {
          ...asset,
          powerMw: reading.power / 1000,
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
  }, [microgridMode, authLoading, isAuthenticated]);
  return (
    <RealTimeContext.Provider
      value={{
        metrics: { ...metrics, totalGeneration: sumCurrentNodePower(powerByNode.current.values()) },
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
