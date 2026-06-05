param(
  [string]$TailscaleHost = ""
)

# Point homelab URLs at this machine's Tailscale IP (single port 8080 for UI + API proxy).
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$ComposeDir = Join-Path $Root "deploy\homelab"
$EnvFile = Join-Path $ComposeDir ".env"
$ApiEnv = Join-Path $ComposeDir "env\api.env"

function Get-TailscaleIPv4 {
  $ip = (& tailscale ip -4 2>$null | Select-Object -First 1).Trim()
  if ($ip -match '^\d+\.\d+\.\d+\.\d+$') { return $ip }
  return $null
}

function Set-EnvKey {
  param([string[]]$Lines, [string]$Key, [string]$Value)
  $found = $false
  $out = foreach ($line in $Lines) {
    if ($line -match "^\s*$([regex]::Escape($Key))\s*=") {
      $found = $true
      "$Key=$Value"
    } else { $line }
  }
  if (-not $found) { $out += "$Key=$Value" }
  return @($out)
}

if (-not (Test-Path $EnvFile)) {
  Write-Error "Missing deploy/homelab/.env — run npm run server:up first."
}
if (-not (Test-Path $ApiEnv)) {
  Write-Error "Missing deploy/homelab/env/api.env — run npm run server:up first."
}

$hostIp = $TailscaleHost.Trim()
if (-not $hostIp) {
  $hostIp = Get-TailscaleIPv4
}
if (-not $hostIp) {
  Write-Error "Could not detect Tailscale IPv4. Pass -TailscaleHost 100.x.x.x or join this machine to Tailscale."
}

$webBase = "http://${hostIp}:8080"
$apiBase = "${webBase}/api"

Write-Host "Configuring homelab for Tailscale hub at $hostIp (UI + API via :8080)..."

$envLines = Get-Content $EnvFile
$envLines = Set-EnvKey $envLines "VITE_API_BASE_URL" $apiBase
$envLines | Set-Content $EnvFile -Encoding utf8

$apiLines = Get-Content $ApiEnv
$apiLines = Set-EnvKey $apiLines "CORTEX_FRONTEND_URL" $webBase
$cors = "$webBase,http://127.0.0.1:8080,http://localhost:8080,http://127.0.0.1:5173,http://localhost:5173"
$apiLines = Set-EnvKey $apiLines "CORS_ORIGINS" $cors
$apiLines = Set-EnvKey $apiLines "GOOGLE_REDIRECT_URI" "$apiBase/gmail/oauth/callback"
$apiLines = Set-EnvKey $apiLines "SPOTIFY_REDIRECT_URI" "$apiBase/spotify/oauth/callback"
$apiLines = Set-EnvKey $apiLines "MICROSOFT_REDIRECT_URI" "$apiBase/microsoft/oauth/callback"
$apiLines = Set-EnvKey $apiLines "NOTION_REDIRECT_URI" "$apiBase/notion/oauth/callback"
$apiLines | Set-Content $ApiEnv -Encoding utf8

Push-Location $ComposeDir
docker compose --env-file .env up -d --build cortex-web cortex-api
Pop-Location

Write-Host ""
Write-Host "Tailscale homelab ready (rebuilt cortex-web with VITE_API_BASE_URL)."
Write-Host "  App (phone/laptop on tailnet):  $webBase"
Write-Host "  API health (via nginx proxy):   $apiBase/health"
Write-Host ""
Write-Host "Update OAuth provider consoles to match the redirect URIs in deploy/homelab/env/api.env."
Write-Host "Later Linux move: copy deploy/homelab/data/ + .env + env/api.env, then docker compose up -d --build."
Write-Host "Guide: docs/local-server-docker.md"
