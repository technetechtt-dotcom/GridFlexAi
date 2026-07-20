/**
 * GridFlex ESP32 Edge — Phase 5 reliability firmware
 *
 * - LittleFS store-and-forward (ACK-only delete, tmp+rename meta/slots)
 * - GRIDFLEX-V1 signed upload with persistent sequence numbers
 * - Hardware watchdog gated on critical task health (NVS counters)
 * - LTE primary with CA-validated TLS; Wi-Fi failover both ways
 * - RS485 Modbus RTU acquisition (fail-closed when bus unavailable)
 * - Signed remote config + last-known-good rollback (no physical enable)
 * - Dual-partition OTA safety hooks
 *
 * Flash with: firmware/partitions_ota.csv
 * Libraries: ArduinoJson, LittleFS, TinyGSM, SSLClient
 */

#include <Arduino.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

#include "config.h"
#include "gridflex_auth.h"
#include "persistent_queue.h"
#include "watchdog_health.h"
#include "network_manager.h"
#include "remote_config.h"
#include "ota_safety.h"
#include "modbus_rtu.h"
#include "ed25519_kat.h"

PersistentQueue gQueue;
WatchdogHealth gWatchdog;
NetworkManager gNet;
RemoteConfigManager gConfig;
OtaSafety gOta;
ModbusRtuReader gModbus;

uint8_t gDeviceSecret[32];
bool gSecretOk = false;
bool gStorageOk = false;
unsigned long gLastMeasureMs = 0;
unsigned long gBackoffUntilMs = 0;
unsigned long gLastConfigPullMs = 0;
unsigned long gLastTimeSyncMs = 0;
uint16_t gUploadFailStreak = 0;

void syncTime() {
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
  time_t now = time(nullptr);
  unsigned long start = millis();
  while (now < 8 * 3600 * 2 && millis() - start < 20000) {
    delay(200);
    now = time(nullptr);
  }
  gLastTimeSyncMs = millis();
  gWatchdog.kick(HealthTask::TimeSync);
}

void measureAndEnqueue() {
  if (!gStorageOk) {
    Serial.println("[measure] storage unavailable — skipping enqueue (fail-safe)");
    gWatchdog.kick(HealthTask::Modbus);
    return;
  }

  ModbusSample sample = gModbus.readInverterSample();
  gWatchdog.kick(HealthTask::Modbus);

  if (!sample.valid) {
    Serial.printf("[measure] Modbus fail (%s) — not fabricating values\n",
                  sample.failReason ? sample.failReason : "unknown");
    // Still kick queue health so TWDT does not trip solely from a meter outage;
    // upload path continues draining any prior valid records.
    gWatchdog.kick(HealthTask::Queue);
    return;
  }

  StaticJsonDocument<768> doc;
  doc["voltage"] = sample.voltage;
  doc["current"] = sample.current;
  doc["power"] = sample.power;
  if (isfinite(sample.frequencyHz)) {
    doc["frequency"] = sample.frequencyHz;
  }
  doc["timestamp"] = iso8601UtcNow();
  doc["firmwareVersion"] = FIRMWARE_VERSION;
  doc["queueDepth"] = (int)gQueue.depth();
  doc["watchdogResetCount"] = (int)gWatchdog.watchdogResetCount();
  doc["restartCount"] = (int)gWatchdog.restartCount();
  doc["lastResetReason"] = gWatchdog.lastResetReason();
  doc["appliedConfigVersion"] = gConfig.current().configurationVersion;
  doc["configStatus"] = gConfig.lastStatus();
  doc["storageUtilisationPct"] = gQueue.utilisationPct();
  doc["networkPath"] = gNet.activePathName();

  String payload;
  serializeJson(doc, payload);
  String messageId = randomUuidV4();
  String measuredAt = doc["timestamp"].as<String>();

  if (!gQueue.enqueue(messageId, measuredAt, payload)) {
    Serial.println("[measure] enqueue failed (queue full or FS error)");
  } else {
    Serial.printf("[measure] queued seq cursor=%u depth=%u path=%s\n",
                  gQueue.nextSequence() - 1, gQueue.depth(), gNet.activePathName());
  }
  gWatchdog.kick(HealthTask::Queue);
}

