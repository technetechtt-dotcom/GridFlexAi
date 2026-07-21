#ifndef GRIDFLEX_MODBUS_RTU_H
#define GRIDFLEX_MODBUS_RTU_H

#include <Arduino.h>
#include <math.h>
#include "config.h"
#include "sunspec_model103_map.h"

/**
 * RS485 / Modbus RTU FC03 acquisition against verified SunSpec Model 103 map.
 * When USE_RS485_MODBUS=0, fails closed (no randomized substitute).
 */

#if USE_RS485_MODBUS
#include <HardwareSerial.h>
#ifndef MODBUS_RX
#define MODBUS_RX 16
#endif
#ifndef MODBUS_TX
#define MODBUS_TX 17
#endif
#ifndef MODBUS_DE_RE
#define MODBUS_DE_RE 4
#endif
#if USE_LTE && MODBUS_DE_RE == MODEM_PWR
#error "MODBUS_DE_RE conflicts with MODEM_PWR; assign a board-specific RS485 direction pin."
#endif
HardwareSerial ModbusSerial(2);
#endif

struct ModbusSample {
  float voltage;
  float current;
  float power;
  float frequencyHz;
  float lifetimeEnergyKwh;
  bool valid;
  const char* failReason;
};

class ModbusRtuReader {
 public:
  void begin() {
#if USE_RS485_MODBUS
    pinMode(MODBUS_DE_RE, OUTPUT);
    digitalWrite(MODBUS_DE_RE, LOW);
    ModbusSerial.begin(9600, SERIAL_8N1, MODBUS_RX, MODBUS_TX);
    ready_ = true;
    Serial.printf("[modbus] RS485 RTU SunSpec103 base=%u (FC03 only)\n",
                  (unsigned)SUNSPEC_MODEL103_BASE);
#else
    ready_ = false;
    Serial.println("[modbus] RS485 disabled — set USE_RS485_MODBUS=1");
#endif
  }

  bool ready() const { return ready_; }

  /** Host/CI helpers — exposed for unit tests via identical algorithm in backend. */
  static uint16_t crc16Modbus(const uint8_t* data, size_t len) {
    uint16_t crc = 0xffff;
    for (size_t i = 0; i < len; i++) {
      crc ^= data[i];
      for (uint8_t b = 0; b < 8; b++) {
        if (crc & 1) crc = (crc >> 1) ^ 0xa001;
        else crc >>= 1;
      }
    }
    return crc;
  }

