# Hardware Specification — LattePanda 3 Delta 864

## Overview

The NEXUS Facility Operations Platform uses the **DFRobot LattePanda 3 Delta 864** as the standard edge computing node at each fueling island. The LattePanda was selected for its native Windows 10/11 support, integrated Arduino coprocessor, compact form factor, and industrial-grade connectivity — enabling a Win32 build that is compatible with existing in-house Windows infrastructure.

Product Reference: [DFRobot Product #1908](https://www.dfrobot.com/product-1908.html)

## Core Specifications

| Specification | Detail |
|---------------|--------|
| **CPU** | Intel Celeron N5105, Quad-core, 2.0 GHz base / 2.9 GHz burst |
| **RAM** | 8 GB LPDDR4 2933 MHz |
| **Storage** | 64 GB eMMC onboard |
| **GPU** | Intel UHD Graphics, 450–800 MHz |
| **OS** | Pre-installed Windows 10 Pro 21H2 (upgradable to Windows 11) |
| **TPM** | Built-in TPM 2.0 |
| **Wi-Fi** | Wi-Fi 6 (Intel AX201, 802.11ax, 2.4 GHz & 5 GHz) |
| **Bluetooth** | 5.2 |
| **Ethernet** | 2.5 Gbps (Intel I225-V) |
| **USB** | 1× USB 3.2 Gen 2 Type-A, 2× USB 3.2 Gen 1 Type-A, 1× USB 2.0 Type-C |
| **Display** | HDMI 2.0b (4K@60Hz), DisplayPort 1.4 via USB-C, eDP (1080p) |
| **Expansion** | M.2 Key B (SATA/PCIe), M.2 Key M (NVMe PCIe 3.0 ×2), microSD |
| **Coprocessor** | Microchip ATmega32U4-MU (Arduino Leonardo compatible) |
| **Arduino GPIO** | Up to 23 Digital I/O, 12 Analog Inputs, PWM, UART, I2C, SPI |
| **Power** | 12V DC (PH2.0-4Pin) or USB-C PD 15V |
| **Dimensions** | 125 mm × 78 mm × 16 mm |
| **Weight** | 100 g (gross) |
| **Operating Temp** | 0–60 °C |
| **Certifications** | CE, FCC, KC, RoHS |

## Peripheral Connections

### USB Port Allocation

| Port | Device | Purpose |
|------|--------|---------|
| USB 3.2 Gen 2 (Type-A) | HID OMNIKEY 5427CK Dual-Frequency Reader | RFID card read / HID iCLASS SE encoding |
| USB 3.2 Gen 1 (Type-A) #1 | USB-RS485 Adapter | IGEM 9-PID dispenser communication |
| USB 3.2 Gen 1 (Type-A) #2 | USB HID Numeric Keypad | PIN entry for operator authorization |
| USB 2.0 (Type-C) | Reserved | Future expansion / diagnostics |

### Arduino Coprocessor GPIO Allocation

The onboard ATmega32U4 handles real-time signal monitoring and relay control, communicating with the Windows host application via virtual serial port (USB CDC).

| Pin | Function | Direction | Signal |
|-----|----------|-----------|--------|
| D2 | E-Stop Input | Input | Active LOW — Emergency stop circuit |
| D3 | Tank Alarm Input | Input | Active LOW — Tank level alarm relay |
| D4 | Pump Run Input | Input | Active HIGH — Pump running status |
| D5 | Authorize Relay | Output | Active HIGH — Enable pump relay |
| D6 | Alarm LED | Output | Active HIGH — Visual alarm indicator |
| D7 | Status LED | Output | Active HIGH — System status indicator |
| A0 | Pulse Input | Input | Dispenser pulse signal (via opto-isolator) |
| A1 | Battery Voltage | Input | RTC / backup battery monitor |

### Opto-Isolation Board

All dispenser signal connections **must** pass through an opto-isolation board to protect the LattePanda from electrical noise and voltage spikes common in fuel dispenser environments.

**Required Components:**
- HCPL-3700 or PC817 opto-isolators for each input
- Schmitt trigger buffers (74HC14) for signal conditioning
- TVS diodes (P6KE series) for transient suppression
- DIN rail terminal blocks for field wiring

### Display

| Option | Interface | Resolution | Use Case |
|--------|-----------|------------|----------|
| 5.7″ Monochrome LCD | HDMI via adapter | 640 × 480 | Dispenser-side status display |
| 7″ Touchscreen (DFRobot) | eDP / HDMI | 1024 × 600 | Enhanced operator interface |
| Remote Desktop | RDP over Ethernet | Any | Remote management and diagnostics |

## Power Supply

The LattePanda requires 12V DC at approximately 3A (36W peak). Inside the dispenser enclosure:

1. **Source:** Existing 110–240 VAC dispenser power or dedicated 24V DC rail
2. **Conversion:** Industrial AC-DC isolated supply (Mean Well LRS-50-12) or 24V→12V DC-DC buck converter
3. **Protection:** Fused input, reverse polarity protection, surge suppression
4. **Backup:** Optional CR927 coin cell for RTC (included on board)

## Enclosure & Mounting

### Dispenser-Mounted Installation

1. Select mounting location inside dispenser cabinet (avoid heat sources and moving parts)
2. Drill mounting holes for 3D-printed bezel (see below) or use DIN rail adapter
3. Seal penetrations with Permatex Ultra Grey RTV sealant and 2-part marine epoxy
4. Route cables through grommeted openings
5. Secure LattePanda to bezel or bracket with M3 standoffs

### 3D-Printed Bezel Specifications

| Parameter | Value |
|-----------|-------|
| Material | ASA or PETG (UV and fuel-resistant) |
| Outer Dimensions | 160 mm × 110 mm × 25 mm |
| Board Cutout | 125 mm × 78 mm |
| Mounting Holes | 4× M3, 140 mm × 90 mm pattern |
| Display Window | 130 mm × 80 mm (for 5.7″ LCD) |
| RFID Reader Window | 50 mm × 50 mm (no metal — plastic only for RF transparency) |
| Ventilation | Slotted vents on sides, filtered |
| IP Rating Target | IP54 (with gasket) |

### Upgrade Path

The 3D-printed bezel system allows field upgrades:
- **Standard bezel:** Status display + RFID reader window
- **Enhanced bezel:** 7″ touchscreen + RFID + keypad cutout
- **Premium bezel:** Touchscreen + RFID + keypad + camera mount

## Network Configuration

| Parameter | Value |
|-----------|-------|
| Connection | 2.5 GbE wired (primary) + Wi-Fi 6 (fallback) |
| IP Assignment | Static IP or DHCP reservation |
| NTP | Configured for time synchronization |
| RDP | Enabled for remote management (port 3389) |
| Firewall | Windows Firewall — allow outbound HTTPS + inbound RDP only |

## Windows 10/11 Configuration

### Base Image

A standardized Windows 10 Pro ISO is prepared with:
- NEXUS SBC Client software pre-installed
- Auto-login configured for kiosk operation
- Windows Update managed centrally (WSUS or deferred)
- BitLocker enabled (TPM 2.0)
- Remote Desktop enabled
- Windows Firewall configured
- Unnecessary services disabled for performance
- Arduino IDE drivers pre-installed (virtual COM port)
- HID OMNIKEY drivers pre-installed

### Deployment

1. Prepare master ISO with Sysprep
2. Flash to LattePanda eMMC via USB boot or M.2 SSD staging
3. First boot applies site-specific configuration from USB key or RDP session
4. Register device with central server Deployment Service
5. Verify heartbeat and connectivity

See [deployment.md](deployment.md) for the full deployment guide.
