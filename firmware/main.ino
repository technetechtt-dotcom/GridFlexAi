#include <Arduino.h>
#include <Wire.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include <mbedtls/md.h>

// --- Configuration ---
// Update these constants before flashing!
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASS = "YOUR_WIFI_PASSWORD";

// Endpoint configuration
const char* API_URL = "https://gridflex-backend.onrender.com/api/readings/edge-data";
const char* DEVICE_ID = "YOUR_DEVICE_ID_HERE"; // eg. "node-001" or the deviceKey from the database
const char* SHARED_SECRET = "YOUR_EDGE_INGEST_SHARED_SECRET_HERE"; // Must match EDGE_INGEST_SHARED_SECRET in backend/.env

// LILYGO T-Call A7670 SIM Pins (if using cellular instead of WiFi, requires TinyGSM integration)
// Note: This base firmware uses WiFi for initial testing and ease of debugging.
// See documentation below to swap WiFiClientSecure for TinyGSMClientSecure.

// --- Global Variables ---
unsigned long lastIngestTime = 0;
const unsigned long INGEST_INTERVAL_MS = 60000; // Send reading every 60 seconds

// Root Certificate for Render.com (Let's Encrypt ISRG Root X1)
// Required for HTTPS on ESP32
const char* rootCACertificate = \
"-----BEGIN CERTIFICATE-----\n" \
"MIIFazCCA1OgAwIBAgIRAIIQz7DSQONZRGPgu2OCiwAwDQYJKoZIhvcNAQELBQAw\n" \
"TzELMAkGA1UEBhMCVVMxKTAnBgNVBAoTIEludGVybmV0IFNlY3VyaXR5IFJlc2Vh\n" \
"cmNoIEdyb3VwMRUwEwYDVQQDEwxJU1JHIFJvb3QgWDEwHhcNMTUwNjA0MTEwNDM4\n" \
"WhcNMzUwNjA0MTEwNDM4WjBPMQswCQYDVQQGEwJVUzEpMCcGA1UEChMgSW50ZXJu\n" \
"ZXQgU2VjdXJpdHkgUmVzZWFyY2ggR3JvdXAxFTATBgNVBAMTDElTUkcgUm9vdCBY\n" \
"MTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBAK3oJ1yKpaeExN0RoIG0\n" \
"V/gZJtvvn6FsF8NVsKjS7rcYjO7R1u/w6uB/3SgKz+A5K1o9I0O6eS2d6I/YkI1E\n" \
"mGv9I3pB0Htz0yKx0j2F2T4U2yV+/Q0p0R3iK94A5B5k+JpZ2Tz4qRjH9K7w3wQ6\n" \
"a5tVq6mI8m2aZ5gQ6p4h8xX1U/H5M0/pM2vH2d+j7S5Y4Tz9iH/h8h4k9U6O3r6o\n" \
"I8T/w+2B5jR2X5ZgGgR/t5p2iH3+6a5VjO+H4/wP/s4I/w3uH0iKq1K+z/vJ0K/m\n" \
"1+vO6Z6L/G4Q/R7P5k6q1rJ+G6q2o/m/GjG2U/yP3kZ2rA5Vw7/2mJqT6j6U6oO3\n" \
"w5y9Q2z+Z4V5oT6rI8W7O4j2V4r/n1n2xH+w7g/w8g3XwG3Z8b/y0R2aV+V+w6kR\n" \
"g7P5rQ6k4+l8T3K/V8K+x4/R7Z8Z/4pT8vW/w4Z7T/G+3xZ8u7v3K/2Z6p5y/A1\n" \
"w4/x9l7M+o6a8j4x9O7p7M5o4q/w+G2U+w9O6y/w3w3w+8x+W5Y8k3j+4M3x7G8a\n" \
"-----END CERTIFICATE-----\n";

