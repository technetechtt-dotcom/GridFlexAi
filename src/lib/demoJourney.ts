import type { Page } from '../components/Sidebar';

/** Five-step judge journey (closing ask is step 5). */
export const DEMO_JOURNEY_STEPS = [
  { id: 1, label: 'Pilot case', page: 'pilot-case' as Page, path: '/pilot-case' },
  { id: 2, label: 'Climate', page: 'climate-impact' as Page, path: '/climate-impact' },
  { id: 3, label: 'Commercial', page: 'commercial-value' as Page, path: '/commercial-value' },
  { id: 4, label: 'AI evidence', page: 'ai-evidence' as Page, path: '/ai-evidence' },
  { id: 5, label: 'Ask & next', page: 'gcip-ask' as Page, path: '/gcip/ask' }
] as const;

export const DEMO_TIMER_SECONDS = 7 * 60;
export const DEMO_TIMER_STORAGE_KEY = 'gridflex_demo_timer_deadline_v1';
export const PRODUCT_INFO_PATH = '/product-info';
export const FROZEN_PACK_BADGE = 'gcip-demo-2026-10-12.1';

export function demoStepFromPath(pathname: string): number {
  if (pathname.startsWith('/gcip/ask')) return 5;
  if (pathname.startsWith('/pilot-case')) return 1;
  if (pathname.startsWith('/climate-impact')) return 2;
  if (pathname.startsWith('/commercial-value')) return 3;
  if (pathname.startsWith('/ai-evidence')) return 4;
  if (pathname.startsWith('/gcip')) return 0;
  return 0;
}

export function productInfoUrl(): string {
  if (typeof window === 'undefined') return PRODUCT_INFO_PATH;
  return `${window.location.origin}${PRODUCT_INFO_PATH}`;
}
