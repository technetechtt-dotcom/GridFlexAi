export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  action: string;
  userId: string;
  details?: any;
}

class AuditLogger {
  private logs: AuditLogEntry[] = [];

  log(action: string, userId: string, details?: any) {
    const entry: AuditLogEntry = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
      action,
      userId,
      details
    };

    this.logs.unshift(entry);
    console.log(
      `[AUDIT] ${entry.timestamp.toISOString()} | ${userId} | ${action}`,
      details || ''
    );

    // In a real app, this would send to a backend API
    // await fetch('/api/audit', { method: 'POST', body: JSON.stringify(entry) })
  }

  getLogs() {
    return this.logs;
  }
}

export const auditLogger = new AuditLogger();