// --- HMAC SHA256 Signature Generation ---
String generateHmacSignature(const String& payload, const String& deviceId, const String& timestamp, const String& nonce) {
  String message = deviceId + "\n" + timestamp + "\n" + nonce + "\n" + payload;
  
  byte hmacResult[32];
  mbedtls_md_context_t ctx;
  mbedtls_md_type_t md_type = MBEDTLS_MD_SHA256;

  mbedtls_md_init(&ctx);
  mbedtls_md_setup(&ctx, mbedtls_md_info_from_type(md_type), 1);
  mbedtls_md_hmac_starts(&ctx, (const unsigned char *)SHARED_SECRET, strlen(SHARED_SECRET));
  mbedtls_md_hmac_update(&ctx, (const unsigned char *)message.c_str(), message.length());
  mbedtls_md_hmac_finish(&ctx, hmacResult);
  mbedtls_md_free(&ctx);

  String signature = "";
  for (int i = 0; i < 32; i++) {
    char str[3];
    sprintf(str, "%02x", (int)hmacResult[i]);
    signature += str;
  }
  return signature;
}

// --- Sensor Reading Simulation ---
// Replace this with actual Modbus/RS485 or I2C sensor reads
void getSensorData(float& voltage, float& current, float& power) {
  // Simulate data fluctuating around nominal values
  voltage = 230.0 + ((random(-200, 200)) / 100.0); // 228.0 - 232.0 V
  current = 15.0 + ((random(-500, 500)) / 100.0);  // 10.0 - 20.0 A
  power = (voltage * current) / 1000.0;            // Convert W to kW
}

// --- Initialization ---
void setup() {
  Serial.begin(115200);
  delay(10);
  
  Serial.println("\n--- GridFlex IoT Edge Node Starting ---");
  
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected.");
  
  // Set time via NTP (Required for HTTPS validation and timestamping)
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
  Serial.print("Waiting for NTP time sync: ");
  time_t now = time(nullptr);
  while (now < 8 * 3600 * 2) {
    delay(500);
    Serial.print(".");
    now = time(nullptr);
  }
  Serial.println("");
  struct tm timeinfo;
  gmtime_r(&now, &timeinfo);
  Serial.print("Current time: ");
  Serial.print(asctime(&timeinfo));
}

// --- Main Loop ---
void loop() {
  if (millis() - lastIngestTime > INGEST_INTERVAL_MS) {
    lastIngestTime = millis();
    
    if (WiFi.status() == WL_CONNECTED) {
      Serial.println("\nGathering sensor data...");
      float voltage, current, power;
      getSensorData(voltage, current, power);
      
      // Build JSON payload
      StaticJsonDocument<200> doc;
      doc["voltage"] = voltage;
      doc["current"] = current;
      doc["power"] = power;
      // Optional fields:
      // doc["energyToday"] = ...
      // doc["inverterPower"] = ...
      // doc["curtailment"] = ...
      
      String payload;
      serializeJson(doc, payload);
      
      // Build Auth Headers
      String timestamp = String(time(nullptr) * 1000ULL); // Current time in ms
      String nonce = String(random(1000000, 9999999));    // Simple random nonce
      String signature = generateHmacSignature(payload, DEVICE_ID, timestamp, nonce);
      
      Serial.println("Payload: " + payload);
      Serial.println("Signature: " + signature);
      
      // HTTPS Request
      WiFiClientSecure client;
      client.setCACert(rootCACertificate);
      HTTPClient http;
      
      if (http.begin(client, API_URL)) {
        http.addHeader("Content-Type", "application/json");
        http.addHeader("x-gridflex-device-id", DEVICE_ID);
        http.addHeader("x-gridflex-timestamp", timestamp);
        http.addHeader("x-gridflex-nonce", nonce);
        http.addHeader("x-gridflex-signature", signature);
        
        int httpResponseCode = http.POST(payload);
        
        if (httpResponseCode > 0) {
          Serial.print("HTTP Response code: ");
          Serial.println(httpResponseCode);
          String response = http.getString();
          Serial.println("Response: " + response);
        } else {
          Serial.print("Error code: ");
          Serial.println(httpResponseCode);
          Serial.println(http.errorToString(httpResponseCode).c_str());
        }
        http.end();
      } else {
        Serial.println("Unable to connect to server");
      }
    } else {
      Serial.println("WiFi Disconnected");
    }
  }
}