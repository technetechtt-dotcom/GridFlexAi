import React from 'react';
import { Loader2 } from 'lucide-react';
export function LoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="flex flex-col items-center space-y-4">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
        <p className="text-slate-400 text-sm animate-pulse">
          Loading GridFlex AI...
        </p>
      </div>
    </div>);

}