# API Specification

## Overview

All communication between SBC clients, the dashboard, and backend services passes through the API Gateway. The API uses JSON over HTTPS with JWT-based authentication.

## Authentication

### POST `/api/auth/login`

Authenticate a user and receive a JWT token.

**Request:**
```json
{
  "username": "operator1",
  "password": "***",
  "site_id": "NKY-CVG"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expires_in": 3600,
  "role": "operator",
  "site_id": "NKY-CVG"
}
```

## SBC Endpoints

### POST `/api/telemetry/heartbeat`

SBC sends periodic heartbeat with status.

**Request:**
```json
{
  "sbc_id": "sbc-pump-01",
  "site_id": "NKY-CVG",
  "timestamp": "2026-02-21T15:43:00Z",
  "status": "OK",
  "pump_state": "idle",
  "estop_active": false,
  "tank_alarm": false
}
```

### POST `/api/telemetry/transaction`

SBC pushes completed transaction data (after 10-second delay).

**Request:**
```json
{
  "sbc_id": "sbc-pump-01",
  "site_id": "NKY-CVG",
  "transaction_id": "txn-20260221-001",
  "user_rfid": "A1B2C3D4",
  "pump_id": "pump-01",
  "start_time": "2026-02-21T15:30:00Z",
  "end_time": "2026-02-21T15:35:22Z",
  "gallons": 42.50,
  "vehicle_plate": "ABC1234",
  "company_id": "fleet-ops"
}
```

### POST `/api/telemetry/event`

SBC reports safety or operational events.

**Request:**
```json
{
  "sbc_id": "sbc-pump-01",
  "site_id": "NKY-CVG",
  "timestamp": "2026-02-21T15:43:00Z",
  "event_type": "ESTOP_ACTIVATED",
  "details": {
    "source": "gpio_pin_4",
    "state": "active"
  }
}
```

## Tank Monitoring Endpoints

### POST `/api/tanks/status`

Tank monitor pushes level data (via cellular or Ethernet).

**Request:**
```json
{
  "device_id": "tank-01",
  "site_id": "NKY-CVG",
  "timestamp": "2026-02-21T15:43:00Z",
  "level_gallons": 4560.5,
  "capacity_gallons": 10000,
  "temperature_f": 72.4,
  "status": "OK",
  "alerts": []
}
```

## Dashboard Endpoints

### GET `/api/dashboard/overview`

Returns current site status for dashboard rendering.

### GET `/api/dashboard/transactions`

Query parameters: `site_id`, `from`, `to`, `pump_id`, `user_rfid`, `page`, `per_page`

### GET `/api/dashboard/tanks`

Returns current tank levels and historical data.

### GET `/api/dashboard/alarms`

Returns active and historical alarm events.

## Deployment Endpoints

### POST `/api/deploy/push`

Push a software update to one or more SBCs.

### GET `/api/deploy/status`

Check update status for SBCs.

## FormForce Integration Endpoints

### POST `/api/formforce/webhook`

Receive webhook notifications from FormForce when forms are submitted or documents are updated.

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

List available FormForce forms for the current site.

Query parameters: `site_id`, `category`

### GET `/api/formforce/submissions`

Query form submissions with filtering and pagination.

Query parameters: `site_id`, `form_id`, `from`, `to`, `submitted_by`, `page`, `per_page`

### POST `/api/formforce/sync`

Trigger a manual sync with FormForce (requires Supervisor or Admin role).

### GET `/api/formforce/status`

Check FormForce integration health and sync status.

See [docs/formforce-integration.md](formforce-integration.md) for the full FormForce API specification.

## Security

- All endpoints require valid JWT in `Authorization: Bearer <token>` header
- SBC endpoints additionally require a per-device API key
- FormForce webhook payloads are verified using HMAC-SHA256 signatures
- All communication over TLS 1.2+
- Rate limiting enforced at API Gateway
- Site isolation: users can only access data for their assigned site(s)
