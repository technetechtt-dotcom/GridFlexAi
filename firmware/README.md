# GridFlex ESP32 edge firmware

Pilot reliability stack lives in **`firmware/GridFlexEdge/`**.

## Features

| Area | Implementation |
|------|----------------|
| Store-and-forward | LittleFS queue — measure → enqueue → upload → **delete only after ACK**; tmp+rename meta/slots |
| Fail-safe storage | If LittleFS mount fails, enqueue is disabled (no wipe/format) |
| Idempotency | Persistent `sequenceNumber` + `messageId` |
| Watchdog | ESP task WDT; NVS-persisted WDT/restart counts + reset reason in telemetry |
| Network | **LTE primary** (SIM7670X/TinyGSM) with **CA-validated TLS via SSLClient**; Wi-Fi failover both ways |
| Measurements | **RS485 Modbus RTU FC03** (`USE_RS485_MODBUS=1`); when disabled, **no randomized substitute** |
| Remote config | Authenticated GET, Ed25519 gate, expiry/version/replay checks, LKG tmp+rename, rollback; **cannot enable physical control** |
| OTA | Dual partitions (`partitions_ota.csv`), boot confirm / rollback |

**HMAC device secrets are never delivered through remote configuration.**

## Flash

1. Arduino IDE → ESP32 Dev Module (or LILYGO T-Call / SIM7670X).
2. Tools → Partition Scheme → custom / flash `firmware/partitions_ota.csv`.
3. Libraries: **ArduinoJson**, **TinyGSM**, **SSLClient**, LittleFS (ESP32 core).
4. Edit `GridFlexEdge/config.h`: Wi-Fi, device identity, secret, API base, Ed25519 public key PEM, `USE_RS485_MODBUS`, modem pins.
5. Ensure `certs.h` contains ISRG Root X1 (`npm run` / `scripts/generate-certs-h.mjs` if regenerating).
6. Open `GridFlexEdge/GridFlexEdge.ino` and upload.

## Backend contracts

- Ingest: `POST /api/edge-data` (GRIDFLEX-V1)
- Config: `GET /api/edge/config` (signed payload; verify Ed25519)
- Docs: `docs/EDGE_RELIABILITY.md`, `docs/HARDWARE_IN_THE_LOOP.md`, `docs/runbooks/p0-p2-checklist-status.md`
