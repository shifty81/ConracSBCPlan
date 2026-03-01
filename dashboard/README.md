# Dashboard

Web-based dashboard for monitoring and administering the NEXUS Facility Operations Platform.

## Features

- **Real-time site overview** — pump status, alarm states, active transactions
- **Tank level gauges** — visual representation with color-coded alerts (green/yellow/red)
- **Transaction logs** — searchable by pump, user, company, date range
- **RFID card management** — add, remove, block cards from the web interface
- **Reports** — hourly, daily, weekly, monthly, yearly; export to CSV/PDF
- **Alarm monitoring** — E-stop, tank alarms, tamper detection
- **Reconciliation** — dispensed gallons vs. tank level changes
- **Forms & Inspections** — view pre-shift/post-shift inspection results and submit forms
- **Compliance tracking** — track compliance document status and certification records
- **Vendor management** — vendor registration, check-in/out tracking, insurance monitoring
- **Service orders** — create, assign, and track maintenance and repair work orders
- **Car wash monitoring** — cycle history, water/chemical usage, system status
- **Facility systems** — inventory of all tracked facility systems and maintenance schedules

## Layout

- **Top Bar:** Site name, daily fuel total, active alerts
- **Left Panel:** Pump status list (active/idle/offline, current user, gallons)
- **Center:** Tank level gauges with historical usage charts
- **Right Panel:** User and card management
- **Bottom:** Real-time transaction log
- **Forms & Inspections Tab:** Inspection forms, compliance status, submission history
- **Vendor Management Tab:** Vendor list, visit log, service orders
- **Facility Systems Tab:** Car wash status, system inventory, maintenance schedules

## Structure

```
dashboard/
├── frontend/     # Main application entry and pages
├── components/   # Reusable UI components (gauges, tables, charts, forms)
├── auth/         # Login, session management, role-based views
└── services/     # API client, data fetching, WebSocket handlers
```
