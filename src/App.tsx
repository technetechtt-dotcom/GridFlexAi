import React, { Suspense, lazy } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FileDown, X } from 'lucide-react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';

import { ErrorBoundary } from './components/ErrorBoundary';
import { LoadingSpinner } from './components/LoadingSpinner';
import { Page, Sidebar } from './components/Sidebar';
import { AuthProvider, useAuth } from './context/AuthContext';
import { RealTimeProvider, useRealTime } from './context/RealTimeContext';
import { canAccessOpsCenter, isPlantManager } from './lib/roles';
import { PilotReportModal } from './components/PilotReportModal';
import { OperatingModeBanner } from './components/OperatingModeBanner';
import { ToastProvider } from './components/Toast';
import { LoginPage } from './pages/LoginPage';
import { usePilotStore } from './store/pilotStore';

const Dashboard = lazy(() => import('./pages/Dashboard').then((module) => ({ default: module.Dashboard })));
const NodeDashboard = lazy(() => import('./pages/NodeDashboard').then((module) => ({ default: module.NodeDashboard })));
const CongestionForecast = lazy(() => import('./pages/CongestionForecast').then((module) => ({ default: module.CongestionForecast })));
const DispatchOptimization = lazy(() => import('./pages/DispatchOptimization').then((module) => ({ default: module.DispatchOptimization })));
const ScenarioSimulation = lazy(() => import('./pages/ScenarioSimulation').then((module) => ({ default: module.ScenarioSimulation })));
const AIPromptInterface = lazy(() => import('./pages/AIPromptInterface').then((module) => ({ default: module.AIPromptInterface })));
const KPIReporting = lazy(() => import('./pages/KPIReporting').then((module) => ({ default: module.KPIReporting })));
const PlatformBlueprint = lazy(() => import('./pages/PlatformBlueprint').then((module) => ({ default: module.PlatformBlueprint })));
const TotalGeneration = lazy(() => import('./pages/TotalGeneration').then((module) => ({ default: module.TotalGeneration })));
const CurtailmentDetail = lazy(() => import('./pages/CurtailmentDetail').then((module) => ({ default: module.CurtailmentDetail })));
const RecoveryCommandCenter = lazy(() =>
  import('./pages/RecoveryCommandCenter').then((module) => ({ default: module.RecoveryCommandCenter }))
);
const RevenueDetail = lazy(() => import('./pages/RevenueDetail').then((module) => ({ default: module.RevenueDetail })));
const ForecastAccuracy = lazy(() => import('./pages/ForecastAccuracy').then((module) => ({ default: module.ForecastAccuracy })));
const GenerationVsForecast = lazy(() => import('./pages/GenerationVsForecast').then((module) => ({ default: module.GenerationVsForecast })));
const DispatchStatus = lazy(() => import('./pages/DispatchStatus').then((module) => ({ default: module.DispatchStatus })));
const AIInsights = lazy(() => import('./pages/AIInsights').then((module) => ({ default: module.AIInsights })));
const AllRecommendations = lazy(() => import('./pages/AllRecommendations').then((module) => ({ default: module.AllRecommendations })));
const HyShiftControl = lazy(() => import('./pages/HyShiftControl').then((module) => ({ default: module.HyShiftControl })));
const SectorCouplingSimulator = lazy(() => import('./pages/SectorCouplingSimulator').then((module) => ({ default: module.SectorCouplingSimulator })));
const ProviderDiagnostics = lazy(() => import('./pages/ProviderDiagnostics').then((module) => ({ default: module.ProviderDiagnostics })));

