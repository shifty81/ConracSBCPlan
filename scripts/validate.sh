#!/usr/bin/env bash
# validate.sh — Run validation checks across the platform
set -euo pipefail

ERRORS=0

echo "=== Fuel System Platform Validation ==="

echo "[1/6] Checking environment configuration..."
if [ -f .env ]; then
    echo "  ✓ .env file found"
else
    echo "  ✗ .env file missing — copy from .env.example"
    ERRORS=$((ERRORS + 1))
fi

echo "[2/6] Checking Docker services..."
if command -v docker-compose &>/dev/null; then
    RUNNING=$(docker-compose ps --services --filter "status=running" 2>/dev/null | wc -l)
    echo "  $RUNNING service(s) running"
else
    echo "  ✗ docker-compose not available"
    ERRORS=$((ERRORS + 1))
fi

echo "[3/6] Checking API Gateway connectivity..."
if curl -sf http://localhost:8080/health &>/dev/null; then
    echo "  ✓ API Gateway responding"
else
    echo "  ✗ API Gateway not responding on port 8080"
    ERRORS=$((ERRORS + 1))
fi

echo "[4/6] Checking Dashboard connectivity..."
if curl -sf http://localhost:3000 &>/dev/null; then
    echo "  ✓ Dashboard responding"
else
    echo "  ✗ Dashboard not responding on port 3000"
    ERRORS=$((ERRORS + 1))
fi

echo "[5/6] Checking database connectivity..."
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

echo "[6/6] Checking FormForce integration..."
if curl -sf http://localhost:8080/api/formforce/status &>/dev/null; then
    echo "  ✓ FormForce service responding"
else
    echo "  - FormForce service not responding (may not be configured)"
fi

echo ""
if [ "$ERRORS" -eq 0 ]; then
    echo "=== All Checks Passed ==="
else
    echo "=== $ERRORS Check(s) Failed ==="
    exit 1
fi
