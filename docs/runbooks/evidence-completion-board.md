# Evidence completion board (pilot)

All items below stay **Open** until dated artifacts and signatures exist. Physical execution remains **disabled** for the initial pilot (`PILOT_LOCK_PHYSICAL_EXECUTION=true`).

| Gate | Status | Artifact |
|------|--------|----------|
| Physical execution disabled | **Enforced in code/config** | `env.ts`, `render.yaml`, `docker-compose.yml`, boot attestation |
| Ed25519 device verify + KAT | **Code Done** — flash/bench Open | `ed25519_verify.cpp`, `ed25519_kat.h`, `backend/tests/fixtures/ed25519-remote-config-kat.json` |
| SunSpec map on ESP32 Modbus | **Code Done** — HW enable Open | `sunspec_model103_map.h`, `USE_RS485_MODBUS=1` |
| LTE TLS compile + bench | **Open** | `docs/equipment/lte-tls-bench-worksheet.md` |
| Queue power-loss journal | **Code Done** — device stage tests Open | `persistent_queue.h`, `journaled-queue.ts` CI |
| HIL CRC / length / disconnect / reset | **CI partial** — bench Open | `ed25519-kat-and-modbus-hil.test.ts`, `hil-evidence-worksheet.md` |
| Physical inverter validation + EE sign-off | **Open** | `pilot-inverter-dossier.md`, issue #44 |
| Credential rotation + revocation rehearsal | **Open** | `credential-rotation-rehearsal.md`, issue #45 |
| DB restore approver + HTTP smoke | **Open** | `backup-restore-evidence.md` |
| Observability fire-drill | **Open** | `docs/observability/alert-review.md` |
| Staging/prod parity promotion | **Open** | `parity-promotion-evidence.md` |
| Load soak evidence | **Open** | `docs/load/evidence-worksheet.md` |
| External pen-test | **Open** | issue #47 |
| POPIA IO | **Open** | issue #48 |

## Physical execution lock (initial pilot)

Do **not** set `PHYSICAL_COMMAND_EXECUTION_ENABLED` or `HIL_PLANT_APPROVAL_CONFIRMED` to true.
Keep `PILOT_LOCK_PHYSICAL_EXECUTION=true` on Render/staging until plant attestation (#46).
