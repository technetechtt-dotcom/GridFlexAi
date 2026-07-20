# GRIDFLEX-V1 HMAC test vector

Device secret: 32 zero bytes  
Base64URL secret (provisioning one-shot form): `AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`

Raw HTTP body (exact UTF-8 bytes — do **not** re-serialize):

```json
{"current":11.2,"nodeId":"esp32-node-1","power":7.16,"voltage":640}
```

Body SHA-256 (hex):

```
31653ac80c63186286fb2c2df0e153fb025411171e5d861174cf6fe1d90c87d5
```

Canonical message (`\n` separators, UTF-8):

```
GRIDFLEX-V1
esp32-node-1
cred_testvector01
1
1713187200000
abc123nonce
42
31653ac80c63186286fb2c2df0e153fb025411171e5d861174cf6fe1d90c87d5
```

HMAC-SHA256(deviceSecret, canonical) as **base64url**:

```
KjRhh4nKNGxQKSA23ezOUrC83LMmB7GX-NeC3mu8rh4
```

Headers:

| Header | Value |
|--------|-------|
| `x-gridflex-device-id` | `esp32-node-1` |
| `x-gridflex-credential-id` | `cred_testvector01` |
| `x-gridflex-key-version` | `1` |
| `x-gridflex-timestamp` | `1713187200000` |
| `x-gridflex-nonce` | `abc123nonce` |
| `x-gridflex-sequence-number` | `42` |
| `x-gridflex-signature` | `KjRhh4nKNGxQKSA23ezOUrC83LMmB7GX-NeC3mu8rh4` |

## Legacy vector (shared secret only)

Still used when `EDGE_ALLOW_LEGACY_SHARED_SECRET=true`:

Message: `esp32-node-1.1713187200000.abc123nonce.{"current":11.2,"nodeId":"esp32-node-1","power":7.16,"voltage":640}`  
Secret: `test-edge-shared-secret-123`  
HMAC hex: `f09bff4fc8f1894f56e24d01a88ea7947646ff6d3f3cb499e04fa7d33d7715a9`
