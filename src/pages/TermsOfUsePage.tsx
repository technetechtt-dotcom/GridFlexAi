import React from 'react';
import { PageHeader } from '../components/PageHeader';
import { Breadcrumbs } from '../components/Breadcrumbs';

export function TermsOfUsePage() {
  return (
    <div className="max-w-3xl space-y-6 p-6 pb-20">
      <PageHeader
        title="Terms of use"
        description="Pilot platform conditions"
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Overview', onClick: () => window.location.assign('/') },
              { label: 'Help', onClick: () => window.location.assign('/help') },
              { label: 'Terms' }
            ]}
          />
        }
      />
      <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 text-sm leading-relaxed text-slate-300">
        <p>
          GridFlex AI is provided in pilot / demonstration mode. Recommendations, forecasts, and optimisation outputs are
          advisory unless explicitly covered by a separate operational agreement.
        </p>
        <p className="mt-4">
          Physical plant control, market submission, and grid operator instructions are not executed through this UI
          during the pilot. Operators remain responsible for compliance with licence conditions and grid codes.
        </p>
        <p className="mt-4">
          Misuse, credential sharing, or attempts to bypass role controls may result in access suspension.
        </p>
      </section>
    </div>
  );
}
