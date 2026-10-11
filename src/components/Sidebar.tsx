import React, { useEffect, useRef, useState } from 'react';
import {
  LayoutDashboard,
  Zap,
  Activity,
  Sliders,
  MessageSquareMore,
  BarChart3,
  Settings,
  LogOut,
  Grid,
  Menu,
  X,
  AlertTriangle,
  Droplet,
  Factory,
  Users,
  Server,
  Recycle,
  Leaf,
  HelpCircle,
  Trophy,
  ClipboardList,
  FileText,
  Shield
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { canAccessOpsCenter, isPlantManager } from '../lib/roles';
import { useAuth } from '../context/AuthContext';

export type Page =
  | 'dashboard'
  | 'nodes'
  | 'plants'
  | 'gcip'
  | 'admin-dashboard'
  | 'manager-team'
  | 'congestion'
  | 'dispatch'
  | 'scenario'
  | 'ai-assistant'
  | 'kpi'
  | 'blueprint'
  | 'help'
  | 'settings'
  | 'total-generation'
  | 'curtailment-detail'
  | 'recovery'
  | 'recovery-history'
  | 'recovery-cases'
  | 'diagnostics'
  | 'alarms'
  | 'approvals'
  | 'reports'
  | 'pilot-onboarding'
  | 'data-quality'
  | 'operator-tasks'
  | 'pilot-results'
  | 'revenue-detail'
  | 'forecast-accuracy'
  | 'generation-vs-forecast'
  | 'dispatch-status'
  | 'ai-insights'
  | 'all-recommendations'
  | 'hyshift'
  | 'sector-coupling'
  | 'provider-diagnostics';

interface SidebarProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
}

type NavItem = { id: Page; label: string; icon: React.ComponentType<{ className?: string }> };
type NavGroup = { id: string; label: string; items: NavItem[] };

const DEMO_MODE_KEY = 'gridflex_demo_mode_v1';

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = () => setReduced(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return reduced;
}

