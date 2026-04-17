// GridFlex edge-data signing example (ArduinoJson variant).
//
// Why this version:
// - Easier to maintain as payload grows.
// - Uses a recursive key-sorted serializer to keep canonical JSON stable.
//
// Install dependency:
// - ArduinoJson (v7+ recommended)
//
// Message format (must match backend exactly):
//   deviceId.timestamp.nonce.canonicalJson(body)
// Known-good test vector:
// - backend/examples/edge_hmac_test_vector.md

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <mbedtls/md.h>

static const char* WIFI_SSID = "YOUR_WIFI";
static const char* WIFI_PASS = "YOUR_PASS";
static const char* API_URL = "http://YOUR_BACKEND_HOST:4000/api/edge-data";
static const char* DEVICE_ID = "esp32-node-1";
static const char* EDGE_SHARED_SECRET = "change-this-edge-secret";

struct KeyValue {
  String key;
  JsonVariantConst value;
};

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

void writeCanonical(JsonVariantConst value, String& out) {
  if (value.is<JsonObjectConst>()) {
    JsonObjectConst obj = value.as<JsonObjectConst>();
    out += "{";

    // Gather keys first.
    const size_t maxKeys = 64; // increase if your object is larger
    KeyValue items[maxKeys];
    size_t count = 0;
    for (JsonPairConst kv : obj) {
      if (count >= maxKeys) break;
      items[count].key = String(kv.key().c_str());
      items[count].value = kv.value();
      count++;
    }

    // Sort keys lexicographically.
    for (size_t i = 0; i < count; i++) {
      for (size_t j = i + 1; j < count; j++) {
        if (items[j].key < items[i].key) {
          KeyValue tmp = items[i];
          items[i] = items[j];
          items[j] = tmp;
        }
      }
    }

    // Emit "key":value pairs in sorted order.
    for (size_t i = 0; i < count; i++) {
      if (i > 0) out += ",";
      out += "\"";
      out += items[i].key;
      out += "\":";
      writeCanonical(items[i].value, out);
    }
    out += "}";
    return;
  }

  if (value.is<JsonArrayConst>()) {
    JsonArrayConst arr = value.as<JsonArrayConst>();
    out += "[";
    size_t idx = 0;
    for (JsonVariantConst v : arr) {
      if (idx++ > 0) out += ",";
      writeCanonical(v, out);
    }
    out += "]";
    return;
  }

  // Scalar fallback: leverage ArduinoJson formatter for proper string escaping
  // and JSON literals (numbers, booleans, null) without whitespace.
  serializeJson(value, out);
}

String buildCanonicalPayload() {
  StaticJsonDocument<512> doc;

  // Payload can be built in any key order now.
  doc["power"] = 7.16;
  doc["nodeId"] = DEVICE_ID;
  doc["current"] = 11.2;
  doc["voltage"] = 640.0;

  // Example nested object/array to show growth safety.
  JsonObject weather = doc["weather"].to<JsonObject>();
  weather["tempC"] = 32.4;
  weather["cloudCoverPct"] = 18;
  JsonArray tags = doc["tags"].to<JsonArray>();
  tags.add("pv");
  tags.add("edge");

  String canonical;
  canonical.reserve(384);
  writeCanonical(doc.as<JsonVariantConst>(), canonical);
  return canonical;
}

bool postSignedEdgeData() {
  if (WiFi.status() != WL_CONNECTED) return false;

  const String payload = buildCanonicalPayload();
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

  // Recommended so timestamp skew checks pass.
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
  delay(1000);
}

void loop() {
  postSignedEdgeData();
  delay(10000);
}
