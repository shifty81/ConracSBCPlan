-- ============================================================
-- NEXUS Facility Operations Platform — PostgreSQL Database Initialization
-- ============================================================

BEGIN;

-- -----------------------------------------------------------
-- 1. users
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    username      VARCHAR(100) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role          VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'supervisor', 'operator', 'viewer')),
    site_id       VARCHAR(50),
    full_name     VARCHAR(200),
    email         VARCHAR(200),
    active        BOOLEAN DEFAULT true,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------
-- 2. sbc_devices
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS sbc_devices (
    id                   SERIAL PRIMARY KEY,
    sbc_id               VARCHAR(100) UNIQUE NOT NULL,
    site_id              VARCHAR(50) NOT NULL,
    pump_id              VARCHAR(50),
    location_description TEXT,
    api_key_hash         TEXT NOT NULL,
    status               VARCHAR(20) DEFAULT 'offline',
    firmware_version     VARCHAR(50),
    last_heartbeat       TIMESTAMPTZ,
    registered_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------
-- 3. transactions
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS transactions (
    id              SERIAL PRIMARY KEY,
    transaction_id  VARCHAR(100) UNIQUE NOT NULL,
    sbc_id          VARCHAR(100) NOT NULL,
    site_id         VARCHAR(50) NOT NULL,
    user_rfid       VARCHAR(100),
    pump_id         VARCHAR(50),
    start_time      TIMESTAMPTZ,
    end_time        TIMESTAMPTZ,
    gallons         NUMERIC(10,3),
    vehicle_plate   VARCHAR(50),
    company_id      VARCHAR(100),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_site_start
    ON transactions (site_id, start_time);

-- -----------------------------------------------------------
-- 4. events
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS events (
    id              SERIAL PRIMARY KEY,
    sbc_id          VARCHAR(100),
    site_id         VARCHAR(50) NOT NULL,
    event_type      VARCHAR(100) NOT NULL,
    timestamp       TIMESTAMPTZ NOT NULL,
    details         JSONB,
    acknowledged    BOOLEAN DEFAULT false,
    acknowledged_by VARCHAR(100),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_site_ts_type
    ON events (site_id, timestamp, event_type);

-- -----------------------------------------------------------
-- 5. heartbeats
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS heartbeats (
    id            SERIAL PRIMARY KEY,
    sbc_id        VARCHAR(100) NOT NULL,
    site_id       VARCHAR(50) NOT NULL,
    timestamp     TIMESTAMPTZ NOT NULL,
    status        VARCHAR(20),
    pump_state    VARCHAR(20),
    estop_active  BOOLEAN,
    tank_alarm    BOOLEAN,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_heartbeats_sbc_ts
    ON heartbeats (sbc_id, timestamp);

-- -----------------------------------------------------------
-- 6. tank_readings
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS tank_readings (
    id               SERIAL PRIMARY KEY,
    device_id        VARCHAR(100) NOT NULL,
    site_id          VARCHAR(50) NOT NULL,
    timestamp        TIMESTAMPTZ NOT NULL,
    level_gallons    NUMERIC(10,2),
    capacity_gallons NUMERIC(10,2),
    temperature_f    NUMERIC(5,1),
    status           VARCHAR(20),
    alerts           JSONB,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tank_readings_device_ts
    ON tank_readings (device_id, timestamp);

-- -----------------------------------------------------------
-- 7. form_submissions
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS form_submissions (
    id             SERIAL PRIMARY KEY,
    submission_id  VARCHAR(100) UNIQUE NOT NULL,
    form_id        VARCHAR(100) NOT NULL,
    site_id        VARCHAR(50) NOT NULL,
    submitted_by   VARCHAR(200),
    timestamp      TIMESTAMPTZ,
    data           JSONB,
    synced         BOOLEAN DEFAULT false,
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------
-- 8. audit_log
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
    id        SERIAL PRIMARY KEY,
    action    VARCHAR(200) NOT NULL,
    actor     VARCHAR(100),
    site_id   VARCHAR(50),
    details   JSONB,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------
-- 9. vendors
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS vendors (
    id              SERIAL PRIMARY KEY,
    vendor_id       VARCHAR(100) UNIQUE NOT NULL,
    company_name    VARCHAR(200) NOT NULL,
    contact_name    VARCHAR(200),
    contact_phone   VARCHAR(50),
    contact_email   VARCHAR(200),
    trade_type      VARCHAR(100),
    insurance_expiry DATE,
    active          BOOLEAN DEFAULT true,
    site_id         VARCHAR(50),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------
-- 10. vendor_visits
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS vendor_visits (
    id              SERIAL PRIMARY KEY,
    vendor_id       VARCHAR(100) NOT NULL REFERENCES vendors(vendor_id),
    site_id         VARCHAR(50) NOT NULL,
    check_in_time   TIMESTAMPTZ NOT NULL,
    check_out_time  TIMESTAMPTZ,
    purpose         TEXT,
    work_area       VARCHAR(200),
    badge_number    VARCHAR(50),
    vehicle_plate   VARCHAR(50),
    escorted_by     VARCHAR(200),
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_visits_site_checkin
    ON vendor_visits (site_id, check_in_time);

CREATE INDEX IF NOT EXISTS idx_vendor_visits_vendor
    ON vendor_visits (vendor_id);

-- -----------------------------------------------------------
-- 11. service_orders
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS service_orders (
    id               SERIAL PRIMARY KEY,
    order_number     VARCHAR(100) UNIQUE NOT NULL,
    vendor_id        VARCHAR(100) NOT NULL REFERENCES vendors(vendor_id),
    site_id          VARCHAR(50) NOT NULL,
    system_type      VARCHAR(50),
    description      TEXT,
    status           VARCHAR(20) DEFAULT 'open',
    priority         VARCHAR(20),
    scheduled_date   DATE,
    completed_date   DATE,
    labor_hours      NUMERIC(8,2),
    parts_cost       NUMERIC(10,2),
    total_cost       NUMERIC(10,2),
    invoice_number   VARCHAR(100),
    billing_verified BOOLEAN DEFAULT false,
    notes            TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_orders_site_status
    ON service_orders (site_id, status);

CREATE INDEX IF NOT EXISTS idx_service_orders_vendor
    ON service_orders (vendor_id);

-- -----------------------------------------------------------
-- 12. facility_systems
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS facility_systems (
    id                SERIAL PRIMARY KEY,
    system_id         VARCHAR(100) UNIQUE NOT NULL,
    site_id           VARCHAR(50) NOT NULL,
    system_type       VARCHAR(50) NOT NULL CHECK (system_type IN ('fuel', 'carwash', 'hvac', 'electrical', 'plumbing', 'fire_suppression', 'security', 'other')),
    name              VARCHAR(200),
    location          VARCHAR(200),
    manufacturer      VARCHAR(200),
    model             VARCHAR(200),
    serial_number     VARCHAR(200),
    install_date      DATE,
    last_service_date DATE,
    status            VARCHAR(20) DEFAULT 'operational',
    notes             TEXT,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_facility_systems_site_type
    ON facility_systems (site_id, system_type);

-- -----------------------------------------------------------
-- 13. carwash_cycles
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS carwash_cycles (
    id               SERIAL PRIMARY KEY,
    system_id        VARCHAR(100) NOT NULL REFERENCES facility_systems(system_id),
    site_id          VARCHAR(50) NOT NULL,
    cycle_type       VARCHAR(20),
    start_time       TIMESTAMPTZ,
    end_time         TIMESTAMPTZ,
    vehicle_plate    VARCHAR(50),
    company_id       VARCHAR(100),
    water_gallons    NUMERIC(10,2),
    chemical_gallons NUMERIC(10,2),
    status           VARCHAR(20),
    alerts           JSONB,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_carwash_cycles_site_start
    ON carwash_cycles (site_id, start_time);

CREATE INDEX IF NOT EXISTS idx_carwash_cycles_system
    ON carwash_cycles (system_id);

-- -----------------------------------------------------------
-- Seed default admin user (password: changeme — CHANGE IN PRODUCTION)
-- -----------------------------------------------------------
INSERT INTO users (username, password_hash, role, site_id)
VALUES (
    'admin',
    '$2b$10$rQEY7kGbLpK1eqYKqIe8sOzGGtMzBw6VqPmVyFJuYfRkPdKgKzLbG',
    'admin',
    'NKY-CVG'
) ON CONFLICT (username) DO NOTHING;

COMMIT;
