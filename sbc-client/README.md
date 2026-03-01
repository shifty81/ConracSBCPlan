# SBC Client

Edge software that runs on each LattePanda 3 Delta 864 at the fueling island, part of the NEXUS Facility Operations Platform. Built as a **Win32 application** targeting **Windows 10 Pro / Windows 11**.

## Target Hardware

**DFRobot LattePanda 3 Delta 864** — Intel Celeron N5105, 8 GB LPDDR4, 64 GB eMMC, 2.5 GbE, Wi-Fi 6, USB 3.2, built-in ATmega32U4 coprocessor, TPM 2.0. Pre-installed Windows 10 Pro.

See [docs/hardware-spec.md](../docs/hardware-spec.md) for full specifications.

## Core Components

### Hardware Abstraction Layer (`hardware/`)
- GPIO monitoring (E-stop, tank alarm inputs)
- Relay control
- Signal debounce handling

### Safety Engine (`safety-engine/`)
- Immediate shutdown logic on E-stop or alarm
- Restart lockout enforcement
- Local safety override (operates independently of network)

### Network Module (`network/`)
- Secure outbound-only HTTPS connection to central server
- Heartbeat reporting (configurable interval, default 30s)
- Transaction push with 10-second finalization delay
- Offline buffer mode (store-and-forward when server unreachable)
- Windows Remote Desktop (RDP) enabled for remote management

### UI Module (`ui/`)
- 5.7″ monochrome display (qVGA 640×480)
- Status messages: "Pump Stopped", "E-Stop Active", "Authorized Restart", "Maintenance"
- Progress bar during nightly backup
- Maintenance mode notification

### Core (`core/`)
- Authorization engine (validate RFID / PIN credentials)
- IGEM 9-PID serial interface for dispenser communication
- Transaction capture from dispenser (POS-style read, not pulse counting)
- Local SQLite database for transaction redundancy

## Peripheral Interfaces

| Device | Interface |
|--------|-----------|
| HID OMNIKEY 5427CK | USB 3.2 — Dual-frequency RFID reader / HID iCLASS SE encoder |
| Keypad | USB HID Numeric Keypad |
| IGEM 9-PID | USB-RS485 adapter or direct serial |
| Display | HDMI (5.7″ mono) or eDP (7″ touch) |
| Arduino Coprocessor | Virtual COM (USB CDC) — GPIO, relay, signal monitoring |
| Network | 2.5 GbE Ethernet (primary) + Wi-Fi 6 (fallback) |
| Remote Management | Windows Remote Desktop (RDP, port 3389) |

## Structure

```
sbc-client/
├── core/           # Authorization, IGEM interface, transaction capture
├── hardware/       # GPIO, relay, signal abstraction
├── safety-engine/  # Shutdown logic, lockout, local override
├── network/        # Server communication, heartbeat, offline buffer
├── ui/             # Display driver, status messages, progress bar
└── tests/          # Unit and integration tests
```
