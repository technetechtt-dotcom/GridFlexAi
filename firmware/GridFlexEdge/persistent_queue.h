#ifndef GRIDFLEX_PERSISTENT_QUEUE_H
#define GRIDFLEX_PERSISTENT_QUEUE_H

#include <Arduino.h>
#include <LittleFS.h>
#include <ArduinoJson.h>
#include "config.h"

/**
 * Flash-backed store-and-forward queue (LittleFS).
 * Measure → enqueue → upload → delete only after ACK.
 * Never silently overwrites unsent records. Survives reboot.
 */

struct QueueRecord {
  String messageId;
  uint32_t sequenceNumber;
  String measuredAt;
  String payloadJson;
  uint16_t retryCount;
};

class PersistentQueue {
 public:
  bool begin() {
    if (!LittleFS.begin(true)) {
      Serial.println("[queue] LittleFS mount failed");
      return false;
    }
    LittleFS.mkdir("/q");
    loadMeta();
    return true;
  }

  uint32_t depth() const { return count_; }
  uint32_t nextSequence() const { return nextSequence_; }
  float utilisationPct() const {
    return (float)count_ * 100.0f / (float)QUEUE_MAX_RECORDS;
  }

  bool enqueue(const String& messageId, const String& measuredAt, const String& payloadJson) {
    if (count_ >= QUEUE_MAX_RECORDS) {
      Serial.println("[queue] FULL — refusing overwrite of unsent records");
      return false;
    }
    QueueRecord rec;
    rec.messageId = messageId;
    rec.sequenceNumber = nextSequence_++;
    rec.measuredAt = measuredAt;
    rec.payloadJson = payloadJson;
    rec.retryCount = 0;
    if (!writeRecord(tail_, rec)) return false;
    count_++;
    tail_ = (tail_ + 1) % QUEUE_MAX_RECORDS;
    persistMeta();
    return true;
  }

  bool peek(QueueRecord& out) {
    if (count_ == 0) return false;
    return readRecord(head_, out);
  }

  bool acknowledge(uint32_t sequenceNumber) {
    QueueRecord head;
    if (!peek(head)) return false;
    if (head.sequenceNumber != sequenceNumber) return false;
    LittleFS.remove(slotPath(head_));
    head_ = (head_ + 1) % QUEUE_MAX_RECORDS;
    count_--;
    persistMeta();
    return true;
  }

  uint32_t markFailureAndBackoffMs() {
    QueueRecord head;
    if (!peek(head)) return 0;
    head.retryCount++;
    writeRecord(head_, head);
    uint32_t exp = 1000u;
    for (uint16_t i = 1; i < head.retryCount && exp < 150000u; i++) exp *= 2;
    if (exp > 300000u) exp = 300000u;
    uint32_t jitter = (uint32_t)random(0, (long)(exp / 5 + 1));
    return exp + jitter;
  }

 private:
  uint32_t head_ = 0;
  uint32_t tail_ = 0;
  uint32_t count_ = 0;
  uint32_t nextSequence_ = 1;

  String slotPath(uint32_t slot) const {
    return String("/q/") + String(slot) + ".json";
  }

  void loadMeta() {
    File f = LittleFS.open("/q/meta.json", "r");
    if (!f) {
      persistMeta();
      return;
    }
    StaticJsonDocument<256> doc;
    deserializeJson(doc, f);
    f.close();
    head_ = doc["head"] | 0;
    tail_ = doc["tail"] | 0;
    count_ = doc["count"] | 0;
    nextSequence_ = doc["nextSequence"] | 1;
  }

  void persistMeta() {
    File f = LittleFS.open("/q/meta.json", "w");
    if (!f) return;
    StaticJsonDocument<256> doc;
    doc["head"] = head_;
    doc["tail"] = tail_;
    doc["count"] = count_;
    doc["nextSequence"] = nextSequence_;
    serializeJson(doc, f);
    f.close();
  }

  bool writeRecord(uint32_t slot, const QueueRecord& rec) {
    File f = LittleFS.open(slotPath(slot), "w");
    if (!f) return false;
    StaticJsonDocument<1024> doc;
    doc["messageId"] = rec.messageId;
    doc["sequenceNumber"] = rec.sequenceNumber;
    doc["measuredAt"] = rec.measuredAt;
    doc["payloadJson"] = rec.payloadJson;
    doc["retryCount"] = rec.retryCount;
    serializeJson(doc, f);
    f.close();
    return true;
  }

  bool readRecord(uint32_t slot, QueueRecord& out) {
    File f = LittleFS.open(slotPath(slot), "r");
    if (!f) return false;
    StaticJsonDocument<1024> doc;
    deserializeJson(doc, f);
    f.close();
    out.messageId = doc["messageId"].as<String>();
    out.sequenceNumber = doc["sequenceNumber"] | 0;
    out.measuredAt = doc["measuredAt"].as<String>();
    out.payloadJson = doc["payloadJson"].as<String>();
    out.retryCount = doc["retryCount"] | 0;
    return true;
  }
};

#endif
