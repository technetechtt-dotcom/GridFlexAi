import React from 'react';
import { getFrontendReleaseIdentity, shortSha } from '../lib/frontendRelease';

/** Compact frontend build identity for demo / ops surfaces. */
export function FrontendReleaseBadge({ className }: { className?: string }) {
  const id = getFrontendReleaseIdentity();
  return (
    <p className={className ?? 'font-mono text-[10px] text-slate-500'} title={id.gitSha ?? 'Frontend release unpinned'}>
      FE release {shortSha(id.gitSha)}
      {id.buildId ? ` · ${id.buildId}` : ''}
    </p>
  );
}
