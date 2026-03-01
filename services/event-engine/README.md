# Event Engine

The deterministic safety and system state engine — the most critical service in the platform.

## Responsibilities

- Maintain fuel zone state machine
- Evaluate alarm inputs from SBC telemetry
- Enforce restart rules (require physical reset + authorized action)
- Validate state transitions
- Generate compliance logs
- Notify dashboard of state changes

## Structure

```
event-engine/
├── src/              # Application entry point
├── state-machine/    # Fuel zone state definitions and transitions
├── rules/            # Safety and business rules
│   ├── estop_rule
│   ├── tank_alarm_rule
│   └── restart_authorization_rule
└── tests/            # Unit and integration tests
```

This service must be deterministic and heavily test-covered.
