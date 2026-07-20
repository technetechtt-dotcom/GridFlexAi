export interface ElectrolyzerStatus {
  loadMW: number;
  productionRate: number; // kg/h
  efficiency: number; // kWh/kg
  lcoh: number; // R/kg
  mode: 'excess' | 'arbitrage' | 'ancillary';
  waterUsage: number; // L/h
  stackTemp: number; // °C
}

export interface ProbabilisticForecastPoint {
  time: string;
  p10: number;
  p50: number;
  p90: number;
}

export interface AIInsightForecast {
  summary: string;
  confidence: number;
  model: 'N-BEATS' | 'TFT' | 'Ensemble';
  weatherSignal: string;
  drivers: string[];
  solar: ProbabilisticForecastPoint[];
  wind: ProbabilisticForecastPoint[];
  load: ProbabilisticForecastPoint[];
}

export interface ProactiveAlert {
  id: string;
  issuedAt: Date;
  severity: 'info' | 'medium' | 'high';
  title: string;
  recommendation: string;
  trigger: string;
  actionPage:
  | 'dispatch'
  | 'congestion'
  | 'scenario'
  | 'hyshift'
  | 'sector-coupling';
}

export interface DynamicLineRatingSnapshot {
  corridor: string;
  ambientTempC: number;
  windSpeedMs: number;
  staticLimitMW: number;
  dynamicLimitMW: number;
  upliftPercent: number;
}

export interface GETOptimizationResult {
  congestionReductionPercent: number;
  transferCapacityGainPercent: number;
  recommendedTopology: string;
  rerouteToElectrolyzerMW: number;
}

export interface HydrogenTwinState {
  electrolyzerType: 'PEM' | 'Alkaline';
  stackLoadPercent: number;
  efficiencyKwhPerKg: number;
  productionKgPerHour: number;
  lcohZarPerKg: number;
  gridPriceZarPerKwh: number;
  renewableSharePercent: number;
  predictedLoadsheddingRisk: 'low' | 'medium' | 'high';
  mode: 'excess' | 'arbitrage' | 'ancillary';
}

export interface ESGMetric {
  key: string;
  label: string;
  value: number;
  unit: string;
  changePercent: number;
}

export interface IoTEdgeAsset {
  id: string;
  name: string;
  type: 'microgrid' | 'battery' | 'solar' | 'wind' | 'electrolyzer';
  location: string;
  health: 'good' | 'degraded' | 'critical';
  powerMw: number;
  edgeForecastConfidence: number;
}

export interface CongestionNode {
  name: string;
  currentLoad: number; // %
  forecast24h: number[];
  risk: 'low' | 'medium' | 'high' | 'critical';
}

export interface DispatchCommand {
  id: string;
  timestamp: Date;
  command: string;
  asset: string;
  status: 'pending' | 'executing' | 'executed' | 'failed';
  operator: string;
}

export interface PilotReport {
  date: string;
  curtailmentSaved: number; // MWh
  revenueUplift: number; // ZAR
  h2Produced: number; // kg
  co2Avoided: number; // tons
  gridStabilityScore: number; // 0-100
}

export interface DispatchRecommendation {
  id: number;
  type: 'curtailment' | 'battery' | 'dispatch' | 'hyshift';
  title: string;
  description: string;
  impact: string;
  status: 'pending' | 'approved' | 'rejected';
}

export type OptimisationRunSummary = {
  id: string;
  plantId: string;
  status: string;
  advisory: boolean;
  expectedBenefitZar: number | null;
  solverVersion: string;
  createdAt: string;
  advisoryLabel?: string;
};

type ApiEnvelope<T> = {
  data: T;
};

export type NodeStatus = 'online' | 'offline' | 'maintenance';
export type NodeStatusBadge = NodeStatus | 'warning';

export type NodeAlert = {
  id: string;
  type: 'offline' | 'lowBattery' | 'lowSignal' | 'stale' | 'anomaly';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
};

export type BackendNode = {
  id: string;
  deviceKey: string | null;
  serialNumber: string | null;
  siteId: string | null;
  site: {
    id: string;
    name: string;
    code: string;
    location: string;
    client: {
      id: string;
      name: string;
      slug: string;
    };
  } | null;
  name: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  status: NodeStatus;
  statusBadge: NodeStatusBadge;
  firmwareVersion: string | null;
  batteryLevel: number | null;
  signalStrength: number | null;
  healthScore: number;
  alerts: NodeAlert[];
  isActive?: boolean;
  lastSeen: string | null;
  installedAt: string;
  lastRestartedAt: string | null;
  createdAt: string;
  updatedAt: string;
  readingsCount: number;
  openMaintenanceRequests: number;
  lastReading: BackendReading | null;
  latestReadingSummary: {
    latestTimestamp: string | null;
    latestPowerKw: number | null;
    latestVoltage: number | null;
    latestCurrent: number | null;
    avgPower24h: number | null;
    samples24h: number;
    energyTodayKwh: number | null;
  };
};

export type BackendReading = {
  id: string;
  nodeId: string;
  voltage: number;
  current: number;
  power: number;
  energyToday: number | null;
  inverterPower: number | null;
  curtailment: number | null;
  timestamp: string;
  node?: {
    id: string;
    name: string;
    location: string;
    status: NodeStatus;
  };
};

export type NodeStatusLog = {
  id: string;
  nodeId: string;
  fromStatus: NodeStatus | null;
  toStatus: NodeStatus;
  action: string;
  message: string | null;
  metadata: unknown;
  userId: string | null;
  createdAt: string;
};

export type NodeMaintenanceRequest = {
  id: string;
  nodeId: string;
  requestedById: string | null;
  issueType: string;
  description: string;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
};

export type BackendNodeDetail = BackendNode & {
  readings: BackendReading[];
  statusLogs: NodeStatusLog[];
  maintenanceRequests: NodeMaintenanceRequest[];
};

export type ReadingsSummaryPoint = {
  nodeId: string;
  nodeName: string;
  location: string;
  date: string;
  totalEnergyKwh: number;
  avgPowerKw: number;
  samples: number;
};

export type DashboardSummary = {
  nodes: {
    total: number;
    online: number;
    offline: number;
  };
  readingsWindow: number;
  averages: {
    voltage: number;
    current: number;
    power: number;
    inverterPower: number;
    curtailment: number;
  };
  latestTimestamp: string | null;
  telemetryEnvironment?: "live" | "simulation" | "hil" | "all";
  excludesSimulated?: boolean;
};

