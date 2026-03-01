# System Architecture

## Overview

The NEXUS Facility Operations Platform follows a client-server architecture providing comprehensive management of all ConRAC facility systems — fueling, car wash, vendor management, maintenance tracking, digital inspections, and compliance. Industrial Single Board Computers (SBCs) at each fueling island act as intelligent edge clients, reporting to a centralized server that aggregates data, enforces authorization, and presents dashboards across all facility operations.

## Architecture Layers

### Edge Layer — Dispenser-Side SBC

Each fueling island or dispenser cluster includes a **LattePanda 3 Delta 864** SBC running **Windows 10/11** as a local control client (Win32 build).

**Responsibilities:**

- **Monitor:** Emergency Stop circuits, tank alarm outputs, pump run/stop signals
- **Enforce:** Immediate shutdown logic and lockout conditions
- **Provide:** Local operator status display and visual safety feedback
- **Maintain:** Safe operation even during network outage

**Electrical Integration:**

- Powered from existing 24V dispenser rail (isolated)
- Built-in Arduino ATmega32U4 coprocessor on the LattePanda for GPIO/relay interfacing
- IGEM bus / 9-PID serial interface for transaction data
- USB HID card readers (HID iCLASS SE) for authorization via PC/SC (winscard) interface

### Core Layer — Central Server

A hardened central server acts as:

- System of record for all facility operations
- Authentication authority
- Event aggregation service
- Configuration manager
- Deployment controller

> **Note:** The server can run on Windows Server or within Docker Desktop for Windows, supporting in-house Windows infrastructure.

**Responsibilities:**

- Site-segmented user login
- Role-based authorization (Operator, Supervisor, Admin, System Architect)
- Alarm/event logging across all facility systems
- Remote SBC updates
- API gateway for dashboards
- Tank monitor data aggregation and reconciliation
- Car wash cycle monitoring and reporting
- Vendor visit tracking and service order management

### Forms & Inspections Service

The built-in Forms & Inspections Service (`formforce-service`) provides native digital safety inspections, compliance documentation, incident reporting, and audit-ready record keeping. The service routes as `/api/forms` through the API Gateway.

**Responsibilities:**

- Manage form templates for inspections, incidents, and compliance checklists
- Process form submissions and update facility status accordingly
- Generate form entries automatically from platform events (E-stop, tank alarms, transactions)
- Provide inspection and compliance data to the dashboard
- Maintain audit trails for all form activity

For organizations already using the [FormForce](https://www.formforceinc.com/) cloud platform, the service can optionally bridge outbound safety events and inbound inspection results via webhooks. See [formforce-integration.md](formforce-integration.md) for the integration specification.

See [forms-inspections.md](forms-inspections.md) for the full built-in forms specification.

### Vendor Management Service

The Vendor Management Service handles all third-party contractor and vendor interactions within ConRAC facilities.

**Responsibilities:**

- Vendor registration and insurance/certification tracking
- Check-in / check-out logging with badge and vehicle tracking
- Service order creation, assignment, and lifecycle management
- Labor, parts, and billing verification

### Car Wash Monitoring

Car wash systems are monitored through the Telemetry Service, tracking:

- Wash cycle types (basic, full, rinse, wax) and durations
- Water and chemical usage per cycle
- Vehicle and company attribution
- System health alerts and maintenance scheduling

### Workforce Management Service

The Workforce Service streamlines facility technician operations. It routes as `/api/workforce` through the API Gateway.

**Responsibilities:**

- One-tap clock in/out with automatic timestamps and work category classification
- Task management — create, assign, prioritize, and quick-complete work orders
- Training compliance — track certifications, renewal dates, and block clock-in for expired mandatory training
- Payroll reporting — summarize hours by employee, date range, and work category; export to CSV

### Interface Layer — Dashboard & Admin Tools

Web-based dashboard providing:

- Real-time site overview across all facility systems
- Alarm status per dispenser
- E-stop state monitoring
- Tank level gauges with visual representation
- Car wash cycle history and system status
- Vendor visit log and active service orders
- Facility system inventory and maintenance schedules
- Historical event logs (hourly to 5+ year retention)
- Role-based access controls
- RFID card management

## Communication Model

```
[SBC Client] --outbound HTTPS/WSS--> [API Gateway] --> [Internal Services]
                                                              |
                              +----------+--------------+-----+------+--------------+-------------------+
                              |          |              |            |              |                   |
                        [Auth Service] [Event Engine] [Telemetry] [Forms Service] [Vendor Service] [Workforce Service]
                              |          |              |            |              |                   |
                              +----+-----+-----+-------+------------+--------------+-------------------+
                                         |
                                     [Database]
```

- SBCs initiate outbound-only HTTPS connections (no inbound ports exposed)
- Windows Remote Desktop (RDP) provides a management channel for SBC provisioning, diagnostics, and updates
- API keys + rotating JWT for authentication
- Server never directly controls pumps (Phase 1)
- Hardware shutdown always takes priority over software

## Network Architecture

| Layer | Devices | Protocol / Medium | Purpose |
|-------|---------|-------------------|---------|
| Control / Transaction | Dispenser modules, RFID / keypad | Ethernet / RS485 / IGEM bus | Capture fuel events, authorize users |
| Tank Monitoring | Tank level sensors (Veeder-Root, Incon EVO) | Cellular / Ethernet | Monitor tank fill levels, reconcile transactions |
| Car Wash | Car wash control systems | Ethernet | Monitor wash cycles, water/chemical usage |
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

## Platform & Build Target

- **Target Hardware:** DFRobot LattePanda 3 Delta 864 (Intel Celeron N5105, 8 GB RAM, 64 GB eMMC)
- **Target OS:** Windows 10 Pro / Windows 11 (Win32 build)
- **Edge Deployment:** Windows ISO image with pre-installed NEXUS SBC client software, deployed and managed via RDP
- **Server:** Docker containers on Windows Server or Linux host
- **HID Integration:** PC/SC (winscard) interface for HID iCLASS SE card encoding and reader support
- See [hardware-spec.md](hardware-spec.md) for full hardware specifications
- See [hid-encoding.md](hid-encoding.md) for HID card encoding integration
