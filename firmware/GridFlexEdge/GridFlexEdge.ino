/**
 * GridFlex ESP32 Edge — Phase 5 reliability firmware
 *
 * - LittleFS store-and-forward (ACK-only delete, no silent overwrite)
 * - GRIDFLEX-V1 signed upload with persistent sequence numbers
 * - Hardware watchdog gated on critical task health
 * - Wi-Fi reconnect + LTE stub with modem power-cycle
 * - Signed remote config + last-known-good rollback
 * - Dual-partition OTA safety hooks
 *
 * Flash with: firmware/partitions_ota.csv
 * Libraries: ArduinoJson, LittleFS (ESP32 core)
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

PersistentQueue gQueue;
WatchdogHealth gWatchdog;
NetworkManager gNet;
RemoteConfigManager gConfig;
OtaSafety gOta;

uint8_t gDeviceSecret[32];
bool gSecretOk = false;
unsigned long gLastMeasureMs = 0;
unsigned long gBackoffUntilMs = 0;
unsigned long gLastConfigPullMs = 0;

void syncTime() {
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
  time_t now = time(nullptr);
  unsigned long start = millis();
  while (now < 8 * 3600 * 2 && millis() - start < 20000) {
    delay(200);
    now = time(nullptr);
  }
  gWatchdog.kick(HealthTask::TimeSync);
}

void measureAndEnqueue() {
  float voltage = 230.0f + (random(-200, 200) / 100.0f);
  float current = 15.0f + (random(-500, 500) / 100.0f);
  float power = (voltage * current) / 1000.0f;

  StaticJsonDocument<512> doc;
  doc["voltage"] = voltage;
  doc["current"] = current;
  doc["power"] = power;
  doc["timestamp"] = iso8601UtcNow();
  doc["firmwareVersion"] = FIRMWARE_VERSION;
  doc["queueDepth"] = (int)gQueue.depth();
  doc["watchdogResetCount"] = (int)gWatchdog.watchdogResetCount();
  doc["restartCount"] = (int)gWatchdog.restartCount();
  doc["lastResetReason"] = gWatchdog.lastResetReason();
  doc["appliedConfigVersion"] = gConfig.current().configurationVersion;
  doc["storageUtilisationPct"] = gQueue.utilisationPct();

  String payload;
  serializeJson(doc, payload);
  String messageId = randomUuidV4();
  String measuredAt = doc["timestamp"].as<String>();

  if (!gQueue.enqueue(messageId, measuredAt, payload)) {
    Serial.println("[measure] enqueue failed (queue full)");
  } else {
    Serial.printf("[measure] queued seq cursor=%u depth=%u\n",
                  gQueue.nextSequence() - 1, gQueue.depth());
  }
  gWatchdog.kick(HealthTask::Modbus);
  gWatchdog.kick(HealthTask::Queue);
}

bool uploadHead() {
  QueueRecord rec;
  if (!gQueue.peek(rec)) return true;

  // Build body: original payload + messageId/sequence for idempotency bookkeeping.
  StaticJsonDocument<768> body;
  deserializeJson(body, rec.payloadJson);
  body["messageId"] = rec.messageId;
  body["sequenceNumber"] = rec.sequenceNumber;
  body["timestamp"] = rec.measuredAt; // preserve original measurement time
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
  WiFiClientSecure& client = gNet.tlsClient();
  if (!http.begin(client, url)) return false;
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
    Serial.printf("[upload] ACK seq=%u http=%d\n", rec.sequenceNumber, code);
    gQueue.acknowledge(rec.sequenceNumber);
    gWatchdog.kick(HealthTask::Queue);
    return true;
  }

  Serial.printf("[upload] fail seq=%u http=%d body=%s\n", rec.sequenceNumber, code, resp.c_str());
  uint32_t backoff = gQueue.markFailureAndBackoffMs();
  gBackoffUntilMs = millis() + backoff;
  return false;
}

void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println("\n--- GridFlex Edge Reliability (Phase 5) ---");
  Serial.printf("Firmware %s reset=%s\n", FIRMWARE_VERSION, "");

  gSecretOk = decodeBase64Url(DEVICE_SECRET_B64URL, gDeviceSecret, sizeof(gDeviceSecret));
  if (!gSecretOk) {
    Serial.println("FATAL: invalid DEVICE_SECRET_B64URL");
  }

  gWatchdog.begin();
  gOta.begin();
  gQueue.begin();
  gConfig.begin();
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

  // Periodic config pull (device must attach auth headers in production pull helper).
  if (millis() - gLastConfigPullMs > 600000UL) {
    gLastConfigPullMs = millis();
    // Config pull uses the same auth stack; skip until secrets configured.
  }

  delay(50);
}
