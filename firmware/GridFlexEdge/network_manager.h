#ifndef GRIDFLEX_NETWORK_MANAGER_H
#define GRIDFLEX_NETWORK_MANAGER_H

#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include "config.h"
#include "certs.h"
#include "network_http.h"

/**
 * Persistent network for sequenced 4G edge client (SIM7670X / TinyGSM).
 * Primary: LTE when USE_LTE=1. Fallback: Wi-Fi STA with automatic failover both ways.
 * Telemetry HTTPS always uses CA-validated TLS (GRIDFLEX_ROOT_CA_PEM) — no insecure mode.
 *
 * LTE TLS requires Arduino library "SSLClient" (supports setCACert on Client wrapper).
 * Flash with: TinyGSM + SSLClient + ArduinoHttpClient.
 */

#if USE_LTE
#ifndef TINY_GSM_MODEM_SIM7600
// TinyGSM currently uses the SIM7600 driver for the AT-compatible SIM7670X.
#define TINY_GSM_MODEM_SIM7600
#endif
#include <TinyGsmClient.h>
#include <SSLClient.h>
HardwareSerial SerialAT(1);
TinyGsm modem(SerialAT);
TinyGsmClient gsmClient(modem);
SSLClient lteTlsClient(&gsmClient);
#endif

class NetworkManager {
 public:
  void begin() {
#if USE_LTE
    pinMode(MODEM_PWR, OUTPUT);
    digitalWrite(MODEM_PWR, LOW);
    delay(100);
    SerialAT.begin(115200, SERIAL_8N1, MODEM_RX, MODEM_TX);
    powerOnModem();
    Serial.println("[net] SIM7670X / TinyGSM LTE primary (TLS via SSLClient+CA)");
#endif
    WiFi.mode(WIFI_STA);
  }

  bool ensureConnected() {
#if USE_LTE
    if (lteReady_) {
      lteFailStreak_ = 0;
      activePath_ = Path::Lte;
      return true;
    }
    if (ensureLte()) {
      activePath_ = Path::Lte;
      return true;
    }
#endif
    if (WiFi.status() == WL_CONNECTED) {
      wifiFailStreak_ = 0;
      activePath_ = Path::Wifi;
      return true;
    }
    wifiFailStreak_++;
    unsigned long backoff = backoffMs(wifiFailStreak_);
    if (millis() - lastAttemptMs_ < backoff) return false;
    lastAttemptMs_ = millis();
    Serial.printf("[net] Wi-Fi reconnect attempt %u (backoff %lums)\n", wifiFailStreak_, backoff);
    connectWifi();
    if (WiFi.status() == WL_CONNECTED) {
      activePath_ = Path::Wifi;
      return true;
    }
    activePath_ = Path::None;
    return false;
  }

  /**
   * Begin HTTPS on the active bearer.
   * LTE path uses SSLClient(TinyGsmClient) — never WiFiClientSecure while LTE is active.
   */
  bool beginHttps(NetworkHttpRequest& http, const String& url) {
#if USE_LTE
    if (activePath_ == Path::Lte && lteReady_) {
      lteTlsClient.setCACert(GRIDFLEX_ROOT_CA_PEM);
      Serial.println("[net] HTTPS via LTE modem TLS client");
      return http.begin(lteTlsClient, url);
    }
#endif
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("[net] HTTPS refused — no bearer for TLS");
      return false;
    }
    wifiTls_.setCACert(GRIDFLEX_ROOT_CA_PEM);
    Serial.println("[net] HTTPS via Wi-Fi TLS client");
    return http.begin(wifiTls_, url);
  }

  WiFiClientSecure& tlsClient() {
    wifiTls_.setCACert(GRIDFLEX_ROOT_CA_PEM);
    return wifiTls_;
  }

  const char* activePathName() const {
    switch (activePath_) {
      case Path::Lte: return "lte";
      case Path::Wifi: return "wifi";
      default: return "none";
    }
  }

  bool lteReady() const {
#if USE_LTE
    return lteReady_;
#else
    return false;
#endif
  }

  void markPathUnhealthy() {
#if USE_LTE
    if (activePath_ == Path::Lte) {
      lteReady_ = false;
      Serial.println("[net] LTE marked unhealthy — failover to Wi-Fi");
    }
#endif
    if (activePath_ == Path::Wifi) {
      WiFi.disconnect(true);
      Serial.println("[net] Wi-Fi marked unhealthy — failover to LTE");
    }
    activePath_ = Path::None;
  }

 private:
  enum class Path : uint8_t { None = 0, Wifi = 1, Lte = 2 };
  Path activePath_ = Path::None;
  WiFiClientSecure wifiTls_;
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
      modem.restart();
      lteFailStreak_ = 0;
    }

    Serial.println("[net] LTE modem init / GPRS attach");
    if (!modem.init()) {
      Serial.println("[net] modem.init failed");
      lteReady_ = false;
      return false;
    }
    if (!modem.waitForNetwork(60000L)) {
      Serial.println("[net] waitForNetwork failed");
      lteReady_ = false;
      return false;
    }
    if (!modem.isNetworkConnected()) {
      Serial.println("[net] network not connected");
      lteReady_ = false;
      return false;
    }
    if (!modem.gprsConnect(LTE_APN, LTE_USER, LTE_PASS)) {
      Serial.println("[net] gprsConnect failed");
      lteReady_ = false;
      return false;
    }
    lteReady_ = modem.isGprsConnected();
    Serial.printf("[net] LTE GPRS %s\n", lteReady_ ? "up" : "down");
    return lteReady_;
  }
#endif
};

#endif