bool uploadHead() {
  if (!gStorageOk || !gSecretOk) return false;

  QueueRecord rec;
  if (!gQueue.peek(rec)) return true;

  StaticJsonDocument<768> body;
  deserializeJson(body, rec.payloadJson);
  body["messageId"] = rec.messageId;
  body["sequenceNumber"] = rec.sequenceNumber;
  body["timestamp"] = rec.measuredAt;
  String rawBody;
  serializeJson(body, rawBody);

  String timestamp = String((uint64_t)time(nullptr) * 1000ULL);
  String nonce = String(esp_random());
  String signature = createGridFlexV1Signature(
    DEVICE_ID, CREDENTIAL_ID, KEY_VERSION, timestamp, nonce, rec.sequenceNumber,
    rawBody, gDeviceSecret, sizeof(gDeviceSecret)
  );

  String url = gConfig.current().serverEndpoint;
  if (url.indexOf("/edge-data") < 0) {
    url = String(DEFAULT_API_BASE) + EDGE_DATA_PATH;
  }

  HTTPClient http;
  if (!gNet.beginHttps(http, url)) {
    gUploadFailStreak++;
    if (gUploadFailStreak >= 3) {
      gNet.markPathUnhealthy();
      gUploadFailStreak = 0;
    }
    return false;
  }
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-gridflex-device-id", DEVICE_ID);
  http.addHeader("x-gridflex-credential-id", CREDENTIAL_ID);
  http.addHeader("x-gridflex-key-version", String(KEY_VERSION));
  http.addHeader("x-gridflex-timestamp", timestamp);
  http.addHeader("x-gridflex-nonce", nonce);
  http.addHeader("x-gridflex-sequence-number", String(rec.sequenceNumber));
  http.addHeader("x-gridflex-signature", signature);

  int code = http.POST(rawBody);
  String resp = http.getString();
  http.end();
  gWatchdog.kick(HealthTask::Upload);

  if (code == 200 || code == 201) {
    Serial.printf("[upload] ACK seq=%u http=%d path=%s\n",
                  rec.sequenceNumber, code, gNet.activePathName());
    gQueue.acknowledge(rec.sequenceNumber);
    gWatchdog.kick(HealthTask::Queue);
    gUploadFailStreak = 0;
    gConfig.rollbackIfUnhealthy(true);
    return true;
  }

  Serial.printf("[upload] fail seq=%u http=%d body=%s\n", rec.sequenceNumber, code, resp.c_str());
  gUploadFailStreak++;
  if (gUploadFailStreak >= 3) {
    gNet.markPathUnhealthy();
    gConfig.rollbackIfUnhealthy(false);
    gUploadFailStreak = 0;
  }
  uint32_t backoff = gQueue.markFailureAndBackoffMs();
  gBackoffUntilMs = millis() + backoff;
  return false;
}

bool pullRemoteConfig() {
  if (!gSecretOk) return false;
  HTTPClient http;
  String url = String(DEFAULT_API_BASE) + EDGE_CONFIG_PATH;
  if (!gNet.beginHttps(http, url)) return false;

  String timestamp = String((uint64_t)time(nullptr) * 1000ULL);
  String nonce = String(esp_random());
  String emptyBody = "{}";
  // Sequence 0 reserved for config pull authentication binding.
  String signature = createGridFlexV1Signature(
    DEVICE_ID, CREDENTIAL_ID, KEY_VERSION, timestamp, nonce, 0,
    emptyBody, gDeviceSecret, sizeof(gDeviceSecret)
  );
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-gridflex-device-id", DEVICE_ID);
  http.addHeader("x-gridflex-credential-id", CREDENTIAL_ID);
  http.addHeader("x-gridflex-key-version", String(KEY_VERSION));
  http.addHeader("x-gridflex-timestamp", timestamp);
  http.addHeader("x-gridflex-nonce", nonce);
  http.addHeader("x-gridflex-sequence-number", "0");
  http.addHeader("x-gridflex-signature", signature);

  bool ok = gConfig.pullAndApply(http);
  gWatchdog.kick(HealthTask::Upload);
  return ok;
}

void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println("\n--- GridFlex Edge Reliability (Phase 5) ---");

  gSecretOk = decodeBase64Url(DEVICE_SECRET_B64URL, gDeviceSecret, sizeof(gDeviceSecret));
  if (!gSecretOk) {
    Serial.println("FATAL: invalid DEVICE_SECRET_B64URL");
  }

  if (!ed25519RunKnownAnswerTest()) {
    Serial.println("FATAL: Ed25519 known-answer test failed");
  } else {
    Serial.println("[boot] Ed25519 KAT passed");
  }

  gWatchdog.begin();
  Serial.printf("Firmware %s reset=%s wdt=%u restarts=%u\n",
                FIRMWARE_VERSION,
                gWatchdog.lastResetReason(),
                gWatchdog.watchdogResetCount(),
                gWatchdog.restartCount());

  gOta.begin();
  gStorageOk = gQueue.begin();
  if (!gStorageOk) {
    Serial.println("FATAL: LittleFS/queue init failed — measurement enqueue disabled");
  }
  gConfig.begin();
  gModbus.begin();
  gNet.begin();
  syncTime();

  Serial.printf("Queue depth after boot: %u (offline preservation)\n", gQueue.depth());
  gWatchdog.kick(HealthTask::Network);
  gWatchdog.kick(HealthTask::Upload);
  gWatchdog.kick(HealthTask::Modbus);
  gWatchdog.kick(HealthTask::Queue);
}

void loop() {
  gWatchdog.service();

  // Periodic NTP so TimeSync kicks stay fresh for TWDT gating.
  if (millis() - gLastTimeSyncMs > 3600000UL) {
    syncTime();
  } else {
    gWatchdog.kick(HealthTask::TimeSync);
  }

  if (gNet.ensureConnected()) {
    gWatchdog.kick(HealthTask::Network);
    if (gOta.pendingConfirm() && millis() > 15000) {
      gOta.confirmBoot();
    }
  }

  unsigned long poll = gConfig.current().pollingIntervalMs;
  if (millis() - gLastMeasureMs >= poll) {
    gLastMeasureMs = millis();
    measureAndEnqueue();
  }

  if (millis() >= gBackoffUntilMs && gNet.ensureConnected() && gSecretOk) {
    uploadHead();
  }

  if (millis() - gLastConfigPullMs > 600000UL && gNet.ensureConnected() && gSecretOk) {
    gLastConfigPullMs = millis();
    pullRemoteConfig();
  }

  delay(50);
}
