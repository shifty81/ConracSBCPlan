# SBC Client

Edge software that runs on each industrial Single Board Computer (SBC) at the fueling island.

## Recommended Hardware

**UP Core Industrial** — Intel x86, 4–8 GB RAM, eMMC, Gigabit Ethernet, USB 3.0

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
| Keypad | USB HID |
| RFID Reader | USB HID (13.56 MHz MIFARE) |
| IGEM 9-PID | USB-RS485 adapter or direct serial |
| Display | HDMI or SPI |
| Network | Gigabit Ethernet (Cat6) |

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
