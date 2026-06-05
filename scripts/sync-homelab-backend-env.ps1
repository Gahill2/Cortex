# Merge Docker homelab DATABASE_URL into backend/.env (creates from .env.homelab.example if missing).
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$HomelabEnv = Join-Path $Root "deploy\homelab\.env"
$BackendEnv = Join-Path $Root "backend\.env"
$Example = Join-Path $Root "backend\.env.homelab.example"

if (-not (Test-Path $HomelabEnv)) {
  Write-Error "Run npm run server:up first (missing deploy/homelab/.env)."
}

$pgUser = "cortex"
$pgDb = "cortex"
$pgPort = "5432"
$pgPass = ""
foreach ($line in Get-Content $HomelabEnv) {
  if ($line -match '^\s*POSTGRES_USER\s*=\s*(.+)\s*$') { $pgUser = $Matches[1].Trim().Trim('"').Trim("'") }
  if ($line -match '^\s*POSTGRES_DB\s*=\s*(.+)\s*$') { $pgDb = $Matches[1].Trim().Trim('"').Trim("'") }
  if ($line -match '^\s*POSTGRES_PORT\s*=\s*(.+)\s*$') { $pgPort = $Matches[1].Trim().Trim('"').Trim("'") }
  if ($line -match '^\s*POSTGRES_PASSWORD\s*=\s*(.+)\s*$') { $pgPass = $Matches[1].Trim().Trim('"').Trim("'") }
}
if (-not $pgPass) { Write-Error "POSTGRES_PASSWORD missing in deploy/homelab/.env" }

$databaseUrl = "postgresql://${pgUser}:${pgPass}@127.0.0.1:${pgPort}/${pgDb}"

$ApiEnv = Join-Path $Root "deploy\homelab\env\api.env"
$jwt = ""
$enc = ""
if (Test-Path $ApiEnv) {
  foreach ($line in Get-Content $ApiEnv) {
    if ($line -match '^\s*JWT_SECRET\s*=\s*(.+)\s*$') { $jwt = $Matches[1].Trim() }
    if ($line -match '^\s*CORTEX_ENCRYPTION_KEY\s*=\s*(.+)\s*$') { $enc = $Matches[1].Trim() }
  }
}

if (-not (Test-Path $BackendEnv)) {
  if (Test-Path $Example) {
    Copy-Item $Example $BackendEnv
  } else {
    @(
      "NODE_ENV=development",
      "PORT=4000",
      'DATABASE_URL=""',
      "JWT_SECRET=",
      "CORTEX_ENCRYPTION_KEY="
    ) | Set-Content $BackendEnv -Encoding utf8
  }
}

function Set-EnvLine {
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

$lines = Get-Content $BackendEnv
$lines = Set-EnvLine $lines "DATABASE_URL" "`"$databaseUrl`""
if ($jwt) { $lines = Set-EnvLine $lines "JWT_SECRET" $jwt }
if ($enc) { $lines = Set-EnvLine $lines "CORTEX_ENCRYPTION_KEY" $enc }
$lines | Set-Content $BackendEnv -Encoding utf8

Write-Host "Updated backend/.env with homelab DATABASE_URL (and JWT keys from deploy/homelab/env/api.env)."
Write-Host "Use: npm run dev:frontend  (API already in Docker on :4000)"
