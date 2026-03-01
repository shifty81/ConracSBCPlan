# NEXUS Facility Operations Platform — Windows Service Installation
# Installs ALL NEXUS services (SBC Client + backend microservices) and scheduled tasks
# Requires: NSSM (Non-Sucking Service Manager) — https://nssm.cc
# Run as Administrator

param(
    [string]$NexusRoot = "C:\nexus",
    [string]$NodePath = (Get-Command node -ErrorAction SilentlyContinue).Source,
    [switch]$EdgeOnly,
    [switch]$ServerOnly
)

$ErrorActionPreference = "Stop"

Write-Host "=== NEXUS Windows Service Installer ===" -ForegroundColor Cyan

# --- Validate prerequisites ---
if (-not $NodePath) {
    Write-Error "Node.js not found in PATH. Install Node.js 20 LTS first."
    exit 1
}

# --- Check for NSSM ---
$nssmPath = Get-Command nssm -ErrorAction SilentlyContinue
if (-not $nssmPath) {
    Write-Host "NSSM not found. Downloading..." -ForegroundColor Yellow
    Write-Host "Download from https://nssm.cc/download and add to PATH" -ForegroundColor Yellow
    Write-Host "Then re-run this script." -ForegroundColor Yellow
    exit 1
}

# --- Create log directory ---
if (-not (Test-Path "$NexusRoot\logs")) {
    New-Item -ItemType Directory -Path "$NexusRoot\logs" -Force | Out-Null
}

# --- Helper function to install a NEXUS service via NSSM ---
function Install-NexusService {
    param(
        [string]$ServiceName,
        [string]$DisplayName,
        [string]$Description,
        [string]$EntryPoint,
        [string]$WorkDir,
        [string]$EnvExtra = "NODE_ENV=production"
    )

    if (-not (Test-Path $EntryPoint)) {
        Write-Host "  Skipping $ServiceName — entry point not found: $EntryPoint" -ForegroundColor Yellow
        return
    }

    Write-Host "  Installing $ServiceName..." -ForegroundColor Green

    nssm install $ServiceName $NodePath 2>$null
    nssm set $ServiceName AppParameters $EntryPoint
    nssm set $ServiceName AppDirectory $WorkDir
    nssm set $ServiceName DisplayName $DisplayName
    nssm set $ServiceName Description $Description
    nssm set $ServiceName Start SERVICE_AUTO_START
    nssm set $ServiceName AppStdout "$NexusRoot\logs\$ServiceName-stdout.log"
    nssm set $ServiceName AppStderr "$NexusRoot\logs\$ServiceName-stderr.log"
    nssm set $ServiceName AppRotateFiles 1
    nssm set $ServiceName AppRotateBytes 10485760
    nssm set $ServiceName AppEnvironmentExtra $EnvExtra

    Write-Host "  $ServiceName installed." -ForegroundColor Green
}

