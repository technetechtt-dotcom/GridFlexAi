#ifndef GRIDFLEX_NETWORK_MANAGER_H
#define GRIDFLEX_NETWORK_MANAGER_H

#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include "config.h"

/**
 * Network recovery: Wi-Fi primary, optional LTE secondary.
 * Exponential backoff with jitter; modem power-cycle after repeated LTE failures.
 * Offline queue is preserved across reboot (handled by PersistentQueue / LittleFS).
 */

class NetworkManager {
 public:
  void begin() {
    WiFi.mode(WIFI_STA);
    connectWifi();
#if USE_LTE
    pinMode(MODEM_PWR, OUTPUT);
    digitalWrite(MODEM_PWR, LOW);
#endif
  }

  bool ensureConnected() {
    if (WiFi.status() == WL_CONNECTED) {
      wifiFailStreak_ = 0;
      return true;
    }
    wifiFailStreak_++;
    unsigned long backoff = backoffMs(wifiFailStreak_);
    if (millis() - lastAttemptMs_ < backoff) return false;
    lastAttemptMs_ = millis();
    Serial.printf("[net] Wi-Fi reconnect attempt %u (backoff %lums)\n", wifiFailStreak_, backoff);
    connectWifi();
    if (WiFi.status() == WL_CONNECTED) {
      wifiFailStreak_ = 0;
      return true;
    }
#if USE_LTE
    return ensureLte();
#else
    return false;
#endif
  }

  WiFiClientSecure& tlsClient() {
    client_.setInsecure(); // Prefer setCACert in production with pinned root CA.
    return client_;
  }

  bool preferWifi() const { return WiFi.status() == WL_CONNECTED; }

 private:
  WiFiClientSecure client_;
  uint16_t wifiFailStreak_ = 0;
  uint16_t lteFailStreak_ = 0;
  unsigned long lastAttemptMs_ = 0;

  void connectWifi() {
    WiFi.disconnect(true);
    delay(100);
    WiFi.begin(WIFI_SSID, WIFI_PASS);
    unsigned long start = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - start < 15000) {
      delay(250);
    }
  }

  unsigned long backoffMs(uint16_t streak) const {
    unsigned long exp = 1000UL;
    for (uint16_t i = 1; i < streak && exp < 60000UL; i++) exp *= 2;
    unsigned long jitter = (unsigned long)random(0, (long)(exp / 5 + 1));
    return exp + jitter;
  }

#if USE_LTE
  bool ensureLte() {
    lteFailStreak_++;
    if (lteFailStreak_ >= 5) {
      Serial.println("[net] LTE modem power-cycle");
      digitalWrite(MODEM_PWR, HIGH);
      delay(1200);
      digitalWrite(MODEM_PWR, LOW);
      delay(3000);
      lteFailStreak_ = 0;
    }
    // TinyGSM bring-up would go here; DNS/TLS failures increment lteFailStreak_.
    Serial.println("[net] LTE path stub — enable TinyGSM for production cellular");
    return false;
  }
#endif
};

#endif
