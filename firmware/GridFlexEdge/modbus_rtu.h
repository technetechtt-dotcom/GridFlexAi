#ifndef GRIDFLEX_MODBUS_RTU_H
#define GRIDFLEX_MODBUS_RTU_H

#include <Arduino.h>
#include "config.h"

/**
 * RS485 / Modbus RTU FC03 acquisition (read-only).
 * When USE_RS485_MODBUS=0, readHolding fails closed (no randomized substitute).
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
HardwareSerial ModbusSerial(2);
#endif

struct ModbusSample {
  float voltage;
  float current;
  float power;
  bool valid;
  const char* failReason;
};

class ModbusRtuReader {
 public:
  void begin() {
#if USE_RS485_MODBUS
    pinMode(MODBUS_DE_RE, OUTPUT);
    digitalWrite(MODBUS_DE_RE, LOW); // receive
    ModbusSerial.begin(9600, SERIAL_8N1, MODBUS_RX, MODBUS_TX);
    ready_ = true;
    Serial.println("[modbus] RS485 RTU ready (FC03 only)");
#else
    ready_ = false;
    Serial.println("[modbus] RS485 disabled — measurements require USE_RS485_MODBUS=1");
#endif
  }

  bool ready() const { return ready_; }

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
    // Example map: holding regs 0..2 as uint16 scaled (site-specific — replace with SunSpec offsets).
    uint16_t regs[3] = {0, 0, 0};
    if (!readHoldingRegisters(MODBUS_SLAVE_ID, 0, 3, regs)) {
      out.failReason = "fc03_timeout_or_crc";
      return out;
    }
    out.voltage = regs[0] / 10.0f;
    out.current = regs[1] / 100.0f;
    out.power = regs[2] / 10.0f;
    if (out.voltage < 50.0f || out.voltage > 300.0f) {
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
  static uint16_t crc16(const uint8_t* data, size_t len) {
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

  bool readHoldingRegisters(uint8_t slave, uint16_t start, uint16_t qty, uint16_t* out) {
    uint8_t req[8];
    req[0] = slave;
    req[1] = 0x03;
    req[2] = (start >> 8) & 0xff;
    req[3] = start & 0xff;
    req[4] = (qty >> 8) & 0xff;
    req[5] = qty & 0xff;
    uint16_t crc = crc16(req, 6);
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
    if (got < expect) return false;
    if (resp[1] != 0x03) return false;
    uint16_t gotCrc = (uint16_t)resp[got - 2] | ((uint16_t)resp[got - 1] << 8);
    if (gotCrc != crc16(resp, got - 2)) return false;
    for (uint16_t i = 0; i < qty; i++) {
      out[i] = ((uint16_t)resp[3 + i * 2] << 8) | resp[4 + i * 2];
    }
    return true;
  }
#endif
};

#endif
