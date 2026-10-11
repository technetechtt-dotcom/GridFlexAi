import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, KeyRound, MonitorSmartphone, Shield, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { PageHeader } from '../components/PageHeader';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { useToast } from '../components/Toast';
import {
  acknowledgeAdminMfa,
  changePassword,
  fetchLoginHistory,
  listAuthSessions,
  revokeOtherSessions,
  type AuthSessionRow,
  type LoginHistoryRow
} from '../services/api';

export function AccountSettingsPage() {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [dispatchDigest, setDispatchDigest] = useState(false);
  const [maintenanceAlerts, setMaintenanceAlerts] = useState(true);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [sessions, setSessions] = useState<AuthSessionRow[]>([]);
  const [history, setHistory] = useState<LoginHistoryRow[]>([]);
  const [securityBusy, setSecurityBusy] = useState(false);

  const loadSecurity = async () => {
    try {
      const [sessionRows, historyRows] = await Promise.all([
        listAuthSessions(),
        fetchLoginHistory(30)
      ]);
      setSessions(sessionRows);
      setHistory(historyRows);
    } catch {
      setSessions([]);
      setHistory([]);
    }
  };

  useEffect(() => {
    void loadSecurity();
  }, []);

  const onChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      showToast('New password must be at least 8 characters', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('New passwords do not match', 'error');
      return;
    }
    setPasswordBusy(true);
    try {
      const result = await changePassword(currentPassword, newPassword);
      showToast(result.message, 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      await logout();
      navigate('/login');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Password change failed', 'error');
    } finally {
      setPasswordBusy(false);
    }
  };

  const onRevokeSessions = async () => {
    setSecurityBusy(true);
    try {
      const result = await revokeOtherSessions();
      showToast(`Revoked ${result.revokedCount} other session(s)`, 'success');
      await loadSecurity();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to revoke sessions', 'error');
    } finally {
      setSecurityBusy(false);
    }
  };

  const onAcknowledgeMfa = async () => {
    setSecurityBusy(true);
    try {
      const result = await acknowledgeAdminMfa();
      showToast(result.message, 'success');
      await loadSecurity();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'MFA acknowledgement failed', 'error');
    } finally {
      setSecurityBusy(false);
    }
  };

  return (
    <div className="space-y-6 p-6 pb-20">
      <PageHeader
        title="Account settings"
        description="Profile, password, sessions, login history, and administrator MFA acknowledgement"
        breadcrumbs={
          <Breadcrumbs items={[{ label: 'Overview', onClick: () => window.location.assign('/') }, { label: 'Settings' }]} />
        }
      />

      <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-emerald-500/10 p-2">
            <User className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-100">Profile summary</h2>
            <p className="text-sm text-slate-400">
              {user?.name} · {user?.email}
            </p>
            <p className="text-xs capitalize text-slate-500">Role: {user?.role}</p>
          </div>
          <Link to="/profile" className="ml-auto text-sm font-medium text-emerald-400 hover:text-emerald-300">
            View full profile
          </Link>
        </div>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
        <div className="mb-4 flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-slate-400" />
          <h2 className="font-semibold text-slate-100">Change password</h2>
        </div>
        <form className="grid max-w-md gap-3" onSubmit={(e) => void onChangePassword(e)}>
          <input
            type="password"
            placeholder="Current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
            autoComplete="current-password"
            required
          />
          <input
            type="password"
            placeholder="New password (min 8 characters)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
            autoComplete="new-password"
            required
          />
          <input
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
            autoComplete="new-password"
            required
          />
          <button
            type="submit"
            disabled={passwordBusy}
            className="w-fit rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-50">
            {passwordBusy ? 'Updating…' : 'Update password'}
          </button>
        </form>
        <p className="mt-3 text-xs text-slate-500">
          Changing password revokes other sessions and signs you out. Forgot password is available on the login page
          (admin-assisted reset in this pilot).
        </p>
      </section>

      {(user?.role === 'admin' || user?.role === 'developer') && (
        <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
          <div className="mb-3 flex items-center gap-2">
            <Shield className="h-5 w-5 text-slate-400" />
            <h2 className="font-semibold text-slate-100">Administrator MFA</h2>
          </div>
          <p className="mb-3 text-sm text-slate-400">
            TOTP enrollment is required before production cutover. Acknowledge now to record the control in the audit
            log — MFA is not yet enforced at login.
          </p>
          <button
            type="button"
            disabled={securityBusy}
            onClick={() => void onAcknowledgeMfa()}
            className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-100 hover:bg-amber-500/20 disabled:opacity-50">
            Acknowledge MFA enrollment requirement
          </button>
        </section>
      )}

      <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
        <div className="mb-4 flex items-center gap-2">
          <Bell className="h-5 w-5 text-slate-400" />
          <h2 className="font-semibold text-slate-100">Notifications</h2>
        </div>
        <ul className="space-y-3 text-sm">
          {[
            { label: 'Email alerts for critical grid events', checked: emailAlerts, set: setEmailAlerts },
            { label: 'Daily dispatch advisory digest', checked: dispatchDigest, set: setDispatchDigest },
            { label: 'Maintenance and node health reminders', checked: maintenanceAlerts, set: setMaintenanceAlerts }
          ].map((row) => (
            <li key={row.label} className="flex items-center justify-between gap-4">
              <span className="text-slate-300">{row.label}</span>
              <button
                type="button"
                role="switch"
                aria-checked={row.checked}
                onClick={() => row.set(!row.checked)}
                className={`relative h-6 w-11 rounded-full transition-colors ${row.checked ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${row.checked ? 'left-5' : 'left-0.5'}`}
                />
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-slate-500">Preferences are stored locally until server sync is available.</p>
      </section>

      <section id="sessions" className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MonitorSmartphone className="h-5 w-5 text-slate-400" />
            <h2 className="font-semibold text-slate-100">Active sessions</h2>
          </div>
          <button
            type="button"
            disabled={securityBusy}
            onClick={() => void onRevokeSessions()}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-50">
            Force logout other devices
          </button>
        </div>
        <ul className="space-y-2 text-sm text-slate-400">
          {sessions.map((s) => (
            <li key={s.id} className="rounded-lg border border-slate-800 px-3 py-2">
              Session {s.id.slice(0, 8)}… · created {new Date(s.createdAt).toLocaleString()} · expires{' '}
              {new Date(s.expiresAt).toLocaleString()}
            </li>
          ))}
          {!sessions.length && <li className="text-slate-500">No active refresh sessions listed.</li>}
        </ul>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
        <h2 className="mb-3 font-semibold text-slate-100">Login history</h2>
        <ul className="max-h-64 space-y-2 overflow-y-auto text-sm text-slate-400">
          {history.map((h) => (
            <li key={h.id} className="rounded-lg border border-slate-800 px-3 py-2">
              {new Date(h.createdAt).toLocaleString()} · {h.action}
              {h.message ? ` — ${h.message}` : ''}
            </li>
          ))}
          {!history.length && <li className="text-slate-500">No login history available yet.</li>}
        </ul>
      </section>
    </div>
  );
}
