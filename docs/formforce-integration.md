# FormForce Integration

## Overview

The platform integrates with [FormForce](https://www.formforceinc.com/), a cloud-based form management and automation platform, to provide digital safety inspections, compliance documentation, incident reporting, and audit-ready record keeping for ConRAC fueling facilities.

## Why FormForce?

ConRAC fueling operations require strict compliance with safety regulations. FormForce provides:

- **Digital safety inspection forms** — Replace paper-based pre-shift and post-shift fuel island inspections with real-time digital forms
- **Compliance document management** — Centralized storage and version control for regulatory documentation
- **Incident reporting** — Structured forms for recording and tracking safety events
- **Employee certification tracking** — Monitor training, certifications, and qualification records
- **Audit trail** — Tamper-evident, timestamped records for regulatory audits
- **Mobile data collection** — Field teams submit forms from any device

## Architecture

```
[Fuel System Platform]                        [FormForce Cloud]
        |                                            |
        |  ┌─────────────────────────────┐           |
        +──│  FormForce Integration      │──HTTPS──> |
           │  Service                    │<──────────+
           │                             │  Webhooks
           │  - Event sync (outbound)    │
           │  - Form pull (inbound)      │
           │  - Webhook receiver         │
           └─────────────────────────────┘
                       |
                   [Database]
```

The FormForce Integration Service acts as a bridge between the fuel system platform and the FormForce API. It runs as a microservice alongside the existing services and communicates through the API Gateway.

## Data Flow

### Outbound: Platform → FormForce

Safety events and fuel transactions are automatically submitted to FormForce as form entries:

| Platform Event | FormForce Form | Trigger |
|----------------|---------------|---------|
| E-stop activation | Safety Incident Report | Real-time |
| Tank alarm | Tank Alert Report | Real-time |
| Completed fuel transaction | Fuel Transaction Log | After 10s finalization |
| SBC heartbeat failure | Equipment Status Alert | On missed heartbeat |

### Inbound: FormForce → Platform

Inspection results and compliance data flow back into the platform:

| FormForce Form | Platform Action | Delivery |
|----------------|-----------------|----------|
| Pre-shift inspection | Update pump readiness status | Webhook |
| Equipment inspection | Update asset records | Webhook |
| Training completion | Update operator certifications | Periodic sync |
| Compliance checklist | Update site compliance status | Periodic sync |

## Configuration

### Environment Variables

Add the following to your `.env` file (see `.env.example`):

```env
# FormForce Integration
FORMFORCE_API_URL=https://api.formforceinc.com
FORMFORCE_API_KEY=your-api-key
FORMFORCE_ORG_ID=your-org-id
FORMFORCE_SYNC_INTERVAL=300
FORMFORCE_WEBHOOK_SECRET=your-webhook-secret
```

| Variable | Required | Description |
|----------|----------|-------------|
| `FORMFORCE_API_URL` | Yes | Base URL for the FormForce API |
| `FORMFORCE_API_KEY` | Yes | API key provided by FormForce for authentication |
| `FORMFORCE_ORG_ID` | Yes | Your organization ID within FormForce |
| `FORMFORCE_SYNC_INTERVAL` | No | Seconds between periodic sync cycles (default: 300) |
| `FORMFORCE_WEBHOOK_SECRET` | Yes | Shared secret for verifying webhook signatures |

### FormForce Account Setup

1. Log in to your FormForce account at [formforceinc.com](https://www.formforceinc.com/)
2. Navigate to **Settings → API Keys** and generate an API key
3. Note your **Organization ID** from the account settings
4. Configure webhook endpoints:
   - URL: `https://<your-server>/api/formforce/webhook`
   - Events: Form submissions, document updates
   - Secret: Set a strong shared secret and add it to `FORMFORCE_WEBHOOK_SECRET`

## API Endpoints

All FormForce endpoints are exposed through the API Gateway under `/api/formforce/` and require JWT authentication.

### POST `/api/formforce/webhook`

Receives webhook notifications from FormForce when forms are submitted or documents are updated.

**Headers:**
```
X-FormForce-Signature: <HMAC-SHA256 signature>
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

### GET `/api/formforce/forms`

List available FormForce forms configured for the current site.

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

### GET `/api/formforce/submissions`

Query form submissions with filtering and pagination.

**Query Parameters:** `site_id`, `form_id`, `from`, `to`, `submitted_by`, `page`, `per_page`

### POST `/api/formforce/sync`

Trigger an immediate sync cycle with FormForce (requires Supervisor or Admin role).

**Response:**
```json
{
  "status": "sync_started",
  "last_sync": "2026-03-01T05:55:00Z",
  "pending_outbound": 3,
  "pending_inbound": 1
}
```

### GET `/api/formforce/status`

Check FormForce integration health and sync status.

**Response:**
```json
{
  "connected": true,
  "last_sync": "2026-03-01T05:55:00Z",
  "next_sync": "2026-03-01T06:00:00Z",
  "outbound_queue": 0,
  "inbound_queue": 0,
  "api_status": "healthy"
}
```

## Security

- All communication with FormForce uses TLS 1.2+
- API key is stored as an environment variable, never in source code
- Webhook payloads are verified using HMAC-SHA256 signatures
- FormForce endpoints require JWT authentication through the API Gateway
- Site isolation is enforced — users can only access FormForce data for their assigned sites
- Sensitive form data is encrypted at rest in the platform database
