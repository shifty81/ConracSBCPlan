-- ============================================================
-- Fuel System Monitoring — PostgreSQL Database Initialization
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
-- 7. formforce_submissions
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS formforce_submissions (
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