  ModbusSample readInverterSample() {
    ModbusSample out{};
    out.valid = false;
    out.failReason = "not_configured";
#if !USE_RS485_MODBUS
    out.failReason = "rs485_disabled";
    return out;
#else
    if (!ready_) {
      out.failReason = "not_ready";
      return out;
    }

    using namespace SunSpec103;
    // Batch read W + W_SF (offsets 16..17) and PPV_AB + need V_SF, A, A_SF in separate reads.
    uint16_t wRegs[2] = {0, 0};
    if (!readHoldingRegisters(MODBUS_SLAVE_ID, addr(O_W), 2, wRegs)) {
      out.failReason = "fc03_timeout_or_crc";
      return out;
    }
    int16_t wRaw = asInt16(wRegs[0]);
    int16_t wSf = asInt16(wRegs[1]);
    if (isUnavailableI16(wRaw) || isUnavailableI16(wSf)) {
      out.failReason = "sunspec_sentinel";
      return out;
    }
    float powerW = applySunSsf((float)wRaw, wSf);
    if (!isfinite(powerW)) {
      out.failReason = "invalid_sf";
      return out;
    }

    uint16_t vRegs[1] = {0};
    uint16_t vSfRegs[1] = {0};
    if (!readHoldingRegisters(MODBUS_SLAVE_ID, addr(O_PPV_AB), 1, vRegs) ||
        !readHoldingRegisters(MODBUS_SLAVE_ID, addr(O_V_SF), 1, vSfRegs)) {
      out.failReason = "fc03_timeout_or_crc";
      return out;
    }
    if (isUnavailableU16(vRegs[0]) || isUnavailableI16(asInt16(vSfRegs[0]))) {
      out.failReason = "sunspec_sentinel";
      return out;
    }
    float voltage = applySunSsf((float)vRegs[0], asInt16(vSfRegs[0]));

    uint16_t aRegs[1] = {0};
    uint16_t aSfRegs[1] = {0};
    if (!readHoldingRegisters(MODBUS_SLAVE_ID, addr(O_A), 1, aRegs) ||
        !readHoldingRegisters(MODBUS_SLAVE_ID, addr(O_A_SF), 1, aSfRegs)) {
      out.failReason = "fc03_timeout_or_crc";
      return out;
    }
    if (isUnavailableU16(aRegs[0]) || isUnavailableI16(asInt16(aSfRegs[0]))) {
      out.failReason = "sunspec_sentinel";
      return out;
    }
    float current = applySunSsf((float)aRegs[0], asInt16(aSfRegs[0]));

    uint16_t hzRegs[2] = {0, 0};
    if (!readHoldingRegisters(MODBUS_SLAVE_ID, addr(O_HZ), 2, hzRegs)) {
      out.failReason = "fc03_timeout_or_crc";
      return out;
    }
    float frequency = NAN;
    if (!isUnavailableU16(hzRegs[0]) && !isUnavailableI16(asInt16(hzRegs[1]))) {
      frequency = applySunSsf((float)hzRegs[0], asInt16(hzRegs[1]));
    }

    out.voltage = voltage;
    out.current = current;
    out.power = powerW / 1000.0f; // W → kW (matches backend map scale 0.001 after sunssf)
    out.frequencyHz = frequency;
    out.lifetimeEnergyKwh = NAN; // lifetime WH requires 32-bit read; optional separately
    if (!isfinite(out.voltage) || out.voltage < 50.0f || out.voltage > 300.0f) {
      out.failReason = "voltage_oor";
      return out;
    }
    out.valid = true;
    out.failReason = nullptr;
    return out;
#endif
  }

 private:
  bool ready_ = false;

#if USE_RS485_MODBUS
  bool readHoldingRegisters(uint8_t slave, uint16_t start, uint16_t qty, uint16_t* out) {
    if (qty == 0 || qty > 16) return false;
    uint8_t req[8];
    req[0] = slave;
    req[1] = 0x03;
    req[2] = (start >> 8) & 0xff;
    req[3] = start & 0xff;
    req[4] = (qty >> 8) & 0xff;
    req[5] = qty & 0xff;
    uint16_t crc = crc16Modbus(req, 6);
    req[6] = crc & 0xff;
    req[7] = (crc >> 8) & 0xff;

    digitalWrite(MODBUS_DE_RE, HIGH);
    delayMicroseconds(100);
    ModbusSerial.write(req, sizeof(req));
    ModbusSerial.flush();
    digitalWrite(MODBUS_DE_RE, LOW);

    const size_t expect = 5 + qty * 2;
    uint8_t resp[64];
    if (expect > sizeof(resp)) return false;
    size_t got = 0;
    unsigned long startMs = millis();
    while (got < expect && millis() - startMs < 500) {
      if (ModbusSerial.available()) {
        resp[got++] = (uint8_t)ModbusSerial.read();
      }
    }
    if (got != expect) return false;
    if (resp[0] != slave) return false;
    if (resp[1] != 0x03) return false;
    if (resp[2] != qty * 2) return false; // malformed length
    uint16_t gotCrc = (uint16_t)resp[got - 2] | ((uint16_t)resp[got - 1] << 8);
    if (gotCrc != crc16Modbus(resp, got - 2)) return false;
    for (uint16_t i = 0; i < qty; i++) {
      out[i] = ((uint16_t)resp[3 + i * 2] << 8) | resp[4 + i * 2];
    }
    return true;
  }
#endif
};

#endif
