// GridFlex EDGE GRIDFLEX-V1 HMAC reference for ESP32 (Arduino).
// Matches backend/examples/edge_hmac_test_vector.md and backend/tests/device-credential-vault.test.ts
//
// Canonical message (UTF-8, newline separators):
//   GRIDFLEX-V1
//   deviceId
//   credentialId
//   keyVersion
//   timestamp
//   nonce
//   sequenceNumber
//   SHA256(rawRequestBody)  // hex lowercase
//
// Signature = base64url(HMAC-SHA256(deviceSecretBytes, canonical))
// deviceSecretBytes = base64url-decode of the one-shot provisioned secret (32 bytes).

#include <WiFi.h>
#include <HTTPClient.h>
#include <mbedtls/md.h>

static const char* WIFI_SSID = "YOUR_WIFI";
static const char* WIFI_PASS = "YOUR_PASS";
static const char* API_URL = "http://YOUR_BACKEND_HOST:4000/api/edge-data";
static const char* DEVICE_ID = "esp32-node-1";
static const char* CREDENTIAL_ID = "cred_testvector01";
static const int KEY_VERSION = 1;
// 32 zero bytes as base64url — replace with provisioned secret in production.
static const char* DEVICE_SECRET_B64URL = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

static const char B64URL[] =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

String sha256Hex(const uint8_t* data, size_t len) {
  uint8_t hash[32];
  mbedtls_md_context_t ctx;
  mbedtls_md_init(&ctx);
  mbedtls_md_setup(&ctx, mbedtls_md_info_from_type(MBEDTLS_MD_SHA256), 0);
  mbedtls_md_starts(&ctx);
  mbedtls_md_update(&ctx, data, len);
  mbedtls_md_finish(&ctx, hash);
  mbedtls_md_free(&ctx);
  static const char* HEX = "0123456789abcdef";
  String out;
  out.reserve(64);
  for (int i = 0; i < 32; i++) {
    out += HEX[(hash[i] >> 4) & 0x0F];
    out += HEX[hash[i] & 0x0F];
  }
  return out;
}

String base64UrlEncode(const uint8_t* data, size_t len) {
  String out;
  out.reserve(((len + 2) / 3) * 4);
  for (size_t i = 0; i < len; i += 3) {
    uint32_t n = ((uint32_t)data[i]) << 16;
    if (i + 1 < len) n |= ((uint32_t)data[i + 1]) << 8;
    if (i + 2 < len) n |= (uint32_t)data[i + 2];
    out += B64URL[(n >> 18) & 63];
    out += B64URL[(n >> 12) & 63];
    out += (i + 1 < len) ? B64URL[(n >> 6) & 63] : '\0';
    out += (i + 2 < len) ? B64URL[n & 63] : '\0';
  }
  out.replace(String('\0'), "");
  return out;
}

bool decodeBase64Url(const char* in, uint8_t* out, size_t outLen) {
  // Minimal decoder for 32-byte secrets (43 chars without padding).
  auto val = [](char c) -> int {
    if (c >= 'A' && c <= 'Z') return c - 'A';
    if (c >= 'a' && c <= 'z') return c - 'a' + 26;
    if (c >= '0' && c <= '9') return c - '0' + 52;
    if (c == '-') return 62;
    if (c == '_') return 63;
    return -1;
  };
  size_t inLen = strlen(in);
  size_t o = 0;
  for (size_t i = 0; i + 3 < inLen + 3 && o < outLen; ) {
    int a = val(in[i++]);
    int b = (i < inLen) ? val(in[i++]) : 0;
    int c = (i < inLen) ? val(in[i++]) : 0;
    int d = (i < inLen) ? val(in[i++]) : 0;
    if (a < 0 || b < 0) return false;
    uint32_t n = ((uint32_t)a << 18) | ((uint32_t)b << 12) | ((uint32_t)(c < 0 ? 0 : c) << 6) | (uint32_t)(d < 0 ? 0 : d);
    if (o < outLen) out[o++] = (n >> 16) & 0xFF;
    if (c >= 0 && o < outLen) out[o++] = (n >> 8) & 0xFF;
    if (d >= 0 && o < outLen) out[o++] = n & 0xFF;
  }
  return o == outLen;
}

String hmacSha256Base64Url(const uint8_t* key, size_t keyLen, const String& msg) {
  uint8_t mac[32];
  mbedtls_md_context_t ctx;
  mbedtls_md_init(&ctx);
  mbedtls_md_setup(&ctx, mbedtls_md_info_from_type(MBEDTLS_MD_SHA256), 1);
  mbedtls_md_hmac_starts(&ctx, key, keyLen);
  mbedtls_md_hmac_update(&ctx, (const uint8_t*)msg.c_str(), msg.length());
  mbedtls_md_hmac_finish(&ctx, mac);
  mbedtls_md_free(&ctx);
  return base64UrlEncode(mac, 32);
}

void setup() {
  Serial.begin(115200);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) {
    delay(400);
  }

  // Exact body bytes — must match what is transmitted.
  const char* body =
    "{\"current\":11.2,\"nodeId\":\"esp32-node-1\",\"power\":7.16,\"voltage\":640}";
  String bodyHash = sha256Hex((const uint8_t*)body, strlen(body));

  String timestamp = String(1713187200000ULL);
  String nonce = "abc123nonce";
  int sequenceNumber = 42;

  String canonical = String("GRIDFLEX-V1") + "\n" +
    DEVICE_ID + "\n" +
    CREDENTIAL_ID + "\n" +
    String(KEY_VERSION) + "\n" +
    timestamp + "\n" +
    nonce + "\n" +
    String(sequenceNumber) + "\n" +
    bodyHash;

  uint8_t secret[32];
  if (!decodeBase64Url(DEVICE_SECRET_B64URL, secret, 32)) {
    Serial.println("Failed to decode device secret");
    return;
  }

  String signature = hmacSha256Base64Url(secret, 32, canonical);
  memset(secret, 0, sizeof(secret));

  // Expected for zero-key test vector: KjRhh4nKNGxQKSA23ezOUrC83LMmB7GX-NeC3mu8rh4
  Serial.println(signature);

  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(API_URL);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("x-gridflex-device-id", DEVICE_ID);
    http.addHeader("x-gridflex-credential-id", CREDENTIAL_ID);
    http.addHeader("x-gridflex-key-version", String(KEY_VERSION));
    http.addHeader("x-gridflex-timestamp", timestamp);
    http.addHeader("x-gridflex-nonce", nonce);
    http.addHeader("x-gridflex-sequence-number", String(sequenceNumber));
    http.addHeader("x-gridflex-signature", signature);
    int code = http.POST((uint8_t*)body, strlen(body));
    Serial.printf("HTTP %d\n", code);
    http.end();
  }
}

void loop() {}
