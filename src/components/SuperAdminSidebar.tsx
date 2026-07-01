import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Server,
  Activity,
  FileText,
  LogOut,
  ShieldAlert,
  Menu,
  X,
  ArrowLeft,
  Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';

import { Database, CreditCard } from 'lucide-react';

export function SuperAdminSidebar() {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

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

  const navItems = [
    { to: '/ops', label: 'Overview', icon: LayoutDashboard, end: true },
    { to: '/ops/management', label: 'Management', icon: Settings },
    { to: '/ops/users', label: 'Users', icon: Users },
    { to: '/ops/nodes', label: 'Nodes', icon: Server },
    { to: '/ops/billing', label: 'Billing', icon: CreditCard },
    { to: '/ops/data', label: 'Data Explorer', icon: Database },
    { to: '/ops/metrics', label: 'Metrics', icon: Activity },
    { to: '/ops/logs', label: 'Audit Logs', icon: FileText }
  ];

  return (
    <>
      {isMobile && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed top-4 left-4 z-50 p-2 bg-slate-900 rounded-lg border border-slate-700 text-slate-200"
        >
          <Menu className="w-5 h-5" />
        </button>
      )}

      <AnimatePresence>
        {isMobile && isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {(isOpen || !isMobile) && (
          <motion.div
            initial={isMobile ? { x: -300 } : false}
            animate={{ x: 0 }}
            exit={isMobile ? { x: -300 } : undefined}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={cn(
              'h-screen bg-slate-950 border-r border-slate-800 flex flex-col fixed left-0 top-0 z-50 transition-all duration-300',
              isMobile ? 'w-64 shadow-2xl' : 'w-64'
            )}
          >
            <div className="p-6 flex items-center justify-between border-b border-slate-800 bg-slate-900/50">
              <div className="flex items-center space-x-3">
                <div className="bg-red-500/10 p-2 rounded-lg">
                  <ShieldAlert className="w-6 h-6 text-red-500" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-100 tracking-tight">Ops Center</h1>
                  <p className="text-[10px] uppercase tracking-wider text-red-400 font-bold">Super Admin</p>
                </div>
              </div>
              {isMobile && (
                <button onClick={() => setIsOpen(false)} className="text-slate-400">
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => isMobile && setIsOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative overflow-hidden',
                      isActive
                        ? 'bg-red-500/10 text-red-400'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <item.icon
                        className={cn(
                          'w-5 h-5 transition-colors',
                          isActive ? 'text-red-400' : 'text-slate-500 group-hover:text-slate-300'
                        )}
                      />
                      <span className="font-medium text-sm">{item.label}</span>
                      {isActive && (
                        <motion.div
                          layoutId="opsActiveIndicator"
                          className="absolute left-0 w-1 h-8 bg-red-500 rounded-r-full"
                        />
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </nav>

            <div className="p-4 border-t border-slate-800 bg-slate-900/30">
              <NavLink
                to="/"
                className="w-full mb-4 flex items-center justify-center space-x-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700 hover:text-slate-100 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to App</span>
              </NavLink>

              <div className="flex items-center justify-between px-2 text-slate-500">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-300 border border-slate-700">
                    {user?.name.charAt(0) || 'A'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-200 truncate">{user?.name}</p>
                    <p className="text-xs text-slate-500 truncate">{user?.role}</p>
                  </div>
                </div>
                <button onClick={logout} className="hover:text-red-400 transition-colors p-2" title="Sign Out">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