const AdminLayout = lazy(() => import('./pages/admin/AdminLayout').then((module) => ({ default: module.AdminLayout })));
const AdminOverview = lazy(() => import('./pages/admin/AdminOverview').then((module) => ({ default: module.AdminOverview })));
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage').then((module) => ({ default: module.AdminUsersPage })));
const AdminNodesPage = lazy(() => import('./pages/admin/AdminNodesPage').then((module) => ({ default: module.AdminNodesPage })));
const AdminBillingPage = lazy(() => import('./pages/admin/AdminBillingPage').then((module) => ({ default: module.AdminBillingPage })));
const AdminDataPage = lazy(() => import('./pages/admin/AdminDataPage').then((module) => ({ default: module.AdminDataPage })));
const AdminMetricsPage = lazy(() => import('./pages/admin/AdminMetricsPage').then((module) => ({ default: module.AdminMetricsPage })));
const AdminLogsPage = lazy(() => import('./pages/admin/AdminLogsPage').then((module) => ({ default: module.AdminLogsPage })));
const AdminAlarmsPage = lazy(() => import('./pages/admin/AdminAlarmsPage').then((module) => ({ default: module.AdminAlarmsPage })));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard').then((module) => ({ default: module.AdminDashboard })));
const SuperAdminShell = lazy(() => import('./pages/admin/SuperAdminShell').then((module) => ({ default: module.SuperAdminShell })));
const ManagerTeamPage = lazy(() => import('./pages/ManagerTeamPage').then((module) => ({ default: module.ManagerTeamPage })));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage').then((module) => ({ default: module.NotFoundPage })));
const AccessDeniedPage = lazy(() => import('./pages/AccessDeniedPage').then((module) => ({ default: module.AccessDeniedPage })));
const AccountSettingsPage = lazy(() =>
  import('./pages/AccountSettingsPage').then((module) => ({ default: module.AccountSettingsPage }))
);
const ProfilePage = lazy(() => import('./pages/ProfilePage').then((module) => ({ default: module.ProfilePage })));
const HelpCentrePage = lazy(() => import('./pages/HelpCentrePage').then((module) => ({ default: module.HelpCentrePage })));
const PlantPortfolioPage = lazy(() =>
  import('./pages/PlantPortfolioPage').then((module) => ({ default: module.PlantPortfolioPage }))
);
const RecoveryHistoryPage = lazy(() =>
  import('./pages/RecoveryHistoryPage').then((module) => ({ default: module.RecoveryHistoryPage }))
);
const AlarmRulesPage = lazy(() => import('./pages/AlarmRulesPage').then((module) => ({ default: module.AlarmRulesPage })));
const ApprovalQueuePage = lazy(() =>
  import('./pages/ApprovalQueuePage').then((module) => ({ default: module.ApprovalQueuePage }))
);
const ReportCentrePage = lazy(() => import('./pages/ReportCentrePage').then((module) => ({ default: module.ReportCentrePage })));
const EnvironmentReleasePage = lazy(() =>
  import('./pages/EnvironmentReleasePage').then((module) => ({ default: module.EnvironmentReleasePage }))
);
const PrivacyNoticePage = lazy(() =>
  import('./pages/PrivacyNoticePage').then((module) => ({ default: module.PrivacyNoticePage }))
);
const TermsOfUsePage = lazy(() => import('./pages/TermsOfUsePage').then((module) => ({ default: module.TermsOfUsePage })));
const GCIPShowcase = lazy(() => import('./pages/GCIPShowcase').then((module) => ({ default: module.GCIPShowcase })));

const pageToPath: Record<Page, string> = {
  dashboard: '/',
  nodes: '/nodes',
  plants: '/plants',
  gcip: '/gcip',
  'admin-dashboard': '/ops',
  'manager-team': '/team',
  congestion: '/congestion',
  dispatch: '/dispatch',
  scenario: '/scenario',
  'ai-assistant': '/ai',
  kpi: '/kpi',
  blueprint: '/blueprint',
  help: '/help',
  settings: '/settings',
  'total-generation': '/total-generation',
  'curtailment-detail': '/curtailment',
  recovery: '/recovery',
  'recovery-history': '/recovery/history',
  'revenue-detail': '/revenue',
  'forecast-accuracy': '/forecast-accuracy',
  'generation-vs-forecast': '/generation-vs-forecast',
  'dispatch-status': '/dispatch-status',
  'ai-insights': '/ai-insights',
  'all-recommendations': '/all-recommendations',
  hyshift: '/hyshift',
  'sector-coupling': '/sector-coupling',
  'provider-diagnostics': '/provider-diagnostics'
};

