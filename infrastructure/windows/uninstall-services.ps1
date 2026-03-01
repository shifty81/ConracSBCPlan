# NEXUS Facility Operations Platform — Windows Service Removal
# Removes NEXUS SBC Client service and maintenance task
# Run as Administrator

param(
    [string]$NexusRoot = "C:\nexus"
)

$ErrorActionPreference = "Stop"

Write-Host "=== NEXUS Windows Service Uninstaller ===" -ForegroundColor Cyan

# --- Stop and remove SBC Client service ---
Write-Host "`nRemoving NEXUS SBC Client service..." -ForegroundColor Yellow

$nssmPath = Get-Command nssm -ErrorAction SilentlyContinue
if ($nssmPath) {
    nssm stop NexusSBCClient confirm 2>$null
    nssm remove NexusSBCClient confirm 2>$null
    Write-Host "SBC Client service removed." -ForegroundColor Green
} else {
    Write-Host "NSSM not found — skipping service removal." -ForegroundColor Yellow
}

# --- Remove scheduled task ---
Write-Host "`nRemoving nightly maintenance task..." -ForegroundColor Yellow
Unregister-ScheduledTask -TaskName "NEXUS Nightly Maintenance" -Confirm:$false -ErrorAction SilentlyContinue
Write-Host "Scheduled task removed." -ForegroundColor Green

# --- Remove firewall rules ---
Write-Host "`nRemoving NEXUS firewall rules..." -ForegroundColor Yellow
Remove-NetFirewallRule -DisplayName "NEXUS Outbound HTTPS" -ErrorAction SilentlyContinue
Remove-NetFirewallRule -DisplayName "NEXUS Inbound RDP" -ErrorAction SilentlyContinue
Write-Host "Firewall rules removed." -ForegroundColor Green

Write-Host "`n=== Uninstall Complete ===" -ForegroundColor Cyan
Write-Host "Note: Log files in $NexusRoot\logs were not removed."
