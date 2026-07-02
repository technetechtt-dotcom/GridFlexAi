# LILYGO T-Call A7670 ESP32 Firmware

This directory contains the firmware for the GridFlex IoT edge node. It is designed to run on the LILYGO T-Call A7670 (ESP32 with 4G/LTE cellular module) but defaults to Wi-Fi for testing purposes.

## Requirements

1.  **Arduino IDE** (or PlatformIO)
2.  **ESP32 Board Support** installed in Arduino IDE.
3.  **Libraries**:
    *   `ArduinoJson` (by Benoit Blanchon)
    *   If switching to cellular later: `TinyGSM` (by Volodymyr Shymanskyy)

## Configuration

Before flashing the device, you **MUST** edit the top of `main.ino`:

1.  **`WIFI_SSID` & `WIFI_PASS`**: Your local Wi-Fi credentials.
2.  **`DEVICE_ID`**: The `deviceKey` of your node in the GridFlex Ops Center. You can create a new node or use an existing one. E.g., `device-001`.
3.  **`SHARED_SECRET`**: The exact value of `EDGE_INGEST_SHARED_SECRET` from your backend environment variables (`backend/.env`). This is critical for the HMAC SHA256 security.

## Deployment to LILYGO T-Call A7670

1.  Connect the board via USB-C.
2.  Select **ESP32 Dev Module** in the Arduino IDE Boards Manager.
3.  Compile and Upload.
4.  Open the Serial Monitor (115200 baud) to watch the device boot, connect, sync NTP time, and post its first HMAC-secured JSON payload to your live Render backend!

## Future: Switching to 4G/LTE Cellular

The current `main.ino` uses standard `WiFi.h` and `WiFiClientSecure`. 
To use the onboard A7670 SIM module:
1. Define the TinyGSM modem: `#define TINY_GSM_MODEM_SIM7600`
2. Include `<TinyGsmClient.h>`.
3. Initialize `Serial1` for the modem AT commands using the LILYGO specific pins (RX: 26, TX: 27, PWR: 4, BAT_ADC: 35).
4. Replace `WiFiClientSecure` with `TinyGsmClientSecure`.