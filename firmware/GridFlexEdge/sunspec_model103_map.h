#ifndef GRIDFLEX_SUNSPEC_MODEL103_MAP_H
#define GRIDFLEX_SUNSPEC_MODEL103_MAP_H

#include <Arduino.h>
#include "config.h"

/**
 * Verified read-only SunSpec Model 103 map (aligned with
 * backend/src/gateway/maps/vendor/sunspec/model103/1.0.ts).
 * Addresses are zero-based holding registers relative to model ID base.
 * Set SUNSPEC_MODEL103_BASE in config.h from discovery (default 40069).
 */

#ifndef SUNSPEC_MODEL103_BASE
#define SUNSPEC_MODEL103_BASE 40069
#endif

namespace SunSpec103 {
  // Offsets from model ID register (SunSpec Alliance Model 103).
  constexpr uint16_t O_A = 2;
  constexpr uint16_t O_A_SF = 6;
  constexpr uint16_t O_PPV_AB = 7;
  constexpr uint16_t O_V_SF = 13;
  constexpr uint16_t O_HZ = 14;
  constexpr uint16_t O_HZ_SF = 15;
  constexpr uint16_t O_W = 16;
  constexpr uint16_t O_W_SF = 17;
  constexpr uint16_t O_WH = 24;
  constexpr uint16_t O_WH_SF = 26;
  constexpr uint16_t O_ST = 38;

  constexpr uint16_t UNAVAILABLE_U16 = 0xffff;
  constexpr int16_t UNAVAILABLE_I16 = -32768;

  inline uint16_t addr(uint16_t offset) {
    return (uint16_t)(SUNSPEC_MODEL103_BASE + offset);
  }

  inline int16_t asInt16(uint16_t w) {
    return (w >= 0x8000) ? (int16_t)(w - 0x10000) : (int16_t)w;
  }

  inline bool isUnavailableU16(uint16_t w) { return w == UNAVAILABLE_U16; }
  inline bool isUnavailableI16(int16_t v) { return v == UNAVAILABLE_I16; }

  /** Apply SunSpec sunssf: engineering = raw * 10^sf */
  inline float applySunSsf(float raw, int16_t sf) {
    if (sf < -10 || sf > 10) return NAN;
    float scale = 1.0f;
    if (sf >= 0) {
      for (int i = 0; i < sf; i++) scale *= 10.0f;
      return raw * scale;
    }
    for (int i = 0; i < -sf; i++) scale *= 10.0f;
    return raw / scale;
  }
}

#endif
