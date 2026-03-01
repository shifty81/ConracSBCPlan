# FormForce Integration Service

## Purpose

The FormForce Integration Service connects the Fuel System Monitoring & Control Platform with the [FormForce](https://www.formforceinc.com/) cloud-based form management platform. This integration enables digital safety inspections, compliance documentation, incident reporting, and audit-ready record keeping for ConRAC fueling facilities.

## Responsibilities

- **Sync fuel system events** (E-stop activations, tank alarms, transactions) to FormForce as form submissions
- **Retrieve inspection forms** (pre-shift checklists, equipment inspections) from FormForce and surface them in the dashboard
- **Push compliance records** (safety audits, training certifications) to FormForce for centralized document management
- **Webhook receiver** for real-time FormForce form submission notifications
- **Bi-directional data mapping** between fuel system schemas and FormForce form fields

## Integration Points

| Direction | Data | Trigger |
|-----------|------|---------|
| Platform → FormForce | Safety events (E-stop, alarms) | Real-time on event |
| Platform → FormForce | Completed fuel transactions | After transaction finalization |
| FormForce → Platform | Inspection form submissions | Webhook notification |
| FormForce → Platform | Compliance document updates | Periodic sync (configurable) |

## Configuration

Set the following environment variables (see `.env.example`):

| Variable | Description |
|----------|-------------|
| `FORMFORCE_API_URL` | FormForce API base URL |
| `FORMFORCE_API_KEY` | API key for FormForce authentication |
| `FORMFORCE_ORG_ID` | Your FormForce organization identifier |
| `FORMFORCE_SYNC_INTERVAL` | Sync interval in seconds (default: 300) |
| `FORMFORCE_WEBHOOK_SECRET` | Shared secret for webhook signature verification |

## Directory Structure

```
formforce-service/
├── src/          # Service entry point and configuration
├── sync/         # Bi-directional sync logic (push events, pull forms)
└── tests/        # Integration and unit tests
```

## API Endpoints

Exposed through the API Gateway under `/api/formforce/`:

- `POST /api/formforce/webhook` — Receive FormForce webhook notifications
- `GET  /api/formforce/forms` — List available FormForce forms for this site
- `GET  /api/formforce/submissions` — Query form submissions (inspections, reports)
- `POST /api/formforce/sync` — Trigger a manual sync with FormForce
- `GET  /api/formforce/status` — Check FormForce integration health and sync status