export type AdminDashboardSummary = {
  generatedAt: string;
  overview: {
    usersTotal: number;
    activeSessions: number;
    nodesTotal: number;
    nodesOnline: number;
    nodesOffline: number;
    staleNodes: number;
    readings24h: number;
  };
  alerts: {
    offlineNodes: number;
    staleNodes: number;
    highCurtailmentNodes: number;
  };
  providerHealth: {
    forecastSolar: 'closed' | 'open' | 'half-open';
    openWeather: 'closed' | 'open' | 'half-open';
    openWeatherConfigured: boolean;
    accuWeather: 'closed' | 'open' | 'half-open';
    accuWeatherConfigured: boolean;
  };
  ingestionHourly: Array<{
    hour: string;
    readings: number;
  }>;
  recentUsers: Array<{
    id: string;
    name: string;
    email: string;
    createdAt: string;
  }>;
  nodes: Array<{
    id: string;
    name: string;
    location: string;
    status: NodeStatus;
    lastSeen: string | null;
    latestReading: {
      powerKw: number;
      curtailmentKw: number | null;
      timestamp: string;
    } | null;
  }>;
};

export type ForecastProvidersStatus = {
  providers: {
    forecastSolar: {
      state: 'closed' | 'open' | 'half-open';
      failures: number;
      openedAt: string | null;
      nextAttemptInMs: number;
    };
    openWeather: {
      state: 'closed' | 'open' | 'half-open';
      failures: number;
      openedAt: string | null;
      nextAttemptInMs: number;
      configured: boolean;
    };
    accuWeather: {
      state: 'closed' | 'open' | 'half-open';
      failures: number;
      openedAt: string | null;
      nextAttemptInMs: number;
      configured: boolean;
    };
  };
  cache: {
    redisEnabled: boolean;
    redisConnected: boolean;
    inMemoryEntries: number;
    ttlMs: number;
  };
};

export type AdminClient = {
  id: string;
  name: string;
  slug: string;
  contactEmail: string | null;
  status: string;
  createdAt: string;
  siteCount: number;
  credentialCount: number;
};

export type AdminSite = {
  id: string;
  clientId: string;
  client: {
    id: string;
    name: string;
    slug: string;
  };
  name: string;
  code: string;
  location: string;
  timezone: string;
  createdAt: string;
  nodeCount: number;
  credentialCount: number;
  userCount: number;
  operatorCount: number;
  managers: Array<{
    id: string;
    name: string;
    email: string;
  }>;
};

export type AdminNode = {
  id: string;
  serialNumber: string | null;
  name: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  status: NodeStatus;
  firmwareVersion: string | null;
  batteryLevel: number | null;
  signalStrength: number | null;
  isActive?: boolean;
  lastSeen: string | null;
  siteId: string | null;
  site: {
    id: string;
    name: string;
    code: string;
    client: {
      id: string;
      name: string;
    };
  } | null;
};

export type AdminApiCredential = {
  id: string;
  provider: 'openai' | 'openweather' | 'accuweather' | 'custom';
  name: string;
  keyLast4: string;
  isActive: boolean;
  notes: string | null;
  clientId: string | null;
  siteId: string | null;
  client: {
    id: string;
    name: string;
    slug: string;
  } | null;
  site: {
    id: string;
    name: string;
    code: string;
  } | null;
  createdAt: string;
};

export type AdminBillingAccount = {
  id: string;
  clientId: string;
  client: {
    id: string;
    name: string;
    slug: string;
  };
  plan: 'starter' | 'pro' | 'enterprise';
  status: 'active' | 'suspended' | 'past_due';
  billingEmail: string | null;
  taxId: string | null;
  createdAt: string;
  invoiceCount: number;
};

export type AdminPlatformOverview = {
  generatedAt: string;
  database: { healthy: boolean };
  providers: {
    forecastSolar: 'closed' | 'open' | 'half-open';
    openWeather: 'closed' | 'open' | 'half-open';
    openWeatherConfigured: boolean;
    accuWeather: 'closed' | 'open' | 'half-open';
    accuWeatherConfigured: boolean;
  };
  overview: {
    usersTotal: number;
    nodesTotal: number;
    nodesOnline: number;
    readings24h: number;
  };
  metrics: {
    totalRequests: number;
    totalError4xx: number;
    totalError5xx: number;
    avgLatencyMs: number;
    socketConnections: number;
  };
};

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: 'operator' | 'manager' | 'admin' | 'developer';
  status: string;
  createdAt: string;
  lastLoginAt: string | null;
  siteId?: string | null;
  site?: {
    id: string;
    name: string;
    code: string;
    location: string;
    client: {
      id: string;
      name: string;
    };
  } | null;
  managedById?: string | null;
  managedBy?: {
    id: string;
    name: string;
    email: string;
    siteId?: string | null;
    site?: {
      id: string;
      name: string;
      code: string;
    } | null;
  } | null;
  operatorCount?: number;
  operatorProvisioning?: {
    enabled: boolean;
    maxOperators: number;
    updatedAt: string;
  } | null;
};

export type ManagerTeamOverview = {
  site: {
    id: string;
    name: string;
    code: string;
    location: string;
    client: {
      id: string;
      name: string;
    };
  } | null;
  provisioning: {
    enabled: boolean;
    maxOperators: number;
    operatorCount: number;
    remainingSlots: number;
  };
  operators: Array<{
    id: string;
    name: string;
    email: string;
    siteId: string | null;
    site: {
      id: string;
      name: string;
      code: string;
    } | null;
    status: string;
    createdAt: string;
    lastLoginAt: string | null;
  }>;
};

export type TeamActivityLog = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  message: string | null;
  metadata: unknown;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  createdAt: string;
};

export type AdminMonitoringNode = {
  id: string;
  name: string;
  location: string;
  status: NodeStatus;
  isActive?: boolean;
  lastSeen: string | null;
  readingsCount: number;
};

export type AdminMetricsSnapshot = {
  startedAt: string;
  totalRequests: number;
  totalError4xx: number;
  totalError5xx: number;
  avgLatencyMs: number;
  socketConnections: number;
  routes: Array<{
    path: string;
    method: string;
    count: number;
    error4xx: number;
    error5xx: number;
    totalLatencyMs: number;
  }>;
};

export type AdminAuditLog = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  message: string | null;
  metadata: unknown;
  userId: string | null;
  userEmail: string | null;
  userName?: string | null;
  createdAt: string;
};

export type AdminQuickActionResult = {
  action: string;
  executedAt: string;
  message: string;
};

export type ForecastProvidersHistory = {
  generatedAt: string;
  providers: {
    forecastSolar: Array<{
      timestamp: string;
      state: 'closed' | 'open' | 'half-open';
      failures: number;
    }>;
    openWeather: Array<{
      timestamp: string;
      state: 'closed' | 'open' | 'half-open';
      failures: number;
    }>;
    accuWeather: Array<{
      timestamp: string;
      state: 'closed' | 'open' | 'half-open';
      failures: number;
    }>;
  };
};

export type DailyForecastPrediction = {
  id: string;
  nodeId: string;
  nodeName: string;
  location: string;
  forecastDate: string;
  estimatedEnergyKwh: number;
  peakPowerKw: number;
  sourceConfidence: string;
  generatedAt: string;
};

