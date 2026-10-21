import { createContext, useContext } from 'react';
export type AdminRefreshContextValue = {
  autoRefresh: boolean;
  setAutoRefresh: (value: boolean) => void;
  refreshTick: number;
  triggerRefresh: () => void;
};

export const AdminRefreshContext = createContext<AdminRefreshContextValue | undefined>(undefined);

export function useAdminRefresh() {
  const context = useContext(AdminRefreshContext);
  if (!context) {
    throw new Error('useAdminRefresh must be used inside AdminLayout');
  }
  return context;
}
