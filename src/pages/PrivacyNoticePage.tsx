import React from 'react';
import { PageHeader } from '../components/PageHeader';
import { Breadcrumbs } from '../components/Breadcrumbs';

export function PrivacyNoticePage() {
  return (
    <div className="prose prose-invert max-w-3xl space-y-6 p-6 pb-20">
      <PageHeader
        title="Privacy notice"
        description="POPIA-aligned summary for GridFlex AI pilot users"
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Overview', onClick: () => window.location.assign('/') },
              { label: 'Help', onClick: () => window.location.assign('/help') },
              { label: 'Privacy' }
            ]}
          />
        }
      />
      <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 text-sm leading-relaxed text-slate-300">
        <p>
          GridFlex AI processes personal information (name, email, role, audit logs of your actions) to provide
          authenticated access to grid optimisation tools. We act as responsible party for pilot deployments under the
          Protection of Personal Information Act (POPIA).
        </p>
        <p className="mt-4">
          Data is used for authentication, authorisation, operational audit, and support. We do not sell personal
          information. Telemetry and plant data are handled separately from user profiles.
        </p>
        <p className="mt-4">
          You may request access or correction of your profile via your organisation administrator or{' '}
          <a href="mailto:privacy@gridflex.ai" className="text-emerald-400">
            privacy@gridflex.ai
          </a>
          . Retention follows your contract and applicable law.
        </p>
      </section>
    </div>
  );
}
