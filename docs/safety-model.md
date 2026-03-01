# Safety Model

## Principles

The system follows a strict safety hierarchy where physical safety devices always override software decisions.

### Safety Hierarchy

1. **Physical safety devices** always have ultimate authority
2. **SBC enforces immediate shutdown** on alarm or E-stop detection
3. **Restart requires explicit authorized action** — no automatic restart
4. **All events are logged centrally** for audit and compliance

### Fail-Safe Behavior

Safety behavior remains fully functional even if:

- Network connection to central server is lost
- Central server is unreachable or down
- Dashboard is unavailable

The SBC operates autonomously for all safety-critical functions.

## Emergency Stop (E-Stop) Integration

- SBC monitors E-stop circuits via GPIO inputs
- On E-stop activation, SBC immediately enforces pump shutdown
- Display shows "PUMP STOPPED — E-STOP ACTIVE"
- Restart requires:
  1. Physical E-stop reset
  2. Authorized user action (RFID + PIN)
  3. Server acknowledgment (when online)

## Tank Alarm Monitoring

- Tank monitor alarms (overfill, leak detection, low level) are the primary interface for safety subsystem activation
- Alarms propagate to dependent systems including E-stop and interlock logic
- SBC monitors tank alarm outputs and enforces corresponding shutdown conditions

## Authorization & Safety Logic Flow

```
[RFID / PIN Input]
       |
       v
[Credential Validation]
       |
       v
[Check Safety State] --> IF E-Stop Active or Alarm --> DENY + Display Warning
       |
       v (SAFE)
[Authorize Pump Enable]
       |
       v
[Monitor Transaction]
       |
       v (Complete or Alarm)
[Log & Report]
```

## Ventilation & Fire Alarm Integration (Future)

- Ventilation system monitoring planned for future integration
- Honeywell fire alarm system integration planned (exact specs TBD)
- Server-based control and monitoring for these subsystems
- All subsystems feed into the central event engine for unified alarm management

## Compliance

- No calibration seals are broken during installation
- No PCB modifications to existing dispenser electronics
- Fully reversible installation
- Inspector-friendly documentation maintained
- Tamper detection (enclosure door switch) triggers alert
