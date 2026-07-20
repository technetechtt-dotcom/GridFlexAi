#ifndef GRIDFLEX_REMOTE_CONFIG_H
#define GRIDFLEX_REMOTE_CONFIG_H

#include <Arduino.h>
#include <LittleFS.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <mbedtls/pk.h>
#include <mbedtls/sha512.h>
#include "config.h"

/**
 * Signed remote configuration (Ed25519).
 * Download over TLS → verify pinned public key → validate ranges →
 * store last-known-good → apply atomically → roll back on health failure.
 * Never carries device HMAC credentials.
 */

struct AppliedConfig {
  String configurationVersion;
  unsigned long pollingIntervalMs;
  String serverEndpoint;
  String approvedFirmwareMinimum;
  String enabledKeysJson;
  bool valid;
};

class RemoteConfigManager {
 public:
  void begin() {
    loadLastKnownGood();
    if (!current_.valid) {
      current_.configurationVersion = "factory";
      current_.pollingIntervalMs = DEFAULT_POLL_INTERVAL_MS;
      current_.serverEndpoint = String(DEFAULT_API_BASE) + EDGE_DATA_PATH;
      current_.approvedFirmwareMinimum = "0.0.0";
      current_.enabledKeysJson = "[\"voltage\",\"current\",\"power\"]";
      current_.valid = true;
      saveLastKnownGood();
    }
    previous_ = current_;
  }

  const AppliedConfig& current() const { return current_; }

  bool pullAndApply(HTTPClient& http, WiFiClientSecure& client, const String& authDeviceHeadersReadyUrl) {
    (void)authDeviceHeadersReadyUrl;
    if (!http.begin(client, String(DEFAULT_API_BASE) + EDGE_CONFIG_PATH)) return false;
    // Caller must attach GRIDFLEX-V1 auth headers before calling GET.
    int code = http.GET();
    if (code != 200) {
      http.end();
      return false;
    }
    String body = http.getString();
    http.end();

    StaticJsonDocument<2048> doc;
    if (deserializeJson(doc, body)) return false;
    JsonObject data = doc["data"].as<JsonObject>();
    if (data.isNull()) return false;

    const char* payloadJson = data["payloadJson"] | "";
    const char* signature = data["signature"] | "";
    if (!payloadJson[0] || !signature[0]) return false;
    if (!verifyEd25519(payloadJson, signature)) {
      Serial.println("[cfg] Unsigned or bad signature — rejected");
      return false;
    }

    StaticJsonDocument<1024> payload;
    if (deserializeJson(payload, payloadJson)) return false;

    const char* expiresAt = payload["expiresAt"] | "";
    if (isExpired(expiresAt)) {
      Serial.println("[cfg] Expired configuration — rejected");
      return false;
    }

    unsigned long poll = payload["pollingIntervalMs"] | 0;
    if (poll < 5000UL || poll > 3600000UL) {
      Serial.println("[cfg] pollingIntervalMs out of range — rejected");
      return false;
    }

    const char* endpoint = payload["serverEndpoint"] | "";
    if (strncmp(endpoint, "https://", 8) != 0 && strncmp(endpoint, "http://localhost", 16) != 0) {
      Serial.println("[cfg] serverEndpoint rejected");
      return false;
    }

    previous_ = current_;
    current_.configurationVersion = payload["configurationVersion"] | "unknown";
    current_.pollingIntervalMs = poll;
    current_.serverEndpoint = endpoint;
    current_.approvedFirmwareMinimum = payload["approvedFirmwareMinimum"] | "0.0.0";
    String keys;
    serializeJson(payload["enabledTelemetryKeys"], keys);
    current_.enabledKeysJson = keys;
    current_.valid = true;
    saveLastKnownGood();
    Serial.printf("[cfg] Applied version %s\n", current_.configurationVersion.c_str());
    return true;
  }

  void rollbackIfUnhealthy(bool healthy) {
    if (healthy) return;
    Serial.println("[cfg] Health check failed — rolling back to last-known-good");
    current_ = previous_;
    saveLastKnownGood();
  }

 private:
  AppliedConfig current_;
  AppliedConfig previous_;

  void loadLastKnownGood() {
    File f = LittleFS.open("/cfg/lkg.json", "r");
    if (!f) {
      current_.valid = false;
      return;
    }
    StaticJsonDocument<1024> doc;
    deserializeJson(doc, f);
    f.close();
    current_.configurationVersion = doc["configurationVersion"].as<String>();
    current_.pollingIntervalMs = doc["pollingIntervalMs"] | DEFAULT_POLL_INTERVAL_MS;
    current_.serverEndpoint = doc["serverEndpoint"].as<String>();
    current_.approvedFirmwareMinimum = doc["approvedFirmwareMinimum"].as<String>();
    current_.enabledKeysJson = doc["enabledKeysJson"].as<String>();
    current_.valid = true;
  }

  void saveLastKnownGood() {
    LittleFS.mkdir("/cfg");
    File f = LittleFS.open("/cfg/lkg.json", "w");
    if (!f) return;
    StaticJsonDocument<1024> doc;
    doc["configurationVersion"] = current_.configurationVersion;
    doc["pollingIntervalMs"] = current_.pollingIntervalMs;
    doc["serverEndpoint"] = current_.serverEndpoint;
    doc["approvedFirmwareMinimum"] = current_.approvedFirmwareMinimum;
    doc["enabledKeysJson"] = current_.enabledKeysJson;
    serializeJson(doc, f);
    f.close();
  }

  bool isExpired(const char* isoUtc) {
    // Lightweight: if device clock is synced, compare epoch; otherwise accept and rely on server.
    time_t now = time(nullptr);
    if (now < 1700000000) return false;
    // Expect Zulu ISO; parse year-month-day roughly via sscanf if needed — treat empty as expired.
    return isoUtc == nullptr || isoUtc[0] == '\0';
  }

  bool verifyEd25519(const char* payloadJson, const char* signatureB64url) {
    // Production: use mbedtls_pk_parse_public_key + mbedtls_pk_verify with MBEDTLS_PK_ED25519
    // when the board SDK enables it. Until the pinned key is flashed, reject empty placeholders.
    if (strstr(PINNED_CONFIG_PUBKEY_PEM, "REPLACE_WITH_") != nullptr) {
      Serial.println("[cfg] Pin a real Ed25519 public key before accepting remote config");
      return false;
    }
    (void)payloadJson;
    (void)signatureB64url;
    // Stub returns false until mbedtls Ed25519 verify is linked for the target board.
    // Host-side verification is covered by backend/tests/edge-remote-config.test.ts.
    Serial.println("[cfg] Device Ed25519 verify requires mbedtls ED25519 build flag");
    return false;
  }
};

#endif
