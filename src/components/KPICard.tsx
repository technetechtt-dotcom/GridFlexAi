import React, { memo } from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';
interface KPICardProps {
  title: string;
  value: string;
  unit?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  icon: LucideIcon;
  accentColor?: 'emerald' | 'cyan' | 'amber' | 'red' | 'purple';
  delay?: number;
}
export const KPICard = memo(function KPICard({
  title,
  value,
  unit,
  trend,
  trendValue,
  icon: Icon,
  accentColor = 'emerald',
  delay = 0
}: KPICardProps) {
  const colors = {
    emerald: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
    cyan: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/20',
    amber: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
    red: 'text-red-500 bg-red-500/10 border-red-500/20',
    purple: 'text-purple-500 bg-purple-500/10 border-purple-500/20'
  };
  const trendColors = {
    up: 'text-emerald-400',
    down: 'text-red-400',
    neutral: 'text-slate-400'
  };
  return (
    <motion.div
      initial={{
        opacity: 0,
        y: 20
      }}
      animate={{
        opacity: 1,
        y: 0
      }}
      transition={{
        duration: 0.4,
        delay
      }}
      className="bg-slate-800 border border-slate-700 rounded-xl p-5 relative overflow-hidden group hover:border-slate-600 transition-colors">

      <div
        className={cn(
          'absolute top-0 left-0 w-1 h-full',
          colors[accentColor].replace('text-', 'bg-').split(' ')[0]
        )} />


      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="text-slate-400 text-sm font-medium">{title}</p>
        </div>
        <div className={cn('p-2 rounded-lg', colors[accentColor])}>
          <Icon className="w-5 h-5" />
        </div>
      </div>

      <div className="flex items-baseline space-x-1">
        <h3 className="text-2xl font-bold text-slate-100">{value}</h3>
        {unit &&
        <span className="text-sm text-slate-500 font-medium">{unit}</span>
        }
      </div>

      {trend &&
      <div className="mt-3 flex items-center text-xs font-medium">
          {trend === 'up' &&
        <ArrowUpRight className={cn('w-3 h-3 mr-1', trendColors.up)} />
        }
          {trend === 'down' &&
        <ArrowDownRight className={cn('w-3 h-3 mr-1', trendColors.down)} />
        }
          {trend === 'neutral' &&
        <Minus className={cn('w-3 h-3 mr-1', trendColors.neutral)} />
        }

          <span className={trendColors[trend]}>{trendValue}</span>
          <span className="text-slate-500 ml-1">vs last period</span>
        </div>
      }
    </motion.div>);

});
