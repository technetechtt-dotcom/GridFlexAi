# ESP32-S3 pilot pin-map approval

Status: **OPEN — exact production board and revision have not been identified or electrically verified.**

The CI target `esp32-s3-devkitc-1` is a build target, not proof that GPIO 25 is
available on the purchased board. Do not connect RS485 DE/RE until this record is
completed from the exact board schematic, BOM and a continuity/voltage check.

## Candidate firmware assignment

| Function | GPIO | Source | Current conflict check |
|----------|------|--------|------------------------|
| LTE modem power | 4 | `firmware/GridFlexEdge/config.h` | distinct from GPIO 25 |
| LTE UART RX | 26 | `firmware/GridFlexEdge/config.h` | distinct from GPIO 25 |
| LTE UART TX | 27 | `firmware/GridFlexEdge/config.h` | distinct from GPIO 25 |
| RS485 DE/RE | 25 | `firmware/platformio.ini`, LTE CI profile | firmware rejects equality with modem power; exact board remains unverified |
| USB D-/D+ | _from exact board schematic_ | schematic | pending |
| Boot/strapping pins | _from exact module/board datasheet_ | datasheet | pending |
| Other peripherals | _inventory every attached peripheral_ | wiring/BOM | pending |

## Exact-board verification

| Field | Verified value / evidence |
|-------|---------------------------|
| Board manufacturer | |
| Commercial board model | |
| Board revision | |
| ESP32-S3 module part number | |
| Schematic revision and URL/path | |
| BOM revision | |
| GPIO 25 exposed on connector/test point | |
| GPIO 25 connected elsewhere on board | |
| Boot/strapping impact checked | |
| USB/JTAG impact checked | |
| Modem/peripheral conflict checked | |
| Measured idle voltage and continuity | |
| Approved RS485 transceiver and DE/RE wiring | |
| Photo / annotated drawing path | |
| Artifact SHA-256 | |

## Acceptance

- GPIO 25 is exposed, not reserved, and has no schematic or measured conflict.
- The selected RS485 transceiver voltage and logic levels match the board.
- Common ground, isolation, termination and biasing are documented.
- A build using the approved board profile succeeds.
- Engineering signs before energizing the RS485 interface.

| Role | Name | Signature / ticket | Date |
|------|------|--------------------|------|
| Firmware engineer | | | |
| Hardware/electrical reviewer | | | |
| Plant representative | | | |
