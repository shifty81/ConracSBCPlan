#!/usr/bin/env bash
# build.sh — Build all services and dashboard
set -euo pipefail

echo "=== Building NEXUS Facility Operations Platform ==="

echo "[1/8] Building API Gateway..."
if [ -f services/api-gateway/Dockerfile ]; then
    docker build -t nexus/api-gateway services/api-gateway/
fi

echo "[2/8] Building Auth Service..."
if [ -f services/auth-service/Dockerfile ]; then
    docker build -t nexus/auth-service services/auth-service/
fi

echo "[3/8] Building Event Engine..."
if [ -f services/event-engine/Dockerfile ]; then
    docker build -t nexus/event-engine services/event-engine/
fi

echo "[4/8] Building Telemetry Service..."
if [ -f services/telemetry-service/Dockerfile ]; then
    docker build -t nexus/telemetry-service services/telemetry-service/
fi

echo "[5/8] Building Deployment Service..."
if [ -f services/deployment-service/Dockerfile ]; then
    docker build -t nexus/deployment-service services/deployment-service/
fi

echo "[6/8] Building Forms & Inspections Service..."
if [ -f services/formforce-service/Dockerfile ]; then
    docker build -t nexus/forms-service services/formforce-service/
fi

echo "[7/8] Building Vendor Service..."
if [ -f services/vendor-service/Dockerfile ]; then
    docker build -t nexus/vendor-service services/vendor-service/
fi

echo "[8/8] Building Dashboard..."
if [ -f dashboard/Dockerfile ]; then
    docker build -t nexus/dashboard dashboard/
fi

echo "=== Build Complete ==="
