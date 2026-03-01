# Auth Service

Identity and authorization authority for the Fuel System Platform.

## Responsibilities

- User login and session management
- Role-based access control (RBAC)
- Site segmentation (users assigned to specific sites)
- JWT token issuance and validation
- Audit log of login events

## Roles

| Role | Description |
|------|-------------|
| Operator | Day-to-day fueling operations |
| Supervisor | Site management and reporting |
| Admin | System configuration and user management |
| System Architect | Full platform access |

This service never touches safety logic.

## Structure

```
auth-service/
├── src/           # Application entry point
├── models/        # User, role, site data models
├── token/         # JWT generation and validation
└── tests/         # Unit and integration tests
```