# =========================================================
# Edge Services (installed on LattePanda SBC nodes)
# =========================================================
if (-not $ServerOnly) {
    Write-Host "`n--- Edge Services (SBC Client) ---" -ForegroundColor Cyan

    Install-NexusService `
        -ServiceName "NexusSBCClient" `
        -DisplayName "NEXUS SBC Client" `
        -Description "NEXUS SBC Client — Dispenser monitoring, RFID authorization, and transaction capture" `
        -EntryPoint "$NexusRoot\sbc-client\src\index.js" `
        -WorkDir "$NexusRoot\sbc-client"
}

# =========================================================
# Backend Services (installed on server or all-in-one node)
# =========================================================
if (-not $EdgeOnly) {
    Write-Host "`n--- Backend Services ---" -ForegroundColor Cyan

    # API Gateway (port 8080)
    Install-NexusService `
        -ServiceName "NexusAPIGateway" `
        -DisplayName "NEXUS API Gateway" `
        -Description "NEXUS API Gateway — Reverse proxy, auth validation, rate limiting (port 8080)" `
        -EntryPoint "$NexusRoot\services\api-gateway\src\index.js" `
        -WorkDir "$NexusRoot\services\api-gateway" `
        -EnvExtra "NODE_ENV=production PORT=8080"

    # Auth Service (port 3001)
    Install-NexusService `
        -ServiceName "NexusAuthService" `
        -DisplayName "NEXUS Auth Service" `
        -Description "NEXUS Auth Service — JWT issuance, RBAC, user management (port 3001)" `
        -EntryPoint "$NexusRoot\services\auth-service\src\index.js" `
        -WorkDir "$NexusRoot\services\auth-service" `
        -EnvExtra "NODE_ENV=production PORT=3001"

    # Telemetry Service (port 3002)
    Install-NexusService `
        -ServiceName "NexusTelemetryService" `
        -DisplayName "NEXUS Telemetry Service" `
        -Description "NEXUS Telemetry Service — SBC heartbeat, transaction ingestion, tank monitoring (port 3002)" `
        -EntryPoint "$NexusRoot\services\telemetry-service\src\index.js" `
        -WorkDir "$NexusRoot\services\telemetry-service" `
        -EnvExtra "NODE_ENV=production PORT=3002"

    # Event Engine (port 3003)
    Install-NexusService `
        -ServiceName "NexusEventEngine" `
        -DisplayName "NEXUS Event Engine" `
        -Description "NEXUS Event Engine — Deterministic safety state machine, E-stop logic (port 3003)" `
        -EntryPoint "$NexusRoot\services\event-engine\src\index.js" `
        -WorkDir "$NexusRoot\services\event-engine" `
        -EnvExtra "NODE_ENV=production PORT=3003"

    # Deployment Service (port 3004)
    Install-NexusService `
        -ServiceName "NexusDeploymentService" `
        -DisplayName "NEXUS Deployment Service" `
        -Description "NEXUS Deployment Service — SBC update management, version tracking, rollback (port 3004)" `
        -EntryPoint "$NexusRoot\services\deployment-service\src\index.js" `
        -WorkDir "$NexusRoot\services\deployment-service" `
        -EnvExtra "NODE_ENV=production PORT=3004"

    # Forms & Inspections Service (port 3005)
    Install-NexusService `
        -ServiceName "NexusFormsService" `
        -DisplayName "NEXUS Forms & Inspections Service" `
        -Description "NEXUS Forms Service — Digital inspections, compliance records, webhooks (port 3005)" `
        -EntryPoint "$NexusRoot\services\formforce-service\src\index.js" `
        -WorkDir "$NexusRoot\services\formforce-service" `
        -EnvExtra "NODE_ENV=production PORT=3005"

    # Vendor Service (port 3006)
    Install-NexusService `
        -ServiceName "NexusVendorService" `
        -DisplayName "NEXUS Vendor Service" `
        -Description "NEXUS Vendor Service — Vendor check-in/out, insurance tracking, service orders (port 3006)" `
        -EntryPoint "$NexusRoot\services\vendor-service\src\index.js" `
        -WorkDir "$NexusRoot\services\vendor-service" `
        -EnvExtra "NODE_ENV=production PORT=3006"

    # Workforce Service (port 3007)
    Install-NexusService `
        -ServiceName "NexusWorkforceService" `
        -DisplayName "NEXUS Workforce Service" `
        -Description "NEXUS Workforce Service — Timeclock, task management, training, payroll (port 3007)" `
        -EntryPoint "$NexusRoot\services\workforce-service\src\index.js" `
        -WorkDir "$NexusRoot\services\workforce-service" `
        -EnvExtra "NODE_ENV=production PORT=3007"

    # Card Encoding Service (port 3008)
    Install-NexusService `
        -ServiceName "NexusCardEncodingService" `
        -DisplayName "NEXUS Card Encoding Service" `
        -Description "NEXUS Card Encoding Service — HID iCLASS SE card encoding via PC/SC (port 3008)" `
        -EntryPoint "$NexusRoot\services\card-encoding-service\src\index.js" `
        -WorkDir "$NexusRoot\services\card-encoding-service" `
        -EnvExtra "NODE_ENV=production PORT=3008"
}

# =========================================================
# Scheduled Tasks
# =========================================================
Write-Host "`n--- Scheduled Tasks ---" -ForegroundColor Cyan

# Nightly Maintenance (3:00 AM)
Write-Host "  Creating nightly maintenance task..." -ForegroundColor Green

$maintenanceAction = New-ScheduledTaskAction `
    -Execute $NodePath `
    -Argument "$NexusRoot\scripts\nightly-maintenance.js" `
    -WorkingDirectory "$NexusRoot\scripts"

$maintenanceTrigger = New-ScheduledTaskTrigger -Daily -At "3:00AM"

$maintenanceSettings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable

Register-ScheduledTask `
    -TaskName "NEXUS Nightly Maintenance" `
    -Action $maintenanceAction `
    -Trigger $maintenanceTrigger `
    -Settings $maintenanceSettings `
    -Description "NEXUS nightly backup, buffer flush, and system maintenance" `
    -RunLevel Highest `
    -Force

Write-Host "  Nightly maintenance task created (3:00 AM daily)." -ForegroundColor Green

