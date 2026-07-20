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
 * Meta updates are write-tmp + rename (atomic as provided by LittleFS).
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
    // Never format-on-fail — that would wipe the store-and-forward queue.
    if (!LittleFS.begin(false)) {
      Serial.println("[queue] LittleFS mount failed (not formatting)");
      return false;
    }
    LittleFS.mkdir("/q");
    if (!loadMeta()) {
      rebuildMetaFromSlots();
      persistMeta();
    }
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
    rec.sequenceNumber = nextSequence_;
    rec.measuredAt = measuredAt;
    rec.payloadJson = payloadJson;
    rec.retryCount = 0;
    if (!writeRecordAtomic(tail_, rec)) return false;
    uint32_t newCount = count_ + 1;
    uint32_t newTail = (tail_ + 1) % QUEUE_MAX_RECORDS;
    uint32_t newSeq = nextSequence_ + 1;
    if (!persistMetaValues(head_, newTail, newCount, newSeq)) {
      LittleFS.remove(slotPath(tail_));
      return false;
    }
    count_ = newCount;
    tail_ = newTail;
    nextSequence_ = newSeq;
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
    uint32_t newHead = (head_ + 1) % QUEUE_MAX_RECORDS;
    uint32_t newCount = count_ - 1;
    if (!persistMetaValues(newHead, tail_, newCount, nextSequence_)) return false;
    LittleFS.remove(slotPath(head_));
    head_ = newHead;
    count_ = newCount;
    return true;
  }

  uint32_t markFailureAndBackoffMs() {
    QueueRecord head;
    if (!peek(head)) return 0;
    head.retryCount++;
    writeRecordAtomic(head_, head);
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

  String slotTmpPath(uint32_t slot) const {
    return String("/q/") + String(slot) + ".json.tmp";
  }

  bool loadMeta() {
    File f = LittleFS.open("/q/meta.json", "r");
    if (!f) return false;
    StaticJsonDocument<256> doc;
    DeserializationError err = deserializeJson(doc, f);
    f.close();
    if (err) return false;
    head_ = doc["head"] | 0;
    tail_ = doc["tail"] | 0;
    count_ = doc["count"] | 0;
    nextSequence_ = doc["nextSequence"] | 1;
    if (count_ > QUEUE_MAX_RECORDS) return false;
    return true;
  }

  void rebuildMetaFromSlots() {
    head_ = 0;
    tail_ = 0;
    count_ = 0;
    nextSequence_ = 1;
    uint32_t maxSeq = 0;
    uint32_t minSeq = UINT32_MAX;
    uint32_t minSlot = 0;
    uint32_t maxSlot = 0;
    bool any = false;
    for (uint32_t slot = 0; slot < QUEUE_MAX_RECORDS; slot++) {
      QueueRecord rec;
      if (!readRecord(slot, rec)) continue;
      any = true;
      count_++;
      if (rec.sequenceNumber <= minSeq) {
        minSeq = rec.sequenceNumber;
        minSlot = slot;
      }
      if (rec.sequenceNumber >= maxSeq) {
        maxSeq = rec.sequenceNumber;
        maxSlot = slot;
      }
    }
    if (!any) {
      Serial.println("[queue] rebuilt meta empty");
      return;
    }
    head_ = minSlot;
    tail_ = (maxSlot + 1) % QUEUE_MAX_RECORDS;
    nextSequence_ = maxSeq + 1;
    Serial.printf("[queue] rebuilt meta count=%u head=%u nextSeq=%u\n", count_, head_, nextSequence_);
  }

  bool persistMeta() {
    return persistMetaValues(head_, tail_, count_, nextSequence_);
  }

  bool persistMetaValues(uint32_t head, uint32_t tail, uint32_t count, uint32_t nextSequence) {
    const char* tmp = "/q/meta.json.tmp";
    const char* finalPath = "/q/meta.json";
    File f = LittleFS.open(tmp, "w");
    if (!f) return false;
    StaticJsonDocument<256> doc;
    doc["head"] = head;
    doc["tail"] = tail;
    doc["count"] = count;
    doc["nextSequence"] = nextSequence;
    if (serializeJson(doc, f) == 0) {
      f.close();
      LittleFS.remove(tmp);
      return false;
    }
    f.flush();
    f.close();
    LittleFS.remove(finalPath);
    return LittleFS.rename(tmp, finalPath);
  }

  bool writeRecordAtomic(uint32_t slot, const QueueRecord& rec) {
    String tmp = slotTmpPath(slot);
    String finalPath = slotPath(slot);
    File f = LittleFS.open(tmp, "w");
    if (!f) return false;
    StaticJsonDocument<1024> doc;
    doc["messageId"] = rec.messageId;
    doc["sequenceNumber"] = rec.sequenceNumber;
    doc["measuredAt"] = rec.measuredAt;
    doc["payloadJson"] = rec.payloadJson;
    doc["retryCount"] = rec.retryCount;
    if (serializeJson(doc, f) == 0) {
      f.close();
      LittleFS.remove(tmp);
      return false;
    }
    f.flush();
    f.close();
    LittleFS.remove(finalPath);
    return LittleFS.rename(tmp, finalPath);
  }

  bool readRecord(uint32_t slot, QueueRecord& out) {
    File f = LittleFS.open(slotPath(slot), "r");
    if (!f) return false;
    StaticJsonDocument<1024> doc;
    DeserializationError err = deserializeJson(doc, f);
    f.close();
    if (err) return false;
    out.messageId = doc["messageId"].as<String>();
    out.sequenceNumber = doc["sequenceNumber"] | 0;
    out.measuredAt = doc["measuredAt"].as<String>();
    out.payloadJson = doc["payloadJson"].as<String>();
    out.retryCount = doc["retryCount"] | 0;
    return true;
  }
};

#endif
