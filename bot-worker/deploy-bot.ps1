# deploy-bot.ps1
# Packages the bot-worker and deploys it to a VPS via SCP + SSH.
#
# Prerequisites on your Windows machine:
#   - OpenSSH client installed (Windows 10/11: Settings > Apps > Optional Features > OpenSSH Client)
#   - You have the VPS IP address and the SSH private key file
#
# Usage:
#   .\deploy-bot.ps1 -VpsIp "1.2.3.4" -SshKeyPath "C:\Users\you\.ssh\id_rsa"
#
# If this is a brand-new VPS with password auth (before you set up SSH keys):
#   .\deploy-bot.ps1 -VpsIp "1.2.3.4" -SshUser "root"
#   (it will prompt for password)

param(
    [Parameter(Mandatory=$true)]
    [string]$VpsIp,

    [string]$SshUser = "root",
    [string]$SshKeyPath = "",       # leave empty if using password auth
    [string]$RemoteDir = "/opt/bot-worker"
)

$ScriptDir    = Split-Path -Parent $MyInvocation.MyCommand.Path
$ZipPath      = "$env:TEMP\bot-worker-deploy.zip"
$BotWorkerDir = $ScriptDir   # this script lives inside bot-worker/

# ─── SSH helper ───────────────────────────────────────────────────────────────
function Invoke-Ssh {
    param([string]$Command)
    $keyArg = if ($SshKeyPath) { @("-i", $SshKeyPath) } else { @() }
    ssh @keyArg -o StrictHostKeyChecking=no "${SshUser}@${VpsIp}" $Command
}

function Invoke-Scp {
    param([string]$Source, [string]$Dest)
    $keyArg = if ($SshKeyPath) { @("-i", $SshKeyPath) } else { @() }
    scp @keyArg -o StrictHostKeyChecking=no -r $Source "${SshUser}@${VpsIp}:${Dest}"
}

# ─── Step 1: Package ──────────────────────────────────────────────────────────
Write-Host ""
Write-Host "=== [1/4] Packaging bot-worker..." -ForegroundColor Cyan

# Remove old zip if exists
if (Test-Path $ZipPath) { Remove-Item $ZipPath -Force }

# Compress everything except logs and this script's output
$filesToInclude = @(
    "$BotWorkerDir\dist",
    "$BotWorkerDir\node_modules",
    "$BotWorkerDir\.env",
    "$BotWorkerDir\ecosystem.config.cjs",
    "$BotWorkerDir\setup-vps.sh"
)

Compress-Archive -Path $filesToInclude -DestinationPath $ZipPath -Force
$sizeMB = [math]::Round((Get-Item $ZipPath).Length / 1MB, 1)
Write-Host "  Created $ZipPath ($sizeMB MB)" -ForegroundColor Green

# ─── Step 2: Upload ───────────────────────────────────────────────────────────
Write-Host ""
Write-Host "=== [2/4] Uploading to VPS ${VpsIp}..." -ForegroundColor Cyan

Invoke-Ssh "mkdir -p $RemoteDir"
Invoke-Scp $ZipPath "/tmp/bot-worker-deploy.zip"
Write-Host "  Upload complete." -ForegroundColor Green

# ─── Step 3: Extract ──────────────────────────────────────────────────────────
Write-Host ""
Write-Host "=== [3/4] Extracting on VPS..." -ForegroundColor Cyan

Invoke-Ssh @"
cd /tmp && \
unzip -o bot-worker-deploy.zip -d $RemoteDir && \
chmod +x $RemoteDir/setup-vps.sh && \
rm /tmp/bot-worker-deploy.zip
"@
Write-Host "  Extraction complete." -ForegroundColor Green

# ─── Step 4: Setup ────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "=== [4/4] Running setup on VPS (installs Node.js, PM2, starts bot)..." -ForegroundColor Cyan
Write-Host "    This may take a few minutes." -ForegroundColor Yellow

Invoke-Ssh "bash $RemoteDir/setup-vps.sh"

Write-Host ""
Write-Host "=== ALL DONE ===" -ForegroundColor Green
Write-Host ""
Write-Host "To check the bot is running:" -ForegroundColor White
Write-Host "  ssh ${SshUser}@${VpsIp} 'pm2 status'" -ForegroundColor Gray
Write-Host ""
Write-Host "To watch live logs:" -ForegroundColor White
Write-Host "  ssh ${SshUser}@${VpsIp} 'pm2 logs bot-manager'" -ForegroundColor Gray
Write-Host ""
Write-Host "The bot will auto-start after any VPS reboot. No manual action needed." -ForegroundColor Green
