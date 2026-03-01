# Beta Validation Plan — NEXUS Facility Operations Platform

## Beta Site

**Location:** NKY / CVG ConRAC Facility

## Objectives

1. Validate deterministic safety enforcement in live environment
2. Confirm signal integrity from dispenser IGEM interface
3. Test operator workflow (RFID scan → authorization → fueling → transaction capture)
4. Verify remote SBC update and configuration process
5. Validate tank monitor reconciliation against dispensed gallons
6. Confirm nightly maintenance cycle (3 AM backup and restart)
7. Validate vendor check-in/check-out workflow and service order tracking
8. Verify car wash cycle monitoring and reporting

## Test Scenarios

### 1. Normal Fueling Transaction

- Operator scans RFID card
- SBC validates credentials
- Pump is authorized via IGEM
- Fuel is dispensed
- Transaction data captured and pushed to server
- Dashboard reflects transaction in real time

### 2. Emergency Stop Activation

- E-stop button pressed during fueling
- SBC immediately enforces pump shutdown
- Display shows "PUMP STOPPED" message
- Event logged centrally
- Restart requires physical reset + authorized user action

### 3. Tank Alarm Condition

- Simulate low tank / overfill alarm from tank monitor
- SBC detects alarm condition
- Appropriate safety action enforced
- Alert appears on dashboard
- Event logged with full timestamp and context

### 4. Network Failure

- Disconnect SBC from network during fueling
- Verify transaction completes normally
- Verify transaction is buffered locally
- Reconnect network
- Verify buffered transaction is pushed to server

### 5. Nightly Maintenance Cycle

- Verify active transactions complete before maintenance
- SBC displays maintenance message
- Backup completes successfully
- System restarts gracefully
- Operations resume automatically

### 6. Remote Software Update

- Push update from central server
- SBC downloads, verifies, and applies update
- Services restart with new version
- Verify functionality after update

### 7. Vendor Management

- Register a new vendor with insurance and certification details
- Perform vendor check-in with badge and vehicle tracking
- Create and assign a service order to the vendor
- Complete vendor check-out with work notes
- Verify visit history and service order status on dashboard

### 8. Car Wash Monitoring

- Record car wash cycles for different cycle types (basic, full, rinse, wax)
- Verify water and chemical usage tracking per cycle
- Verify vehicle and company attribution
- Test car wash system alert generation and display on dashboard
- Validate car wash cycle history reporting

## Exit Criteria

| Criterion | Requirement |
|-----------|-------------|
| Deterministic shutdown | E-stop → pump off within defined latency |
| No unsafe restart paths | Restart requires physical + authorized action |
| Network resilience | Transactions buffer and recover after outage |
| Audit trail | All events logged with timestamps |
| Operator usability | Positive feedback from site operators |
| Tank reconciliation | Dispensed gallons match tank level delta ±1% |
| Remote update | Successful push and rollback tested |
| Vendor tracking | Check-in, check-out, and service orders verified |
| Car wash monitoring | Cycle data captured and displayed correctly |

## Post-Beta Actions

- Document findings and adjustments
- Finalize standardized SBC image
- Prepare multi-site deployment plan
- Enable production dashboard
