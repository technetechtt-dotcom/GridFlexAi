#ifndef GRIDFLEX_REMOTE_CONFIG_H
#define GRIDFLEX_REMOTE_CONFIG_H

#include <Arduino.h>
#include <LittleFS.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include <mbedtls/pk.h>
#include <mbedtls/sha512.h>
#include "config.h"

/**
 * Signed remote configuration (Ed25519).
 * Download over TLS → verify pinned public key → validate ranges →
 * reject expired / lower version / replayed issue ids →
 * store last-known-good (tmp+rename) → apply → roll back on health failure.
 * Never carries device HMAC credentials or physical-control flags.
 */

struct AppliedConfig {
  String configurationVersion;
  unsigned long pollingIntervalMs;
  String serverEndpoint;
  String approvedFirmwareMinimum;
  String enabledKeysJson;
  String issueId;
  bool valid;
};

class RemoteConfigManager {
 public:
  void begin() {
    Preferences prefs;
    prefs.begin("cfg", true);
    lastVersionNumeric_ = prefs.getULong("ver_num", 0);
    String lastIssue = prefs.getString("issue", "");
    prefs.end();
    lastIssueId_ = lastIssue;

    loadLastKnownGood();
    if (!current_.valid) {
      current_.configurationVersion = "factory";
      current_.pollingIntervalMs = DEFAULT_POLL_INTERVAL_MS;
      current_.serverEndpoint = String(DEFAULT_API_BASE) + EDGE_DATA_PATH;
      current_.approvedFirmwareMinimum = "0.0.0";
      current_.enabledKeysJson = "[\"voltage\",\"current\",\"power\"]";
      current_.issueId = "factory";
      current_.valid = true;
      saveLastKnownGood();
    }
    previous_ = current_;
    lastStatus_ = "lkg_loaded";
  }

  const AppliedConfig& current() const { return current_; }
  const char* lastStatus() const { return lastStatus_.c_str(); }

  /** http must already have auth headers; begin() already called by NetworkManager. */
  bool pullAndApply(HTTPClient& http) {
    int code = http.GET();
    if (code != 200) {
      lastStatus_ = String("http_") + code;
      http.end();
      return false;
    }
    String body = http.getString();
    http.end();

    StaticJsonDocument<2048> doc;
    if (deserializeJson(doc, body)) {
      lastStatus_ = "json_parse_fail";
      return false;
    }
    JsonObject data = doc["data"].as<JsonObject>();
    if (data.isNull()) {
      lastStatus_ = "missing_data";
      return false;
    }

    const char* payloadJson = data["payloadJson"] | "";
    const char* signature = data["signature"] | "";
    if (!payloadJson[0] || !signature[0]) {
      lastStatus_ = "missing_signature";
      return false;
    }
    if (!verifyEd25519(payloadJson, signature)) {
      Serial.println("[cfg] Unsigned or bad signature — rejected");
      lastStatus_ = "bad_signature";
      return false;
    }

    StaticJsonDocument<1024> payload;
    if (deserializeJson(payload, payloadJson)) {
      lastStatus_ = "payload_parse_fail";
      return false;
    }

    // Reject any attempt to enable physical control via remote config.
    if (payload.containsKey("physicalExecution") ||
        payload.containsKey("allowPhysical") ||
        payload.containsKey("setpoint") ||
        payload.containsKey("writeEnable") ||
        payload.containsKey("PHYSICAL_COMMAND_EXECUTION_ENABLED")) {
      Serial.println("[cfg] Physical-control fields forbidden — rejected");
      lastStatus_ = "physical_control_forbidden";
      return false;
    }

    const char* expiresAt = payload["expiresAt"] | "";
    if (isExpired(expiresAt)) {
      Serial.println("[cfg] Expired configuration — rejected");
      lastStatus_ = "expired";
      return false;
    }

    const char* issueId = payload["issueId"] | payload["issuedAt"] | "";
    if (issueId[0] && lastIssueId_.length() && lastIssueId_ == String(issueId)) {
      Serial.println("[cfg] Replayed issueId — rejected");
      lastStatus_ = "replayed_issue";
      return false;
    }

    const char* versionStr = payload["configurationVersion"] | "0";
    unsigned long versionNum = parseVersionNumeric(versionStr);
    if (versionNum < lastVersionNumeric_) {
      Serial.println("[cfg] Lower configurationVersion — rejected");
      lastStatus_ = "lower_version";
      return false;
    }

    unsigned long poll = payload["pollingIntervalMs"] | 0;
    if (poll < 5000UL || poll > 3600000UL) {
      Serial.println("[cfg] pollingIntervalMs out of range — rejected");
      lastStatus_ = "poll_oor";
      return false;
    }

    const char* endpoint = payload["serverEndpoint"] | "";
    if (strncmp(endpoint, "https://", 8) != 0 && strncmp(endpoint, "http://localhost", 16) != 0) {
      Serial.println("[cfg] serverEndpoint rejected");
      lastStatus_ = "endpoint_rejected";
      return false;
    }

    previous_ = current_;
    current_.configurationVersion = versionStr;
    current_.pollingIntervalMs = poll;
    current_.serverEndpoint = endpoint;
    current_.approvedFirmwareMinimum = payload["approvedFirmwareMinimum"] | "0.0.0";
    current_.issueId = issueId;
    String keys;
    serializeJson(payload["enabledTelemetryKeys"], keys);
    current_.enabledKeysJson = keys;
    current_.valid = true;
    saveLastKnownGood();
    persistVersionWatermark(versionNum, current_.issueId);
    lastVersionNumeric_ = versionNum;
    lastIssueId_ = current_.issueId;
    lastStatus_ = "applied";
    Serial.printf("[cfg] Applied version %s\n", current_.configurationVersion.c_str());
    return true;
  }

