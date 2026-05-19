# Start Cortex + InsForge on the Tailscale hub (always-on host).
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$ComposeDir = Join-Path $Root "deploy\tailscale-hub"
$Vendor = Join-Path $Root "vendor\insforge\docker-compose.prod.yml"
$EnvFile = Join-Path $ComposeDir ".env"
$EnvExample = Join-Path $ComposeDir ".env.example"
$ApiEnv = Join-Path $ComposeDir "env\api.env"
$ApiExample = Join-Path $ComposeDir "env\api.env.example"

if (-not (Test-Path $Vendor)) {
  Write-Host "vendor/insforge missing — running hub:sync ..."
  & (Join-Path $Root "scripts\sync-insforge.ps1")
}

if (-not (Test-Path $EnvFile)) {
  Copy-Item $EnvExample $EnvFile
  Write-Host "Created deploy/tailscale-hub/.env — set TAILSCALE_HOST and secrets before production use."
}

if (-not (Test-Path $ApiEnv)) {
  New-Item -ItemType Directory -Force -Path (Join-Path $ComposeDir "env") | Out-Null
  Copy-Item $ApiExample $ApiEnv
  Write-Host "Created deploy/tailscale-hub/env/api.env from example."
}

Push-Location $ComposeDir
docker compose --env-file .env up -d --build --remove-orphans
if ($LASTEXITCODE -ne 0) {
  Write-Host "[hub] Compose failed (often stale container names). Recreating stack..."
  docker compose --env-file .env down --remove-orphans
  docker compose --env-file .env up -d --build
}
Pop-Location

$hostName = "cortex-zima"
if (Test-Path $EnvFile) {
  foreach ($line in Get-Content $EnvFile) {
    if ($line -match '^\s*TAILSCALE_HOST\s*=\s*(.+)\s*$') {
      $hostName = $Matches[1].Trim().Trim('"').Trim("'")
      break
    }
  }
}

Write-Host ""
Write-Host "Tailscale hub stack starting (first build can take 15-30+ min)."
Write-Host "  Postgres:        postgresql://postgres:<password>@${hostName}:5432/<POSTGRES_DB from .env>"
Write-Host "  InsForge Auth:   http://${hostName}:7131"
Write-Host "  InsForge API:    http://${hostName}:7130"
Write-Host "  Cortex API:      http://${hostName}:4000/api/health"
Write-Host "  Cortex Web:      http://${hostName}:8080"
Write-Host ""
Write-Host 'Other devices: cp backend/.env.tailscale.example backend/.env; npm run db:migrate; npm run dev:web'
Write-Host "Guide: docs/insforge-tailscale.md"
