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
  HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { canAccessOpsCenter, isPlantManager } from '../lib/roles';
import { useAuth } from '../context/AuthContext';

export type Page =
  | 'dashboard'
  | 'nodes'
  | 'plants'
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

  const navItems: Array<{ id: Page; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'nodes', label: 'Nodes', icon: Server },
    { id: 'plants', label: 'Plants', icon: Leaf },
    ...(canAccessOpsCenter(user?.role)
      ? ([{ id: 'admin-dashboard', label: 'Ops Center', icon: Settings }] as Array<{
          id: Page;
          label: string;
          icon: React.ComponentType<{ className?: string }>;
        }>)
      : []),
    ...(isPlantManager(user?.role)
      ? ([{ id: 'manager-team', label: 'Operator Team', icon: Users }] as Array<{
          id: Page;
          label: string;
          icon: React.ComponentType<{ className?: string }>;
        }>)
      : []),
    { id: 'congestion', label: 'Congestion Forecast', icon: Zap },
    { id: 'dispatch', label: 'Dispatch Optimization', icon: Activity },
    { id: 'hyshift', label: 'HyShift Control', icon: Droplet },
    { id: 'sector-coupling', label: 'Sector Coupling', icon: Factory },
    { id: 'scenario', label: 'Scenario Simulation', icon: Sliders },
    { id: 'curtailment-detail', label: 'Curtailment', icon: AlertTriangle },
    { id: 'recovery', label: 'Recovery Centre', icon: Recycle },
    { id: 'kpi', label: 'KPI & Reporting', icon: BarChart3 },
    { id: 'help', label: 'Help', icon: HelpCircle }
  ];

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
                  <p className="text-xs text-slate-500">IPP Optimization</p>
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

            <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-6">
              <button
                type="button"
                onClick={() => handleNavigate('ai-assistant')}
                className="mb-4 flex w-full items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-left text-emerald-300 transition-colors hover:bg-emerald-500/15">
                <div className="flex items-center space-x-3">
                  <div className="rounded-lg bg-emerald-500/20 p-2">
                    <MessageSquareMore className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Zolt AI</p>
                    <p className="text-xs text-emerald-200/80">Ask Zolt AI now</p>
                  </div>
                </div>
                <span className="rounded-full bg-emerald-500/20 px-2 py-1 text-[10px] uppercase tracking-wider">Live</span>
              </button>

              {navItems.map((item) => {
                const isActive = activePage === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavigate(item.id)}
                    className={cn(
                      'group relative flex w-full items-center space-x-3 overflow-hidden rounded-lg px-3 py-2.5 transition-all duration-200',
                      isActive ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    )}>
                    <item.icon
                      className={cn(
                        'h-5 w-5 transition-colors',
                        isActive ? 'text-emerald-400' : 'text-slate-500 group-hover:text-slate-300'
                      )}
                    />
                    <span className="text-sm font-medium">{item.label}</span>
                    {isActive && !reducedMotion && (
                      <motion.div layoutId="activeIndicator" className="absolute left-0 h-8 w-1 rounded-r-full bg-emerald-500" />
                    )}
                    {isActive && reducedMotion && (
                      <div className="absolute left-0 h-8 w-1 rounded-r-full bg-emerald-500" />
                    )}
                  </button>
                );
              })}
            </nav>

            <div className="border-t border-slate-800 p-4">
              <div className="mb-4 flex items-center space-x-3 px-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700 text-xs font-bold text-slate-300">
                  {user?.name.charAt(0) ?? '?'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-200">{user?.name}</p>
                  <p className="truncate text-xs text-slate-500">
                    {user?.role} · Northern Cape
                  </p>
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
