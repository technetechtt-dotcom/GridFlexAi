# Alarms and incidents

Tenant-scoped alarm centre models: AlarmRule, AlarmEvent, AlarmAcknowledgement, Incident, IncidentTimeline.

GridFlex alarms are **advisory** and do **not** replace protection relays, PPC safety, or BMS protection.

## API
- GET/POST /api/alarm-rules
- GET/POST /api/alarm-events
- POST /api/alarm-events/:alarmEventId/acknowledge
- GET/POST /api/incidents
- POST /api/incidents/:incidentId/timeline

## UI
Ops Centre → Alarms (/ops/alarms).
