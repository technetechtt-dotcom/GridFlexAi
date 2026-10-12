# Short answers: synthetic demonstration dataset

Use these when judges ask about the numbers.

**Q: Is this a real plant’s savings?**  
**A:** No. This is a frozen synthetic pack (`gcip-demo-2026-10-12.1`) shaped like a Northern Cape PV profile. We do not claim a named commercial site.

**Q: Why synthetic?**  
**A:** Permission to use a real plant brand (including Prieska Solar) is not confirmed. We refuse to invent customer affiliation.

**Q: What does “Measured (pack)” mean?**  
**A:** Inside this synthetic dataset, “measured” means the pack treats the value as if it were measured export — so we can practice loss attribution methodology. It is **not** an audited commercial meter reading or settlement figure.

**Q: Are the figures internally consistent?**  
**A:** Yes. Loss = expected − actual; recoverable = loss − remaining; Rand and CO₂ follow labelled formulas. Run `npm run validate:demo-pack`.

**Q: Who reviewed it?**  
**A:** An internal GridFlex / Techne Tech pilot desk — not an independent auditor.

**Q: Can you turn plant equipment?**  
**A:** No. Physical execution stays locked. Recommendations are advisory only.

**Q: Exact funding ask?**  
**A:** **R 1,950,000** for a 90-day telemetry-only pilot (see use-of-funds on `/gcip/ask` and the printed pilot request).

**Q: What changes after GCIP?**  
**A:** A telemetry-only pilot with a willing operator, still execution-locked until written plant approval, then replace this pack with site-scoped measured windows.
