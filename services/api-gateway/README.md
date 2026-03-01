# API Gateway

Single entry point for all external communication with the Fuel System Platform.

## Responsibilities

- Route traffic to internal services
- Enforce rate limiting
- Validate JWT tokens
- Site isolation enforcement
- TLS termination

No business logic lives here.

## Structure

```
api-gateway/
├── src/           # Application entry point
├── routes/        # Route definitions
├── middleware/     # Auth, rate-limit, logging middleware
└── tests/         # Unit and integration tests
```
