import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';
interface HeatmapData {
  node: string;
  values: number[]; // 0-100 representing congestion %
}
interface HeatmapGridProps {
  data: HeatmapData[];
  timeLabels: string[];
  title?: string;
}
export const HeatmapGrid = memo(function HeatmapGrid({
  data,
  timeLabels,
  title
}: HeatmapGridProps) {
  const getColor = (value: number) => {
    if (value < 50) return 'bg-emerald-500/20 text-emerald-500'; // Low
    if (value < 75) return 'bg-amber-500/20 text-amber-500'; // Medium
    return 'bg-red-500/20 text-red-500'; // High
  };
  const getIntensity = (value: number) => {
    // Return opacity based on value for the background
    return value / 100;
  };
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 overflow-hidden">
      {title &&
      <h3 className="text-lg font-semibold text-slate-100 mb-4">{title}</h3>
      }

      <div className="overflow-x-auto">
        <div className="min-w-[600px]">
          {/* Header */}
          <div className="grid grid-cols-[150px_repeat(auto-fit,minmax(40px,1fr))] gap-1 mb-2">
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Node
            </div>
            {timeLabels.map((label, i) =>
            <div
              key={i}
              className="text-xs font-medium text-slate-500 text-center">

                {label}
              </div>
            )}
          </div>

          {/* Rows */}
          <div className="space-y-1">
            {data.map((row, i) =>
            <motion.div
              key={row.node}
              initial={{
                opacity: 0,
                x: -20
              }}
              animate={{
                opacity: 1,
                x: 0
              }}
              transition={{
                delay: i * 0.05
              }}
              className="grid grid-cols-[150px_repeat(auto-fit,minmax(40px,1fr))] gap-1 items-center">

                <div className="text-sm font-medium text-slate-300 truncate pr-2">
                  {row.node}
                </div>
                {row.values.map((val, j) =>
              <div
                key={j}
                className="h-8 rounded flex items-center justify-center relative group cursor-help"
                style={{
                  backgroundColor:
                  val < 50 ?
                  `rgba(16, 185, 129, ${getIntensity(val) * 0.5 + 0.1})` :
                  val < 75 ?
                  `rgba(245, 158, 11, ${getIntensity(val) * 0.5 + 0.1})` :
                  `rgba(239, 68, 68, ${getIntensity(val) * 0.5 + 0.1})`
                }}>

                    <span
                  className={cn(
                    'text-xs font-medium',
                    val < 50 ?
                    'text-emerald-400' :
                    val < 75 ?
                    'text-amber-400' :
                    'text-red-400'
                  )}>

                      {val}%
                    </span>

                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-2 hidden group-hover:block z-10 w-32 bg-slate-900 text-slate-200 text-xs p-2 rounded border border-slate-700 shadow-xl pointer-events-none">
                      <div className="font-bold mb-1">{row.node}</div>
                      <div>Time: {timeLabels[j]}</div>
                      <div>Congestion: {val}%</div>
                      <div>Capacity: {(val * 2.5).toFixed(0)} MW</div>
                    </div>
                  </div>
              )}
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center justify-end space-x-4 text-xs text-slate-400">
        <div className="flex items-center">
          <div className="w-3 h-3 rounded bg-emerald-500/30 mr-2"></div>Optimal
          (&lt;50%)
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 rounded bg-amber-500/30 mr-2"></div>Warning
          (50-75%)
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 rounded bg-red-500/30 mr-2"></div>Critical
          (&gt;75%)
        </div>
      </div>
    </div>);

});