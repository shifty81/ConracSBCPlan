# Provisioning Guide
# Instructions for setting up a new LattePanda SBC or server instance.

## SBC Provisioning (LattePanda 3 Delta — Windows 10/11)

1. Prepare a master Windows 10 Pro ISO with NEXUS SBC Client pre-installed (Sysprep)
2. Flash ISO to LattePanda eMMC via USB boot media or M.2 SSD staging
3. On first boot, configure auto-login for kiosk operation
4. Connect LattePanda to site network (2.5 GbE or Wi-Fi 6)
5. Apply site-specific configuration via USB key or Windows Remote Desktop (RDP)
6. Register SBC with central server via Deployment Service API
7. NEXUS SBC Client starts automatically as a Windows service (NSSM)
8. Verify heartbeat appears on dashboard

### Windows-Specific Setup

- Enable Remote Desktop for remote management
- Enable BitLocker full-disk encryption (TPM 2.0)
- Install HID OMNIKEY 5427CK drivers
- Install Arduino Leonardo virtual COM port drivers
- Verify PC/SC Smart Card Service is running (`SCardSvr`)
- Run `infrastructure/windows/install-services.ps1` as Administrator

## Server Provisioning

1. Install Docker Desktop for Windows (or Docker on Linux host)
2. Clone this repository
3. Copy `.env.example` to `.env` and configure
4. Run `scripts/deploy.sh` (Linux) or `docker compose up -d` (Windows)
5. Create initial admin user via CLI or dashboard
6. Configure site(s) and SBC registrations

## Network Configuration

- Assign static IPs or DHCP reservations for each LattePanda SBC
- Configure VLANs for control, camera, and tank monitor networks
- Ensure NTP is configured for time synchronization across all devices
- Enable RDP (port 3389) on SBCs for remote management
- Configure Windows Firewall: allow outbound HTTPS (443) + inbound RDP (3389)
