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

static const char* FIRMWARE_VERSION = "5.2.0-edge-ed25519-sunspec";
static const char* PINNED_CONFIG_PUBKEY_PEM =
  "-----BEGIN PUBLIC KEY-----\n"
  "REPLACE_WITH_EDGE_CONFIG_ED25519_PUBLIC_KEY\n"
  "-----END PUBLIC KEY-----\n";

// LittleFS queue limits (approx. 24h @ 1/min ≈ 1440; leave headroom).
static const size_t QUEUE_MAX_RECORDS = 2000;
static const unsigned long DEFAULT_POLL_INTERVAL_MS = 60000;
static const unsigned long WATCHDOG_TIMEOUT_MS = 30000;

// LTE modem pins (LILYGO T-Call / SIM7670X). Sequenced 4G edge client.
#ifndef USE_LTE
#define USE_LTE 1
#endif
#define MODEM_RX 26
#define MODEM_TX 27
#define MODEM_PWR 4
static const char* LTE_APN = "internet";
static const char* LTE_USER = "";
static const char* LTE_PASS = "";

// RS485 Modbus RTU (set 1 on hardware with transceiver wired). Fail-closed when 0 — no random metrics.
#ifndef USE_RS485_MODBUS
#define USE_RS485_MODBUS 0
#endif
static const uint8_t MODBUS_SLAVE_ID = 1;
// Zero-based Model 103 ID address from SunSpec discovery (backend default 40069).
#ifndef SUNSPEC_MODEL103_BASE
#define SUNSPEC_MODEL103_BASE 40069
#endif

// TLS: CA is provided by certs.h (ISRG Root X1). Insecure TLS is not supported.

#endif
