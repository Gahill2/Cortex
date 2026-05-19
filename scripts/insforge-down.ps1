$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$ComposeDir = Join-Path $Root "deploy\insforge"
Push-Location $ComposeDir
docker compose --env-file .env down
Pop-Location
Write-Host "InsForge stack stopped."
