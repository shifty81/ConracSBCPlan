# NEXUS Facility Operations Platform — Windows Service Removal
# Removes ALL NEXUS Windows services and scheduled tasks
# Run as Administrator

param(
    [string]$NexusRoot = "C:\nexus",
    [switch]$EdgeOnly,
    [switch]$ServerOnly
)

$ErrorActionPreference = "Stop"

Write-Host "=== NEXUS Windows Service Uninstaller ===" -ForegroundColor Cyan

$nssmPath = Get-Command nssm -ErrorAction SilentlyContinue

function Remove-NexusService {
    param([string]$ServiceName)

    if ($nssmPath) {
        nssm stop $ServiceName confirm 2>$null
        nssm remove $ServiceName confirm 2>$null
        Write-Host "  Removed $ServiceName" -ForegroundColor Green
    }
}

# --- Edge services ---
if (-not $ServerOnly) {
    Write-Host "`nRemoving edge services..." -ForegroundColor Yellow
    Remove-NexusService "NexusSBCClient"
}

# --- Backend services ---
if (-not $EdgeOnly) {
    Write-Host "`nRemoving backend services..." -ForegroundColor Yellow
    Remove-NexusService "NexusAPIGateway"
    Remove-NexusService "NexusAuthService"
    Remove-NexusService "NexusTelemetryService"
    Remove-NexusService "NexusEventEngine"
    Remove-NexusService "NexusDeploymentService"
    Remove-NexusService "NexusFormsService"
    Remove-NexusService "NexusVendorService"
    Remove-NexusService "NexusWorkforceService"
    Remove-NexusService "NexusCardEncodingService"
}

if (-not $nssmPath) {
    Write-Host "NSSM not found — skipping service removal." -ForegroundColor Yellow
}

# --- Remove scheduled tasks ---
Write-Host "`nRemoving scheduled tasks..." -ForegroundColor Yellow
Unregister-ScheduledTask -TaskName "NEXUS Nightly Maintenance" -Confirm:$false -ErrorAction SilentlyContinue
Write-Host "  Removed NEXUS Nightly Maintenance" -ForegroundColor Green

if (-not $EdgeOnly) {
    Unregister-ScheduledTask -TaskName "NEXUS Database Optimization" -Confirm:$false -ErrorAction SilentlyContinue
    Write-Host "  Removed NEXUS Database Optimization" -ForegroundColor Green
}

# --- Remove firewall rules ---
Write-Host "`nRemoving NEXUS firewall rules..." -ForegroundColor Yellow
Remove-NetFirewallRule -DisplayName "NEXUS Outbound HTTPS" -ErrorAction SilentlyContinue
Remove-NetFirewallRule -DisplayName "NEXUS Inbound RDP" -ErrorAction SilentlyContinue
Remove-NetFirewallRule -DisplayName "NEXUS API Gateway" -ErrorAction SilentlyContinue
Remove-NetFirewallRule -DisplayName "NEXUS Dashboard" -ErrorAction SilentlyContinue
Write-Host "Firewall rules removed." -ForegroundColor Green

Write-Host "`n=== Uninstall Complete ===" -ForegroundColor Cyan
Write-Host "Note: Log files in $NexusRoot\logs were not removed."
