#ifndef GRIDFLEX_ED25519_KAT_H
#define GRIDFLEX_ED25519_KAT_H

#include <Arduino.h>
#include <string.h>
#include "ed25519_verify.h"

// Known-answer vectors from backend/tests/fixtures/ed25519-remote-config-kat.json
static const char kKatMessageUtf8[] =
  "{\"approvedFirmwareMinimum\":\"5.0.0\",\"configurationVersion\":\"kat-1\","
  "\"enabledTelemetryKeys\":[\"current\",\"power\",\"voltage\"],"
  "\"expiresAt\":\"2099-01-01T00:00:00.000Z\","
  "\"issuedAt\":\"2026-07-20T00:00:00.000Z\","
  "\"pollingIntervalMs\":60000,"
  "\"serverEndpoint\":\"https://example.com/api/edge-data\"}";

static const uint8_t kKatPublicKey[32] = {
  0xd5, 0x87, 0x40, 0x6a, 0x19, 0x4b, 0x8c, 0x91, 0x69, 0x34, 0x13, 0x17, 0xcb, 0xe5,
  0xc6, 0x2c, 0xc2, 0x5a, 0x0b, 0xd2, 0x96, 0xe4, 0x89, 0x8b, 0x7f, 0x47, 0x44, 0xce,
  0xc3, 0xe6, 0x4b, 0xe9
};

static const uint8_t kKatSignature[64] = {
  0xa6, 0xc6, 0x90, 0x35, 0x17, 0x01, 0xfa, 0x6a, 0x1e, 0x6c, 0x50, 0xa4, 0x5f, 0xec,
  0x62, 0x80, 0xed, 0x13, 0xf8, 0x23, 0x10, 0xe7, 0x3b, 0xb1, 0x70, 0x60, 0xd7, 0x24,
  0x9b, 0xa7, 0x4e, 0x45, 0xf0, 0x7f, 0x92, 0x92, 0x12, 0x95, 0x17, 0x5b, 0xcb, 0xab,
  0xc5, 0x84, 0xde, 0x47, 0xed, 0x37, 0x61, 0x11, 0xc6, 0x0c, 0x9c, 0x7c, 0xf5, 0x4f,
  0xb6, 0xc1, 0x49, 0x7a, 0xd9, 0x95, 0x58, 0x0b
};

inline bool ed25519RunKnownAnswerTest() {
  const size_t msgLen = strlen(kKatMessageUtf8);

  if (!ed25519VerifyDetached(kKatPublicKey, kKatSignature,
                             reinterpret_cast<const uint8_t*>(kKatMessageUtf8),
                             msgLen)) {
    Serial.println("[ed25519] KAT: valid vector verify failed");
    return false;
  }

  uint8_t tampered[512];
  if (msgLen + 1 >= sizeof(tampered)) {
    Serial.println("[ed25519] KAT: message too long for tamper buffer");
    return false;
  }
  memcpy(tampered, kKatMessageUtf8, msgLen);
  tampered[0] ^= 0x01;

  if (ed25519VerifyDetached(kKatPublicKey, kKatSignature, tampered, msgLen)) {
    Serial.println("[ed25519] KAT: tampered message incorrectly accepted");
    return false;
  }

  Serial.println("[ed25519] KAT passed");
  return true;
}

#endif
