# ESP32-S3 pilot pin-map approval

Status: **OPEN — exact commercial board model/revision and electrical verification are not complete.**

Do **not** treat desk review, CI `esp32-s3-devkitc-1` builds, the
`esp32s3-waveshare-sim7670g-candidate` env, or community pin sketches as
confirmation or flash authorization.

The CI target `esp32-s3-devkitc-1` is a **build** target only. It does not prove that
GPIO 25 (or any other RS485 pin) is free on the purchased board.

## Board identity (required before wiring)

| Field | Verified value / evidence |
|-------|---------------------------|
| Board manufacturer | _pending — candidate: Waveshare_ |
| Commercial board model | _pending — candidate: ESP32-S3-SIM7670G-4G_ (schematic family also labeled ESP32-S3-A-SIM7670X-4G) |
| Board revision | _pending — Waveshare docs distinguish V1 vs V2 (camera / MAX17048 I2C differ)_ |
| ESP32-S3 module part number | |
| Schematic revision and URL/path | https://www.waveshare.com/wiki/ESP32-S3-SIM7670G-4G · PDF https://files.waveshare.com/wiki/ESP32-S3-A7670E-4G/ESP32-S3-A-SIM7670X-4G-Sch.pdf |
| BOM revision | |
| Photo / annotated drawing path | |
| Artifact SHA-256 | |

## Documented pin conflict (desk review 2026-07-22)

Firmware **defaults** in `firmware/GridFlexEdge/config.h` remain **LILYGO-style**.
Modem pins are `#ifndef`-overridable for board-specific PlatformIO envs.

| Function | Default (`config.h` / `esp32s3-lte-ci`) | Waveshare desk candidate | Notes |
|----------|----------------------------------------|--------------------------|-------|
| LTE UART RX (ESP←modem) | GPIO **26** | GPIO **18** | Schematic level-shifter GPIO17/18 ↔ modem UART |
| LTE UART TX (ESP→modem) | GPIO **27** | GPIO **17** | Matches TinyGSM/LilyGO SIM7670G UART direction |
| LTE modem power / PWRKEY | GPIO **4** | GPIO **9** (candidate) | Waveshare TF CMD also uses GPIO **4**; camera Y4 uses GPIO **9** when camera populated — leave camera/TF unused |
| RS485 DE/RE | GPIO **25** (`esp32s3-lte-ci`) | GPIO **25** header candidate | **Not onboard**; needs external transceiver |
| RS485 RX / TX | 16 / 17 (modbus defaults) | **15 / 16** in candidate env | Default MODBUS_TX=17 **conflicts** with Waveshare modem TX |
| Camera DVP | unused | V1/V2 tables on Waveshare Arduino docs | Leave unpopulated for pilot |
| TF / SDMMC | unused | CLK=5, CMD=4, DATA=6 | Keep unused |
| RGB | unused | GPIO **38** (WS2812B) | Leave unused |
| USB D-/D+ | 19/20 | firmware rejects RS485 on 19/20 | OK |
| Strapping | 0 / 3 / 45 / 46 | firmware rejects RS485 on these | OK |

Sources consulted (desk only — **not** a signed electrical verification):

- Waveshare wiki + Arduino docs (V1/V2 camera and fuel-gauge differences)
- Waveshare schematic PDF (GPIO17/18 level shifter to modem UART)
- LilyGO T-SIM7670G-S3 docs (UART TX=17, RX=18, PWRKEY=9) — related module family, different PCB

**Conclusion:** Board model/revision still **unconfirmed**. Candidate env
`esp32s3-waveshare-sim7670g-candidate` is **compile-only**. Do not flash or energize
RS485 until the acceptance table below is signed.

## Unsigned firmware candidate (compile only)

PlatformIO env: `esp32s3-waveshare-sim7670g-candidate`

| Function | Candidate GPIO | Override |
|----------|----------------|----------|
| MODEM_RX | 18 | `-DMODEM_RX=18` |
| MODEM_TX | 17 | `-DMODEM_TX=17` |
| MODEM_PWR | 9 | `-DMODEM_PWR=9` |
| MODBUS_RX | 15 | `-DMODBUS_RX=15` |
| MODBUS_TX | 16 | `-DMODBUS_TX=16` |
| MODBUS_DE_RE | 25 | `-DMODBUS_DE_RE=25` |

## Candidate firmware assignment (after board is confirmed)

Promote the **signed** map into the approved env / flash profile only after electrical sign-off:

| Function | Approved GPIO | Source | Conflict check |
|----------|---------------|--------|----------------|
| LTE modem power | | schematic + continuity + AT | |
| LTE UART RX | | schematic + AT echo | |
| LTE UART TX | | schematic + AT echo | |
| RS485 DE/RE | | schematic + transceiver datasheet | distinct from modem/USB/strap/camera/TF |
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
