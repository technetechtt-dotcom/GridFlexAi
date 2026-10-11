import React from 'react';
import { PageHeader } from '../components/PageHeader';
import { Breadcrumbs } from '../components/Breadcrumbs';

type WorkflowStubPageProps = {
  title: string;
  description: string;
  bullets: string[];
  linkedPath?: string;
  linkedLabel?: string;
};

export function WorkflowStubPage({
  title,
  description,
  bullets,
  linkedPath,
  linkedLabel
}: WorkflowStubPageProps) {
  return (
    <div className="space-y-6 p-6 pb-20">
      <PageHeader
        title={title}
        description={description}
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Overview', onClick: () => window.location.assign('/') },
              { label: title }
            ]}
          />
        }
        primaryAction={
          linkedPath
            ? {
                label: linkedLabel ?? 'Open related screen',
                onClick: () => window.location.assign(linkedPath),
                variant: 'primary'
              }
            : undefined
        }
      />
      <p className="rounded-lg border border-sky-500/20 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
        This screen is an operational scaffold for the telemetry-only pilot. It does not claim customer
        savings and never enables physical plant execution.
      </p>
      <ul className="space-y-2 text-sm text-slate-300">
        {bullets.map((item) => (
          <li key={item} className="rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
