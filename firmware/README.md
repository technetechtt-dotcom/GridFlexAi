# GridFlex ESP32 edge firmware

Pilot reliability stack (Phase 5) lives in **`firmware/GridFlexEdge/`**.

## Features

| Area | Implementation |
|------|----------------|
| Store-and-forward | LittleFS queue — measure → enqueue → upload → **delete only after ACK** |
| Idempotency | Persistent `sequenceNumber` + `messageId`; backend unique on `deviceId + sequenceNumber` |
| Watchdog | ESP task WDT fed only when Modbus, network, upload, queue, and time-sync tasks stay healthy |
| Network | Wi-Fi reconnect with jittered backoff; LTE modem power-cycle stub (`USE_LTE`) |
| Remote config | TLS download, Ed25519 verify (pinned key), range checks, last-known-good, rollback |
| OTA | Dual partitions (`partitions_ota.csv`), signed-image gate, boot confirm / rollback |

**HMAC device secrets are never delivered through remote configuration.**

## Flash

1. Arduino IDE → ESP32 Dev Module (or LILYGO T-Call).
2. Tools → Partition Scheme → custom / flash `firmware/partitions_ota.csv`.
3. Libraries: **ArduinoJson**, LittleFS (bundled with ESP32 core).
4. Edit `GridFlexEdge/config.h`: Wi-Fi, `DEVICE_ID`, `CREDENTIAL_ID`, provisioned secret, API base, Ed25519 public key PEM.
5. Open `GridFlexEdge/GridFlexEdge.ino` and upload.

## Legacy sketch

`firmware/main.ino` is the older Wi-Fi + legacy HMAC demo. Prefer **GridFlexEdge** for pilot.

## Backend contracts

- Ingest: `POST /api/edge-data` (GRIDFLEX-V1)
- Config: `GET /api/edge/config` (signed payload; verify Ed25519)
- Docs: `docs/EDGE_RELIABILITY.md`, `docs/HARDWARE_IN_THE_LOOP.md`
