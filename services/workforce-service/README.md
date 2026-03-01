# Workforce Service

Part of the **NEXUS Facility Operations Platform** — absorbs FormForce's key features (payroll, time tracking, task logging) into a unified, technician-friendly experience.

## Philosophy

**Technicians shouldn't be bogged down by paperwork.** This service streamlines everything so field staff can focus on repairs, not forms. One-tap clock in/out, simple dropdowns for work category, optional notes — that's it.

## Features

- **Time Clock** — One-tap clock in/out with automatic timestamps. Work categories auto-categorize labor (fuel system, carwash, HVAC, electrical, plumbing, fire suppression, security, tank inspection, dispenser service).
- **Task Management** — Create, assign, and quick-complete work orders. Priority-sorted task lists keep urgent items visible.
- **Training Compliance** — Track certifications, renewal dates, and block clock-in if mandatory training has expired. Supervisors can view all expired certifications at a glance.
- **Payroll Reporting** — Summarize hours by employee, date range, and work category. Export to CSV for payroll processing.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/api/workforce/timeclock/clock-in` | Clock in |
| POST | `/api/workforce/timeclock/clock-out` | Clock out |
| GET | `/api/workforce/timeclock/status/:employee_id` | Current clock status |
| GET | `/api/workforce/timeclock/entries` | Time entry history |
| POST | `/api/workforce/tasks` | Create task |
| GET | `/api/workforce/tasks` | List tasks |
| GET | `/api/workforce/tasks/:id` | Get task details |
| PUT | `/api/workforce/tasks/:id` | Update task |
| POST | `/api/workforce/tasks/:id/complete` | Quick-complete task |
| GET | `/api/workforce/training/modules` | List training modules |
| GET | `/api/workforce/training/status/:employee_id` | Training compliance status |
| POST | `/api/workforce/training/complete` | Record training completion |
| GET | `/api/workforce/training/expired` | Expired certifications |
| GET | `/api/workforce/payroll/summary` | Payroll summary |
| GET | `/api/workforce/payroll/export` | CSV payroll export |

## Work Categories

`fuel_system`, `carwash`, `hvac`, `electrical`, `plumbing`, `fire_suppression`, `security`, `tank_inspection`, `dispenser_service`, `general`

## Running

```bash
npm install
npm start        # Starts on port 3007
npm test         # Run test suite
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3007` | HTTP port |
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_NAME` | `workforce_db` | Database name |
| `DB_USER` | `postgres` | Database user |
| `DB_PASSWORD` | (empty) | Database password |

## Database Tables

- `employee_time_entries` — Clock in/out records with work categories
- `tasks` — Work orders with priority, status, and assignment
- `training_modules` — Available training/certification modules
- `employee_training_records` — Individual completion records with digital signatures