export type DailyForecastPredictionsResponse = {
  data: DailyForecastPrediction[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
};

export type BackendForecastHourlyPoint = {
  timestamp: string;
  estimatedPowerKw: number;
  cloudCoverPct: number | null;
  temperatureC: number | null;
  irradianceWm2: number | null;
  sources: string[];
};

export type BackendForecastDailyPoint = {
  date: string;
  estimatedEnergyKwh: number;
  peakPowerKw: number;
  avgCloudCoverPct: number | null;
  avgTemperatureC: number | null;
  sourceConfidence: 'low' | 'medium' | 'high';
  sources: string[];
};

export type BackendForecastResponse = {
  meta: {
    location: {
      lat: number;
      lon: number;
    };
    capacityKw: number;
    tilt: number;
    azimuth: number;
    generatedAt: string;
    cacheTtlMs: number;
    dataSourcesUsed: string[];
    fallbackMessages: string[];
  };
  hourly: BackendForecastHourlyPoint[];
  daily: BackendForecastDailyPoint[];
};

export type ForecastNodeProfile = {
  id?: string;
  name: string;
  lat: number;
  lon: number;
  capacity: number;
};

export type AuthResponse = {
  user: {
    id: string;
    email: string;
    name: string;
    role: 'operator' | 'manager' | 'admin' | 'developer';
    lastLoginAt: string | null;
    createdAt: string;
  };
  token: string;
};

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: 'operator' | 'manager' | 'admin' | 'developer';
};

const API_BASE_URL =
(import.meta.env.VITE_API_BASE_URL as string | undefined) ??
'http://localhost:4000/api';
const AUTH_TOKEN_KEY = 'gridflex_token';
const DEFAULT_FORECAST_CAPACITY_KW = 120;

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  auth?: boolean;
  skipRefresh?: boolean;
};

export function getAuthToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearAuthToken(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(normalized);
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
};

export function getSessionUserFromToken(token: string): SessionUser | null {
  const payload = decodeJwtPayload(token);
  if (!payload) return null;

  const exp = payload.exp;
  if (typeof exp === 'number' && exp * 1000 <= Date.now()) {
    return null;
  }

  const id = payload.sub;
  const email = payload.email;
  const name = payload.name;
  const role = payload.role;
  if (typeof id !== 'string' || typeof email !== 'string' || typeof name !== 'string' || (
  role !== 'operator' &&
  role !== 'manager' &&
  role !== 'admin' &&
  role !== 'developer'))
  {
    return null;
  }

  return {
    id,
    email,
    name,
    role
  };
}

