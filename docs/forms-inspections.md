# Built-in Forms & Compliance

## Overview

NEXUS includes a built-in forms, inspections, and compliance module that provides digital safety inspections, compliance documentation, incident reporting, and audit-ready record keeping for ConRAC facilities. This is a native platform feature — all form data is managed directly within NEXUS.

## Capabilities

- **Digital safety inspection forms** — Replace paper-based pre-shift and post-shift fuel island inspections with real-time digital forms
- **Compliance document management** — Centralized storage and version control for regulatory documentation
- **Incident reporting** — Structured forms for recording and tracking safety events
- **Employee certification tracking** — Monitor training, certifications, and qualification records
- **Audit trail** — Tamper-evident, timestamped records for regulatory audits
- **Mobile data collection** — Field teams submit forms from any device

## Architecture

```
[NEXUS Platform]
        |
        |  ┌─────────────────────────────┐
        +──│  Forms & Inspections        │
           │  Service                    │
           │                             │
           │  - Form template management │
           │  - Submission processing    │
           │  - Compliance tracking      │
           │  - Webhook receiver         │
           └─────────────────────────────┘
                       |
                   [Database]
```

The Forms & Inspections Service runs as a microservice alongside the existing services and communicates through the API Gateway.

## Data Flow

### Form Submissions

Safety events and fuel transactions automatically generate form entries:

| Platform Event | Form Template | Trigger |
|----------------|---------------|---------|
| E-stop activation | Safety Incident Report | Real-time |
| Tank alarm | Tank Alert Report | Real-time |
| Completed fuel transaction | Fuel Transaction Log | After 10s finalization |
| SBC heartbeat failure | Equipment Status Alert | On missed heartbeat |

### Inspection Results

Inspection results and compliance data are processed within the platform:

| Form Template | Platform Action | Delivery |
|---------------|-----------------|----------|
| Pre-shift inspection | Update pump readiness status | Webhook / direct submit |
| Equipment inspection | Update asset records | Webhook / direct submit |
| Training completion | Update operator certifications | Direct submit |
| Compliance checklist | Update site compliance status | Direct submit |

## Configuration

### Environment Variables

Add the following to your `.env` file (see `.env.example`):

```env
# Forms & Inspections
NEXUS_FORMS_WEBHOOK_SECRET=your-webhook-secret
NEXUS_FORMS_SYNC_INTERVAL=300
```

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXUS_FORMS_WEBHOOK_SECRET` | Yes | Shared secret for verifying webhook signatures |
| `NEXUS_FORMS_SYNC_INTERVAL` | No | Seconds between periodic sync cycles (default: 300) |

## API Endpoints

All forms endpoints are exposed through the API Gateway under `/api/forms/` and require JWT authentication.

### POST `/api/forms/webhook`

Receives webhook notifications when forms are submitted or documents are updated.

**Headers:**
```
X-Nexus-Signature: <HMAC-SHA256 signature>
Content-Type: application/json
```

**Request:**
```json
{
  "event": "form_submitted",
  "form_id": "insp-preshift-001",
  "submission_id": "sub-20260301-042",
  "submitted_by": "operator1",
  "site_id": "NKY-CVG",
  "timestamp": "2026-03-01T06:00:00Z",
  "data": {
    "pump_area_clear": true,
    "spill_kit_present": true,
    "fire_extinguisher_ok": true,
    "notes": "All clear for shift start"
  }
}
```

### GET `/api/forms/forms`

List available forms configured for the current site.

**Query Parameters:** `site_id`, `category` (inspection, incident, compliance)

**Response:**
```json
{
  "forms": [
    {
      "form_id": "insp-preshift-001",
      "name": "Pre-Shift Fuel Island Inspection",
      "category": "inspection",
      "version": "2.1",
      "last_updated": "2026-02-15T10:00:00Z"
    }
  ]
}
```

### GET `/api/forms/submissions`

Query form submissions with filtering and pagination.

**Query Parameters:** `site_id`, `form_id`, `from`, `to`, `submitted_by`, `page`, `per_page`

### POST `/api/forms/sync`

Trigger an immediate sync cycle (requires Supervisor or Admin role).

**Response:**
```json
{
  "status": "sync_started",
  "last_sync": "2026-03-01T05:55:00Z",
  "pending_outbound": 3,
  "pending_inbound": 1
}
```

### GET `/api/forms/status`

Check forms service health and sync status.

**Response:**
```json
{
  "healthy": true,
  "last_sync": "2026-03-01T05:55:00Z",
  "next_sync": "2026-03-01T06:00:00Z",
  "pending_submissions": 0
}
```

## Security

- All communication uses TLS 1.2+
- Webhook payloads are verified using HMAC-SHA256 signatures via `X-Nexus-Signature`
- Forms endpoints require JWT authentication through the API Gateway
- Site isolation is enforced — users can only access form data for their assigned sites
- Sensitive form data is encrypted at rest in the platform database
