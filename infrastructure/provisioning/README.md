# Provisioning Guide
# Instructions for setting up a new SBC or server instance.

## SBC Provisioning

1. Flash the base OS image to the SBC storage (eMMC / microSD)
2. Connect SBC to site network
3. Register SBC with central server via deployment service
4. Server pushes site-specific configuration to SBC
5. SBC client starts automatically via systemd
6. Verify heartbeat appears on dashboard

## Server Provisioning

1. Install Docker and Docker Compose on server hardware
2. Clone this repository
3. Copy `.env.example` to `.env` and configure
4. Run `scripts/deploy.sh`
5. Create initial admin user via CLI or dashboard
6. Configure site(s) and SBC registrations

## Network Configuration

- Assign static IPs or DHCP reservations for each SBC
- Configure VLANs for control, camera, and tank monitor networks
- Ensure NTP is configured for time synchronization across all devices
