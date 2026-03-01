# Forms & Inspections Service

## Purpose

The Forms & Inspections Service is a built-in NEXUS module that provides digital safety inspections, compliance documentation, incident reporting, and audit-ready record keeping for ConRAC facilities.

## Responsibilities

- **Process form submissions** (pre-shift checklists, equipment inspections) and surface them in the dashboard
- **Generate form entries** from platform events (E-stop activations, tank alarms, transactions)
- **Manage compliance records** (safety audits, training certifications) for centralized document management
- **Webhook receiver** for real-time form submission notifications
- **Data mapping** between platform event schemas and form templates

## Integration Points

| Direction | Data | Trigger |
|-----------|------|---------|
| Events → Forms | Safety events (E-stop, alarms) | Real-time on event |
| Events → Forms | Completed fuel transactions | After transaction finalization |
| Submissions → Platform | Inspection form submissions | Webhook notification |
| Submissions → Platform | Compliance document updates | Periodic sync (configurable) |

## Configuration

Set the following environment variables (see `.env.example`):

| Variable | Description |
|----------|-------------|
| `NEXUS_FORMS_WEBHOOK_SECRET` | Shared secret for webhook signature verification |
| `NEXUS_FORMS_SYNC_INTERVAL` | Sync interval in seconds (default: 300) |

## Directory Structure

```
formforce-service/
├── src/          # Service entry point and configuration
├── sync/         # Sync logic (push events, pull forms)
└── tests/        # Integration and unit tests
```

## API Endpoints

Exposed through the API Gateway under `/api/forms/`:

- `POST /api/forms/webhook` — Receive form webhook notifications
- `GET  /api/forms/forms` — List available forms for this site
- `GET  /api/forms/submissions` — Query form submissions (inspections, reports)
- `POST /api/forms/sync` — Trigger a manual sync
- `GET  /api/forms/status` — Check forms service health and sync status
