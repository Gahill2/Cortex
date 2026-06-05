# Import a Postgres dump into the homelab Docker database (Railway / old hub / backup).
# Usage:
#   .\scripts\homelab-import.ps1 -DumpPath C:\path\cortex-railway.dump
#   .\scripts\homelab-import.ps1 -DumpPath C:\path\cortex-railway.sql
#
# Get a dump from Railway: pg_dump "$DATABASE_URL" -Fc -f cortex-railway.dump
# Requires: homelab stack running (npm run server:up)

param(
  [Parameter(Mandatory = $true)]
  [string]$DumpPath
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$ComposeDir = Join-Path $Root "deploy\homelab"
$EnvFile = Join-Path $ComposeDir ".env"

if (-not (Test-Path $DumpPath)) {
  Write-Error "Dump not found: $DumpPath"
}

if (-not (Test-Path $EnvFile)) {
  Write-Error "Missing deploy/homelab/.env - run npm run server:up first."
}

$pgUser = "cortex"
$pgDb = "cortex"
foreach ($line in Get-Content $EnvFile) {
  if ($line -match '^\s*POSTGRES_USER\s*=\s*(.+)\s*$') { $pgUser = $Matches[1].Trim().Trim('"').Trim("'") }
  if ($line -match '^\s*POSTGRES_DB\s*=\s*(.+)\s*$') { $pgDb = $Matches[1].Trim().Trim('"').Trim("'") }
}

$resolved = (Resolve-Path $DumpPath).Path
$ext = [System.IO.Path]::GetExtension($resolved).ToLowerInvariant()

Write-Host "Importing into homelab Postgres (db=$pgDb user=$pgUser)..."
Write-Host "  Source: $resolved"
Write-Host ""
Write-Host "Stop npm run dev first. After import, log in with the SAME email you used on Railway."
Write-Host "Copy CORTEX_ENCRYPTION_KEY from Railway into deploy/homelab/env/api.env or OAuth tokens break."
Write-Host ""

Push-Location $ComposeDir
$container = (docker compose --env-file .env ps -q postgres)
if (-not $container) {
  Pop-Location
  Write-Error "Postgres container not running. Run npm run server:up"
}

$remotePath = "/tmp/cortex-import$ext"
docker cp $resolved "${container}:${remotePath}"

if ($ext -eq ".dump" -or $ext -eq ".backup") {
  $pgPass = ""
  foreach ($line in Get-Content $EnvFile) {
    if ($line -match '^\s*POSTGRES_PASSWORD\s*=\s*(.+)\s*$') {
      $pgPass = $Matches[1].Trim().Trim('"').Trim("'")
      break
    }
  }
  $pgPort = "5432"
  foreach ($line in Get-Content $EnvFile) {
    if ($line -match '^\s*POSTGRES_PORT\s*=\s*(.+)\s*$') {
      $pgPort = $Matches[1].Trim().Trim('"').Trim("'")
      break
    }
  }
  # pg_dump from Postgres 18+ needs pg_restore 18; homelab image may be 16.
  docker run --rm -v "${resolved}:/backup${ext}" -e "PGPASSWORD=$pgPass" postgres:18-alpine `
    pg_restore -h host.docker.internal -p $pgPort -U $pgUser -d $pgDb `
    --clean --if-exists --no-owner --role=$pgUser "/backup$ext"
  if ($LASTEXITCODE -ne 0) {
    Write-Host "[import] pg_restore exited $LASTEXITCODE (transaction_timeout warnings on PG16 are OK)"
  }
} elseif ($ext -eq ".sql") {
  docker compose --env-file .env exec -T postgres `
    psql -U $pgUser -d $pgDb -v ON_ERROR_STOP=1 -f $remotePath
  if ($LASTEXITCODE -ne 0) { Pop-Location; Write-Error "psql import failed with exit $LASTEXITCODE" }
} else {
  Pop-Location
  Write-Error "Unsupported extension '$ext'. Use .dump (pg_dump -Fc) or .sql"
}

docker compose --env-file .env exec -T postgres rm -f $remotePath | Out-Null
Pop-Location

Write-Host ""
Write-Host "Import finished. Restart API and open http://127.0.0.1:8080"
Write-Host "  cd deploy/homelab; docker compose --env-file .env up -d cortex-api"
