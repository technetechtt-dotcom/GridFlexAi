import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PageHeader } from '../components/PageHeader';
import { Breadcrumbs } from '../components/Breadcrumbs';

export function ProfilePage() {
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6 p-6 pb-20">
      <PageHeader
        title="Your profile"
        description="Identity from your authenticated session"
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Overview', onClick: () => window.location.assign('/') },
              { label: 'Settings', onClick: () => window.location.assign('/settings') },
              { label: 'Profile' }
            ]}
          />
        }
      />

      <dl className="max-w-lg divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-900/50">
        {[
          { term: 'Name', value: user.name },
          { term: 'Email', value: user.email },
          { term: 'Role', value: user.role },
          { term: 'User ID', value: user.id }
        ].map((row) => (
          <div key={row.term} className="flex justify-between gap-4 px-6 py-4">
            <dt className="text-sm text-slate-500">{row.term}</dt>
            <dd className="text-sm font-medium text-slate-100">{row.value}</dd>
          </div>
        ))}
      </dl>

      <Link to="/settings" className="text-sm text-emerald-400 hover:text-emerald-300">
        Back to account settings
      </Link>
    </div>
  );
}
