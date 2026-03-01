# NEXUS Facility Operations Platform — Windows Service Installation
# Installs NEXUS SBC Client and maintenance task as Windows services
# Requires: NSSM (Non-Sucking Service Manager) or node-windows
# Run as Administrator

param(
    [string]$NexusRoot = "C:\nexus",
    [string]$NodePath = (Get-Command node -ErrorAction SilentlyContinue).Source
)

$ErrorActionPreference = "Stop"

Write-Host "=== NEXUS Windows Service Installer ===" -ForegroundColor Cyan

# --- Validate prerequisites ---
if (-not $NodePath) {
    Write-Error "Node.js not found in PATH. Install Node.js 20 LTS first."
    exit 1
}

if (-not (Test-Path "$NexusRoot\sbc-client\src\index.js")) {
    Write-Error "NEXUS SBC Client not found at $NexusRoot\sbc-client\src\index.js"
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

# --- Install SBC Client Service ---
Write-Host "`nInstalling NEXUS SBC Client service..." -ForegroundColor Green

nssm install NexusSBCClient $NodePath
nssm set NexusSBCClient AppParameters "$NexusRoot\sbc-client\src\index.js"
nssm set NexusSBCClient AppDirectory "$NexusRoot\sbc-client"
nssm set NexusSBCClient Description "NEXUS SBC Client — Dispenser monitoring, authorization, and transaction capture"
nssm set NexusSBCClient Start SERVICE_AUTO_START
nssm set NexusSBCClient AppStdout "$NexusRoot\logs\sbc-client-stdout.log"
nssm set NexusSBCClient AppStderr "$NexusRoot\logs\sbc-client-stderr.log"
nssm set NexusSBCClient AppRotateFiles 1
nssm set NexusSBCClient AppRotateBytes 10485760
nssm set NexusSBCClient AppEnvironmentExtra "NODE_ENV=production"

Write-Host "SBC Client service installed." -ForegroundColor Green

# --- Create Nightly Maintenance Scheduled Task ---
Write-Host "`nCreating nightly maintenance scheduled task..." -ForegroundColor Green

$action = New-ScheduledTaskAction `
    -Execute $NodePath `
    -Argument "$NexusRoot\scripts\nightly-maintenance.js" `
    -WorkingDirectory "$NexusRoot\scripts"

$trigger = New-ScheduledTaskTrigger -Daily -At "3:00AM"

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable

Register-ScheduledTask `
    -TaskName "NEXUS Nightly Maintenance" `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Description "NEXUS nightly backup, buffer flush, and system maintenance" `
    -RunLevel Highest `
    -Force

Write-Host "Nightly maintenance task created (runs at 3:00 AM daily)." -ForegroundColor Green

# --- Configure Windows Firewall ---
Write-Host "`nConfiguring Windows Firewall rules..." -ForegroundColor Green

# Allow outbound HTTPS
New-NetFirewallRule -DisplayName "NEXUS Outbound HTTPS" `
    -Direction Outbound -Protocol TCP -RemotePort 443 `
    -Action Allow -Profile Any -ErrorAction SilentlyContinue

# Allow inbound RDP for remote management
New-NetFirewallRule -DisplayName "NEXUS Inbound RDP" `
    -Direction Inbound -Protocol TCP -LocalPort 3389 `
    -Action Allow -Profile Domain,Private -ErrorAction SilentlyContinue

Write-Host "Firewall rules configured." -ForegroundColor Green

# --- Enable Remote Desktop ---
Write-Host "`nEnabling Remote Desktop..." -ForegroundColor Green
Set-ItemProperty -Path "HKLM:\System\CurrentControlSet\Control\Terminal Server" `
    -Name "fDenyTSConnections" -Value 0
Enable-NetFirewallRule -DisplayGroup "Remote Desktop"

Write-Host "Remote Desktop enabled." -ForegroundColor Green

# --- Create log directory ---
if (-not (Test-Path "$NexusRoot\logs")) {
    New-Item -ItemType Directory -Path "$NexusRoot\logs" -Force | Out-Null
}

Write-Host "`n=== Installation Complete ===" -ForegroundColor Cyan
Write-Host "Start the SBC Client service: nssm start NexusSBCClient"
Write-Host "Check status: nssm status NexusSBCClient"
Write-Host "View logs: Get-Content $NexusRoot\logs\sbc-client-stdout.log -Tail 50"
