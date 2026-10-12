import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { ProvenanceBadge } from '../components/ProvenanceBadge';
import { computeCommercialValue, FROZEN_RETROSPECTIVE_PILOT } from '../lib/pilotCase';

export function CommercialValuePage() {
  const navigate = useNavigate();
  const pilot = FROZEN_RETROSPECTIVE_PILOT;
  const defaultLossKwh = pilot.loss.identifiedMWh * 1000;

  const [lossKwh, setLossKwh] = useState(String(defaultLossKwh));
  const [tariff, setTariff] = useState(String(pilot.impact.tariffZarPerKwh));
  const [recoverableFraction, setRecoverableFraction] = useState('0.75');
  const [edgeFee, setEdgeFee] = useState('185000');
  const [subscription, setSubscription] = useState('24000');
  const [perfFeePct, setPerfFeePct] = useState('12');
  const [verified, setVerified] = useState('0');

  const model = useMemo(
    () =>
      computeCommercialValue({
        energyLossKwhThisMonth: Number(lossKwh) || 0,
        tariffZarPerKwh: Number(tariff) || 0,
        recoverableFraction: Number(recoverableFraction) || 0,
        edgeInstallFeeZar: Number(edgeFee) || 0,
        monthlySubscriptionZar: Number(subscription) || 0,
        performanceFeePct: Number(perfFeePct) || 0,
        verifiedSavingsZarToDate: Number(verified) || 0
      }),
    [lossKwh, tariff, recoverableFraction, edgeFee, subscription, perfFeePct, verified]
  );

  const cards = [
    { label: 'Energy loss this month', value: `${(model.energyLossKwhThisMonth / 1000).toLocaleString()} MWh`, kind: 'modelled' as const },
    { label: 'Rand value of the loss', value: `R ${model.randValueOfLoss.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, kind: 'estimated' as const },
    { label: 'Recoverable value', value: `R ${model.recoverableValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, kind: 'potential' as const },
    { label: 'GridFlex AI fee (month)', value: `R ${model.gridflexFeeThisMonth.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, kind: 'estimated' as const },
    { label: 'Estimated customer return', value: `R ${model.estimatedCustomerReturn.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, kind: 'potential' as const },
    {
      label: 'Payback period',
      value: model.paybackMonths == null ? 'n/a' : `${model.paybackMonths.toFixed(1)} months`,
      kind: 'estimated' as const
    },
    {
      label: 'Verified savings to date',
      value: `R ${model.verifiedSavingsZarToDate.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
      kind: 'measured' as const
    }
  ];

  return (
    <div className="gf-page gf-projector-text">
      <PageHeader
        title="Commercial value"
        description="How GridFlex AI makes money — and how the customer keeps the majority of recovered value"
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Presentation', onClick: () => navigate('/gcip') },
              { label: 'Commercial' }
            ]}
          />
        }
      />

      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-sm text-slate-300 sm:text-base">
        <p className="font-medium text-slate-100">Practical commercial model</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Once-off edge-device and installation fee</li>
          <li>Monthly software subscription per site / MW</li>
          <li>Optional performance fee on verified recovered value</li>
          <li>Enterprise reporting and integration fees (quoted separately)</li>
        </ul>
      </div>

      <form className="gf-form-grid max-w-4xl rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <label className="block text-sm text-slate-400">
          Energy loss this month (kWh)
          <input
            type="number"
            className="mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
            value={lossKwh}
            onChange={(e) => setLossKwh(e.target.value)}
          />
        </label>
        <label className="block text-sm text-slate-400">
          Tariff (R / kWh)
          <input
            type="number"
            step="0.01"
            className="mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
            value={tariff}
            onChange={(e) => setTariff(e.target.value)}
          />
        </label>
        <label className="block text-sm text-slate-400">
          Recoverable fraction (0–1)
          <input
            type="number"
            step="0.01"
            min="0"
            max="1"
            className="mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
            value={recoverableFraction}
            onChange={(e) => setRecoverableFraction(e.target.value)}
          />
        </label>
        <label className="block text-sm text-slate-400">
          Edge + install fee (R)
          <input
            type="number"
            className="mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
            value={edgeFee}
            onChange={(e) => setEdgeFee(e.target.value)}
          />
        </label>
        <label className="block text-sm text-slate-400">
          Monthly subscription (R)
          <input
            type="number"
            className="mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
            value={subscription}
            onChange={(e) => setSubscription(e.target.value)}
          />
        </label>
        <label className="block text-sm text-slate-400">
          Performance fee (%)
          <input
            type="number"
            step="0.1"
            className="mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
            value={perfFeePct}
            onChange={(e) => setPerfFeePct(e.target.value)}
          />
        </label>
        <label className="block text-sm text-slate-400 gf-span-all">
          Verified savings to date (R) — measured only
          <input
            type="number"
            className="mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
            value={verified}
            onChange={(e) => setVerified(e.target.value)}
          />
        </label>
      </form>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-slate-400">{card.label}</p>
              <ProvenanceBadge kind={card.kind} />
            </div>
            <p className="mt-2 text-xl font-semibold text-slate-50 sm:text-2xl">{card.value}</p>
          </div>
        ))}
      </div>

      <p className="text-sm text-slate-500">
        Fee this month = subscription (R {model.breakdown.monthlySubscriptionZar.toLocaleString()}) + performance fee (R{' '}
        {model.breakdown.performanceFeeZar.toLocaleString(undefined, { maximumFractionDigits: 0 })}). Verified savings
        stay at R0 until a measured customer approval exists — do not invent achieved results.
      </p>
    </div>
  );
}
