import { getAuthToken } from '../services/api';

export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  action: string;
  userId: string;
  details?: unknown;
}

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:4000/api';

class AuditLogger {
  private logs: AuditLogEntry[] = [];

  log(action: string, userId: string, details?: unknown) {
    const entry: AuditLogEntry = {
      id: Math.random().toString(36).slice(2, 11),
      timestamp: new Date(),
      action,
      userId,
      details
    };

    this.logs.unshift(entry);

    const skipRemote = action === 'USER_LOGIN' || action === 'USER_LOGOUT' || action === 'USER_REGISTER';
    const token = getAuthToken();
    if (!token || skipRemote) return;

    void fetch(`${API_BASE_URL}/activity`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      credentials: 'include',
      body: JSON.stringify({
        action,
        message: typeof details === 'object' && details && 'message' in details
          ? String((details as { message?: unknown }).message ?? action)
          : action,
        metadata: details
      })
    }).catch(() => {
      // Best-effort activity sync; local console remains available for debugging.
    });
  }

  getLogs() {
    return this.logs;
  }
}

export const auditLogger = new AuditLogger();
