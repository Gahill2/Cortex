# Copy OAuth / integration secrets from backend/.env into deploy/homelab/env/api.env.
# Updates redirect URIs for homelab (API on :4000, UI on :8080).
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$BackendEnv = Join-Path $Root "backend\.env"
$ApiEnv = Join-Path $Root "deploy\homelab\env\api.env"

if (-not (Test-Path $BackendEnv)) {
  Write-Error "Missing backend/.env (source for integration keys)."
}
if (-not (Test-Path $ApiEnv)) {
  Write-Error "Missing deploy/homelab/env/api.env - run npm run server:up first."
}

$backend = @{}
foreach ($line in Get-Content $BackendEnv) {
  if ($line -match '^\s*#') { continue }
  if ($line -match '^\s*([^#=]+)=(.*)$') {
    $backend[$Matches[1].Trim()] = $Matches[2].Trim().Trim('"')
  }
}

$keys = @(
  "SPOTIFY_CLIENT_ID", "SPOTIFY_CLIENT_SECRET",
  "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET",
  "MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET",
  "NOTION_CLIENT_ID", "NOTION_CLIENT_SECRET",
  "NOTION_TOKEN", "NOTION_PERSONAL_TOKEN", "NOTION_INTERNAL_TOKEN",
  "ANTHROPIC_API_KEY", "OPENAI_API_KEY", "OPENAI_MODEL",
  "CANVA_APP_ID", "CANVA_CLIENT_ID", "CANVA_APP_ORIGIN",
  "CORTEX_ENCRYPTION_KEY", "JWT_SECRET",
  "SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS"
)

$apiLines = Get-Content $ApiEnv
function Upsert-Key {
  param([string]$Key, [string]$Value)
  if (-not $Value) { return }
  $script:apiLines = @(
    foreach ($line in $script:apiLines) {
      if ($line -match "^\s*$([regex]::Escape($Key))\s*=") { continue }
      $line
    }
  )
  $script:apiLines += "$Key=$Value"
}

foreach ($k in $keys) {
  if ($backend.ContainsKey($k) -and $backend[$k]) {
    Upsert-Key $k $backend[$k]
  }
}

Upsert-Key "SPOTIFY_REDIRECT_URI" "http://127.0.0.1:4000/api/spotify/oauth/callback"
Upsert-Key "GOOGLE_REDIRECT_URI" "http://127.0.0.1:4000/api/gmail/oauth/callback"
Upsert-Key "MICROSOFT_REDIRECT_URI" "http://127.0.0.1:4000/api/microsoft/oauth/callback"
Upsert-Key "NOTION_REDIRECT_URI" "http://127.0.0.1:4000/api/notion/oauth/callback"
Upsert-Key "CORTEX_FRONTEND_URL" "http://127.0.0.1:8080"
Upsert-Key "CORS_ORIGINS" "http://127.0.0.1:8080,http://127.0.0.1:5173"

$apiLines | Set-Content $ApiEnv -Encoding utf8
Write-Host "Synced integration keys from backend/.env to deploy/homelab/env/api.env"
Write-Host "Restart API: cd deploy/homelab; docker compose --env-file .env up -d cortex-api"
