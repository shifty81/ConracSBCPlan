# Shared Modules

Common contracts, schemas, constants, logging, and utilities shared across services.

## Structure

```
shared/
├── schemas/     # Data validation schemas (transaction, heartbeat, alarm, tank, formforce)
├── constants/   # System-wide constants (roles, event types, alarm codes)
├── logging/     # Structured logging configuration
└── utils/       # Common utility functions
```

## FormForce Schemas

The `schemas/` directory includes FormForce-specific schemas for validating data exchanged between the fuel system platform and the FormForce API:

- **formforce-webhook.schema** — Validates inbound webhook payloads from FormForce
- **formforce-submission.schema** — Validates form submission records stored locally
