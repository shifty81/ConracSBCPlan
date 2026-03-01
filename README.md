# Fuel System Monitoring & Control Platform

A safety-critical fuel monitoring and control platform designed for ConRAC fueling facilities. The system provides deterministic emergency stop enforcement, tank alarm monitoring, pump state visibility, centralized event logging, remote configuration & deployment, and multi-site support.

## Architecture Overview

The platform follows a client-server architecture:

- **Edge Layer (SBC Client):** Industrial SBCs at each fueling island handle user authorization, dispenser communication, safety enforcement, and local transaction logging
- **Core Layer (Central Server):** Microservices for authentication, event processing, telemetry ingestion, and remote deployment
- **Interface Layer (Dashboard):** Web-based real-time monitoring, reporting, and administration

See [docs/architecture.md](docs/architecture.md) for the full architecture description.

## Repository Structure

```
├── PLAN.TXT                    # Original project plan and design conversation
├── docs/                       # Project documentation
│   ├── architecture.md         # System architecture
│   ├── safety-model.md         # Safety hierarchy and E-stop logic
│   ├── deployment.md           # Deployment guide (beta → production)
│   ├── api-spec.md             # REST API specification
│   └── beta-validation.md      # Beta test plan and exit criteria
│
├── services/                   # Backend microservices
│   ├── api-gateway/            # Single entry point, routing, auth validation
│   ├── auth-service/           # Identity, RBAC, JWT tokens
│   ├── event-engine/           # Deterministic safety state machine
│   ├── telemetry-service/      # SBC data ingestion and tank monitoring
│   └── deployment-service/     # Remote SBC update and provisioning
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
├── infrastructure/             # Nginx, firewall, systemd, provisioning configs
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
| **0.6** | Multi-Site Support | Site segmentation, config templating, deployment service |
| **0.8** | Hardening Phase | Automated safety tests, redundant DB, security audit |
| **1.0** | Production Release | Certification docs, multi-year retention, operations handbook |

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

## Beta Site

Initial deployment targets the **NKY / CVG ConRAC** fueling facility. See [docs/beta-validation.md](docs/beta-validation.md) for the validation plan and exit criteria.

## License

This project is licensed under the GNU General Public License v3.0 — see [LICENSE](LICENSE) for details.
