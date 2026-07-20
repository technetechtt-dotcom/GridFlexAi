#ifndef GRIDFLEX_ED25519_VERIFY_H
#define GRIDFLEX_ED25519_VERIFY_H

#include <stddef.h>
#include <stdint.h>

// Returns true if Ed25519 detached signature verifies.
// publicKey32: 32-byte raw public key (not PEM)
// signature64: 64-byte signature
// message/messageLen: message bytes
bool ed25519VerifyDetached(const uint8_t publicKey32[32],
                           const uint8_t signature64[64],
                           const uint8_t* message,
                           size_t messageLen);

// Extract raw 32-byte key from Ed25519 SPKI PEM.
bool ed25519ParseSpkiPem(const char* pem, uint8_t out32[32]);

// Decode base64url (RFC 4648 §5) into out; sets *outLen on success.
bool ed25519DecodeBase64Url(const char* in,
                            uint8_t* out,
                            size_t outMax,
                            size_t* outLen);

#endif
