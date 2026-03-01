# Deployment Service

Remote SBC lifecycle management service.

## Responsibilities

- Push software updates to SBCs
- Version tracking per device
- Rollback capability on update failure
- Site-based configuration provisioning
- SBC image management

Critical for scaling after beta deployment.

## Structure

```
deployment-service/
├── src/              # Application entry point
├── update-manager/   # Update packaging, distribution, and rollback
└── tests/            # Unit and integration tests
```
