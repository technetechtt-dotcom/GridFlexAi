import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, MoreHorizontal } from 'lucide-react';
import { cn } from '../lib/utils';

export type PageHeaderAction = {
  label: string;
  onClick: () => void;
  icon?: React.ComponentType<{ className?: string }>;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  title?: string;
};

type PageHeaderProps = {
  title: string;
  description?: string;
  onBack?: () => void;
  primaryAction?: PageHeaderAction;
  secondaryActions?: PageHeaderAction[];
  moreActions?: PageHeaderAction[];
  className?: string;
  breadcrumbs?: React.ReactNode;
};

export function PageHeader({
  title,
  description,
  onBack,
  primaryAction,
  secondaryActions = [],
  moreActions = [],
  className,
  breadcrumbs
}: PageHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [menuOpen]);

  const renderAction = (action: PageHeaderAction, compact?: boolean) => {
    const Icon = action.icon;
    const isPrimary = action.variant === 'primary';
    return (
      <button
        key={action.label}
        type="button"
        onClick={action.onClick}
        disabled={action.disabled}
        title={action.title}
        className={cn(
          'flex items-center justify-center rounded-lg text-sm font-medium transition-colors',
          compact ? 'px-3 py-2' : 'px-3 py-2',
          isPrimary
            ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 disabled:opacity-50'
            : 'border border-slate-700 bg-slate-800 text-slate-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-50'
        )}>
        {Icon && <Icon className="mr-2 h-4 w-4" />}
        {action.label}
      </button>
    );
  };

  const overflow = [...secondaryActions, ...moreActions];

  return (
    <header className={cn('space-y-3', className)}>
      {breadcrumbs}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="mt-1 rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
              aria-label="Go back">
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-slate-100">{title}</h1>
            {description && <p className="mt-1 text-slate-400">{description}</p>}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="hidden flex-wrap items-center gap-2 md:flex">
            {secondaryActions.map((a) => renderAction(a))}
            {primaryAction && renderAction({ ...primaryAction, variant: 'primary' })}
          </div>

          <div className="flex w-full flex-wrap items-center gap-2 md:hidden">
            {primaryAction && renderAction({ ...primaryAction, variant: 'primary' }, true)}
            {overflow.length > 0 && (
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setMenuOpen((o) => !o)}
                  className="flex items-center rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-300 hover:text-white"
                  aria-expanded={menuOpen}
                  aria-haspopup="menu"
                  aria-label="More actions">
                  <MoreHorizontal className="h-4 w-4" />
                </button>
                {menuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 top-full z-20 mt-1 min-w-[12rem] rounded-lg border border-slate-700 bg-slate-900 py-1 shadow-xl">
                    {overflow.map((action) => (
                      <button
                        key={action.label}
                        type="button"
                        role="menuitem"
                        disabled={action.disabled}
                        title={action.title}
                        onClick={() => {
                          action.onClick();
                          setMenuOpen(false);
                        }}
                        className="block w-full px-4 py-2 text-left text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50">
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
