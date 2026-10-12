import { FUNDING_ASK, PILOT_90_DAY_DELIVERABLES, USE_OF_FUNDS } from './fundingAsk';
import { FROZEN_DEMO_PACK_VERSION } from './pilotCase';

/** One-page printable pilot / funding request for judges. */
export function buildPilotRequestHtml(): string {
  const generatedAt = new Date().toISOString();
  const fundsRows = USE_OF_FUNDS.map(
    (r) =>
      `<tr><td>${r.item}</td><td style="text-align:right">${r.pct}%</td><td style="text-align:right">R ${r.zar.toLocaleString()}</td><td>${r.note}</td></tr>`
  ).join('');
  const deliverables = PILOT_90_DAY_DELIVERABLES.map((d) => `<li>${d}</li>`).join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>Techne Tech · GridFlex AI — Pilot funding request</title>
<style>
  body { font-family: Georgia, 'Times New Roman', serif; margin: 18mm; color: #0f172a; line-height: 1.4; font-size: 12px; }
  h1 { color: #065f46; font-size: 22px; margin: 0 0 4px; }
  h2 { color: #134e4a; font-size: 14px; margin: 16px 0 6px; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px; }
  .meta { color: #64748b; font-size: 11px; }
  .ask { font-size: 20px; font-weight: bold; color: #065f46; margin: 10px 0; }
  table { border-collapse: collapse; width: 100%; margin: 8px 0; font-size: 11px; }
  th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #f1f5f9; }
  ul { margin: 4px 0 8px 18px; }
  @media print { button { display: none !important; } body { margin: 12mm; } }
</style>
</head>
<body>
  <p class="meta">Techne Tech · GridFlex AI</p>
  <h1>GCIP pilot funding request</h1>
  <p class="meta">One-page brief for judges · Generated ${generatedAt} · Demo pack ${FROZEN_DEMO_PACK_VERSION}</p>

  <p class="ask">Ask: ${FUNDING_ASK.label} for a ${FUNDING_ASK.periodDays}-day telemetry-only pilot</p>
  <p>${FUNDING_ASK.purpose}. Physical plant execution stays locked unless a separate written plant approval is obtained.</p>

  <h2>Use of funds</h2>
  <table>
    <tr><th>Category</th><th>%</th><th>Amount</th><th>Notes</th></tr>
    ${fundsRows}
    <tr><th colspan="2">Total</th><th style="text-align:right">${FUNDING_ASK.label}</th><th></th></tr>
  </table>

  <h2>90-day pilot deliverables</h2>
  <ul>${deliverables}</ul>

  <h2>What the demonstration already shows</h2>
  <ul>
    <li>Frozen synthetic NC Demo Plant pack — not a named commercial site</li>
    <li>“Measured” labels mean values treated as measured <em>within the synthetic pack semantics</em>, not third-party meter settlement</li>
    <li>Internal pilot-desk review only — not an independent audit</li>
  </ul>

  <button onclick="window.print()" style="margin-top:16px;padding:10px 16px;background:#059669;color:#fff;border:0;border-radius:8px;cursor:pointer">
    Print this page
  </button>
  <footer class="meta" style="margin-top:20px;border-top:1px solid #cbd5e1;padding-top:8px">
    Techne Tech · GridFlex AI · Advisory only · Physical execution locked
  </footer>
</body>
</html>`;
}

export function openPilotRequestPrint() {
  const html = buildPilotRequestHtml();
  const win = window.open('', '_blank', 'noopener,noreferrer,width=900,height=700');
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
  a.download = 'gridflex-gcip-pilot-funding-request.html';
  a.click();
  URL.revokeObjectURL(url);
}
