#!/usr/bin/env bash
# build.sh — Build all services and dashboard
set -euo pipefail

echo "=== Building Fuel System Platform ==="

echo "[1/7] Building API Gateway..."
if [ -f services/api-gateway/Dockerfile ]; then
    docker build -t fuel-system/api-gateway services/api-gateway/
fi

echo "[2/7] Building Auth Service..."
if [ -f services/auth-service/Dockerfile ]; then
    docker build -t fuel-system/auth-service services/auth-service/
fi

echo "[3/7] Building Event Engine..."
if [ -f services/event-engine/Dockerfile ]; then
    docker build -t fuel-system/event-engine services/event-engine/
fi

echo "[4/7] Building Telemetry Service..."
if [ -f services/telemetry-service/Dockerfile ]; then
    docker build -t fuel-system/telemetry-service services/telemetry-service/
fi

echo "[5/7] Building Deployment Service..."
if [ -f services/deployment-service/Dockerfile ]; then
    docker build -t fuel-system/deployment-service services/deployment-service/
fi

echo "[6/7] Building FormForce Service..."
if [ -f services/formforce-service/Dockerfile ]; then
    docker build -t fuel-system/formforce-service services/formforce-service/
fi

echo "[7/7] Building Dashboard..."
if [ -f dashboard/Dockerfile ]; then
    docker build -t fuel-system/dashboard dashboard/
fi

echo "=== Build Complete ==="
