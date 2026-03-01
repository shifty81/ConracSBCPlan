# API Specification — NEXUS Facility Operations Platform

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

## Forms & Inspections Endpoints

### POST `/api/forms/webhook`

Receive webhook notifications when forms are submitted or documents are updated.

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

Query parameters: `site_id`, `category` (inspection, incident, compliance)

### GET `/api/forms/submissions`

Query form submissions with filtering and pagination.

Query parameters: `site_id`, `form_id`, `from`, `to`, `submitted_by`, `page`, `per_page`

### POST `/api/forms/sync`

Trigger a manual form data sync (requires Supervisor or Admin role).

### GET `/api/forms/status`

Check forms service health and sync status.

## Vendor Management Endpoints

### GET `/api/vendors`

List registered vendors for a site.

Query parameters: `site_id`, `trade_type`, `active`, `page`, `per_page`

### POST `/api/vendors`

Register a new vendor.

**Request:**
```json
{
  "vendor_id": "vendor-001",
  "company_name": "ACME Maintenance",
  "contact_name": "Jane Smith",
  "contact_phone": "555-0100",
  "contact_email": "jane@acme.com",
  "trade_type": "plumbing",
  "insurance_expiry": "2027-06-15",
  "site_id": "NKY-CVG"
}
```

### POST `/api/vendors/checkin`

Record a vendor check-in.

**Request:**
```json
{
  "vendor_id": "vendor-001",
  "site_id": "NKY-CVG",
  "purpose": "Scheduled pump maintenance",
  "work_area": "Fuel Island 3",
  "badge_number": "V-1042",
  "vehicle_plate": "XYZ789",
  "escorted_by": "operator1"
}
```

### POST `/api/vendors/checkout`

Record a vendor check-out.

**Request:**
```json
{
  "visit_id": 42,
  "notes": "Work completed, all systems nominal"
}
```

### GET `/api/vendors/visits`

Query vendor visit history.

Query parameters: `site_id`, `vendor_id`, `from`, `to`, `page`, `per_page`

### POST `/api/vendors/service-orders`

Create a new service order.

### GET `/api/vendors/service-orders`

List service orders with filtering.

Query parameters: `site_id`, `vendor_id`, `system_type`, `status`, `priority`, `page`, `per_page`

### PATCH `/api/vendors/service-orders/:id`

Update a service order (status, completion, billing).

## Car Wash Monitoring Endpoints

### POST `/api/telemetry/carwash/cycle`

Record a car wash cycle.

**Request:**
```json
{
  "system_id": "carwash-01",
  "site_id": "NKY-CVG",
  "cycle_type": "full",
  "start_time": "2026-03-01T10:00:00Z",
  "end_time": "2026-03-01T10:08:30Z",
  "vehicle_plate": "ABC1234",
  "company_id": "fleet-ops",
  "water_gallons": 45.2,
  "chemical_gallons": 1.5,
  "status": "completed",
  "alerts": []
}
```

### GET `/api/telemetry/carwash/cycles`

Query car wash cycle history.

Query parameters: `site_id`, `system_id`, `from`, `to`, `cycle_type`, `page`, `per_page`

### GET `/api/telemetry/carwash/status`

Get current car wash system status.

## Facility Systems Endpoints

### GET `/api/facility/systems`

List all tracked facility systems.

Query parameters: `site_id`, `system_type`, `status`, `page`, `per_page`

### POST `/api/facility/systems`

Register a new facility system.

### PATCH `/api/facility/systems/:id`

Update a facility system record.

## Workforce Management Endpoints

### POST `/api/workforce/timeclock/clock-in`

Clock in an employee.

**Request:**
```json
{
  "employee_id": "emp-001",
  "site_id": "NKY-CVG",
  "work_category": "fuel_system",
  "notes": "Starting morning pump inspection round"
}
```

### POST `/api/workforce/timeclock/clock-out`

Clock out an employee.

**Request:**
```json
{
  "employee_id": "emp-001"
}
```

### GET `/api/workforce/timeclock/status/:employee_id`

Get current clock-in status for an employee.

### GET `/api/workforce/timeclock/entries`

Query time entries with filtering.

Query parameters: `site_id`, `employee_id`, `from`, `to`, `work_category`, `page`, `per_page`

### POST `/api/workforce/tasks`

Create a new task/work order.

**Request:**
```json
{
  "site_id": "NKY-CVG",
  "system_type": "fuel_system",
  "title": "Replace fuel line sensor on Pump 5",
  "description": "Sensor reporting intermittent readings",
  "priority": "high",
  "assigned_to": "emp-001"
}
```

### GET `/api/workforce/tasks`

List tasks with filtering.

Query parameters: `site_id`, `status`, `priority`, `assigned_to`, `system_type`, `page`, `per_page`

### GET `/api/workforce/tasks/:id`

Get task details.

### PUT `/api/workforce/tasks/:id`

Update a task (status, assignment, notes).

### POST `/api/workforce/tasks/:id/complete`

Quick-complete a task with optional resolution notes and labor hours.

### GET `/api/workforce/training/modules`

List available training/certification modules.

### GET `/api/workforce/training/status/:employee_id`

Get training compliance status for an employee (completed, expired, upcoming).

### POST `/api/workforce/training/complete`

Record a training completion.

**Request:**
```json
{
  "employee_id": "emp-001",
  "module_id": 1,
  "digital_signature_hash": "sha256-abc123..."
}
```

### GET `/api/workforce/training/expired`

List all employees with expired mandatory certifications.

### GET `/api/workforce/payroll/summary`

Payroll summary by employee, date range, and work category.

Query parameters: `site_id`, `employee_id`, `from`, `to`, `work_category`

### GET `/api/workforce/payroll/export`

Export payroll data as CSV.

Query parameters: `site_id`, `from`, `to`

See [forms-inspections.md](forms-inspections.md) for the full forms and inspections specification.
See [formforce-integration.md](formforce-integration.md) for optional FormForce cloud integration.

## Security

- All endpoints require valid JWT in `Authorization: Bearer <token>` header
- SBC endpoints additionally require a per-device API key
- Form webhook payloads are verified using HMAC-SHA256 signatures via `X-Nexus-Signature`
- All communication over TLS 1.2+
- Rate limiting enforced at API Gateway
- Site isolation: users can only access data for their assigned site(s)
