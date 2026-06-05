# Start InsForge stack for Cortex (requires vendor/insforge from sync-insforge.ps1).
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$ComposeDir = Join-Path $Root "deploy\insforge"
$Vendor = Join-Path $Root "vendor\insforge\docker-compose.prod.yml"
$EnvFile = Join-Path $ComposeDir ".env"
$EnvExample = Join-Path $ComposeDir ".env.example"

if (-not (Test-Path $Vendor)) {
  Write-Error "vendor/insforge not found. Run: npm run insforge:sync"
}

if (-not (Test-Path $EnvFile)) {
  Copy-Item $EnvExample $EnvFile
  Write-Host "Created deploy/insforge/.env from example — edit JWT_SECRET before production."
}

Push-Location $ComposeDir
docker compose --env-file .env up -d
Pop-Location

Write-Host ""
Write-Host "InsForge stack starting."
Write-Host "  Cortex DATABASE_URL: postgresql://postgres:postgres@127.0.0.1:5433/cortex"
Write-Host "  InsForge dashboard:  http://localhost:7131"
Write-Host "  InsForge API:        http://localhost:7130"
Write-Host ""
Write-Host "Then: set DATABASE_URL in backend/.env and run npm run db:migrate"
