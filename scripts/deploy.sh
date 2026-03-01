#!/usr/bin/env bash
# deploy.sh — Deploy the NEXUS Facility Operations Platform
set -euo pipefail

ENV_FILE="${1:-.env}"

if [ ! -f "$ENV_FILE" ]; then
    echo "Error: Environment file '$ENV_FILE' not found."
    echo "Copy .env.example to .env and configure before deploying."
    exit 1
fi

echo "=== Deploying NEXUS Facility Operations Platform ==="
echo "Using environment file: $ENV_FILE"

echo "[1/3] Pulling latest images..."
docker-compose --env-file "$ENV_FILE" pull --ignore-pull-failures

echo "[2/3] Starting services..."
docker-compose --env-file "$ENV_FILE" up -d

echo "[3/3] Checking service health..."
docker-compose ps

echo "=== Deployment Complete ==="
echo "Dashboard available at https://$(hostname):3000"