# Database Optimization (every Sunday at 2:00 AM)
if (-not $EdgeOnly) {
    Write-Host "  Creating weekly database optimization task..." -ForegroundColor Green

    $dbOptAction = New-ScheduledTaskAction `
        -Execute $NodePath `
        -Argument "$NexusRoot\scripts\db-maintenance.js" `
        -WorkingDirectory "$NexusRoot\scripts"

    $dbOptTrigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At "2:00AM"

    $dbOptSettings = New-ScheduledTaskSettingsSet `
        -AllowStartIfOnBatteries `
        -DontStopIfGoingOnBatteries `
        -StartWhenAvailable `
        -RunOnlyIfNetworkAvailable

    Register-ScheduledTask `
        -TaskName "NEXUS Database Optimization" `
        -Action $dbOptAction `
        -Trigger $dbOptTrigger `
        -Settings $dbOptSettings `
        -Description "NEXUS weekly database vacuum, reindex, and data archival" `
        -RunLevel Highest `
        -Force

    Write-Host "  Database optimization task created (Sunday 2:00 AM weekly)." -ForegroundColor Green
}

# =========================================================
# Windows Firewall & Remote Desktop
# =========================================================
Write-Host "`n--- Firewall & Remote Desktop ---" -ForegroundColor Cyan

# Allow outbound HTTPS
New-NetFirewallRule -DisplayName "NEXUS Outbound HTTPS" `
    -Direction Outbound -Protocol TCP -RemotePort 443 `
    -Action Allow -Profile Any -ErrorAction SilentlyContinue

# Allow inbound RDP for remote management
New-NetFirewallRule -DisplayName "NEXUS Inbound RDP" `
    -Direction Inbound -Protocol TCP -LocalPort 3389 `
    -Action Allow -Profile Domain,Private -ErrorAction SilentlyContinue

# Allow inbound for backend services (server only)
if (-not $EdgeOnly) {
    New-NetFirewallRule -DisplayName "NEXUS API Gateway" `
        -Direction Inbound -Protocol TCP -LocalPort 8080 `
        -Action Allow -Profile Domain,Private -ErrorAction SilentlyContinue

    New-NetFirewallRule -DisplayName "NEXUS Dashboard" `
        -Direction Inbound -Protocol TCP -LocalPort 3000 `
        -Action Allow -Profile Domain,Private -ErrorAction SilentlyContinue
}

Write-Host "Firewall rules configured." -ForegroundColor Green

# Enable Remote Desktop
Write-Host "Enabling Remote Desktop..." -ForegroundColor Green
Set-ItemProperty -Path "HKLM:\System\CurrentControlSet\Control\Terminal Server" `
    -Name "fDenyTSConnections" -Value 0
# Require Network Level Authentication (NLA) for additional security
Set-ItemProperty -Path "HKLM:\System\CurrentControlSet\Control\Terminal Server\WinStations\RDP-Tcp" `
    -Name "UserAuthentication" -Value 1
Enable-NetFirewallRule -DisplayGroup "Remote Desktop"
Write-Host "Remote Desktop enabled (NLA required)." -ForegroundColor Green
Write-Host "  NOTE: In production, restrict RDP firewall rule to known management IPs." -ForegroundColor Yellow

# =========================================================
# Summary
# =========================================================
Write-Host "`n=== Installation Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Usage flags:" -ForegroundColor White
Write-Host "  -EdgeOnly    Install only SBC Client service (for LattePanda edge nodes)"
Write-Host "  -ServerOnly  Install only backend services (for central server)"
Write-Host "  (default)    Install all services"
Write-Host ""
Write-Host "Manage services:" -ForegroundColor White
Write-Host "  nssm start <ServiceName>    Start a service"
Write-Host "  nssm stop <ServiceName>     Stop a service"
Write-Host "  nssm status <ServiceName>   Check status"
Write-Host "  nssm restart <ServiceName>  Restart a service"
Write-Host ""
Write-Host "View logs:" -ForegroundColor White
Write-Host "  Get-Content $NexusRoot\logs\<service>-stdout.log -Tail 50"
Write-Host ""
Write-Host "Installed services:" -ForegroundColor White
if (-not $ServerOnly) { Write-Host "  NexusSBCClient             (Edge — SBC Client)" }
if (-not $EdgeOnly) {
    Write-Host "  NexusAPIGateway            (Server — port 8080)"
    Write-Host "  NexusAuthService           (Server — port 3001)"
    Write-Host "  NexusTelemetryService      (Server — port 3002)"
    Write-Host "  NexusEventEngine           (Server — port 3003)"
    Write-Host "  NexusDeploymentService     (Server — port 3004)"
    Write-Host "  NexusFormsService          (Server — port 3005)"
    Write-Host "  NexusVendorService         (Server — port 3006)"
    Write-Host "  NexusWorkforceService      (Server — port 3007)"
    Write-Host "  NexusCardEncodingService   (Server — port 3008)"
}
