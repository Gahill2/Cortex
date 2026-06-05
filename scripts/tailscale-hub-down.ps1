$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$ComposeDir = Join-Path $Root "deploy\tailscale-hub"
Push-Location $ComposeDir
docker compose --env-file .env down
Pop-Location
Write-Host "Tailscale hub stack stopped."
