import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, KeyRound, MonitorSmartphone, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { PageHeader } from '../components/PageHeader';
import { Breadcrumbs } from '../components/Breadcrumbs';

export function AccountSettingsPage() {
  const { user } = useAuth();
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [dispatchDigest, setDispatchDigest] = useState(false);
  const [maintenanceAlerts, setMaintenanceAlerts] = useState(true);

  return (
    <div className="space-y-6 p-6 pb-20">
      <PageHeader
        title="Account settings"
        description="Profile, security, and notification preferences"
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
            <p className="text-sm text-slate-400">{user?.name} · {user?.email}</p>
            <p className="text-xs text-slate-500 capitalize">Role: {user?.role}</p>
          </div>
          <Link
            to="/profile"
            className="ml-auto text-sm font-medium text-emerald-400 hover:text-emerald-300">
            View full profile
          </Link>
        </div>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
        <div className="mb-4 flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-slate-400" />
          <h2 className="font-semibold text-slate-100">Change password</h2>
        </div>
        <form className="grid max-w-md gap-3" onSubmit={(e) => e.preventDefault()}>
          <input
            type="password"
            placeholder="Current password"
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
            autoComplete="current-password"
          />
          <input
            type="password"
            placeholder="New password"
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
            autoComplete="new-password"
          />
          <button
            type="submit"
            disabled
            title="Password change API coming soon"
            className="w-fit rounded-lg bg-slate-700 px-4 py-2 text-sm text-slate-400">
            Update password (coming soon)
          </button>
        </form>
      </section>

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
        <div className="flex items-center gap-2">
          <MonitorSmartphone className="h-5 w-5 text-slate-400" />
          <h2 className="font-semibold text-slate-100">Active sessions</h2>
        </div>
        <p className="mt-2 text-sm text-slate-400">
          Session management (revoke other devices) will appear here when the auth API exposes session listing.
        </p>
        <p className="mt-2 text-xs text-slate-500">This browser session is active now.</p>
      </section>
    </div>
  );
}
