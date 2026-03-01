# Telemetry Service

Handles all inbound data from SBC edge clients.

## Responsibilities

- Accept SBC heartbeats
- Validate payload schema
- Normalize hardware inputs
- Forward events to Event Engine
- Store raw telemetry data
- Accept tank monitor data (Veeder-Root, Incon EVO)
- Reconcile dispensed gallons against tank level changes

Think of this as the "data intake valve" for the platform.

## Structure

```
telemetry-service/
├── src/           # Application entry point
├── ingestion/     # Data intake and parsing
├── validation/    # Schema and integrity validation
└── tests/         # Unit and integration tests
```