export function Sidebar({ activePage, onNavigate }: SidebarProps) {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [demoMode, setDemoMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(DEMO_MODE_KEY) === '1' || new URLSearchParams(window.location.search).get('demo') === '1';
  });
  const drawerRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  const motionTransition = reducedMotion ? { duration: 0.01 } : { type: 'spring' as const, damping: 25, stiffness: 200 };

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (mobile) setIsOpen(false);
      else setIsOpen(true);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    localStorage.setItem(DEMO_MODE_KEY, demoMode ? '1' : '0');
  }, [demoMode]);

  useEffect(() => {
    if (!isMobile || !isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        menuButtonRef.current?.focus();
      }
      if (e.key === 'Tab' && drawerRef.current) {
        const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', onKeyDown);
    closeButtonRef.current?.focus();
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isMobile, isOpen]);

  const groups: NavGroup[] = [
    {
      id: 'overview',
      label: 'Overview',
      items: [
        { id: 'dashboard', label: 'Portfolio overview', icon: LayoutDashboard },
        { id: 'kpi', label: 'Executive dashboard', icon: BarChart3 }
      ]
    },
    {
      id: 'monitor',
      label: 'Monitor',
      items: [
        { id: 'plants', label: 'Plants', icon: Leaf },
        { id: 'nodes', label: 'Nodes', icon: Server },
        { id: 'congestion', label: 'Congestion', icon: Zap },
        { id: 'curtailment-detail', label: 'Curtailment', icon: AlertTriangle },
        { id: 'alarms', label: 'Alarms', icon: AlertTriangle },
        { id: 'dispatch-status', label: 'Live dispatch status', icon: Activity }
      ]
    },
    {
      id: 'operate',
      label: 'Operate',
      items: [
        { id: 'all-recommendations', label: 'Recommendations', icon: ClipboardList },
        { id: 'dispatch', label: 'Dispatch', icon: Activity },
        { id: 'approvals', label: 'Approvals', icon: Users },
        { id: 'diagnostics', label: 'Diagnostics', icon: Activity },
        { id: 'recovery', label: 'Recovery centre', icon: Recycle },
        { id: 'recovery-cases', label: 'Recovery cases', icon: Recycle },
        { id: 'operator-tasks', label: 'Work orders', icon: ClipboardList }
      ]
    },
    {
      id: 'analyse',
      label: 'Analyse',
      items: [
        { id: 'generation-vs-forecast', label: 'Forecasts', icon: BarChart3 },
        { id: 'scenario', label: 'Scenario modelling', icon: Sliders },
        { id: 'reports', label: 'Reports', icon: FileText },
        { id: 'ai-assistant', label: 'Zolt AI', icon: MessageSquareMore },
        ...(demoMode
          ? ([
              { id: 'hyshift', label: 'HyShift (demo)', icon: Droplet },
              { id: 'sector-coupling', label: 'Sector coupling (demo)', icon: Factory },
              { id: 'blueprint', label: 'Platform blueprint', icon: Grid }
            ] as NavItem[])
          : [])
      ]
    },
    {
      id: 'admin',
      label: 'Administration',
      items: [
        ...(canAccessOpsCenter(user?.role)
          ? ([{ id: 'admin-dashboard', label: 'Ops Center', icon: Shield }] as NavItem[])
          : []),
        ...(isPlantManager(user?.role)
          ? ([{ id: 'manager-team', label: 'Users & access', icon: Users }] as NavItem[])
          : []),
        { id: 'pilot-onboarding', label: 'Pilot onboarding', icon: ClipboardList },
        { id: 'data-quality', label: 'Data quality', icon: FileText },
        { id: 'pilot-results', label: 'Verified impact', icon: BarChart3 },
        { id: 'settings', label: 'Settings', icon: Settings },
        { id: 'help', label: 'Help', icon: HelpCircle }
      ]
    }
  ];

  if (demoMode) {
    groups.unshift({
      id: 'demo',
      label: 'Presentation',
      items: [{ id: 'gcip', label: 'GCIP Showcase', icon: Trophy }]
    });
  }

  const handleNavigate = (page: Page) => {
    onNavigate(page);
    if (isMobile) setIsOpen(false);
  };

  return (
    <>
      {isMobile && (
        <button
          ref={menuButtonRef}
          type="button"
          onClick={() => setIsOpen(true)}
          aria-expanded={isOpen}
          aria-controls="gridflex-sidebar"
          aria-label="Open navigation menu"
          className="fixed left-4 top-4 z-50 rounded-lg border border-slate-700 bg-slate-800 p-2 text-slate-200">
          <Menu className="h-5 w-5" />
        </button>
      )}

      <AnimatePresence>
        {isMobile && isOpen && (
          <motion.div
            initial={{ opacity: reducedMotion ? 1 : 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: reducedMotion ? 1 : 0 }}
            transition={motionTransition}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            aria-hidden
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {(isOpen || !isMobile) && (
          <motion.div
            ref={drawerRef}
            id="gridflex-sidebar"
            role={isMobile ? 'dialog' : undefined}
            aria-modal={isMobile ? true : undefined}
            aria-label="Main navigation"
            initial={isMobile ? { x: reducedMotion ? 0 : -300 } : false}
            animate={{ x: 0 }}
            exit={isMobile ? { x: reducedMotion ? 0 : -300 } : undefined}
            transition={motionTransition}
            className={cn(
              'fixed left-0 top-0 z-50 flex h-screen w-64 flex-col border-r border-slate-800 bg-slate-900 transition-all duration-300',
              isMobile && 'shadow-2xl'
            )}>
            <div className="flex items-center justify-between border-b border-slate-800 p-6">
              <div className="flex items-center space-x-3">
                <div className="rounded-lg bg-emerald-500/10 p-2">
                  <Grid className="h-6 w-6 text-emerald-500" />
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-slate-100">GridFlex AI</h1>
                  <p className="text-xs text-slate-500">Energy operations</p>
                </div>
              </div>
              {isMobile && (
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="text-slate-400 hover:text-slate-200"
                  aria-label="Close navigation menu">
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>

            <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
              {groups.map((group) => (
                <div key={group.id}>
                  <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    {group.label}
                  </p>
                  <div className="space-y-0.5">
                    {group.items.map((item) => {
                      const isActive = activePage === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleNavigate(item.id)}
                          className={cn(
                            'group relative flex w-full items-center space-x-3 overflow-hidden rounded-lg px-3 py-2 transition-all duration-200',
                            isActive
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                          )}>
                          <item.icon
                            className={cn(
                              'h-4 w-4 transition-colors',
                              isActive ? 'text-emerald-400' : 'text-slate-500 group-hover:text-slate-300'
                            )}
                          />
                          <span className="text-sm font-medium">{item.label}</span>
                          {isActive && !reducedMotion && (
                            <motion.div
                              layoutId="activeIndicator"
                              className="absolute left-0 h-7 w-1 rounded-r-full bg-emerald-500"
                            />
                          )}
                          {isActive && reducedMotion && (
                            <div className="absolute left-0 h-7 w-1 rounded-r-full bg-emerald-500" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>

            <div className="border-t border-slate-800 p-4">
              <label className="mb-3 flex items-center justify-between gap-2 px-2 text-xs text-slate-400">
                <span>Presentation / demo mode</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={demoMode}
                  onClick={() => setDemoMode((v) => !v)}
                  className={cn(
                    'relative h-5 w-9 rounded-full transition-colors',
                    demoMode ? 'bg-emerald-500' : 'bg-slate-700'
                  )}>
                  <span
                    className={cn(
                      'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform',
                      demoMode ? 'left-4' : 'left-0.5'
                    )}
                  />
                </button>
              </label>
              <div className="mb-4 flex items-center space-x-3 px-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700 text-xs font-bold text-slate-300">
                  {user?.name.charAt(0) ?? '?'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-200">{user?.name}</p>
                  <p className="truncate text-xs capitalize text-slate-500">{user?.role}</p>
                </div>
              </div>
              <div className="flex items-center justify-between px-2 text-slate-500">
                <button
                  type="button"
                  onClick={() => handleNavigate('settings')}
                  className="transition-colors hover:text-slate-300"
                  aria-label="Account settings"
                  title="Account settings">
                  <Settings className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={logout}
                  className="transition-colors hover:text-red-400"
                  aria-label="Sign out"
                  title="Sign Out">
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
