# GridFlex Edge HMAC Test Vector

Use this fixed vector to validate firmware-side HMAC implementations.

- `sharedSecret`: `test-edge-shared-secret-123`
- `deviceId`: `esp32-node-1`
- `timestamp`: `1713187200000`
- `nonce`: `abc123nonce`
- `canonicalPayload`:
  - `{"current":11.2,"nodeId":"esp32-node-1","power":7.16,"voltage":640}`
- `messageToSign`:
  - `esp32-node-1.1713187200000.abc123nonce.{"current":11.2,"nodeId":"esp32-node-1","power":7.16,"voltage":640}`
- `expectedSignatureHex`:
  - `f09bff4fc8f1894f56e24d01a88ea7947646ff6d3f3cb499e04fa7d33d7715a9`

## Verification one-liner (Node.js)

```bash
node -e "const crypto=require('crypto');const secret='test-edge-shared-secret-123';const msg='esp32-node-1.1713187200000.abc123nonce.{\"current\":11.2,\"nodeId\":\"esp32-node-1\",\"power\":7.16,\"voltage\":640}';console.log(crypto.createHmac('sha256',secret).update(msg).digest('hex'));"
```

Expected output:

```text
f09bff4fc8f1894f56e24d01a88ea7947646ff6d3f3cb499e04fa7d33d7715a9
```
