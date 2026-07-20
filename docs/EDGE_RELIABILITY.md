# ESP32 edge reliability (Phase 5)

## Goals

Telemetry must survive multi-hour network outages, power cycles must not lose the queue, duplicate uploads must not duplicate database readings, locked tasks must trip the watchdog, unsigned/expired config must be rejected, and failed OTA must roll back.

## Architecture

```
Measure → LittleFS queue → GRIDFLEX-V1 upload → ACK → dequeue
                ↑
         survives reboot
```

### Store-and-forward

Each record:

```json
{
  "messageId": "uuid",
  "sequenceNumber": 10293,
  "measuredAt": "2026-07-20T08:30:00Z",
  "payload": {},
  "retryCount": 0
}
```

- Remove **only** after HTTP 200/201 acknowledgement.
- Exponential backoff with jitter on failure.
- Queue full → refuse enqueue (never overwrite unsent).
- Host contract tests: `backend/tests/edge-reliability.test.ts`
- Firmware: `firmware/GridFlexEdge/persistent_queue.h`

### Idempotent ingestion

Uniqueness: **`deviceId` + `sequenceNumber`** via `EdgeIngestReceipt`.

| Case | Behaviour |
|------|-----------|
| New sequence | Create reading + receipt; advance watermark; HTTP 201 |
| Same sequence, new nonce (retry) | Idempotent ACK; no duplicate row; HTTP 200 |
| Lower sequence | HTTP 409 regression |

### Watchdog

TWDT reset only when Modbus, network, upload, queue, and time-sync tasks remain healthy. Reset reason reported in edge health fields (`lastResetReason`, `watchdogResetCount`).

### Network recovery

Wi-Fi reconnect with jittered backoff; optional LTE (`USE_LTE`) with modem power-cycle after repeated failures. Queue remains on LittleFS across reboot.

### Signed remote configuration

Ed25519-signed payload fields: configuration version, polling interval, server endpoint, enabled telemetry keys, approved firmware minimum, issue/expiry.

- Publish: `POST /api/edge/config` (admin/developer)
- Device pull: `GET /api/edge/config` (device auth)
- **Never** distribute device HMAC secrets through this channel
- Env: `EDGE_CONFIG_SIGNING_PRIVATE_KEY_PEM`, `EDGE_CONFIG_SIGNING_PUBLIC_KEY_PEM`

### OTA safety

`firmware/partitions_ota.csv` — dual app partitions. Unsigned images rejected; boot confirm cancels rollback; crash before confirm rolls back.

## Migration

`20260720140000_edge_reliability` — `EdgeIngestReceipt`, `EdgeRemoteConfig`, sensor sequence uniqueness.

## Acceptance mapping

| Criterion | Evidence |
|-----------|----------|
| 24h outage survival | Queue max ≥ 2000 @ 1/min; HIL lost-LTE test |
| Power cycle preserves queue | LittleFS meta + slot files; reboot snapshot tests |
| Duplicate uploads idempotent | Receipt unique + auth equal-sequence path |
| Locked task → WDT | `WatchdogHealth::service` only feeds when all tasks kick |
| Unsigned/expired config rejected | `edge-reliability` + HIL-12 tests |
| Failed OTA rolls back | Dual partition + `confirmBoot` / reject unsigned |
