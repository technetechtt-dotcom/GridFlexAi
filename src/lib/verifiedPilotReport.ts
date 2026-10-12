import { FROZEN_RETROSPECTIVE_PILOT, IMPACT_CLASS_LABEL, type PilotCase } from './pilotCase';

/** Build a print-ready HTML report suitable for solar-farm managers / investors / municipalities. */
export function buildVerifiedPilotReportHtml(pilot: PilotCase = FROZEN_RETROSPECTIVE_PILOT): string {
  const generatedAt = new Date().toISOString();
  const cls = (c: string) => IMPACT_CLASS_LABEL[c as keyof typeof IMPACT_CLASS_LABEL] ?? c;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>GridFlex AI — Verified Pilot Report — ${pilot.site.name}</title>
<style>
  :root { color-scheme: light; }
  body { font-family: Georgia, 'Times New Roman', serif; margin: 28px; color: #0f172a; line-height: 1.45; }
  h1 { color: #065f46; font-size: 26px; margin: 0 0 8px; }
  h2 { color: #134e4a; font-size: 17px; margin: 28px 0 10px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; }
  h3 { font-size: 14px; margin: 16px 0 6px; }
  .meta { color: #64748b; font-size: 12px; }
  .banner { background: #fff7ed; border: 1px solid #fdba74; padding: 12px 14px; margin: 16px 0; font-size: 13px; }
  .ok { background: #ecfdf5; border: 1px solid #6ee7b7; }
  table { border-collapse: collapse; width: 100%; margin: 10px 0 16px; font-size: 13px; }
  th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; vertical-align: top; }
  th { background: #f1f5f9; width: 34%; }
  ul { margin: 6px 0 12px 18px; }
  .sig { margin-top: 24px; padding: 14px; border: 1px dashed #94a3b8; background: #f8fafc; }
  @media print {
    body { margin: 12mm; }
    button { display: none !important; }
    a { color: inherit; text-decoration: none; }
  }
</style>
</head>
<body>
  <h1>GridFlex AI — Verified Pilot Report</h1>
  <p class="meta">${pilot.title}</p>
  <p class="meta">Frozen pack ${pilot.frozenVersion} · Generated ${generatedAt}</p>

  <div class="banner"><strong>Data mode:</strong> ${pilot.modeLabel}</div>
  <div class="banner"><strong>Reviewer note:</strong> Confirmation is from an <em>internal</em> GridFlex pilot-desk reviewer — not an independent third-party auditor. No real commercial site brand is asserted.</div>

  <h2>1. Executive summary</h2>
  <p>
    Over ${pilot.monitoring.days} days at ${pilot.site.name} (${pilot.site.installedCapacityMWp} MWp),
    measured generation was ${pilot.generation.actualMWh.toLocaleString()} MWh against modelled expected
    ${pilot.generation.expectedMWh.toLocaleString()} MWh. Identified loss of
    ${pilot.loss.identifiedMWh.toLocaleString()} MWh was attributed to <em>${pilot.loss.causeLabel}</em>.
    An advisory recovery recommendation was approved. Recoverable energy of
    ${pilot.impact.recoveredOrRecoverableMWh.toLocaleString()} MWh is labelled
    <strong>${cls(pilot.impact.impactClass)}</strong> — not settled customer savings.
  </p>

  <h2>2. Site information</h2>
  <table>
    <tr><th>Site</th><td>${pilot.site.name}</td></tr>
    <tr><th>Region</th><td>${pilot.site.region}, ${pilot.site.country}</td></tr>
    <tr><th>Installed capacity</th><td>${pilot.site.installedCapacityMWp} MWp · ${pilot.site.technology}</td></tr>
    <tr><th>Monitoring period</th><td>${pilot.monitoring.start} → ${pilot.monitoring.end} (${pilot.monitoring.days} days)</td></tr>
  </table>

  <h2>3. Data quality</h2>
  <table>
    <tr><th>Completeness</th><td>${pilot.monitoring.dataCompletenessPct}% of expected intervals present</td></tr>
    <tr><th>Actual generation class</th><td>${cls(pilot.generation.actualClass)}</td></tr>
    <tr><th>Expected generation class</th><td>${cls(pilot.generation.expectedClass)}</td></tr>
  </table>

  <h2>4. Baseline methodology</h2>
  <p>${pilot.baselineMethodology}</p>

  <h2>5. Identified losses</h2>
  <table>
    <tr><th>Actual generation</th><td>${pilot.generation.actualMWh.toLocaleString()} MWh · ${cls(pilot.generation.actualClass)}</td></tr>
    <tr><th>Expected generation</th><td>${pilot.generation.expectedMWh.toLocaleString()} MWh · ${cls(pilot.generation.expectedClass)}</td></tr>
    <tr><th>Identified loss</th><td>${pilot.loss.identifiedMWh.toLocaleString()} MWh</td></tr>
    <tr><th>Remaining loss</th><td>${pilot.loss.remainingMWh.toLocaleString()} MWh</td></tr>
    <tr><th>Cause</th><td>${pilot.loss.causeLabel} (${pilot.loss.causeCode}) · ${cls(pilot.loss.causeClass)}</td></tr>
  </table>

  <h2>6. Recommendations</h2>
  <p><strong>${pilot.recommendation.id}</strong> — ${pilot.recommendation.summary}</p>
  <p>Confidence: ${(pilot.recommendation.confidence * 100).toFixed(0)}%</p>
  <p>Why: ${pilot.recommendation.why}</p>
  <h3>Inputs used</h3>
  <ul>${pilot.recommendation.inputs.map((i) => `<li>${i}</li>`).join('')}</ul>
  <p>Low-confidence behaviour: ${pilot.recommendation.lowConfidenceBehaviour}</p>

  <h2>7. Approved actions</h2>
  <table>
    <tr><th>Action taken</th><td>${pilot.action.taken}</td></tr>
    <tr><th>Status</th><td>${pilot.action.status}</td></tr>
    <tr><th>Approved by</th><td>${pilot.action.approvedBy}</td></tr>
    <tr><th>Approved at</th><td>${pilot.action.approvedAt}</td></tr>
  </table>

  <h2>8. Energy and financial impact</h2>
  <table>
    <tr><th>Recovered / recoverable energy</th><td>${pilot.impact.recoveredOrRecoverableMWh.toLocaleString()} MWh · ${cls(pilot.impact.impactClass)}</td></tr>
    <tr><th>Tariff used</th><td>R ${pilot.impact.tariffZarPerKwh.toFixed(2)} / kWh</td></tr>
    <tr><th>Financial value</th><td>R ${pilot.impact.financialValueZar.toLocaleString()} · ${cls(pilot.impact.financialClass)}</td></tr>
  </table>
  <p class="meta">Formula: recovered energy = baseline loss − remaining loss; financial value = recovered kWh × tariff.</p>

  <h2>9. Carbon impact</h2>
  <table>
    <tr><th>Emissions factor</th><td>${pilot.impact.emissionsFactorKgPerKwh} kgCO₂e / kWh</td></tr>
    <tr><th>Avoided CO₂</th><td>${pilot.impact.avoidedCo2t.toLocaleString()} tCO₂e · ${cls(pilot.impact.carbonClass)}</td></tr>
  </table>
  <p class="meta">Formula: avoided emissions = recovered renewable kWh × approved emissions factor.</p>

  <h2>10. Assumptions and limitations</h2>
  <h3>Assumptions</h3>
  <ul>${pilot.assumptions.map((a) => `<li>${a}</li>`).join('')}</ul>
  <h3>Limitations</h3>
  <ul>${pilot.limitations.map((a) => `<li>${a}</li>`).join('')}</ul>

  <h2>11. Digital approval record</h2>
  <div class="sig ok">
    <p><strong>${pilot.reviewer.name}</strong> — ${pilot.reviewer.role}</p>
    <p>${pilot.reviewer.confirmation}</p>
    <p class="meta">Confirmed at ${pilot.reviewer.confirmedAt} · Case ID ${pilot.id}</p>
  </div>

  <button onclick="window.print()" style="margin-top:24px;padding:12px 18px;background:#059669;color:#fff;border:0;border-radius:8px;font-size:14px;cursor:pointer">
    Print / Save as PDF
  </button>

  <footer style="margin-top:36px;padding-top:14px;border-top:1px solid #cbd5e1;font-size:11px;color:#64748b;">
    <strong>Techne Tech</strong> · GridFlex AI · Frozen pack ${pilot.frozenVersion} · Advisory only · Physical execution locked ·
    Synthetic demonstration dataset (no third-party plant brand claimed)
  </footer>
</body>
</html>`;
}

export function openVerifiedPilotReport(pilot: PilotCase = FROZEN_RETROSPECTIVE_PILOT) {
  const html = buildVerifiedPilotReportHtml(pilot);
  const win = window.open('', '_blank', 'noopener,noreferrer,width=960,height=720');
  if (win) {
    win.document.write(html);
    win.document.close();
    win.focus();
    return;
  }
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gridflex-verified-pilot-${pilot.id}.html`;
  a.click();
  URL.revokeObjectURL(url);
}
