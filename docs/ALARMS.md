# Alarms and Incidents (PR5)

Tenant-scoped alarm rules, events, acknowledgements, and incident timelines.

## Safety
GridFlex alarm workflows are advisory and do not replace protection relays, PPC safety, or BMS protection.
Email/webhook notifiers are stubs (structured logs only) until pilot approval.

## API
- GET/POST `/api/alarm-rules`
- GET/POST `/api/alarm-events`
- POST `/api/alarm-events/:id/acknowledge`
- POST `/api/alarm-events/:id/resolve`
- GET/POST `/api/incidents`
- POST `/api/incidents/:id/timeline`
