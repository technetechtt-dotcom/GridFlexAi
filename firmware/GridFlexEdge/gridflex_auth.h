#ifndef GRIDFLEX_AUTH_H
#define GRIDFLEX_AUTH_H

#include <Arduino.h>
#include <mbedtls/md.h>
#include "config.h"

static const char B64URL[] =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

inline String sha256Hex(const uint8_t* data, size_t len) {
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

inline String base64UrlEncode(const uint8_t* data, size_t len) {
  String out;
  out.reserve(((len + 2) / 3) * 4);
  for (size_t i = 0; i < len; i += 3) {
    uint32_t n = ((uint32_t)data[i]) << 16;
    if (i + 1 < len) n |= ((uint32_t)data[i + 1]) << 8;
    if (i + 2 < len) n |= ((uint32_t)data[i + 2]);
    out += B64URL[(n >> 18) & 63];
    out += B64URL[(n >> 12) & 63];
    out += (i + 1 < len) ? B64URL[(n >> 6) & 63] : '\0';
    out += (i + 2 < len) ? B64URL[n & 63] : '\0';
  }
  out.replace(String('\0'), "");
  return out;
}

inline bool decodeBase64Url(const char* in, uint8_t* out, size_t outLen) {
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
  for (size_t i = 0; o < outLen && i < inLen; ) {
    int a = val(in[i++]);
    int b = i < inLen ? val(in[i++]) : 0;
    int c = i < inLen ? val(in[i++]) : 0;
    int d = i < inLen ? val(in[i++]) : 0;
    if (a < 0 || b < 0) return false;
    uint32_t n = ((uint32_t)a << 18) | ((uint32_t)b << 12) | ((uint32_t)(c < 0 ? 0 : c) << 6) | (uint32_t)(d < 0 ? 0 : d);
    if (o < outLen) out[o++] = (n >> 16) & 0xFF;
    if (o < outLen && c >= 0) out[o++] = (n >> 8) & 0xFF;
    if (o < outLen && d >= 0) out[o++] = n & 0xFF;
  }
  return o == outLen;
}

inline String createGridFlexV1Signature(
  const String& deviceId,
  const String& credentialId,
  int keyVersion,
  const String& timestamp,
  const String& nonce,
  uint32_t sequenceNumber,
  const String& rawBody,
  const uint8_t* secret,
  size_t secretLen
) {
  String bodyHash = sha256Hex((const uint8_t*)rawBody.c_str(), rawBody.length());
  String canonical = String("GRIDFLEX-V1\n") + deviceId + "\n" + credentialId + "\n" +
                     String(keyVersion) + "\n" + timestamp + "\n" + nonce + "\n" +
                     String(sequenceNumber) + "\n" + bodyHash;

  uint8_t hmac[32];
  mbedtls_md_context_t ctx;
  mbedtls_md_init(&ctx);
  mbedtls_md_setup(&ctx, mbedtls_md_info_from_type(MBEDTLS_MD_SHA256), 1);
  mbedtls_md_hmac_starts(&ctx, secret, secretLen);
  mbedtls_md_hmac_update(&ctx, (const unsigned char*)canonical.c_str(), canonical.length());
  mbedtls_md_hmac_finish(&ctx, hmac);
  mbedtls_md_free(&ctx);
  return base64UrlEncode(hmac, 32);
}

inline String iso8601UtcNow() {
  time_t now = time(nullptr);
  struct tm t;
  gmtime_r(&now, &t);
  char buf[32];
  strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", &t);
  return String(buf);
}

inline String randomUuidV4() {
  // Not cryptographically perfect — sufficient as messageId for queue records.
  char buf[37];
  snprintf(buf, sizeof(buf),
           "%08lx-%04lx-4%03lx-a%03lx-%012llx",
           (unsigned long)esp_random(),
           (unsigned long)(esp_random() & 0xFFFF),
           (unsigned long)(esp_random() & 0x0FFF),
           (unsigned long)(esp_random() & 0x0FFF),
           (unsigned long long)(((uint64_t)esp_random() << 32) | esp_random()));
  return String(buf);
}

#endif