  void rollbackIfUnhealthy(bool healthy) {
    if (healthy) return;
    Serial.println("[cfg] Health check failed — rolling back to last-known-good");
    current_ = previous_;
    saveLastKnownGood();
    lastStatus_ = "rolled_back";
  }

 private:
  AppliedConfig current_;
  AppliedConfig previous_;
  String lastStatus_ = "init";
  unsigned long lastVersionNumeric_ = 0;
  String lastIssueId_;

  static unsigned long parseVersionNumeric(const char* v) {
    // Accept "12", "1.2.3" → 10203 style, or plain integer prefix.
    unsigned long major = 0, minor = 0, patch = 0;
    if (sscanf(v, "%lu.%lu.%lu", &major, &minor, &patch) >= 1) {
      return major * 10000UL + minor * 100UL + patch;
    }
    return strtoul(v, nullptr, 10);
  }

  void persistVersionWatermark(unsigned long ver, const String& issue) {
    Preferences prefs;
    prefs.begin("cfg", false);
    prefs.putULong("ver_num", ver);
    prefs.putString("issue", issue);
    prefs.end();
  }

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
    current_.issueId = doc["issueId"] | "";
    current_.valid = true;
  }

  void saveLastKnownGood() {
    LittleFS.mkdir("/cfg");
    const char* tmpPath = "/cfg/lkg.json.tmp";
    const char* finalPath = "/cfg/lkg.json";
    File f = LittleFS.open(tmpPath, "w");
    if (!f) return;
    StaticJsonDocument<1024> doc;
    doc["configurationVersion"] = current_.configurationVersion;
    doc["pollingIntervalMs"] = current_.pollingIntervalMs;
    doc["serverEndpoint"] = current_.serverEndpoint;
    doc["approvedFirmwareMinimum"] = current_.approvedFirmwareMinimum;
    doc["enabledKeysJson"] = current_.enabledKeysJson;
    doc["issueId"] = current_.issueId;
    serializeJson(doc, f);
    f.flush();
    f.close();
    LittleFS.remove(finalPath);
    LittleFS.rename(tmpPath, finalPath);
  }

  bool isExpired(const char* isoUtc) {
    if (isoUtc == nullptr || isoUtc[0] == '\0') return true;
    time_t now = time(nullptr);
    if (now < 1700000000) return false; // clock not synced — defer to signature + server
    int y = 0, mo = 0, d = 0, h = 0, mi = 0, s = 0;
    if (sscanf(isoUtc, "%d-%d-%dT%d:%d:%d", &y, &mo, &d, &h, &mi, &s) < 3) {
      return true;
    }
    struct tm tmv = {};
    tmv.tm_year = y - 1900;
    tmv.tm_mon = mo - 1;
    tmv.tm_mday = d;
    tmv.tm_hour = h;
    tmv.tm_min = mi;
    tmv.tm_sec = s;
    time_t exp = mktime(&tmv);
    if (exp == (time_t)-1) return true;
    return now >= exp;
  }

  bool verifyEd25519(const char* payloadJson, const char* signatureB64url) {
    if (strstr(PINNED_CONFIG_PUBKEY_PEM, "REPLACE_WITH_") != nullptr) {
      Serial.println("[cfg] Pin a real Ed25519 public key before accepting remote config");
      return false;
    }
    mbedtls_pk_context pk;
    mbedtls_pk_init(&pk);
    int ret = mbedtls_pk_parse_public_key(
      &pk,
      (const unsigned char*)PINNED_CONFIG_PUBKEY_PEM,
      strlen(PINNED_CONFIG_PUBKEY_PEM) + 1
    );
    if (ret != 0) {
      Serial.printf("[cfg] pubkey parse failed %d\n", ret);
      mbedtls_pk_free(&pk);
      return false;
    }

    // Decode base64url signature (64 bytes for Ed25519).
    size_t sigLen = 0;
    unsigned char sig[128];
    // Minimal base64url decode
    String b64 = signatureB64url;
    b64.replace('-', '+');
    b64.replace('_', '/');
    while (b64.length() % 4) b64 += '=';
    // Use mbedtls if available; otherwise reject until linked.
#if defined(MBEDTLS_PEM_PARSE_C)
    // Host CI covers verify; on-device require ED25519 type.
    if (!mbedtls_pk_can_do(&pk, MBEDTLS_PK_ECKEY) && !mbedtls_pk_can_do(&pk, MBEDTLS_PK_ED25519)) {
      Serial.println("[cfg] Public key type not usable for Ed25519 verify on this build");
      mbedtls_pk_free(&pk);
      return false;
    }
#endif
    (void)payloadJson;
    (void)sigLen;
    (void)sig;
    // Until MBEDTLS_ED25519_C is enabled in the board sdkconfig, fail closed.
    Serial.println("[cfg] Ed25519 verify requires MBEDTLS_ED25519_C — rejecting until enabled");
    mbedtls_pk_free(&pk);
    return false;
  }
};

#endif
