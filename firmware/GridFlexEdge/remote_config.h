#ifndef GRIDFLEX_REMOTE_CONFIG_H
#define GRIDFLEX_REMOTE_CONFIG_H

#include <Arduino.h>
#include <LittleFS.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include "config.h"
#include "ed25519_verify.h"
#include "network_http.h"

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

  bool telemetryKeyEnabled(const char* key) const {
    StaticJsonDocument<256> keys;
    if (deserializeJson(keys, current_.enabledKeysJson)) return false;
    JsonArray list = keys.as<JsonArray>();
    for (JsonVariant value : list) {
      if (value.is<const char*>() && strcmp(value.as<const char*>(), key) == 0) return true;
    }
    return false;
  }

  /** http must already have auth headers; begin() already called by NetworkManager. */
  bool pullAndApply(NetworkHttpRequest& http) {
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
    if (versionNum <= lastVersionNumeric_) {
      Serial.println("[cfg] Non-increasing configurationVersion — rejected");
      lastStatus_ = "non_increasing_version";
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

    const char* minimumFirmware = payload["approvedFirmwareMinimum"] | "";
    if (!minimumFirmware[0] || compareVersions(FIRMWARE_VERSION, minimumFirmware) < 0) {
      Serial.println("[cfg] Firmware below approved minimum — rejected");
      lastStatus_ = "firmware_below_minimum";
      return false;
    }

    JsonArray enabledKeys = payload["enabledTelemetryKeys"].as<JsonArray>();
    if (enabledKeys.isNull() || enabledKeys.size() == 0 || enabledKeys.size() > 16) {
      Serial.println("[cfg] enabledTelemetryKeys invalid — rejected");
      lastStatus_ = "telemetry_keys_invalid";
      return false;
    }
    for (JsonVariant value : enabledKeys) {
      const char* key = value.as<const char*>();
      if (!key || !isAllowedTelemetryKey(key)) {
        Serial.println("[cfg] Unsupported telemetry key — rejected");
        lastStatus_ = "telemetry_key_forbidden";
        return false;
      }
    }

    previous_ = current_;
    current_.configurationVersion = versionStr;
    current_.pollingIntervalMs = poll;
    current_.serverEndpoint = endpoint;
    current_.approvedFirmwareMinimum = minimumFirmware;
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
    // Accept "12", "1.2.3", and deployed labels such as "cfg-12".
    while (v && *v && (*v < '0' || *v > '9')) ++v;
    if (!v || !*v) return 0;
    unsigned long major = 0, minor = 0, patch = 0;
    if (sscanf(v, "%lu.%lu.%lu", &major, &minor, &patch) >= 1) {
      return major * 10000UL + minor * 100UL + patch;
    }
    return strtoul(v, nullptr, 10);
  }

  static int compareVersions(const char* left, const char* right) {
    unsigned long l[3] = {0, 0, 0};
    unsigned long r[3] = {0, 0, 0};
    if (sscanf(left, "%lu.%lu.%lu", &l[0], &l[1], &l[2]) < 1) return -1;
    if (sscanf(right, "%lu.%lu.%lu", &r[0], &r[1], &r[2]) < 1) return -1;
    for (uint8_t i = 0; i < 3; ++i) {
      if (l[i] < r[i]) return -1;
      if (l[i] > r[i]) return 1;
    }
    return 0;
  }

  static bool isAllowedTelemetryKey(const char* key) {
    static const char* ALLOWED[] = {
      "voltage", "current", "power", "frequency", "lifetimeEnergyKwh"
    };
    for (const char* allowed : ALLOWED) {
      if (strcmp(key, allowed) == 0) return true;
    }
    return false;
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
    if (now < 1700000000) {
      Serial.println("[cfg] Clock not synchronized — expiry cannot be verified");
      return true;
    }
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
    uint8_t pub[32];
    if (!ed25519ParseSpkiPem(PINNED_CONFIG_PUBKEY_PEM, pub)) {
      Serial.println("[cfg] Failed to parse pinned SPKI public key");
      return false;
    }
    uint8_t sig[64];
    size_t sigLen = 0;
    if (!ed25519DecodeBase64Url(signatureB64url, sig, sizeof(sig), &sigLen) || sigLen != 64) {
      Serial.println("[cfg] Signature base64url decode failed");
      return false;
    }
    const size_t msgLen = strlen(payloadJson);
    const bool ok = ed25519VerifyDetached(
      pub, sig, reinterpret_cast<const uint8_t*>(payloadJson), msgLen
    );
    if (!ok) {
      Serial.println("[cfg] Ed25519 verify failed");
    }
    return ok;
  }
};

#endif
