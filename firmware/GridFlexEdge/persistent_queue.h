#ifndef GRIDFLEX_PERSISTENT_QUEUE_H
#define GRIDFLEX_PERSISTENT_QUEUE_H

#include <Arduino.h>
#include <LittleFS.h>
#include <ArduinoJson.h>
#include "config.h"

/**
 * Power-loss-safe store-and-forward queue.
 *
 * Design (survives interrupt at every stage):
 * 1. Write JOURNAL (tmp → rename) describing the intended op (enqueue|ack|retry).
 * 2. Write DATA (record via tmp → rename to final; never delete-before-rename of sole copy).
 * 3. Commit META via dual-buffer (meta_a / meta_b with monotonic gen) — always write the
 *    inactive buffer then flip; never delete the live meta first.
 * 4. Clear JOURNAL after meta commit.
 *
 * On boot: if journal present, complete or roll forward safely; then load highest-gen meta
 * (or rebuild from slot files).
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
    if (!LittleFS.begin(false)) {
      Serial.println("[queue] LittleFS mount failed (not formatting)");
      return false;
    }
    LittleFS.mkdir("/q");
    recoverJournal();
    if (!loadMetaDual()) {
      rebuildMetaFromSlots();
      persistMetaDual(head_, tail_, count_, nextSequence_);
    }
    clearJournal();
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

    uint32_t newCount = count_ + 1;
    uint32_t newTail = (tail_ + 1) % QUEUE_MAX_RECORDS;
    uint32_t newSeq = nextSequence_ + 1;

    if (!writeJournal("enqueue", tail_, rec.sequenceNumber, newCount, newTail, newSeq, head_)) {
      return false;
    }
    if (!writeRecordAtomic(tail_, rec)) {
      clearJournal();
      return false;
    }
    if (!persistMetaDual(head_, newTail, newCount, newSeq)) {
      // Record exists; rebuild on next boot from slots + journal.
      return false;
    }
    clearJournal();
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
    uint32_t oldHead = head_;
    uint32_t newHead = (head_ + 1) % QUEUE_MAX_RECORDS;
    uint32_t newCount = count_ - 1;

    if (!writeJournal("ack", oldHead, sequenceNumber, newCount, tail_, nextSequence_, newHead)) {
      return false;
    }
    // Commit meta first so a crash after meta still leaves record (may re-ACK idempotently).
    if (!persistMetaDual(newHead, tail_, newCount, nextSequence_)) {
      return false;
    }
    LittleFS.remove(slotPath(oldHead));
    clearJournal();
    head_ = newHead;
    count_ = newCount;
    return true;
  }

  uint32_t markFailureAndBackoffMs() {
    QueueRecord head;
    if (!peek(head)) return 0;
    head.retryCount++;
    writeJournal("retry", head_, head.sequenceNumber, count_, tail_, nextSequence_, head_);
    writeRecordAtomic(head_, head);
    clearJournal();
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
  uint32_t metaGen_ = 0;
  uint8_t metaActive_ = 0; // 0 => meta_a, 1 => meta_b

  String slotPath(uint32_t slot) const {
    return String("/q/") + String(slot) + ".json";
  }

  String slotTmpPath(uint32_t slot) const {
    return String("/q/") + String(slot) + ".json.tmp";
  }

  static const char* metaPath(uint8_t which) {
    return which == 0 ? "/q/meta_a.json" : "/q/meta_b.json";
  }

  static const char* metaTmpPath(uint8_t which) {
    return which == 0 ? "/q/meta_a.json.tmp" : "/q/meta_b.json.tmp";
  }

  bool atomicWriteJson(const char* tmpPath, const char* finalPath, const JsonDocument& doc) {
    File f = LittleFS.open(tmpPath, "w");
    if (!f) return false;
    if (serializeJson(doc, f) == 0) {
      f.close();
      LittleFS.remove(tmpPath);
      return false;
    }
    f.flush();
    f.close();
    // Prefer rename-over; if final exists, remove only after tmp is durable.
    if (LittleFS.exists(finalPath)) {
      // Keep backup until rename succeeds: rename tmp to sibling then swap.
      String bak = String(finalPath) + ".bak";
      LittleFS.remove(bak);
      LittleFS.rename(finalPath, bak);
      if (!LittleFS.rename(tmpPath, finalPath)) {
        LittleFS.rename(bak, finalPath);
        return false;
      }
      LittleFS.remove(bak);
      return true;
    }
    return LittleFS.rename(tmpPath, finalPath);
  }

  bool writeJournal(
    const char* op,
    uint32_t slot,
    uint32_t sequence,
    uint32_t count,
    uint32_t tail,
    uint32_t nextSeq,
    uint32_t head
  ) {
    StaticJsonDocument<256> doc;
    doc["op"] = op;
    doc["slot"] = slot;
    doc["sequence"] = sequence;
    doc["count"] = count;
    doc["tail"] = tail;
    doc["nextSequence"] = nextSeq;
    doc["head"] = head;
    return atomicWriteJson("/q/journal.json.tmp", "/q/journal.json", doc);
  }

  void clearJournal() {
    LittleFS.remove("/q/journal.json");
    LittleFS.remove("/q/journal.json.tmp");
  }

  void recoverJournal() {
    File f = LittleFS.open("/q/journal.json", "r");
    if (!f) {
      // Incomplete tmp journal — discard
      LittleFS.remove("/q/journal.json.tmp");
      return;
    }
    StaticJsonDocument<256> doc;
    if (deserializeJson(doc, f)) {
      f.close();
      clearJournal();
      return;
    }
    f.close();
    const char* op = doc["op"] | "";
    uint32_t head = doc["head"] | 0;
    uint32_t tail = doc["tail"] | 0;
    uint32_t count = doc["count"] | 0;
    uint32_t nextSeq = doc["nextSequence"] | 1;
    uint32_t slot = doc["slot"] | 0;

    if (strcmp(op, "enqueue") == 0) {
      // If record exists, commit meta; else abandon.
      QueueRecord rec;
      if (readRecord(slot, rec) && rec.sequenceNumber == (uint32_t)(doc["sequence"] | 0)) {
        persistMetaDual(head, tail, count, nextSeq);
      } else {
        LittleFS.remove(slotPath(slot));
      }
    } else if (strcmp(op, "ack") == 0) {
      persistMetaDual(head, tail, count, nextSeq);
      LittleFS.remove(slotPath(slot));
    } else if (strcmp(op, "retry") == 0) {
      // Record rewrite is idempotent; nothing else required.
    }
    clearJournal();
    Serial.printf("[queue] journal recovered op=%s\n", op);
  }

  bool loadMetaDual() {
    uint32_t genA = 0, genB = 0;
    uint32_t hA = 0, tA = 0, cA = 0, nA = 1;
    uint32_t hB = 0, tB = 0, cB = 0, nB = 1;
    bool okA = readMetaFile(0, genA, hA, tA, cA, nA);
    bool okB = readMetaFile(1, genB, hB, tB, cB, nB);
    if (!okA && !okB) {
      // Legacy single meta.json migration
      File f = LittleFS.open("/q/meta.json", "r");
      if (!f) return false;
      StaticJsonDocument<256> doc;
      if (deserializeJson(doc, f)) {
        f.close();
        return false;
      }
      f.close();
      head_ = doc["head"] | 0;
      tail_ = doc["tail"] | 0;
      count_ = doc["count"] | 0;
      nextSequence_ = doc["nextSequence"] | 1;
      metaGen_ = 1;
      metaActive_ = 0;
      persistMetaDual(head_, tail_, count_, nextSequence_);
      LittleFS.remove("/q/meta.json");
      return count_ <= QUEUE_MAX_RECORDS;
    }
    if (okA && (!okB || genA >= genB)) {
      head_ = hA;
      tail_ = tA;
      count_ = cA;
      nextSequence_ = nA;
      metaGen_ = genA;
      metaActive_ = 0;
    } else {
      head_ = hB;
      tail_ = tB;
      count_ = cB;
      nextSequence_ = nB;
      metaGen_ = genB;
      metaActive_ = 1;
    }
    return count_ <= QUEUE_MAX_RECORDS;
  }

  bool readMetaFile(
    uint8_t which,
    uint32_t& gen,
    uint32_t& head,
    uint32_t& tail,
    uint32_t& count,
    uint32_t& nextSeq
  ) {
    File f = LittleFS.open(metaPath(which), "r");
    if (!f) return false;
    StaticJsonDocument<256> doc;
    if (deserializeJson(doc, f)) {
      f.close();
      return false;
    }
    f.close();
    gen = doc["gen"] | 0;
    head = doc["head"] | 0;
    tail = doc["tail"] | 0;
    count = doc["count"] | 0;
    nextSeq = doc["nextSequence"] | 1;
    return true;
  }

  bool persistMetaDual(uint32_t head, uint32_t tail, uint32_t count, uint32_t nextSequence) {
    uint8_t target = metaActive_ ^ 1;
    uint32_t gen = metaGen_ + 1;
    StaticJsonDocument<256> doc;
    doc["gen"] = gen;
    doc["head"] = head;
    doc["tail"] = tail;
    doc["count"] = count;
    doc["nextSequence"] = nextSequence;
    if (!atomicWriteJson(metaTmpPath(target), metaPath(target), doc)) {
      return false;
    }
    metaGen_ = gen;
    metaActive_ = target;
    head_ = head;
    tail_ = tail;
    count_ = count;
    nextSequence_ = nextSequence;
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

  bool writeRecordAtomic(uint32_t slot, const QueueRecord& rec) {
    StaticJsonDocument<1024> doc;
    doc["messageId"] = rec.messageId;
    doc["sequenceNumber"] = rec.sequenceNumber;
    doc["measuredAt"] = rec.measuredAt;
    doc["payloadJson"] = rec.payloadJson;
    doc["retryCount"] = rec.retryCount;
    String tmp = slotTmpPath(slot);
    String finalPath = slotPath(slot);
    return atomicWriteJson(tmp.c_str(), finalPath.c_str(), doc);
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