async function apiRequest<T>(
path: string,
options: RequestOptions = {})
: Promise<T> {
  const { method = 'GET', body, headers, auth = false, skipRefresh = false } = options;

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers ?? {})
  };

  if (auth) {
    const token = getAuthToken();
    if (!token) {
      throw new Error('Missing authentication token.');
    }
    requestHeaders.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: requestHeaders,
    credentials: 'include',
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  if (response.status === 401 && auth && !skipRefresh) {
    const refreshed = await tryRefreshAccessToken();
    if (refreshed) {
      return apiRequest<T>(path, {
        ...options,
        skipRefresh: true
      });
    }
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => ({} as {message?: string;}));
    throw new Error(payload.message ?? `Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function loginWithPassword(
email: string,
password: string)
: Promise<AuthResponse> {
  const result = await apiRequest<AuthResponse>('/auth/login', {
    method: 'POST',
    body: {
      email,
      password
    }
  });
  setAuthToken(result.token);
  return result;
}

export async function registerWithPassword(
name: string,
email: string,
password: string)
: Promise<AuthResponse> {
  const result = await apiRequest<AuthResponse>('/auth/register', {
    method: 'POST',
    body: {
      name,
      email,
      password
    }
  });
  setAuthToken(result.token);
  return result;
}

export async function tryRefreshAccessToken(): Promise<boolean> {
  try {
    const response = await apiRequest<AuthResponse>('/auth/refresh', {
      method: 'POST',
      skipRefresh: true
    });
    setAuthToken(response.token);
    return true;
  } catch {
    clearAuthToken();
    return false;
  }
}

export async function logoutSession(): Promise<void> {
  try {
    await apiRequest<{message: string;}>('/auth/logout', {
      method: 'POST',
      skipRefresh: true
    });
  } finally {
    clearAuthToken();
  }
}

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  const response = await apiRequest<ApiEnvelope<DashboardSummary>>('/dashboard/summary', {
    auth: true
  });
  return response.data;
}

export async function fetchOperatingMode(): Promise<import('../lib/operatingMode').OperatingModeResponse> {
  const response = await apiRequest<{ data: import('../lib/operatingMode').OperatingModeResponse }>(
    '/operating-mode',
    { auth: false }
  );
  return response.data;
}

export async function fetchAdminDashboardSummary(): Promise<AdminDashboardSummary> {
  const response = await apiRequest<ApiEnvelope<AdminDashboardSummary>>('/dashboard/admin', {
    auth: true
  });
  return response.data;
}

export async function fetchAdminOverview(): Promise<AdminPlatformOverview> {
  const response = await apiRequest<ApiEnvelope<AdminPlatformOverview>>('/admin/overview', {
    auth: true
  });
  return response.data;
}

export async function fetchAdminUsers(): Promise<AdminUser[]> {
  const response = await apiRequest<ApiEnvelope<AdminUser[]>>('/admin/users', {
    auth: true
  });
  return response.data;
}

export async function updateAdminUserRole(
  id: string,
  role: 'operator' | 'manager' | 'admin' | 'developer'
): Promise<void> {
  await apiRequest<{ data: AdminUser }>(`/admin/users/${id}/role`, {
    method: 'PATCH',
    auth: true,
    body: { role }
  });
}

export async function updateAdminUserSite(
  id: string,
  siteId: string | null
): Promise<void> {
  await apiRequest<{ data: AdminUser }>(`/admin/users/${id}/site`, {
    method: 'PATCH',
    auth: true,
    body: { siteId }
  });
}

export async function adminResetUserPassword(
  id: string,
  newPassword: string
): Promise<void> {
  await apiRequest<{ message: string }>(`/admin/users/${id}/password`, {
    method: 'PATCH',
    auth: true,
    body: { newPassword }
  });
}

export async function updateManagerOperatorProvisioning(
  managerId: string,
  body: { enabled: boolean; maxOperators?: number }
): Promise<void> {
  await apiRequest<{ data: unknown }>(`/admin/users/${managerId}/operator-provisioning`, {
    method: 'PATCH',
    auth: true,
    body
  });
}

export async function fetchManagerTeamOverview(): Promise<ManagerTeamOverview> {
  const response = await apiRequest<ApiEnvelope<ManagerTeamOverview>>('/team/overview', {
    auth: true
  });
  return response.data;
}

export async function createManagedOperator(body: {
  name: string;
  email: string;
  password: string;
}): Promise<ManagerTeamOverview['operators'][number]> {
  const response = await apiRequest<ApiEnvelope<ManagerTeamOverview['operators'][number]>>('/team/operators', {
    method: 'POST',
    auth: true,
    body
  });
  return response.data;
}

export async function fetchManagerTeamActivity(params: { page?: number; pageSize?: number } = {}): Promise<{
  page: number;
  pageSize: number;
  total: number;
  data: TeamActivityLog[];
}> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiRequest<{
    page: number;
    pageSize: number;
    total: number;
    data: TeamActivityLog[];
  }>(`/team/activity${suffix}`, { auth: true });
}

export async function recordUserActivity(body: {
  action: string;
  message?: string;
  metadata?: unknown;
  entityType?: string;
  entityId?: string;
}): Promise<void> {
  await apiRequest<{ message: string }>('/activity', {
    method: 'POST',
    auth: true,
    body
  });
}

export async function fetchAdminNodesOverview(): Promise<AdminMonitoringNode[]> {
  const response = await apiRequest<ApiEnvelope<AdminMonitoringNode[]>>('/admin/nodes', {
    auth: true
  });
  return response.data;
}

export async function fetchAdminMetrics(): Promise<AdminMetricsSnapshot> {
  const response = await apiRequest<ApiEnvelope<AdminMetricsSnapshot>>('/admin/metrics', {
    auth: true
  });
  return response.data;
}

export type AlarmCentreEvent = {
  id: string;
  organisationId: string;
  siteId: string;
  severity: string;
  status: string;
  title: string;
  message: string;
  metricKey?: string | null;
  metricValue?: number | null;
  startedAt: string;
};

export type AlarmCentreIncident = {
  id: string;
  organisationId: string;
  siteId: string;
  severity: string;
  status: string;
  title: string;
  openedAt: string;
  _count?: { alarmEvents: number };
};

export async function fetchAlarmEvents(params: { status?: string; siteId?: string } = {}): Promise<AlarmCentreEvent[]> {
  const search = new URLSearchParams();
  if (params.status) search.set('status', params.status);
  if (params.siteId) search.set('siteId', params.siteId);
  const query = search.toString();
  const response = await apiRequest<ApiEnvelope<AlarmCentreEvent[]>>(`/alarm-events${query ? `?${query}` : ''}`, {
    auth: true
  });
  return response.data;
}

export async function acknowledgeAlarmEvent(alarmEventId: string, note?: string): Promise<unknown> {
  const response = await apiRequest<ApiEnvelope<unknown>>(`/alarm-events/${alarmEventId}/acknowledge`, {
    method: 'POST',
    auth: true,
    body: note ? { note } : {}
  });
  return response.data;
}

export async function fetchIncidents(): Promise<AlarmCentreIncident[]> {
  const response = await apiRequest<ApiEnvelope<AlarmCentreIncident[]>>('/incidents', {
    auth: true
  });
  return response.data;
}

export async function fetchAdminAuditLogs(params: { page?: number; pageSize?: number; userId?: string } = {}): Promise<{
  page: number;
  pageSize: number;
  total: number;
  data: AdminAuditLog[];
}> {
  const search = new URLSearchParams();
  if (typeof params.page === 'number') search.set('page', String(params.page));
  if (typeof params.pageSize === 'number') search.set('pageSize', String(params.pageSize));
  if (params.userId) search.set('userId', params.userId);
  const query = search.toString();

  return apiRequest<{
    page: number;
    pageSize: number;
    total: number;
    data: AdminAuditLog[];
  }>(`/admin/logs${query ? `?${query}` : ''}`, {
    auth: true
  });
}

export async function runAdminClearForecastCache(): Promise<AdminQuickActionResult> {
  const response = await apiRequest<ApiEnvelope<AdminQuickActionResult>>('/admin/actions/clear-forecast-cache', {
    method: 'POST',
    auth: true
  });
  return response.data;
}

export async function runAdminTestNotification(): Promise<AdminQuickActionResult> {
  const response = await apiRequest<ApiEnvelope<AdminQuickActionResult>>('/admin/actions/test-notification', {
    method: 'POST',
    auth: true
  });
  return response.data;
}

export async function fetchAdminClients(): Promise<AdminClient[]> {
  const response = await apiRequest<ApiEnvelope<AdminClient[]>>('/admin/clients', {
    auth: true
  });
  return response.data;
}

export async function createAdminClient(payload: {
  name: string;
  slug: string;
  contactEmail?: string;
  status?: 'active' | 'inactive';
}): Promise<void> {
  await apiRequest<{data: unknown;}>('/admin/clients', {
    method: 'POST',
    auth: true,
    body: payload
  });
}

export async function fetchAdminSites(): Promise<AdminSite[]> {
  const response = await apiRequest<ApiEnvelope<AdminSite[]>>('/admin/sites', {
    auth: true
  });
  return response.data;
}

export async function createAdminSite(payload: {
  clientId: string;
  name: string;
  code: string;
  location: string;
  timezone?: string;
}): Promise<void> {
  await apiRequest<{data: unknown;}>('/admin/sites', {
    method: 'POST',
    auth: true,
    body: payload
  });
}

export async function fetchAdminNodes(): Promise<AdminNode[]> {
  const response = await apiRequest<ApiEnvelope<AdminNode[]>>('/admin/nodes-managed', {
    auth: true
  });
  return response.data;
}

export async function updateAdminNode(
id: string,
payload: {
  name?: string;
  serialNumber?: string;
  location?: string;
  latitude?: number | null;
  longitude?: number | null;
  status?: NodeStatus;
  firmwareVersion?: string | null;
  batteryLevel?: number | null;
  signalStrength?: number | null;
  isActive?: boolean;
  siteId?: string | null;
}
): Promise<void> {
  await apiRequest<{data: unknown;}>(`/admin/nodes/${id}`, {
    method: 'PATCH',
    auth: true,
    body: payload
  });
}

export async function fetchAdminApiCredentials(): Promise<AdminApiCredential[]> {
  const response = await apiRequest<ApiEnvelope<AdminApiCredential[]>>('/admin/api-credentials', {
    auth: true
  });
  return response.data;
}

export async function fetchAdminBillingAccounts(): Promise<AdminBillingAccount[]> {
  const response = await apiRequest<ApiEnvelope<AdminBillingAccount[]>>('/admin/billing-accounts', {
    auth: true
  });
  return response.data;
}

export async function createAdminBillingAccount(payload: {
  clientId: string;
  plan: 'starter' | 'pro' | 'enterprise';
  status: 'active' | 'suspended' | 'past_due';
  billingEmail?: string;
  taxId?: string;
}): Promise<void> {
  await apiRequest<{data: unknown;}>('/admin/billing-accounts', {
    method: 'POST',
    auth: true,
    body: payload
  });
}

export async function updateAdminBillingAccount(id: string, payload: {
  plan?: 'starter' | 'pro' | 'enterprise';
  status?: 'active' | 'suspended' | 'past_due';
  billingEmail?: string;
  taxId?: string;
}): Promise<void> {
  await apiRequest<{data: unknown;}>(`/admin/billing-accounts/${id}`, {
    method: 'PATCH',
    auth: true,
    body: payload
  });
}

export async function deleteAdminBillingAccount(id: string): Promise<void> {
  await apiRequest<{message: string;}>(`/admin/billing-accounts/${id}`, {
    method: 'DELETE',
    auth: true
  });
}

export async function createAdminApiCredential(payload: {
  provider: 'openai' | 'openweather' | 'accuweather' | 'custom';
  name: string;
  apiKey: string;
  clientId?: string;
  siteId?: string;
  notes?: string;
  isActive?: boolean;
}): Promise<void> {
  await apiRequest<{data: unknown;}>('/admin/api-credentials', {
    method: 'POST',
    auth: true,
    body: payload
  });
}

export async function deleteAdminClient(id: string): Promise<void> {
  await apiRequest<{message: string;}>(`/admin/clients/${id}`, {
    method: 'DELETE',
    auth: true
  });
}

export async function deleteAdminSite(id: string): Promise<void> {
  await apiRequest<{message: string;}>(`/admin/sites/${id}`, {
    method: 'DELETE',
    auth: true
  });
}

export async function deleteAdminApiCredential(id: string): Promise<void> {
  await apiRequest<{message: string;}>(`/admin/api-credentials/${id}`, {
    method: 'DELETE',
    auth: true
  });
}

export type DeviceCredentialSummary = {
  id: string;
  credentialId: string;
  keyVersion: number;
  status: string;
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  rotatedAt: string | null;
};

export type ProvisionedDeviceCredential = {
  credentialId: string;
  keyVersion: number;
  secret: string;
  secretHashAlgorithm: string;
  signingNote: string;
  expiresAt: string | null;
};

export async function fetchDeviceCredentials(edgeNodeId: string): Promise<DeviceCredentialSummary[]> {
  const response = await apiRequest<ApiEnvelope<DeviceCredentialSummary[]>>(`/admin/nodes/${edgeNodeId}/credentials`, {
    auth: true
  });
  return response.data;
}

export async function provisionDeviceCredential(edgeNodeId: string): Promise<ProvisionedDeviceCredential> {
  const response = await apiRequest<{ message: string; data: ProvisionedDeviceCredential }>(
    `/admin/nodes/${edgeNodeId}/credentials`,
    {
      method: 'POST',
      auth: true,
      body: JSON.stringify({})
    }
  );
  return response.data;
}

export async function revokeDeviceCredential(credentialId: string): Promise<void> {
  await apiRequest<{ data: unknown }>(`/admin/credentials/${credentialId}/revoke`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify({})
  });
}

export type PlantSummary = {
  id: string;
  name: string;
  code: string;
  organisationId: string;
  siteId: string;
  status: string;
  dataSourceType: string;
  installedCapacityKw: number;
  exportCapacityKw: number;
};

export type AssetSummary = {
  id: string;
  plantId: string;
  parentAssetId: string | null;
  type: string;
  name: string;
  status: string;
  dataSourceType: string;
  ratedPowerKw: number | null;
  ratedEnergyKwh: number | null;
};

export async function fetchPlants(): Promise<PlantSummary[]> {
  const response = await apiRequest<ApiEnvelope<PlantSummary[]>>('/plants', { auth: true });
  return response.data;
}

export type CurtailmentEventSummary = {
  id: string;
  organisationId: string;
  siteId: string;
  plantId: string;
  startTime: string;
  endTime: string | null;
  status: string;
  cause: string;
  causeConfidence: number;
  availablePowerKw: number;
  actualPowerKw: number;
  curtailedPowerKw: number;
  estimatedLostEnergyKwh: number;
  recoverableEnergyKwh: number;
  calculationVersion: string;
  operatorNotes: string | null;
  reviewedAt: string | null;
  plant?: { id: string; name: string; code: string; dataSourceType: string };
  corrections?: Array<{ id: string; notes: string; createdAt: string }>;
};

export type ForecastAccuracyScoreRow = {
  id: string;
  plantId: string;
  horizonMinutes: number;
  provider: string | null;
  maeKw: number;
  rmseKw: number;
  mapePercent: number | null;
  biasKw: number;
  sampleCount: number;
  scoredAt: string;
  periodStart: string;
  periodEnd: string;
};

export type GridConstraintRow = {
  id: string;
  organisationId: string;
  siteId: string;
  plantId: string | null;
  constraintType: string;
  name: string;
  limitValue: number;
  unit: string;
  sourceType: string;
  quality: string;
  provenance: unknown;
  notes: string | null;
};

export async function fetchCurtailmentEvents(params: {
  plantId?: string;
  status?: string;
  limit?: number;
} = {}): Promise<CurtailmentEventSummary[]> {
  const search = new URLSearchParams();
  if (params.plantId) search.set('plantId', params.plantId);
  if (params.status) search.set('status', params.status);
  if (params.limit) search.set('limit', String(params.limit));
  const query = search.toString();
  const response = await apiRequest<ApiEnvelope<CurtailmentEventSummary[]>>(
    `/curtailment/events${query ? `?${query}` : ''}`,
    { auth: true }
  );
  return response.data;
}

export async function fetchCurtailmentEvent(eventId: string): Promise<CurtailmentEventSummary> {
  const response = await apiRequest<ApiEnvelope<CurtailmentEventSummary>>(
    `/curtailment/events/${eventId}`,
    { auth: true }
  );
  return response.data;
}

export async function reviewCurtailmentEvent(
  eventId: string,
  payload: {
    status?: string;
    operatorNotes?: string;
  }
): Promise<CurtailmentEventSummary> {
  const response = await apiRequest<ApiEnvelope<CurtailmentEventSummary>>(
    `/curtailment/events/${eventId}/review`,
    { method: 'PATCH', auth: true, body: payload }
  );
  return response.data;
}

export async function fetchForecastAccuracyScores(params: {
  plantId?: string;
  horizonMinutes?: number;
  limit?: number;
} = {}): Promise<ForecastAccuracyScoreRow[]> {
  const search = new URLSearchParams();
  if (params.plantId) search.set('plantId', params.plantId);
  if (params.horizonMinutes) search.set('horizonMinutes', String(params.horizonMinutes));
  if (params.limit) search.set('limit', String(params.limit));
  const query = search.toString();
  const response = await apiRequest<ApiEnvelope<ForecastAccuracyScoreRow[]>>(
    `/forecast-accuracy/scores${query ? `?${query}` : ''}`,
    { auth: true }
  );
  return response.data;
}

export async function fetchGridConstraints(params: {
  plantId?: string;
  siteId?: string;
} = {}): Promise<GridConstraintRow[]> {
  const search = new URLSearchParams();
  if (params.plantId) search.set('plantId', params.plantId);
  if (params.siteId) search.set('siteId', params.siteId);
  const query = search.toString();
  const response = await apiRequest<
    ApiEnvelope<GridConstraintRow[]> & { meta?: { hasRealConstraints?: boolean; simulationFallback?: boolean } }
  >(`/grid-constraints${query ? `?${query}` : ''}`, { auth: true });
  return response.data;
}

export async function fetchPlantAssets(plantId: string): Promise<AssetSummary[]> {
  const response = await apiRequest<ApiEnvelope<AssetSummary[]>>(`/plants/${plantId}/assets`, { auth: true });
  return response.data;
}

export async function fetchNodes(params: {
  siteId?: string;
  status?: NodeStatus;
  serialNumber?: string;
  search?: string;
} = {}): Promise<BackendNode[]> {
  const search = new URLSearchParams();
  if (params.siteId) search.set('siteId', params.siteId);
  if (params.status) search.set('status', params.status);
  if (params.serialNumber) search.set('serialNumber', params.serialNumber);
  if (params.search) search.set('search', params.search);
  const query = search.toString();
  const response = await apiRequest<ApiEnvelope<BackendNode[]>>(`/nodes${query ? `?${query}` : ''}`, {
    auth: true
  });
  return response.data;
}

export async function fetchNodeDetail(id: string): Promise<BackendNodeDetail> {
  const response = await apiRequest<ApiEnvelope<BackendNodeDetail>>(`/nodes/${id}`, {
    auth: true
  });
  return response.data;
}

export async function createNode(payload: {
  name: string;
  serialNumber: string;
  siteId?: string | null;
  location: string;
  latitude?: number | null;
  longitude?: number | null;
  status?: NodeStatus;
  firmwareVersion?: string | null;
  batteryLevel?: number | null;
  signalStrength?: number | null;
  installedAt?: string;
  deviceKey?: string | null;
  isActive?: boolean;
}): Promise<BackendNodeDetail> {
  const response = await apiRequest<ApiEnvelope<BackendNodeDetail>>('/nodes', {
    method: 'POST',
    auth: true,
    body: payload
  });
  return response.data;
}

export async function updateNode(id: string, payload: Partial<{
  name: string;
  serialNumber: string;
  siteId: string | null;
  location: string;
  latitude: number | null;
  longitude: number | null;
  status: NodeStatus;
  firmwareVersion: string | null;
  batteryLevel: number | null;
  signalStrength: number | null;
  installedAt: string;
  deviceKey: string | null;
  isActive: boolean;
}>): Promise<BackendNodeDetail> {
  const response = await apiRequest<ApiEnvelope<BackendNodeDetail>>(`/nodes/${id}`, {
    method: 'PATCH',
    auth: true,
    body: payload
  });
  return response.data;
}

export async function deleteNode(id: string): Promise<void> {
  await apiRequest<{ message: string }>(`/nodes/${id}`, {
    method: 'DELETE',
    auth: true
  });
}

export async function runNodeBulkAction(payload: {
  nodeIds: string[];
  action: 'assignSite' | 'updateStatus' | 'remoteRestart';
  siteId?: string | null;
  status?: NodeStatus;
}): Promise<{ action: string; affected: number; executedAt: string }> {
  const response = await apiRequest<ApiEnvelope<{ action: string; affected: number; executedAt: string }>>('/nodes/bulk-actions', {
    method: 'POST',
    auth: true,
    body: payload
  });
  return response.data;
}

export async function requestNodeMaintenance(id: string, payload: {
  issueType: string;
  description: string;
}): Promise<NodeMaintenanceRequest> {
  const response = await apiRequest<ApiEnvelope<NodeMaintenanceRequest>>(`/nodes/${id}/maintenance-requests`, {
    method: 'POST',
    auth: true,
    body: payload
  });
  return response.data;
}

export function buildForecastProfilesFromNodes(
backendNodes: BackendNode[],
selectedNodeNames: string[]
): ForecastNodeProfile[] {
  const hasSpecificNodeScope = !selectedNodeNames.includes('All Nodes');
  const scopedNodes = hasSpecificNodeScope ?
  backendNodes.filter((node) => selectedNodeNames.includes(node.name)) :
  backendNodes;

  return scopedNodes.flatMap((node) => {
    if (typeof node.latitude !== 'number' || typeof node.longitude !== 'number') {
      return [];
    }

    const baselinePower = node.lastReading?.power ?? node.latestReadingSummary.avgPower24h;
    const inferredCapacity = Math.max(120, Math.round((baselinePower ?? 120) * 1.25));
    return [{
      id: node.id,
      name: node.name,
      lat: node.latitude,
      lon: node.longitude,
      capacity: inferredCapacity
    }];
  });
}

export async function fetchReadings(params: {
  nodeId?: string;
  limit?: number;
  startDate?: string;
  endDate?: string;
  sort?: 'asc' | 'desc';
}): Promise<BackendReading[]> {
  const search = new URLSearchParams();
  if (params.nodeId) search.set('nodeId', params.nodeId);
  if (params.limit) search.set('limit', String(params.limit));
  if (params.startDate) search.set('startDate', params.startDate);
  if (params.endDate) search.set('endDate', params.endDate);
  if (params.sort) search.set('sort', params.sort);

  const response = await apiRequest<ApiEnvelope<BackendReading[]>>(`/readings?${search.toString()}`, {
    auth: true
  });
  return response.data;
}

export async function fetchReadingsSummary(params: {
  nodeId?: string;
  startDate?: string;
  endDate?: string;
} = {}): Promise<ReadingsSummaryPoint[]> {
  const search = new URLSearchParams();
  if (params.nodeId) search.set('nodeId', params.nodeId);
  if (params.startDate) search.set('startDate', params.startDate);
  if (params.endDate) search.set('endDate', params.endDate);

  const query = search.toString();
  const response = await apiRequest<ApiEnvelope<ReadingsSummaryPoint[]>>(`/readings/summary${query ? `?${query}` : ''}`, {
    auth: true
  });
  return response.data;
}

export async function fetchForecastProvidersStatus(): Promise<ForecastProvidersStatus> {
  return apiRequest<ForecastProvidersStatus>('/forecast/providers/status', {
    auth: true
  });
}

export async function fetchForecastProvidersHistory(): Promise<ForecastProvidersHistory> {
  return apiRequest<ForecastProvidersHistory>('/forecast/providers/history', {
    auth: true
  });
}

export async function fetchDailyForecastPredictions(params: {
  nodeId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}): Promise<DailyForecastPredictionsResponse> {
  const search = new URLSearchParams();
  if (params.nodeId) search.set('nodeId', params.nodeId);
  if (params.startDate) search.set('startDate', params.startDate);
  if (params.endDate) search.set('endDate', params.endDate);
  search.set('page', String(params.page ?? 1));
  search.set('pageSize', String(params.pageSize ?? 30));

  return apiRequest<DailyForecastPredictionsResponse>(`/forecast/daily-predictions?${search.toString()}`, {
    auth: true
  });
}

export async function fetchForecast(params: {
  lat: number;
  lon: number;
  capacity?: number;
  tilt?: number;
  azimuth?: number;
}): Promise<BackendForecastResponse> {
  const search = new URLSearchParams({
    lat: String(params.lat),
    lon: String(params.lon),
    capacity: String(params.capacity ?? DEFAULT_FORECAST_CAPACITY_KW)
  });

  if (typeof params.tilt === 'number') {
    search.set('tilt', String(params.tilt));
  }
  if (typeof params.azimuth === 'number') {
    search.set('azimuth', String(params.azimuth));
  }

  return apiRequest<BackendForecastResponse>(`/forecast?${search.toString()}`, {
    auth: true
  });
}

// Mock data fetchers (replace with actual API calls)
export async function fetchElectrolyzerStatus(): Promise<ElectrolyzerStatus> {
  const summary = await fetchDashboardSummary();
  return {
    loadMW: Math.max(0, Number(summary.averages.inverterPower.toFixed(1))),
    productionRate: Math.max(0, Number((summary.averages.power * 1.2).toFixed(1))),
    efficiency: 52.4,
    lcoh: 45.2,
    mode: 'excess',
    waterUsage: Math.max(1000, Number((summary.averages.power * 10).toFixed(0))),
    stackTemp: 72
  };
}

export async function fetchDispatchRecommendations(): Promise<
  DispatchRecommendation[]>
{
  const [summary, nodes] = await Promise.all([
    fetchDashboardSummary(),
    fetchNodes()
  ]);
  const primaryNode = nodes[0];
  const curtailmentMw = summary.averages.curtailment;
  const inverterMw = summary.averages.inverterPower;
  const powerMw = summary.averages.power;
  const onlineRatio = summary.nodes.total > 0 ? summary.nodes.online / summary.nodes.total : 0;

  const recommendations: DispatchRecommendation[] = [
    {
      id: 1,
      type: 'curtailment',
      title: curtailmentMw > 2 ? 'Reduce curtailment pressure now' : 'Maintain current curtailment strategy',
      description: curtailmentMw > 2 ?
        `Average curtailment is ${curtailmentMw.toFixed(2)} MW. Prioritize rerouting excess generation to flexible loads.` :
        `Curtailment is ${curtailmentMw.toFixed(2)} MW. Keep dispatch plan and continue monitoring.`,
      impact: `${curtailmentMw.toFixed(2)} MW current curtailment signal`,
      status: curtailmentMw > 2 ? 'pending' : 'approved'
    },
    {
      id: 2,
      type: 'battery',
      title: 'Align battery schedule with inverter profile',
      description: `Inverter output averages ${inverterMw.toFixed(2)} MW. Charge during surplus periods and reserve discharge for peak demand windows.`,
      impact: `Base dispatch load ${powerMw.toFixed(2)} MW`,
      status: 'pending'
    },
    {
      id: 3,
      type: 'dispatch',
      title: 'Stabilize fleet availability',
      description: `${summary.nodes.online}/${summary.nodes.total} nodes are online${primaryNode ? `, anchored by ${primaryNode.name}` : ''}. Prioritize dispatch on online assets to reduce outage risk.`,
      impact: `${Math.round(onlineRatio * 100)}% node availability`,
      status: onlineRatio > 0.8 ? 'approved' : 'pending'
    }
  ];

  if (curtailmentMw > 0.8) {
    recommendations.push({
      id: 4,
      type: 'hyshift',
      title: 'Route excess power to HyShift',
      description: 'Use electrolyzer demand response to absorb curtailed generation before issuing down-dispatch commands.',
      impact: `Potentially recover up to ${Math.max(1, Math.round(curtailmentMw * 0.7))} MW`,
      status: 'pending'
    });
  }

  return recommendations;
}

export async function fetchOptimisationRuns(plantId?: string): Promise<OptimisationRunSummary[]> {
  const query = plantId ? `?plantId=${encodeURIComponent(plantId)}` : '';
  const response = await apiRequest<ApiEnvelope<OptimisationRunSummary[]>>(`/optimisation/runs${query}`);
  return response.data;
}

export async function submitAIPrompt(
prompt: string,
context?: string)
: Promise<{response: string;confidence: number;}> {
  // Simulate AI processing
  await new Promise((resolve) => setTimeout(resolve, 1500));

  return {
    response: `Analysis for "${prompt}": Based on current grid conditions in the Northern Cape, increasing electrolyzer load at Upington would reduce curtailment by 18% while maintaining grid stability within 50.05Hz limits.`,
    confidence: 0.94
  };
}

export async function fetchAIInsightForecast(
prompt: string,
region = 'Free State')
: Promise<AIInsightForecast> {
  const regionCoordinates: Record<string, {lat: number;lon: number;}> = {
    'Free State': {
      lat: -29.0852,
      lon: 26.1596
    },
    Upington: {
      lat: -28.4478,
      lon: 21.2561
    },
    'De Aar': {
      lat: -30.6499,
      lon: 24.0123
    },
    Prieska: {
      lat: -29.6699,
      lon: 22.7447
    }
  };
  const selected = regionCoordinates[region] ?? regionCoordinates['Free State'];

  try {
    const forecast = await fetchForecast({
      lat: selected.lat,
      lon: selected.lon,
      capacity: DEFAULT_FORECAST_CAPACITY_KW
    });

    const points = forecast.hourly.slice(0, 8);
    const solar = points.map((point) => ({
      time: new Date(point.timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      }),
      p10: Number((point.estimatedPowerKw * 0.82).toFixed(1)),
      p50: Number(point.estimatedPowerKw.toFixed(1)),
      p90: Number((point.estimatedPowerKw * 1.18).toFixed(1))
    }));
    const wind = points.map((point) => {
      const baseline = Math.max(0, point.estimatedPowerKw * 0.35);
      return {
        time: new Date(point.timestamp).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
        }),
        p10: Number((baseline * 0.78).toFixed(1)),
        p50: Number(baseline.toFixed(1)),
        p90: Number((baseline * 1.24).toFixed(1))
      };
    });
    const load = points.map((point) => {
      const baseline = Math.max(0, point.estimatedPowerKw * 1.65 + 80);
      return {
        time: new Date(point.timestamp).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
        }),
        p10: Number((baseline * 0.93).toFixed(1)),
        p50: Number(baseline.toFixed(1)),
        p90: Number((baseline * 1.08).toFixed(1))
      };
    });

    return {
      summary: `Backend hybrid forecast for ${region} indicates ${
      points.some((p) => (p.cloudCoverPct ?? 0) > 70) ?
      'intermittent cloud-driven production swings.' :
      'relatively stable PV output.'
      }`,
      confidence: forecast.meta.dataSourcesUsed.length >= 2 ? 0.9 : 0.78,
      model: 'Ensemble',
      weatherSignal: forecast.meta.fallbackMessages[0] ?? 'OpenWeather + Forecast.Solar hybrid signal is healthy.',
      drivers: [
      `Prompt intent detected: ${prompt.slice(0, 72)}`,
      `Providers used: ${forecast.meta.dataSourcesUsed.join(', ')}`,
      `Avg cloud cover (daily): ${forecast.daily[0]?.avgCloudCoverPct ?? 0}%`,
      `Expected peak power: ${forecast.daily[0]?.peakPowerKw ?? 0} kW`],
      solar,
      wind,
      load
    };
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 400));
    return {
      summary: `AI-native forecast fallback for ${region}: backend forecast unavailable, using resilient local estimate.`,
      confidence: 0.7,
      model: 'Ensemble',
      weatherSignal: 'Fallback mode',
      drivers: [
      `Prompt intent detected: ${prompt.slice(0, 72)}`,
      'Forecast endpoint unavailable; using baseline assumptions'],
      solar: [],
      wind: [],
      load: []
    };
  }
}

export async function fetchProactiveAlerts(): Promise<ProactiveAlert[]> {
  const summary = await fetchDashboardSummary();
  const severity = summary.averages.curtailment > 5 ? 'high' : summary.averages.curtailment > 2 ? 'medium' : 'info';

  return [{
    id: 'backend-alert-curtailment',
    issuedAt: new Date(),
    severity,
    title: 'Live curtailment signal detected',
    recommendation: `Average curtailment in latest window is ${summary.averages.curtailment.toFixed(2)} MW. Review dispatch strategy.`,
    trigger: `${summary.readingsWindow} recent readings analyzed from backend stream.`,
    actionPage: 'dispatch'
  }];
}

export async function fetchDynamicLineRatings():
Promise<DynamicLineRatingSnapshot[]> {
  const response = await apiRequest<ApiEnvelope<DynamicLineRatingSnapshot[]>>('/simulation/dynamic-line-ratings', {
    auth: true
  });
  return response.data;
}

export async function optimizeGETTopology(): Promise<GETOptimizationResult> {
  const response = await apiRequest<ApiEnvelope<GETOptimizationResult>>('/simulation/get-optimization', {
    auth: true
  });
  return response.data;
}

export async function fetchHydrogenTwinState(): Promise<HydrogenTwinState> {
  const response = await apiRequest<ApiEnvelope<HydrogenTwinState>>('/simulation/hydrogen-twin', {
    auth: true
  });
  return response.data;
}

export async function fetchESGMetrics(): Promise<ESGMetric[]> {
  const now = new Date();
  const endDate = now.toISOString();
  const startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [dashboard, dailySummary] = await Promise.all([
    fetchDashboardSummary(),
    fetchReadingsSummary({ startDate, endDate })
  ]);
  const totalEnergyKwh = dailySummary.reduce((total, row) => total + row.totalEnergyKwh, 0);
  const avgCurtailmentMw = dashboard.averages.curtailment;
  const renewableShare = Math.max(0, Math.min(100, 100 - avgCurtailmentMw * 4));
  const co2AvoidedTonnes = totalEnergyKwh * 0.0009;
  const waterIntensity = Math.max(4.5, 10 - renewableShare / 20);
  const greenCredits = Math.round(totalEnergyKwh / 8);

  return [
    {
      key: 'co2_avoided',
      label: 'CO2 Avoided',
      value: Number(co2AvoidedTonnes.toFixed(2)),
      unit: 'tCO2e',
      changePercent: 8.4
    },
    {
      key: 'water_intensity',
      label: 'Water Intensity',
      value: Number(waterIntensity.toFixed(2)),
      unit: 'L/kg H2',
      changePercent: -3.1
    },
    {
      key: 'renewable_h2_share',
      label: 'Renewable H2 Share',
      value: Number(renewableShare.toFixed(1)),
      unit: '%',
      changePercent: 4.7
    },
    {
      key: 'verified_green_credits',
      label: 'Verified Green Credits',
      value: greenCredits,
      unit: 'tokens',
      changePercent: 6.2
    }
  ];
}

export async function fetchIoTEdgeAssets(): Promise<IoTEdgeAsset[]> {
  const nodes = await fetchNodes();
  return nodes.map((node) => ({
    id: node.id,
    name: node.name,
    type: 'microgrid',
    location: node.location,
    health: node.status === 'offline' ? 'critical' : node.status === 'maintenance' || node.alerts.length > 0 ? 'degraded' : 'good',
    powerMw: Number((node.lastReading?.power ?? 0).toFixed(1)),
    edgeForecastConfidence: node.status === 'online' ? Math.max(0.72, node.healthScore / 100) : 0.74
  }));
}

export async function fetchCongestionNodes(nodeProfiles?: ForecastNodeProfile[]): Promise<CongestionNode[]> {
  const response = await apiRequest<ApiEnvelope<CongestionNode[]>>('/simulation/congestion-nodes', {
    method: 'POST',
    auth: true,
    body: {
      profiles: nodeProfiles?.length ? nodeProfiles : undefined
    }
  });
  return response.data;
}

export async function generatePilotReport(): Promise<PilotReport> {
  const response = await apiRequest<ApiEnvelope<PilotReport>>('/simulation/pilot-report', {
    auth: true
  });
  return response.data;
}

export type AdvisoryDispatchInterval = {
  intervalStart: string;
  intervalEnd: string;
  targetValue: number;
  assetId: string;
  status: string;
  expectedValue?: number | null;
  unit?: string;
};

export type AdvisoryOptimisationRunPayload = {
  id: string;
  status: string;
  objective: string;
  solverVersion: string;
  expectedBenefitZar: number | null;
  advisory: boolean;
  advisoryLabel?: string;
  baselineComparison?: {
    baselineObjectiveZar: number;
    optimisedObjectiveZar: number;
    deltaZar: number;
  } | null;
  schedules?: AdvisoryDispatchInterval[];
  result?: {
    expectedBenefitZar: number;
    objectiveValueZar: number;
    baselineComparison: {
      baselineObjectiveZar: number;
      optimisedObjectiveZar: number;
      deltaZar: number;
    };
  } | null;
};

/** Create a tenant-scoped advisory optimisation run (no physical actuation). */
export async function createAdvisoryOptimisationRun(body: {
  plantId: string;
  bessAssetId: string;
  electrolyserAssetId: string;
  objective?: string;
}): Promise<AdvisoryOptimisationRunPayload> {
  const response = await apiRequest<ApiEnvelope<AdvisoryOptimisationRunPayload>>(
    '/optimisation/runs',
    {
      method: 'POST',
      auth: true,
      body
    }
  );
  return response.data;
}

