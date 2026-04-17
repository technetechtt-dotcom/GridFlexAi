// Minimal ESP32 reference for GridFlex edge-data HMAC signing.
// Requires:
// - WiFi.h
// - HTTPClient.h
// - mbedtls/md.h (bundled with ESP32 Arduino core)
//
// Message format must match backend exactly:
//   deviceId.timestamp.nonce.canonicalJson(body)
//
// Canonical JSON requirement:
// - keys sorted alphabetically
// - no extra whitespace
// - stable number formatting
//
// In this example we construct the JSON string manually in sorted-key order.
// Known-good test vector:
// - backend/examples/edge_hmac_test_vector.md

#include <WiFi.h>
#include <HTTPClient.h>
#include <mbedtls/md.h>

static const char* WIFI_SSID = "YOUR_WIFI";
static const char* WIFI_PASS = "YOUR_PASS";
static const char* API_URL = "http://YOUR_BACKEND_HOST:4000/api/edge-data";
static const char* DEVICE_ID = "esp32-node-1";
static const char* EDGE_SHARED_SECRET = "change-this-edge-secret";

String toHex(const uint8_t* data, size_t len) {
  static const char* HEX = "0123456789abcdef";
  String out;
  out.reserve(len * 2);
  for (size_t i = 0; i < len; i++) {
    out += HEX[(data[i] >> 4) & 0x0F];
    out += HEX[data[i] & 0x0F];
  }
  return out;
}

String hmacSha256Hex(const String& key, const String& msg) {
  uint8_t mac[32];
  mbedtls_md_context_t ctx;
  const mbedtls_md_info_t* info = mbedtls_md_info_from_type(MBEDTLS_MD_SHA256);

  mbedtls_md_init(&ctx);
  mbedtls_md_setup(&ctx, info, 1);
  mbedtls_md_hmac_starts(&ctx, (const uint8_t*)key.c_str(), key.length());
  mbedtls_md_hmac_update(&ctx, (const uint8_t*)msg.c_str(), msg.length());
  mbedtls_md_hmac_finish(&ctx, mac);
  mbedtls_md_free(&ctx);

  return toHex(mac, sizeof(mac));
}

String buildCanonicalPayload(float voltage, float current, float power) {
  // Keep keys alphabetically sorted: current, nodeId, power, voltage
  // Use stable number precision so signature matches backend input bytes.
  return String("{\"current\":") + String(current, 3) +
         ",\"nodeId\":\"" + DEVICE_ID +
         "\",\"power\":" + String(power, 3) +
         ",\"voltage\":" + String(voltage, 3) + "}";
}

bool postSignedEdgeData(float voltage, float current, float power) {
  if (WiFi.status() != WL_CONNECTED) return false;

  const String payload = buildCanonicalPayload(voltage, current, power);
  const String timestamp = String((unsigned long long)time(nullptr) * 1000ULL);
  const String nonce = String((uint32_t)esp_random(), HEX);
  const String message = String(DEVICE_ID) + "." + timestamp + "." + nonce + "." + payload;
  const String signature = hmacSha256Hex(EDGE_SHARED_SECRET, message);

  HTTPClient http;
  http.begin(API_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-gridflex-device-id", DEVICE_ID);
  http.addHeader("x-gridflex-timestamp", timestamp);
  http.addHeader("x-gridflex-nonce", nonce);
  http.addHeader("x-gridflex-signature", signature);

  const int status = http.POST(payload);
  const String response = http.getString();
  http.end();

  Serial.printf("edge-data status=%d response=%s\n", status, response.c_str());
  return status >= 200 && status < 300;
}

void setup() {
  Serial.begin(115200);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected");

  // Optional but recommended: sync NTP so timestamp skew checks pass.
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
  delay(1000);
}

void loop() {
  postSignedEdgeData(640.0f, 11.2f, 7.16f);
  delay(10000);
}
