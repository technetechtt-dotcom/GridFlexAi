#ifndef GRIDFLEX_NETWORK_MANAGER_H
#define GRIDFLEX_NETWORK_MANAGER_H

#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include "config.h"

/**
 * Persistent network for sequenced 4G edge client.
 * Primary: LTE (when USE_LTE=1) for field sites without reliable Wi-Fi.
 * Fallback: Wi-Fi STA with exponential backoff.
 * Offline queue survives reboot (PersistentQueue / LittleFS) — never dropped on net loss.
 *
 * TinyGSM: install TinyGSM + ArduinoHttpClient; set modem type in config.h.
 */

#if USE_LTE
#define TINY_GSM_MODEM_A7670
// #include <TinyGsmClient.h>  // uncomment after installing TinyGSM
// HardwareSerial SerialAT(1);
// TinyGsm modem(SerialAT);
// TinyGsmClient gsmClient(modem);
#endif

class NetworkManager {
 public:
  void begin() {
#if USE_LTE
    pinMode(MODEM_PWR, OUTPUT);
    digitalWrite(MODEM_PWR, LOW);
    delay(100);
    powerOnModem();
    Serial.println("[net] LTE primary path enabled (TinyGSM bring-up)");
#endif
    WiFi.mode(WIFI_STA);
    // Wi-Fi remains available as fallback even when LTE is primary.
  }

  bool ensureConnected() {
#if USE_LTE
    if (lteReady_) {
      lteFailStreak_ = 0;
      return true;
    }
    if (ensureLte()) {
      return true;
    }
#endif
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
    return WiFi.status() == WL_CONNECTED;
  }

  WiFiClientSecure& tlsClient() {
#if defined(GRIDFLEX_ROOT_CA_PEM)
    client_.setCACert(GRIDFLEX_ROOT_CA_PEM);
#else
    client_.setInsecure(); // Prefer GRIDFLEX_ROOT_CA_PEM in production.
#endif
    return client_;
  }

  bool preferWifi() const { return WiFi.status() == WL_CONNECTED; }
  bool lteReady() const {
#if USE_LTE
    return lteReady_;
#else
    return false;
#endif
  }

 private:
  WiFiClientSecure client_;
  uint16_t wifiFailStreak_ = 0;
  uint16_t lteFailStreak_ = 0;
  unsigned long lastAttemptMs_ = 0;
#if USE_LTE
  bool lteReady_ = false;
#endif

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
  void powerOnModem() {
    digitalWrite(MODEM_PWR, HIGH);
    delay(1000);
    digitalWrite(MODEM_PWR, LOW);
    delay(3000);
  }

  bool ensureLte() {
    lteFailStreak_++;
    unsigned long backoff = backoffMs(lteFailStreak_);
    if (millis() - lastAttemptMs_ < backoff) return false;
    lastAttemptMs_ = millis();

    if (lteFailStreak_ >= 5) {
      Serial.println("[net] LTE modem power-cycle");
      powerOnModem();
      lteFailStreak_ = 0;
    }

    /*
     * Production bring-up (after TinyGSM is linked):
     *   SerialAT.begin(115200, SERIAL_8N1, MODEM_RX, MODEM_TX);
     *   modem.restart();
     *   modem.gprsConnect(LTE_APN, LTE_USER, LTE_PASS);
     *   lteReady_ = modem.isGprsConnected();
     *
     * Until TinyGSM is linked, report not-ready so Wi-Fi fallback + queue keep working.
     */
    Serial.println("[net] LTE: waiting for TinyGSM link — queue retained, Wi-Fi fallback active");
    lteReady_ = false;
    return false;
  }
#endif
};

#endif
