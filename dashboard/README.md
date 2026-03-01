# Dashboard

Web-based dashboard for monitoring and administering the Fuel System Platform.

## Features

- **Real-time site overview** — pump status, alarm states, active transactions
- **Tank level gauges** — visual representation with color-coded alerts (green/yellow/red)
- **Transaction logs** — searchable by pump, user, company, date range
- **RFID card management** — add, remove, block cards from the web interface
- **Reports** — hourly, daily, weekly, monthly, yearly; export to CSV/PDF
- **Alarm monitoring** — E-stop, tank alarms, tamper detection
- **Reconciliation** — dispensed gallons vs. tank level changes

## Layout

- **Top Bar:** Site name, daily fuel total, active alerts
- **Left Panel:** Pump status list (active/idle/offline, current user, gallons)
- **Center:** Tank level gauges with historical usage charts
- **Right Panel:** User and card management
- **Bottom:** Real-time transaction log

## Structure

```
dashboard/
├── frontend/     # Main application entry and pages
├── components/   # Reusable UI components (gauges, tables, charts)
├── auth/         # Login, session management, role-based views
└── services/     # API client, data fetching, WebSocket handlers
```
