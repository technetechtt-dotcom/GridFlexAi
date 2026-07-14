import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Zap,
  Activity,
  Sliders,
  Bot,
  MessageSquareMore,
  BarChart3,
  FileText,
  Settings,
  LogOut,
  Grid,
  Menu,
  X,
  AlertTriangle,
  Droplet,
  Factory,
  Users,
  Server } from
'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { canAccessOpsCenter, isPlantManager } from '../lib/roles';
import { useAuth } from '../context/AuthContext';
export type Page =
'dashboard' |
'nodes' |
'admin-dashboard' |
'manager-team' |
'congestion' |
'dispatch' |
'scenario' |
'ai-assistant' |
'kpi' |
'blueprint' |
'total-generation' |
'curtailment-detail' |
'revenue-detail' |
'forecast-accuracy' |
'generation-vs-forecast' |
'dispatch-status' |
'ai-insights' |
'all-recommendations' |
'hyshift' |
'sector-coupling' |
'provider-diagnostics';
interface SidebarProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
}
export function Sidebar({ activePage, onNavigate }: SidebarProps) {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (mobile) setIsOpen(false);else
      setIsOpen(true);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  const navItems: Array<{id: Page;label: string;icon: React.ComponentType<{className?: string}>;}> = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard
  },
  {
    id: 'nodes',
    label: 'Nodes',
    icon: Server
  },
  ...(canAccessOpsCenter(user?.role) ?
  ([{
    id: 'admin-dashboard',
    label: 'Ops Center',
    icon: Settings
  }] as Array<{id: Page;label: string;icon: React.ComponentType<{className?: string}>;}>) :
  []),
  ...(isPlantManager(user?.role) ?
  ([{
    id: 'manager-team',
    label: 'Operator Team',
    icon: Users
  }] as Array<{id: Page;label: string;icon: React.ComponentType<{className?: string}>;}>) :
  []),
  {
    id: 'congestion',
    label: 'Congestion Forecast',
    icon: Zap
  },
  {
    id: 'dispatch',
    label: 'Dispatch Optimization',
    icon: Activity
  },
  {
    id: 'hyshift',
    label: 'HyShift Control',
    icon: Droplet
  },
  {
    id: 'sector-coupling',
    label: 'Sector Coupling',
    icon: Factory
  },
  {
    id: 'scenario',
    label: 'Scenario Simulation',
    icon: Sliders
  },
  {
    id: 'curtailment-detail',
    label: 'Curtailment',
    icon: AlertTriangle
  },
  {
    id: 'ai-assistant',
    label: 'Zolt AI',
    icon: Bot
  },
  {
    id: 'kpi',
    label: 'KPI & Reporting',
    icon: BarChart3
  },
  {
    id: 'blueprint',
    label: 'Platform Blueprint',
    icon: FileText
  }];
  const handleNavigate = (page: Page) => {
    onNavigate(page);
    if (isMobile) setIsOpen(false);
  };
  return (
    <>
      {/* Mobile Trigger */}
      {isMobile &&
      <button
        onClick={() => setIsOpen(true)}
        className="fixed top-4 left-4 z-50 p-2 bg-slate-800 rounded-lg border border-slate-700 text-slate-200">

          <Menu className="w-5 h-5" />
        </button>
      }

      {/* Sidebar Overlay for Mobile */}
      <AnimatePresence>
        {isMobile && isOpen &&
        <motion.div
          initial={{
            opacity: 0
          }}
          animate={{
            opacity: 1
          }}
          exit={{
            opacity: 0
          }}
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" />

        }
      </AnimatePresence>

      {/* Sidebar Content */}
      <AnimatePresence>
        {(isOpen || !isMobile) &&
        <motion.div
          initial={
          isMobile ?
          {
            x: -300
          } :
          false
          }
          animate={{
            x: 0
          }}
          exit={isMobile ? { x: -300 } : undefined}
          transition={{
            type: 'spring',
            damping: 25,
            stiffness: 200
          }}
          className={cn(
            'h-screen bg-slate-900 border-r border-slate-800 flex flex-col fixed left-0 top-0 z-50 transition-all duration-300',
            isMobile ? 'w-64 shadow-2xl' : 'w-64'
          )}>

            {/* Brand */}
            <div className="p-6 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="bg-emerald-500/10 p-2 rounded-lg">
                  <Grid className="w-6 h-6 text-emerald-500" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-100 tracking-tight">
                    GridFlex AI
                  </h1>
                  <p className="text-xs text-slate-500">IPP Optimization</p>
                </div>
              </div>
              {isMobile &&
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400">

                  <X className="w-5 h-5" />
                </button>
            }
            </div>

            {/* Navigation */}
            <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
              <button
                onClick={() => handleNavigate('ai-assistant')}
                className="w-full mb-4 flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-left text-emerald-300 hover:bg-emerald-500/15 transition-colors">
                <div className="flex items-center space-x-3">
                  <div className="bg-emerald-500/20 p-2 rounded-lg">
                    <MessageSquareMore className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Zolt AI</p>
                    <p className="text-xs text-emerald-200/80">Ask Zolt AI now</p>
                  </div>
                </div>
                <span className="text-[10px] uppercase tracking-wider bg-emerald-500/20 px-2 py-1 rounded-full">
                  Live
                </span>
              </button>
              {navItems.map((item) => {
              const isActive = activePage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavigate(item.id)}
                  className={cn(
                    'w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative overflow-hidden',
                    isActive ?
                    'bg-emerald-500/10 text-emerald-400' :
                    'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  )}>

                    <item.icon
                    className={cn(
                      'w-5 h-5 transition-colors',
                      isActive ?
                      'text-emerald-400' :
                      'text-slate-500 group-hover:text-slate-300'
                    )} />

                    <span className="font-medium text-sm">{item.label}</span>
                    {isActive &&
                  <motion.div
                    layoutId="activeIndicator"
                    className="absolute left-0 w-1 h-8 bg-emerald-500 rounded-r-full" />

                  }
                  </button>);

            })}
            </nav>

            {/* User / Footer */}
            <div className="p-4 border-t border-slate-800">
              <div className="flex items-center space-x-3 mb-4 px-2">
                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
                  {user?.name.charAt(0)}D
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-200 truncate">
                    {user?.name}
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {user?.role} • Northern Cape
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between px-2 text-slate-500">
                <button className="hover:text-slate-300 transition-colors">
                  <Settings className="w-4 h-4" />
                </button>
                <button
                onClick={logout}
                className="hover:text-red-400 transition-colors"
                title="Sign Out">

                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        }
      </AnimatePresence>
    </>);

}
