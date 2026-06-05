# Stop Cortex homelab Docker stack.
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$ComposeDir = Join-Path $Root "deploy\homelab"
$EnvFile = Join-Path $ComposeDir ".env"

Push-Location $ComposeDir
if (Test-Path $EnvFile) {
  docker compose --env-file .env down --remove-orphans
} else {
  docker compose down --remove-orphans
}
Pop-Location
Write-Host "Homelab stack stopped."
