# System Architecture

## Overview

The Fuel System Monitoring & Control Platform follows a client-server architecture where industrial Single Board Computers (SBCs) at each fueling island act as intelligent edge clients, reporting to a centralized server that aggregates data, enforces authorization, and presents dashboards.

## Architecture Layers

### Edge Layer — Dispenser-Side SBC

Each fueling island or dispenser cluster includes an industrial SBC acting as a local control client.

**Responsibilities:**

- **Monitor:** Emergency Stop circuits, tank alarm outputs, pump run/stop signals
- **Enforce:** Immediate shutdown logic and lockout conditions
- **Provide:** Local operator status display and visual safety feedback
- **Maintain:** Safe operation even during network outage

**Electrical Integration:**

- Powered from existing 24V dispenser rail (isolated)
- GPIO or relay interface for signal monitoring
- IGEM bus / 9-PID serial interface for transaction data
- USB HID keypad and RFID reader for user authorization

### Core Layer — Central Server

A hardened central server acts as:

- System of record
- Authentication authority
- Event aggregation service
- Configuration manager
- Deployment controller

**Responsibilities:**

- Site-segmented user login
- Role-based authorization (Operator, Supervisor, Admin, System Architect)
- Alarm/event logging
- Remote SBC updates
- API gateway for dashboards
- Tank monitor data aggregation and reconciliation

### Interface Layer — Dashboard & Admin Tools

Web-based dashboard providing:

- Real-time site overview
- Alarm status per dispenser
- E-stop state monitoring
- Tank level gauges with visual representation
- Historical event logs (hourly to 5+ year retention)
- Role-based access controls
- RFID card management

## Communication Model

```
[SBC Client] --outbound HTTPS/WSS--> [API Gateway] --> [Internal Services]
                                                              |
                                    +----------+--------------+--------------+
                                    |          |              |              |
                              [Auth Service] [Event Engine] [Telemetry] [FormForce Service]
                                    |          |              |              |
                                    +----+-----+-----+-------+       [FormForce Cloud]
                                         |
                                     [Database]
```

### FormForce Integration

The FormForce Integration Service connects the platform with the [FormForce](https://www.formforceinc.com/) cloud-based form management platform. It enables digital safety inspections, compliance documentation, incident reporting, and audit-ready record keeping.

**Responsibilities:**

- Sync safety events and fuel transactions to FormForce as form submissions
- Receive inspection form results via webhooks
- Pull compliance documents and certifications on a periodic schedule
- Provide FormForce data to the dashboard for display

See [docs/formforce-integration.md](formforce-integration.md) for the full integration specification.

- SBCs initiate outbound-only HTTPS connections (no inbound ports exposed)
- API keys + rotating JWT for authentication
- Server never directly controls pumps (Phase 1)
- Hardware shutdown always takes priority over software

## Network Architecture

| Layer | Devices | Protocol / Medium | Purpose |
|-------|---------|-------------------|---------|
| Control / Transaction | Dispenser modules, RFID / keypad | Ethernet / RS485 / IGEM bus | Capture fuel events, authorize users |
| Tank Monitoring | Tank level sensors (Veeder-Root, Incon EVO) | Cellular / Ethernet | Monitor tank fill levels, reconcile transactions |
| Camera | PoE IP cameras at dispensers | PoE Ethernet / VLAN | Capture timestamped images of fueling events |
| Aggregator / Web | Local server / dashboard | Ethernet / Wi-Fi | Consolidate all data |

## Data Flow

1. User presents RFID card / enters PIN on SBC keypad
2. SBC validates credentials (local cache or server check)
3. SBC sends "enable pump" authorization to dispenser via IGEM
4. Dispenser pumps fuel; transaction data flows to SBC
5. SBC logs transaction locally (SQLite / flash buffer)
6. After 10-second finalization delay, SBC pushes transaction to server
7. Server aggregates, reconciles with tank monitor data, and updates dashboard

## Nightly Maintenance (3 AM)

- Active transactions are allowed to complete
- SBC displays "Maintenance" message on monochrome display
- SBC flushes buffered transactions to server
- Server performs database backup (local + cloud)
- Monthly archive rotation
- System graceful restart for stability
- Progress bar shown on SBC display during backup
