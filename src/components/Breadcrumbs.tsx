import React from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';

export type BreadcrumbItem = {
  label: string;
  onClick?: () => void;
};

type BreadcrumbsProps = {
  items: BreadcrumbItem[];
  className?: string;
};

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  if (!items.length) return null;

  return (
    <nav aria-label="Breadcrumb" className={cn('text-sm text-slate-500', className)}>
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1">
              {index > 0 && <ChevronRight className="h-3.5 w-3.5 text-slate-600" aria-hidden />}
              {item.onClick && !isLast ? (
                <button
                  type="button"
                  onClick={item.onClick}
                  className="rounded px-1 text-slate-400 transition-colors hover:text-emerald-400">
                  {item.label}
                </button>
              ) : (
                <span className={cn(isLast ? 'font-medium text-slate-300' : 'text-slate-400')}>
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
