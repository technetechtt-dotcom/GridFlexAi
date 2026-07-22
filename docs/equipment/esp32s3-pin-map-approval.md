# ESP32-S3 pilot pin-map approval

Status: **OPEN — exact commercial board model/revision and electrical verification are not complete.**

Do **not** treat desk review, CI `esp32-s3-devkitc-1` builds, or community pin sketches as confirmation.

The CI target `esp32-s3-devkitc-1` is a **build** target only. It does not prove that
GPIO 25 (or any other RS485 pin) is free on the purchased board.

## Board identity (required before wiring)

| Field | Verified value / evidence |
|-------|---------------------------|
| Board manufacturer | _pending — candidate: Waveshare_ |
| Commercial board model | _pending — candidate: ESP32-S3-SIM7670G-4G_ |
| Board revision | |
| ESP32-S3 module part number | |
| Schematic revision and URL/path | https://www.waveshare.com/wiki/ESP32-S3-SIM7670G-4G |
| BOM revision | |
| Photo / annotated drawing path | |
| Artifact SHA-256 | |

## Documented pin conflict (desk review 2026-07-22)

Firmware defaults in `firmware/GridFlexEdge/config.h` currently assume a
**LILYGO-style** modem map, **not** the community Waveshare map:

| Function | Firmware (`config.h` / LTE CI) | Waveshare community examples | Notes |
|----------|--------------------------------|------------------------------|-------|
| LTE UART RX (ESP←modem) | GPIO **26** | GPIO **17** (community) | **Mismatch — must pick one board and flash matching defines** |
| LTE UART TX (ESP→modem) | GPIO **27** | GPIO **18** (community) | **Mismatch** |
| LTE modem power / PWRKEY | GPIO **4** | _board-specific; SD MMC CMD also uses GPIO 4 on Waveshare wiki TF examples_ | Risk if TF card is enabled |
| RS485 DE/RE | GPIO **25** (`platformio.ini` `esp32s3-lte-ci`) | **Not onboard** on ESP32-S3-SIM7670G-4G (no integrated RS485) | Needs external transceiver + free header pin |
| Camera DVP | unused in firmware | GPIOs 7–16, 34–37 reserved when camera used | Leave camera unpopulated for pilot |
| TF / SDMMC | unused in firmware | CLK=5, CMD=4, DATA=6 (wiki examples) | Keep TF unused if MODEM_PWR stays on GPIO 4 |
| USB D-/D+ | ESP32-S3 native 19/20 | firmware compile-time rejects RS485 on 19/20 | OK |
| Strapping | 0 / 3 / 45 / 46 | firmware compile-time rejects RS485 on these | OK |

Sources consulted (desk only — not a signed electrical verification):

- Waveshare wiki: ESP32-S3-SIM7670G-4G
- Community TinyGSM sketches using Waveshare: modem RX=17, TX=18
- LilyGO Modem Series docs (different product family): modem pins differ again (10/11 or 4/5)

**Conclusion:** The exact Waveshare GPIO map is **not verified for this pilot**.
`MODBUS_DE_RE=25` is a **candidate header pin** only. Do not treat CI success as board approval.

## Candidate firmware assignment (after board is confirmed)

Update `config.h` / PlatformIO flags to the **signed** map before flash:

| Function | Approved GPIO | Source | Conflict check |
|----------|---------------|--------|----------------|
| LTE modem power | | schematic + continuity | |
| LTE UART RX | | schematic + AT echo | |
| LTE UART TX | | schematic + AT echo | |
| RS485 DE/RE | | schematic + transceiver datasheet | distinct from modem/USB/strap |
| RS485 RX / TX | | schematic | |
| Unused reserved | camera / TF / RGB | BOM | left unconnected |

## Exact-board electrical verification

| Field | Verified value / evidence |
|-------|---------------------------|
| GPIO chosen for DE/RE exposed on connector/test point | |
| That GPIO connected elsewhere on board | |
| Boot/strapping impact checked | |
| USB/JTAG impact checked | |
| Modem/peripheral conflict checked | |
| Measured idle voltage and continuity | |
| Approved RS485 transceiver and DE/RE wiring | |
| Common ground / isolation / termination / biasing documented | |
| Build using approved board profile succeeds | |

## Acceptance

- Chosen DE/RE GPIO is exposed, not reserved, and has no schematic or measured conflict.
- Modem UART pins match the flashed firmware defines (AT echo proven).
- Selected RS485 transceiver voltage and logic levels match the board.
- Engineering signs before energizing the RS485 interface.

| Role | Name | Signature / ticket | Date |
|------|------|--------------------|------|
| Firmware engineer | | | |
| Hardware/electrical reviewer | | | |
| Plant representative | | | |
