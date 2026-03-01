# Shared Modules

Common contracts, schemas, constants, logging, and utilities shared across NEXUS services.

## Structure

```
shared/
├── schemas/     # Data validation schemas (transaction, heartbeat, alarm, tank, forms, vendor, carwash)
├── constants/   # System-wide constants (roles, event types, alarm codes, system types)
├── logging/     # Structured logging configuration
└── utils/       # Common utility functions
```

## Forms Schemas

The `schemas/forms/` directory includes form-specific schemas for validating data within the NEXUS forms and inspections module:

- **webhook validation** — Validates inbound webhook payloads for form submissions
- **submission validation** — Validates form submission records stored locally
- **sync request validation** — Validates sync trigger requests
