# Start Cortex homelab stack (Postgres + API + web) - use this PC as the server.
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$ComposeDir = Join-Path $Root "deploy\homelab"
$EnvFile = Join-Path $ComposeDir ".env"
$EnvExample = Join-Path $ComposeDir ".env.example"
$ApiEnv = Join-Path $ComposeDir "env\api.env"
$ApiExample = Join-Path $ComposeDir "env\api.env.example"

function New-RandomSecret {
  $bytes = New-Object byte[] 32
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  [Convert]::ToBase64String($bytes)
}

if (-not (Test-Path $EnvFile)) {
  Copy-Item $EnvExample $EnvFile
  $password = New-RandomSecret
  (Get-Content $EnvFile) -replace 'change-me-strong-password', $password | Set-Content $EnvFile -Encoding utf8
  Write-Host "Created deploy/homelab/.env with a random POSTGRES_PASSWORD."
}

if (-not (Test-Path $ApiEnv)) {
  New-Item -ItemType Directory -Force -Path (Join-Path $ComposeDir "env") | Out-Null
  Copy-Item $ApiExample $ApiEnv
  $jwt = New-RandomSecret
  $enc = New-RandomSecret
  $apiLines = Get-Content $ApiEnv | ForEach-Object {
    if ($_ -match '^\s*JWT_SECRET=') { "JWT_SECRET=$jwt" }
    elseif ($_ -match '^\s*CORTEX_ENCRYPTION_KEY=') { "CORTEX_ENCRYPTION_KEY=$enc" }
    elseif ($_ -match '^\s*CORTEX_OTP_DEV_FALLBACK=') { "CORTEX_OTP_DEV_FALLBACK=1" }
    else { $_ }
  }
  if (-not ($apiLines -match '^\s*CORTEX_OTP_DEV_FALLBACK=')) {
    $apiLines += "CORTEX_OTP_DEV_FALLBACK=1"
  }
  $apiLines | Set-Content $ApiEnv -Encoding utf8
  Write-Host "Created deploy/homelab/env/api.env with generated JWT + encryption keys."
}

& (Join-Path $Root "scripts\sync-homelab-local-data.ps1")

Push-Location $ComposeDir
docker compose --env-file .env up -d --build --remove-orphans
if ($LASTEXITCODE -ne 0) {
  Write-Host "[homelab] Compose failed - recreating stack..."
  docker compose --env-file .env down --remove-orphans
  docker compose --env-file .env up -d --build
}
Pop-Location

Write-Host ""
Write-Host "Homelab stack starting (first build can take several minutes)."
Write-Host "  UI:      http://127.0.0.1:8080"
Write-Host "  API:     http://127.0.0.1:4000/api/health"
Write-Host "  Postgres: localhost:5432 (for Prisma from host - see docs/local-server-docker.md)"
Write-Host ""
Write-Host "After containers are healthy (migrations run inside the API container):"
Write-Host "  npm run server:status"
Write-Host "  npm run server:sync-env   # optional: backend/.env for dev:frontend + Prisma on host"
Write-Host ""
Write-Host "Do not run 'npm run dev' at the same time (duplicate API on :4000)."
Write-Host "UI hot reload: npm run dev:frontend only, with API in Docker."
Write-Host "Tailscale (phone / other devices): npm run server:tailscale"
Write-Host "Guide: docs/local-server-docker.md"
