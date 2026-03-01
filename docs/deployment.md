# Deployment Guide — NEXUS Facility Operations Platform

## Beta Site: NKY / CVG ConRAC

Initial deployment will:

- Instrument selected fueling zones
- Validate shutdown timing
- Confirm signal integrity
- Test operator interaction
- Verify remote update process

### Beta Exit Criteria

- Deterministic shutdown validation
- No unsafe restart paths
- Stable network communication
- Clean audit trail
- Operator usability confirmed

## Post-Beta Scaling

After validation:

- Standardized SBC image used across sites
- Site configuration applied via central server
- Minimal on-site installation time
- Remote provisioning and validation
- Multi-site dashboard enabled immediately

## SBC Deployment

### Hardware Setup

1. Mount LattePanda 3 Delta inside dispenser enclosure (NEMA 4X / IP65 rated bezel)
2. Connect 12V DC power from isolated AC-DC supply or 24V→12V DC-DC converter
3. Connect IGEM 9-PID serial port via USB-RS485 adapter
4. Connect HID OMNIKEY 5427CK dual-frequency reader (USB) and numeric keypad (USB HID)
5. Connect 5.7″ monochrome display via HDMI or 7″ touchscreen via eDP
6. Connect 2.5 GbE Ethernet (Cat6 preferred); Wi-Fi 6 available as fallback

### Software Deployment

SBC software is deployed as a Windows application on a standardized Windows 10 Pro ISO image. Updates are managed remotely via Windows Remote Desktop (RDP) and the NEXUS Deployment Service.

### Windows ISO Deployment

1. Prepare a master Windows 10 Pro image with NEXUS SBC Client pre-installed
2. Apply Sysprep for hardware-independent deployment
3. Flash ISO to LattePanda eMMC via USB boot media
4. On first boot, site-specific configuration is applied via USB key or RDP session
5. Register device with central server Deployment Service
6. Verify heartbeat and dashboard connectivity

### Remote Update via RDP

```
[Central Server / Admin Workstation]
       |
       v (Windows Remote Desktop - port 3389)
[LattePanda SBC]
       |
       v
[Update NEXUS client software]
       |
       v
[Restart Windows service]
```

### Remote Update Capabilities

- Push software updates to SBCs via RDP or Deployment Service API
- Windows Remote Desktop for interactive management and diagnostics
- Version tracking per SBC device
- Rollback capability on update failure
- Site-based configuration provisioning via Deployment Service
- Centralized Windows ISO image management
- Compatible with existing in-house Windows management tools (WSUS, Group Policy)

## Central Server Deployment

### Prerequisites

- Docker Desktop for Windows (or Docker on Linux host)
- PostgreSQL 16+ (via Docker container)
- TLS certificates configured
- Firewall rules in place
- Windows Server 2019+ or Linux server with Docker support

### Steps

1. Clone the repository
2. Copy `.env.example` to `.env` and configure
3. Run `docker compose up -d` (Docker Desktop for Windows) or `docker-compose up -d` (Linux)
4. Access the dashboard at `https://<server-host>:3000`
5. Configure initial site and admin user

## Backup Strategy

### Nightly Maintenance (3:00 AM)

1. Allow active transactions to complete
2. SBC displays maintenance message
3. Flush SBC buffers to server
4. Local database backup
5. Cloud backup (if enabled)
6. Monthly archive rotation
7. Graceful system restart
8. Resume operations

### Retention Policy

| Data Type | Retention |
|-----------|-----------|
| Live transactions | 1 month on dashboard |
| Full transaction history | 5–10 years |
| DVR / camera footage | 1 week |
| SBC local buffer | Until acknowledged by server |
| Cloud archive | As configured |

## Windows-Specific Considerations

### Recommended OS Configuration

- **Auto-login:** Configure for kiosk-mode operation at the dispenser
- **BitLocker:** Enable full-disk encryption (TPM 2.0 supported on LattePanda)
- **Windows Update:** Defer feature updates; apply security updates during nightly maintenance
- **Remote Desktop:** Enable RDP (port 3389) for remote management
- **Windows Firewall:** Allow outbound HTTPS (443), inbound RDP (3389), block all other inbound
- **Power Management:** Disable sleep/hibernate; configure UPS shutdown on power loss
- **Startup:** NEXUS SBC Client registered as a Windows service via node-windows or NSSM

### HID Driver Requirements

- Install HID OMNIKEY 5427CK drivers (available from HID Global)
- Install Arduino Leonardo virtual COM port drivers (included with Arduino IDE)
- Verify PC/SC Smart Card Service is running (`SCardSvr`)

See [hardware-spec.md](hardware-spec.md) for full hardware specifications.
