#!/usr/bin/env bash
# validate.sh — Run validation checks across the platform
set -euo pipefail

ERRORS=0

echo "=== NEXUS Facility Operations Platform Validation ==="

echo "[1/8] Checking environment configuration..."
if [ -f .env ]; then
    echo "  ✓ .env file found"
else
    echo "  ✗ .env file missing — copy from .env.example"
    ERRORS=$((ERRORS + 1))
fi

echo "[2/8] Checking Docker services..."
if command -v docker-compose &>/dev/null; then
    RUNNING=$(docker-compose ps --services --filter "status=running" 2>/dev/null | wc -l)
    echo "  $RUNNING service(s) running"
else
    echo "  ✗ docker-compose not available"
    ERRORS=$((ERRORS + 1))
fi

echo "[3/8] Checking API Gateway connectivity..."
if curl -sf http://localhost:8080/health &>/dev/null; then
    echo "  ✓ API Gateway responding"
else
    echo "  ✗ API Gateway not responding on port 8080"
    ERRORS=$((ERRORS + 1))
fi

echo "[4/8] Checking Dashboard connectivity..."
if curl -sf http://localhost:3000 &>/dev/null; then
    echo "  ✓ Dashboard responding"
else
    echo "  ✗ Dashboard not responding on port 3000"
    ERRORS=$((ERRORS + 1))
fi

echo "[5/8] Checking database connectivity..."
if command -v pg_isready &>/dev/null; then
    if pg_isready -h localhost -p 5432 &>/dev/null; then
        echo "  ✓ Database responding"
    else
        echo "  ✗ Database not responding on port 5432"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo "  - pg_isready not available, skipping database check"
fi

echo "[6/8] Checking Forms & Inspections service..."
if curl -sf http://localhost:8080/api/forms/status &>/dev/null; then
    echo "  ✓ Forms service responding"
else
    echo "  - Forms service not responding (may not be configured)"
fi

echo "[7/8] Checking Vendor Management service..."
if curl -sf http://localhost:8080/api/vendors &>/dev/null; then
    echo "  ✓ Vendor service responding"
else
    echo "  - Vendor service not responding (may not be configured)"
fi

echo "[8/8] Checking Car Wash monitoring..."
if curl -sf http://localhost:8080/api/telemetry/carwash/status &>/dev/null; then
    echo "  ✓ Car wash monitoring responding"
else
    echo "  - Car wash monitoring not responding (may not be configured)"
fi

echo ""
if [ "$ERRORS" -eq 0 ]; then
    echo "=== All Checks Passed ==="
else
    echo "=== $ERRORS Check(s) Failed ==="
    exit 1
fi