function mapPathToPage(pathname: string): Page {
  if (pathname.startsWith('/ops')) return 'admin-dashboard';
  if (pathname.startsWith('/admin')) return 'admin-dashboard';
  if (pathname.startsWith('/gcip')) return 'gcip';
  if (pathname.startsWith('/plants')) return 'plants';
  if (pathname.startsWith('/nodes')) return 'nodes';
  if (pathname.startsWith('/team')) return 'manager-team';
  if (pathname.startsWith('/settings')) return 'settings';
  if (pathname.startsWith('/help')) return 'help';
  if (pathname.startsWith('/congestion')) return 'congestion';
  if (pathname.startsWith('/dispatch-status')) return 'dispatch-status';
  if (pathname.startsWith('/dispatch')) return 'dispatch';
  if (pathname.startsWith('/scenario')) return 'scenario';
  if (pathname.startsWith('/ai-insights')) return 'ai-insights';
  if (pathname.startsWith('/ai')) return 'ai-assistant';
  if (pathname.startsWith('/kpi')) return 'kpi';
  if (pathname.startsWith('/blueprint')) return 'blueprint';
  if (pathname.startsWith('/total-generation')) return 'total-generation';
  if (pathname.startsWith('/curtailment')) return 'curtailment-detail';
  if (pathname.startsWith('/recovery/history')) return 'recovery-history';
  if (pathname.startsWith('/recovery')) return 'recovery';
  if (pathname.startsWith('/revenue')) return 'revenue-detail';
  if (pathname.startsWith('/forecast-accuracy')) return 'forecast-accuracy';
  if (pathname.startsWith('/generation-vs-forecast')) return 'generation-vs-forecast';
  if (pathname.startsWith('/all-recommendations')) return 'all-recommendations';
  if (pathname.startsWith('/hyshift')) return 'hyshift';
  if (pathname.startsWith('/sector-coupling')) return 'sector-coupling';
  if (pathname.startsWith('/provider-diagnostics')) return 'provider-diagnostics';
  return 'dashboard';
}

function RequireAuth() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <LoadingSpinner />;
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <Outlet />;
}

function RequireAdmin() {
  const { user } = useAuth();
  const location = useLocation();
  if (!user || !canAccessOpsCenter(user.role)) {
    return <Navigate to="/access-denied" replace state={{ reason: 'admin', from: location }} />;
  }
  return <Outlet />;
}

function RequireManager() {
  const { user } = useAuth();
  const location = useLocation();
  if (!user || !isPlantManager(user.role)) {
    return <Navigate to="/access-denied" replace state={{ reason: 'manager', from: location }} />;
  }
  return <Outlet />;
}

function AuthShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const activePage = mapPathToPage(location.pathname);
  const { pilotMode, togglePilotMode, reportOpen, setReportOpen } = usePilotStore();
  const { isConnected, metricsStale } = useRealTime();

  const onNavigate = (page: Page) => {
    navigate(pageToPath[page] ?? '/');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans selection:bg-emerald-500/30">
      <Sidebar activePage={activePage} onNavigate={onNavigate} />
      <main className="relative min-h-screen transition-all duration-300 lg:pl-64">
        <OperatingModeBanner isLiveStreamConnected={isConnected} metricsStale={metricsStale} />
        {pilotMode &&
        <div className="relative flex items-center justify-center border-b border-amber-500/20 bg-amber-500/10 px-4 py-1.5 text-xs text-amber-400">
            <span className="font-medium">PILOT MODE — Northern Cape Demonstration (Prieska • Kathu • Boegoebaai)</span>
            <button onClick={togglePilotMode} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 hover:bg-amber-500/20">
              <X className="h-3 w-3" />
            </button>
          </div>
        }

        <ErrorBoundary>
          <Suspense fallback={<LoadingSpinner />}>
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}>
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </Suspense>
        </ErrorBoundary>

        {pilotMode &&
        <button
          onClick={() => setReportOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center space-x-2 rounded-full bg-purple-600 p-3 pr-4 text-white shadow-lg transition-colors hover:bg-purple-700">
            <FileDown className="h-5 w-5" />
            <span className="text-sm font-medium">Export Pilot Report</span>
          </button>
        }
        <PilotReportModal isOpen={reportOpen} onClose={() => setReportOpen(false)} />
      </main>
    </div>
  );
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const routeNavigate = (page: Page) => {
    navigate(pageToPath[page] ?? '/');
  };

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} />

      <Route element={<RequireAuth />}>
        <Route element={<AuthShell />}>
          <Route path="/" element={<Dashboard onNavigate={routeNavigate} />} />
          <Route path="/gcip" element={<GCIPShowcase onNavigate={routeNavigate} />} />
          <Route path="/gcip-demo" element={<GCIPShowcase onNavigate={routeNavigate} />} />
          <Route path="/nodes" element={<NodeDashboard />} />
          <Route path="/plants" element={<PlantPortfolioPage />} />
          <Route path="/settings" element={<AccountSettingsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/help" element={<HelpCentrePage />} />
          <Route path="/access-denied" element={<AccessDeniedPage />} />
          <Route path="/recovery/history" element={<RecoveryHistoryPage />} />
          <Route path="/alarms" element={<AlarmRulesPage />} />
          <Route path="/approvals" element={<ApprovalQueuePage />} />
          <Route path="/reports" element={<ReportCentrePage />} />
          <Route path="/environment-release" element={<EnvironmentReleasePage />} />
          <Route path="/privacy" element={<PrivacyNoticePage />} />
          <Route path="/terms" element={<TermsOfUsePage />} />
          <Route element={<RequireManager />}>
            <Route path="/team" element={<ManagerTeamPage />} />
          </Route>
          <Route path="/congestion" element={<CongestionForecast onNavigate={routeNavigate} />} />
          <Route path="/dispatch" element={<DispatchOptimization onNavigate={routeNavigate} />} />
          <Route path="/scenario" element={<ScenarioSimulation onNavigate={routeNavigate} />} />
          <Route path="/ai" element={<AIPromptInterface onNavigate={routeNavigate} />} />
          <Route path="/kpi" element={<KPIReporting onNavigate={routeNavigate} />} />
          <Route path="/blueprint" element={<PlatformBlueprint onNavigate={routeNavigate} />} />
          <Route path="/total-generation" element={<TotalGeneration onNavigate={routeNavigate} />} />
          <Route path="/curtailment" element={<CurtailmentDetail onNavigate={routeNavigate} />} />
          <Route path="/recovery" element={<RecoveryCommandCenter onNavigate={routeNavigate} />} />
          <Route path="/revenue" element={<RevenueDetail onNavigate={routeNavigate} />} />
          <Route path="/forecast-accuracy" element={<ForecastAccuracy onNavigate={routeNavigate} />} />
          <Route path="/generation-vs-forecast" element={<GenerationVsForecast onNavigate={routeNavigate} />} />
          <Route path="/dispatch-status" element={<DispatchStatus onNavigate={routeNavigate} />} />
          <Route path="/ai-insights" element={<AIInsights onNavigate={routeNavigate} />} />
          <Route path="/all-recommendations" element={<AllRecommendations onNavigate={routeNavigate} />} />
          <Route path="/hyshift" element={<HyShiftControl onNavigate={routeNavigate} />} />
          <Route path="/sector-coupling" element={<SectorCouplingSimulator onNavigate={routeNavigate} />} />
          <Route path="/provider-diagnostics" element={<ProviderDiagnostics onNavigate={routeNavigate} />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        <Route element={<RequireAdmin />}>
          <Route element={<SuperAdminShell />}>
            <Route path="/ops" element={<AdminLayout />}>
              <Route index element={<AdminOverview />} />
              <Route path="management" element={<AdminDashboard onNavigate={routeNavigate} />} />
              <Route path="users" element={<AdminUsersPage />} />
              <Route path="nodes" element={<AdminNodesPage />} />
              <Route path="billing" element={<AdminBillingPage />} />
              <Route path="data" element={<AdminDataPage />} />
              <Route path="metrics" element={<AdminMetricsPage />} />
              <Route path="alarms" element={<AdminAlarmsPage />} />
              <Route path="logs" element={<AdminLogsPage />} />
            </Route>
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export function App() {
  return (
    <AuthProvider>
      <RealTimeProvider>
        <ToastProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </ToastProvider>
      </RealTimeProvider>
    </AuthProvider>
  );
}
