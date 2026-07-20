#ifndef GRIDFLEX_CONFIG_H
#define GRIDFLEX_CONFIG_H

// --- Flash before deploy ---
static const char* WIFI_SSID = "YOUR_WIFI_SSID";
static const char* WIFI_PASS = "YOUR_WIFI_PASSWORD";

static const char* DEVICE_ID = "YOUR_DEVICE_ID";
static const char* CREDENTIAL_ID = "YOUR_CREDENTIAL_ID";
static const int KEY_VERSION = 1;
// One-shot provisioned secret (base64url). Never delivered via remote config.
static const char* DEVICE_SECRET_B64URL = "REPLACE_WITH_PROVISIONED_SECRET";

static const char* DEFAULT_API_BASE = "https://gridflex-backend.onrender.com";
static const char* EDGE_DATA_PATH = "/api/edge-data";
static const char* EDGE_CONFIG_PATH = "/api/edge/config";

static const char* FIRMWARE_VERSION = "5.0.0-edge-reliability";
static const char* PINNED_CONFIG_PUBKEY_PEM =
  "-----BEGIN PUBLIC KEY-----\n"
  "REPLACE_WITH_EDGE_CONFIG_ED25519_PUBLIC_KEY\n"
  "-----END PUBLIC KEY-----\n";

// LittleFS queue limits (approx. 24h @ 1/min ≈ 1440; leave headroom).
static const size_t QUEUE_MAX_RECORDS = 2000;
static const unsigned long DEFAULT_POLL_INTERVAL_MS = 60000;
static const unsigned long WATCHDOG_TIMEOUT_MS = 30000;

// LTE modem pins (LILYGO T-Call A7670). Used when USE_LTE=1.
#define USE_LTE 0
#define MODEM_RX 26
#define MODEM_TX 27
#define MODEM_PWR 4

#endif
