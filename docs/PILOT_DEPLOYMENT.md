# Pilot deployment

Stay in observe + advise mode.

1. PHYSICAL_COMMAND_EXECUTION_ENABLED=false
2. GridFlex does **not** replace protection relays, PPC safety, or BMS protection
3. Set REDIS_URL for Socket.IO adapter + edge replay protection
4. Keep retention purge off until policy sign-off
5. Deploy migration 20260719210000_pr5_alarms_incidents
