#ifndef GRIDFLEX_WATCHDOG_HEALTH_H
#define GRIDFLEX_WATCHDOG_HEALTH_H

#include <Arduino.h>
#include <esp_task_wdt.h>
#include <esp_system.h>
#include "config.h"

/**
 * Hardware watchdog: only reset after critical tasks report healthy.
 * Tasks monitored: modbus, network, upload, queue, time sync.
 */

enum class HealthTask : uint8_t {
  Modbus = 0,
  Network = 1,
  Upload = 2,
  Queue = 3,
  TimeSync = 4,
  COUNT = 5
};

class WatchdogHealth {
 public:
  void begin() {
    resetReason_ = decodeResetReason(esp_reset_reason());
    if (esp_reset_reason() == ESP_RST_TASK_WDT || esp_reset_reason() == ESP_RST_WDT) {
      watchdogResetCount_++;
    }
    restartCount_++;
    esp_task_wdt_init(WATCHDOG_TIMEOUT_MS / 1000, true);
    esp_task_wdt_add(NULL);
    for (uint8_t i = 0; i < (uint8_t)HealthTask::COUNT; i++) {
      lastKickMs_[i] = millis();
    }
  }

  void kick(HealthTask task) {
    lastKickMs_[(uint8_t)task] = millis();
  }

  /** Feed TWDT only when all critical tasks remain healthy. */
  void service() {
    const unsigned long now = millis();
    bool allOk = true;
    for (uint8_t i = 0; i < (uint8_t)HealthTask::COUNT; i++) {
      if (now - lastKickMs_[i] > WATCHDOG_TIMEOUT_MS) {
        allOk = false;
        lockedTask_ = (HealthTask)i;
        break;
      }
    }
    if (allOk) {
      esp_task_wdt_reset();
      lockedTask_ = HealthTask::COUNT;
    }
  }

  const char* lastResetReason() const { return resetReason_; }
  uint32_t watchdogResetCount() const { return watchdogResetCount_; }
  uint32_t restartCount() const { return restartCount_; }
  const char* lockedTaskName() const {
    switch (lockedTask_) {
      case HealthTask::Modbus: return "modbus";
      case HealthTask::Network: return "network";
      case HealthTask::Upload: return "upload";
      case HealthTask::Queue: return "queue";
      case HealthTask::TimeSync: return "time_sync";
      default: return "none";
    }
  }

 private:
  unsigned long lastKickMs_[(uint8_t)HealthTask::COUNT];
  HealthTask lockedTask_ = HealthTask::COUNT;
  const char* resetReason_ = "unknown";
  uint32_t watchdogResetCount_ = 0;
  uint32_t restartCount_ = 0;

  static const char* decodeResetReason(esp_reset_reason_t r) {
    switch (r) {
      case ESP_RST_POWERON: return "power_on";
      case ESP_RST_SW: return "software";
      case ESP_RST_PANIC: return "panic";
      case ESP_RST_INT_WDT: return "int_wdt";
      case ESP_RST_TASK_WDT: return "task_wdt";
      case ESP_RST_WDT: return "wdt";
      case ESP_RST_BROWNOUT: return "brownout";
      case ESP_RST_DEEPSLEEP: return "deepsleep";
      default: return "other";
    }
  }
};

#endif
