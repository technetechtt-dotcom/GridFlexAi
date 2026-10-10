import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, FileText, LifeBuoy, Shield, ScrollText, Rocket } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Breadcrumbs } from '../components/Breadcrumbs';

const links = [
  { to: '/blueprint', label: 'Platform blueprint', desc: 'Architecture and integration map', icon: BookOpen },
  { to: '/environment-release', label: 'Release notes & build', desc: 'Deployed git SHA and image digest', icon: Rocket },
  { to: '/reports', label: 'Report centre', desc: 'Export KPI and operational CSVs', icon: FileText },
  { to: 'mailto:support@gridflex.ai?subject=GridFlex%20support', label: 'Contact support', desc: 'Email the operations team', icon: LifeBuoy, external: true },
  { to: '/privacy', label: 'Privacy notice (POPIA)', desc: 'How personal information is handled', icon: Shield },
  { to: '/terms', label: 'Terms of use', desc: 'Platform usage conditions', icon: ScrollText }
];

export function HelpCentrePage() {
  return (
    <div className="space-y-6 p-6 pb-20">
      <PageHeader
        title="Help centre"
        description="Documentation, release information, and support"
        breadcrumbs={
          <Breadcrumbs items={[{ label: 'Overview', onClick: () => window.location.assign('/') }, { label: 'Help' }]} />
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        {links.map((item) => {
          const Icon = item.icon;
          const inner = (
            <>
              <div className="rounded-lg bg-emerald-500/10 p-2">
                <Icon className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-100">{item.label}</h2>
                <p className="text-sm text-slate-400">{item.desc}</p>
              </div>
            </>
          );
          if (item.external) {
            return (
              <a
                key={item.to}
                href={item.to}
                className="flex gap-4 rounded-xl border border-slate-800 bg-slate-900/50 p-5 transition-colors hover:border-slate-600">
                {inner}
              </a>
            );
          }
          return (
            <Link
              key={item.to}
              to={item.to}
              className="flex gap-4 rounded-xl border border-slate-800 bg-slate-900/50 p-5 transition-colors hover:border-slate-600">
              {inner}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
