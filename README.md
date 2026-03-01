# NEXUS Facility Operations Platform

A comprehensive ConRAC facility management platform covering fueling, car wash, vendor management, maintenance tracking, digital inspections, compliance, and centralized operations. The system provides deterministic emergency stop enforcement, tank alarm monitoring, pump state visibility, car wash cycle tracking, vendor visit management, service/repair order tracking, centralized event logging, remote configuration & deployment, multi-site support, and built-in forms and compliance management.

## Architecture Overview

The platform follows a client-server architecture:

- **Edge Layer (SBC Client):** LattePanda 3 Delta 864 boards running Windows 10/11 at each fueling island handle user authorization, HID card encoding, dispenser communication, safety enforcement, and local transaction logging
- **Core Layer (Central Server):** Microservices for authentication, event processing, telemetry ingestion, vendor management, card encoding, and remote deployment (Docker on Windows Server or Linux host)
- **Forms & Compliance Layer:** Built-in digital safety inspections, compliance documentation, incident reporting, and audit-ready record keeping
- **Interface Layer (Dashboard):** Web-based real-time monitoring, reporting, and administration across all facility systems

See [docs/architecture.md](docs/architecture.md) for the full architecture description.

## Repository Structure

```
├── PLAN.TXT                    # Original project plan and design conversation
├── docs/                       # Project documentation
│   ├── architecture.md         # System architecture
│   ├── hardware-spec.md        # LattePanda 3 Delta 864 hardware specification
│   ├── hid-encoding.md         # HID iCLASS SE card encoding integration
│   ├── safety-model.md         # Safety hierarchy and E-stop logic
│   ├── deployment.md           # Deployment guide (Windows ISO, RDP, beta → production)
│   ├── api-spec.md             # REST API specification
│   ├── beta-validation.md      # Beta test plan and exit criteria
│   └── forms-inspections.md    # Built-in forms, inspections & compliance module
│
├── services/                   # Backend microservices
│   ├── api-gateway/            # Single entry point, routing, auth validation
│   ├── auth-service/           # Identity, RBAC, JWT tokens
│   ├── event-engine/           # Deterministic safety state machine
│   ├── telemetry-service/      # SBC data ingestion, tank and car wash monitoring
│   ├── deployment-service/     # Remote SBC update, Windows ISO provisioning
│   ├── forms-service/          # Built-in forms, inspections & compliance
│   ├── vendor-service/         # Vendor management and service order tracking
│   └── card-encoding-service/  # HID iCLASS SE card encoding via PC/SC
│
├── sbc-client/                 # Edge software for dispenser SBCs
│   ├── core/                   # Authorization, IGEM interface, transactions
│   ├── hardware/               # GPIO, relay, signal abstraction
│   ├── safety-engine/          # Shutdown logic and lockout enforcement
│   ├── network/                # Server communication, offline buffer
│   └── ui/                     # 5.7″ monochrome display driver
│
├── dashboard/                  # Web-based monitoring and admin UI
│   ├── frontend/               # Main application
│   ├── components/             # Reusable UI components
│   ├── auth/                   # Login and session management
│   └── services/               # API client and data handlers
│
├── shared/                     # Common schemas, constants, logging, utils
├── infrastructure/             # Nginx, firewall, Windows service configs, provisioning
├── scripts/                    # Build, deploy, and validation scripts
├── docker-compose.yml          # Service orchestration
└── .env.example                # Environment variable template
```

## Technical Roadmap

| Version | Milestone | Scope |
|---------|-----------|-------|
| **0.1** | Core SBC Prototype | GPIO monitoring, E-stop detection, local display, offline operation |
| **0.2** | Server Foundation | API Gateway, Auth Service, telemetry, basic dashboard login |
| **0.3** | Event Engine Integration | State machine, restart authorization, cross-zone logging |
| **0.4** | Beta Deployment @ NKY/CVG | Live validation with production hardware |
| **0.5** | Built-in Forms & Compliance | Digital inspections, compliance docs, incident reporting |
| **0.6** | Multi-Site Support | Site segmentation, config templating, deployment service |
| **0.7** | Vendor & Maintenance Management | Vendor check-in/out, service orders, repair tracking |
| **0.8** | Car Wash & Facility Systems | Car wash cycle monitoring, facility-wide system tracking |
| **0.9** | Hardening Phase | Automated safety tests, redundant DB, security audit |
| **1.0** | Production Release | Certification docs, multi-year retention, operations handbook |

## Platform

| Component | Specification |
|-----------|---------------|
| **Edge Hardware** | DFRobot LattePanda 3 Delta 864 (Intel N5105, 8 GB RAM, 64 GB eMMC) |
| **Edge OS** | Windows 10 Pro / Windows 11 (Win32 build) |
| **Card Reader** | HID OMNIKEY 5427CK dual-frequency (iCLASS SE / MIFARE / Prox) |
| **Coprocessor** | Onboard ATmega32U4 (Arduino Leonardo) for GPIO and relay control |
| **Server** | Docker containers on Windows Server or Linux host |
| **Deployment** | Windows ISO image + RDP remote management |

See [docs/hardware-spec.md](docs/hardware-spec.md) for full hardware specifications.

## Quick Start

```bash
# 1. Configure environment
cp .env.example .env
# Edit .env with your site-specific values

# 2. Build services
bash scripts/build.sh

# 3. Deploy
bash scripts/deploy.sh

# 4. Validate
bash scripts/validate.sh
```

## Safety Model

The system follows a strict hierarchy where **physical safety devices always override software**. SBCs enforce immediate shutdown on alarm or E-stop detection and continue to operate safely even when disconnected from the network. See [docs/safety-model.md](docs/safety-model.md).

## Built-in Forms & Compliance

NEXUS includes a built-in forms and compliance module for digital safety inspections, compliance documentation, incident reporting, and audit-ready record keeping. Safety events and fuel transactions automatically generate form entries; inspection results and compliance data are managed natively within the platform. See [docs/forms-inspections.md](docs/forms-inspections.md).

## Beta Site

Initial deployment targets the **NKY / CVG ConRAC** facility. See [docs/beta-validation.md](docs/beta-validation.md) for the validation plan and exit criteria.

## License

This project is licensed under the GNU General Public License v3.0 — see [LICENSE](LICENSE) for details.
