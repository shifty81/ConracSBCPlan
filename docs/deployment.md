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

1. Mount SBC inside dispenser enclosure (NEMA 4X / IP65)
2. Connect power from 24V dispenser rail via isolated DC-DC converter
3. Connect IGEM 9-PID serial port (USB-RS485 adapter or direct serial)
4. Connect USB HID keypad and RFID reader
5. Connect 5.7″ monochrome display (HDMI or SPI)
6. Connect Gigabit Ethernet (Cat6 preferred)

### Software Deployment

SBC software is deployed and updated remotely via the Deployment Service.

```
[Central Server]
       |
       v (Secure HTTPS push)
[SBC Client]
       |
       v
[Download update package]
       |
       v
[Verify checksum / signature]
       |
       v
[Apply update]
       |
       v
[Restart services]
```

### Remote Update Capabilities

- Push firmware and configuration updates to SBCs
- Version tracking per SBC
- Rollback capability on failure
- Site-based configuration provisioning
- Centralized image management

## Central Server Deployment

### Prerequisites

- Docker and Docker Compose installed
- PostgreSQL 16+
- TLS certificates configured
- Firewall rules in place

### Steps

1. Clone the repository
2. Copy `.env.example` to `.env` and configure
3. Run `docker-compose up -d`
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
