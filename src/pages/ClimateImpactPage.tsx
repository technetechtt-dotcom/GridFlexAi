import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { ProvenanceBadge } from '../components/ProvenanceBadge';
import { computeClimateImpact, FROZEN_RETROSPECTIVE_PILOT } from '../lib/pilotCase';

export function ClimateImpactPage() {
  const navigate = useNavigate();
  const pilot = FROZEN_RETROSPECTIVE_PILOT;
  const [baselineLossMwh, setBaselineLossMwh] = useState(String(pilot.loss.identifiedMWh));
  const [remainingLossMwh, setRemainingLossMwh] = useState(String(pilot.loss.remainingMWh));
  const [tariff, setTariff] = useState(String(pilot.impact.tariffZarPerKwh));
  const [factor, setFactor] = useState(String(pilot.impact.emissionsFactorKgPerKwh));

  const result = useMemo(() => {
    const baselineLossKwh = Number(baselineLossMwh) * 1000;
    const remainingLossKwh = Number(remainingLossMwh) * 1000;
    return computeClimateImpact({
      baselineLossKwh: Number.isFinite(baselineLossKwh) ? baselineLossKwh : 0,
      remainingLossKwh: Number.isFinite(remainingLossKwh) ? remainingLossKwh : 0,
      tariffZarPerKwh: Number(tariff) || 0,
      emissionsFactorKgPerKwh: Number(factor) || 0
    });
  }, [baselineLossMwh, remainingLossMwh, tariff, factor]);

  return (
    <div className="gf-page gf-projector-text">
      <PageHeader
        title="Climate-impact calculator"
        description="Defensible formulas with explicit measured / modelled / estimated / potential labels"
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Presentation', onClick: () => navigate('/gcip') },
              { label: 'Climate impact' }
            ]}
          />
        }
      />

      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-sm text-slate-300 sm:text-base">
        <p className="font-medium text-slate-100">Formulas</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Recovered energy = baseline loss − remaining loss</li>
          <li>Financial value = recovered kWh × applicable tariff</li>
          <li>Avoided emissions = recovered renewable kWh × approved emissions factor</li>
        </ul>
      </div>

      <div className="flex flex-wrap gap-2">
        <ProvenanceBadge kind="measured" />
        <ProvenanceBadge kind="modelled" />
        <ProvenanceBadge kind="estimated" />
        <ProvenanceBadge kind="potential" />
      </div>

      <form className="gf-form-grid max-w-3xl rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <label className="block text-sm text-slate-400">
          Baseline loss (MWh) <ProvenanceBadge kind="modelled" className="ml-2" />
          <input
            type="number"
            className="mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
            value={baselineLossMwh}
            onChange={(e) => setBaselineLossMwh(e.target.value)}
          />
        </label>
        <label className="block text-sm text-slate-400">
          Remaining loss (MWh) <ProvenanceBadge kind="modelled" className="ml-2" />
          <input
            type="number"
            className="mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
            value={remainingLossMwh}
            onChange={(e) => setRemainingLossMwh(e.target.value)}
          />
        </label>
        <label className="block text-sm text-slate-400">
          Tariff (R / kWh) <ProvenanceBadge kind="estimated" className="ml-2" />
          <input
            type="number"
            step="0.01"
            className="mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
            value={tariff}
            onChange={(e) => setTariff(e.target.value)}
          />
        </label>
        <label className="block text-sm text-slate-400">
          Emissions factor (kgCO₂e / kWh) <ProvenanceBadge kind="estimated" className="ml-2" />
          <input
            type="number"
            step="0.01"
            className="mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
            value={factor}
            onChange={(e) => setFactor(e.target.value)}
          />
        </label>
      </form>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-slate-400">Recovered energy</p>
            <ProvenanceBadge kind="potential" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-emerald-300">
            {(result.recoveredKwh / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} MWh
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-slate-400">Financial value</p>
            <ProvenanceBadge kind="estimated" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-emerald-300">
            R {result.financialValueZar.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-slate-400">Avoided CO₂</p>
            <ProvenanceBadge kind="estimated" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-emerald-300">
            {result.avoidedCo2t.toLocaleString(undefined, { maximumFractionDigits: 1 })} t
          </p>
        </div>
      </div>

      <p className="rounded-lg border border-fuchsia-500/20 bg-fuchsia-500/10 px-4 py-3 text-sm text-fuchsia-100">
        Do not present these calculator outputs as achieved / settled customer results unless a measured verification
        record exists on the Pilot Results page. Defaults come from the frozen synthetic NC demo pack.
      </p>
    </div>
  );
}
