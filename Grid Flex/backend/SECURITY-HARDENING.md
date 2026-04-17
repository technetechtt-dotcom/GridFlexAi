# GridFlex Backend Security Hardening

## 1) Enable HTTPS

Set these values in `backend/.env`:

```env
HTTPS_ENABLED=true
HTTPS_PORT=4443
HTTPS_CERT_PATH=C:\certs\gridflex-cert.pem
HTTPS_KEY_PATH=C:\certs\gridflex-key.pem
FORCE_HTTPS=true
TRUST_PROXY=true
```

Notes:
- `FORCE_HTTPS=true` redirects all HTTP GET/HEAD requests to HTTPS and rejects insecure non-GET traffic.
- `TRUST_PROXY=true` should be enabled when running behind a reverse proxy / load balancer.

## 2) Restrict admin access

Use a strict admin policy in `.env`:

```env
ADMIN_ALLOWED_EMAILS=admin@gridflex.ai,ops-admin@yourcompany.com
ADMIN_ALLOWED_IPS=203.0.113.5,198.51.100.0/24
ADMIN_REQUIRE_HTTPS=true
ADMIN_MAX_TOKEN_AGE_MINUTES=30
```

Behavior:
- Only emails in `ADMIN_ALLOWED_EMAILS` can access admin routes.
- If `ADMIN_ALLOWED_IPS` is set, requests outside this list are blocked.
- Admin endpoints require HTTPS when `ADMIN_REQUIRE_HTTPS=true`.
- Admin access tokens older than `ADMIN_MAX_TOKEN_AGE_MINUTES` are rejected.

## 3) Apply Windows firewall rules

Run as Administrator:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup-firewall.ps1 -HttpsPort 4443 -AllowedRemoteAddresses "203.0.113.5,198.51.100.0/24"
```

This adds:
- Allow rule for trusted source ranges to HTTPS port.
- Block rule for all other inbound traffic to that port.

## 4) Keep credentials safe

- Do not commit `.env` to git.
- Rotate `JWT_SECRET` and API keys periodically.
- Prefer dedicated service accounts for admin users.
