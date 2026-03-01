# HID Card Encoding Integration Guide

## Overview

The NEXUS Facility Operations Platform supports HID card encoding for contactless access and fueling authorization at SBC (Site-Based Controller) client dispensers. Encoded cards carry facility credentials and user metadata that are validated in real time when a user taps a card at a fuel dispenser.

The `card-encoding-service` provides REST APIs for encoding, reading, and managing HID cards. It communicates with physical card readers via the PC/SC interface and maintains a registry of all encoded cards with full audit logging.

## Supported Card Technologies

| Technology | Frequency | Use Case |
|---|---|---|
| HID iCLASS SE | 13.56 MHz | Primary credential — secure sector encoding |
| HID iCLASS Seos | 13.56 MHz | Next-generation secure identity objects |
| MIFARE DESFire EV1 | 13.56 MHz | High-security applications with AES encryption |
| HID Prox | 125 kHz | Legacy proximity read-only cards |

The HID OMNIKEY 5427CK dual-frequency reader supports all four technologies simultaneously, reading 125 kHz and 13.56 MHz cards from a single device.

## Hardware

**Reader:** HID OMNIKEY 5427CK Dual-Frequency Contactless Smart Card Reader

- Interface: USB (PC/SC compliant)
- Frequencies: 125 kHz (Prox) + 13.56 MHz (iCLASS, Seos, MIFARE)
- Read range: up to 5 cm (contactless tap)
- LED/buzzer feedback for card detection
- Drivers: CCID class driver (built into Windows 10+; Linux via `pcsc-lite`)

Each encoding workstation and SBC dispenser kiosk is equipped with one OMNIKEY 5427CK reader.

## Software Interface

Card communication uses the **PC/SC** (Personal Computer/Smart Card) standard:

- **Windows:** `winscard.dll` (built-in)
- **Linux:** `pcsclite` daemon (`pcscd`)
- **Node.js:** The `pcsclite` npm module provides asynchronous bindings to the native PC/SC stack

The `card-encoding-service` abstracts PC/SC operations behind a `pcsc/` module that can be swapped between mock (development/CI) and live (production) implementations.

### Connecting to a Reader

```js
const pcsc = require('pcsclite');
const context = pcsc();

context.on('reader', (reader) => {
  console.log('Reader detected:', reader.name);

  reader.on('status', (status) => {
    const inserted = (status.state & reader.SCARD_STATE_PRESENT) !== 0;
    if (inserted) {
      reader.connect({ share_mode: reader.SCARD_SHARE_SHARED }, (err, protocol) => {
        // reader is ready for APDU commands
      });
    }
  });
});
```

## Card Data Format

Each encoded card stores:

| Field | Size | Description |
|---|---|---|
| Facility Code | 2 bytes | Site identifier (e.g., `0x00 0x2A` = site 42) |
| Card Number | 4 bytes | Unique card sequence number |
| User Metadata | Variable | JSON payload: full name, company, plate, role |

### Metadata Payload

```json
{
  "full_name": "Jane Doe",
  "company_id": "HERTZ",
  "vehicle_plate": "7ABC123",
  "role": "operator"
}
```

Metadata is serialized, padded to sector boundaries, and written to a dedicated iCLASS SE application area.

## Integration with NEXUS

Encoded cards are the primary authorization credential at SBC client dispensers.

1. A rental car company employee arrives at the ConRAC fueling island.
2. The employee taps their encoded HID card on the dispenser reader.
3. The SBC reads the card UID, facility code, and card number.
4. The SBC sends an authorization request to the `card-encoding-service` registry.
5. If the card is active and the user has the correct role, the dispenser is authorized.
6. A fueling transaction is recorded against the card's company and vehicle plate.

## Encoding Workflow

```
┌───────────────┐     ┌─────────────────────┐     ┌──────────────────┐
│   Dashboard   │────▶│ card-encoding-service│────▶│ OMNIKEY 5427CK   │
│  (Admin UI)   │     │     POST /encode     │     │  (PC/SC reader)  │
└───────────────┘     └─────────────────────┘     └──────────────────┘
        │                       │
        │                       ▼
        │              ┌─────────────────┐
        │              │   Card Registry  │
        │              │   + Audit Log    │
        │              └─────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────┐
│  User taps card at SBC dispenser                  │
│  → SBC reads UID → Queries registry → Authorizes  │
└───────────────────────────────────────────────────┘
```

### Step-by-Step

1. **Admin creates user** in the NEXUS dashboard and assigns a role and company.
2. **Admin encodes card** via `POST /api/cards/encode`, providing the user RFID, facility code, card number, and user metadata.
3. The service writes credentials to the card via PC/SC APDU commands and stores the record in the card registry.
4. **User taps card** at a ConRAC fuel dispenser equipped with an OMNIKEY reader.
5. **SBC reads card**, extracts the facility code and card number, and queries the registry for authorization.
6. If authorized, the dispenser unlocks and records the transaction.

## APDU Command Reference

### Read Card UID

```
APDU: FF CA 00 00 00
Response: [UID bytes] 90 00
```

| Byte | Value | Description |
|---|---|---|
| CLA | `0xFF` | PC/SC pseudo-class |
| INS | `0xCA` | Get Data |
| P1 | `0x00` | UID |
| P2 | `0x00` | — |
| Le | `0x00` | Max length |

### Write iCLASS SE Sector

```
APDU: FF D6 00 {block} {len} {data...}
Response: 90 00 (success)
```

| Byte | Value | Description |
|---|---|---|
| CLA | `0xFF` | PC/SC pseudo-class |
| INS | `0xD6` | Update Binary |
| P1 | `0x00` | — |
| P2 | Block number | Target sector block |
| Lc | Data length | Number of bytes to write |
| Data | Credential bytes | Facility code + card number + metadata |

### Authenticate to iCLASS SE Application

```
APDU: FF 86 00 00 05 01 00 {block} {key_type} 00
Response: 90 00 (success)
```

Authentication must occur before any read/write to secured sectors.

## Security

### Key Management

- iCLASS SE application keys are stored server-side in environment variables or a secrets vault.
- Keys are never exposed to the client (dashboard) or transmitted over the network.
- The `card-encoding-service` loads keys at startup and uses them exclusively within the PC/SC module.

### Access Control

- **Encoding operations** (`POST /encode`) require the `admin` or `supervisor` role.
- **Read operations** (`POST /read`, `GET /registry`) require authentication.
- **Update and deactivation** (`PUT`, `DELETE /registry/:user_rfid`) require `admin` or `supervisor` role.
- Role enforcement is handled by the API gateway and JWT middleware from the `auth-service`.

### Audit Logging

Every encoding operation is logged to the `audit_log` table:

```sql
INSERT INTO audit_log (action, entity_type, entity_id, actor, details, created_at)
VALUES ($1, $2, $3, $4, $5, NOW());
```

| Field | Example |
|---|---|
| action | `CARD_ENCODED`, `CARD_DEACTIVATED`, `CARD_READ` |
| entity_type | `card` |
| entity_id | `RFID-00042` |
| actor | `admin@site42` |
| details | JSON with full operation context |

Audit logs are immutable and retained per the facility's data-retention policy.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3008` | Service listen port |
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_NAME` | `card_encoding_db` | Database name |
| `DB_USER` | `postgres` | Database user |
| `DB_PASSWORD` | (none) | Database password |
| `HID_READER_NAME` | `HID OMNIKEY 5427CK` | Expected PC/SC reader name |
| `HID_FACILITY_CODE` | `42` | Default facility code |
| `HID_CARD_FORMAT` | `H10301` | HID card format (H10301 = 26-bit) |
