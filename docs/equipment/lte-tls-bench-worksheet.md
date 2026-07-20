# LTE TLS bench worksheet (ESP32 + SIM7670X)

**Status: Open — requires physical hardware.** Host CI cannot compile/flash Arduino sketches.

| Field | Value |
|-------|-------|
| Board | LILYGO T-Call / SIM7670X (exact P/N: ) |
| Firmware | `firmware/GridFlexEdge` + SSLClient + TinyGSM |
| Firmware version | |
| Backend URL | https://… |
| Date | |
| Operator | |

## Compile checklist

1. Arduino IDE: ESP32 board package matching production flash.
2. Libraries: ArduinoJson, TinyGSM, **SSLClient**, LittleFS.
3. `config.h`: Wi-Fi, LTE APN, device credentials, `PINNED_CONFIG_PUBKEY_PEM`, `USE_LTE=1`.
4. `certs.h` contains ISRG Root X1.
5. Build `GridFlexEdge.ino` (includes `ed25519_verify.cpp`).
6. Confirm serial: `[boot] Ed25519 KAT passed`.

## Bench cases

| ID | Test | Expected | Pass? | Log ref |
|----|------|----------|-------|---------|
| LTE-01 | GPRS attach | `[net] LTE GPRS up` | | |
| LTE-02 | HTTPS POST via LTE | `[net] HTTPS via LTE modem TLS client` + HTTP 200/201 | | |
| LTE-03 | Wi-Fi failover when LTE marked unhealthy | path switches to wifi | | |
| LTE-04 | LTE recovery after Wi-Fi drop | path returns to lte | | |
| LTE-05 | Cert reject (wrong CA) | TLS handshake fail; no insecure fallback | | |

## Sign-off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Firmware eng | | | |
| Ops | | | |
