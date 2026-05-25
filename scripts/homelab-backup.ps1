# Backup homelab Postgres to deploy/homelab/data/backups/
param(
  [string]$OutDir = ""
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$ComposeDir = Join-Path $Root "deploy\homelab"
$EnvFile = Join-Path $ComposeDir ".env"
$dataDir = Join-Path $ComposeDir "data"
$backupDir = if ($OutDir) { $OutDir } else { Join-Path $dataDir "backups" }

if (-not (Test-Path $EnvFile)) {
  Write-Error "Run npm run server:up first."
}

$pgUser = "cortex"
$pgDb = "cortex"
foreach ($line in Get-Content $EnvFile) {
  if ($line -match '^\s*POSTGRES_USER\s*=\s*(.+)\s*$') { $pgUser = $Matches[1].Trim().Trim('"').Trim("'") }
  if ($line -match '^\s*POSTGRES_DB\s*=\s*(.+)\s*$') { $pgDb = $Matches[1].Trim().Trim('"').Trim("'") }
}

New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
$stamp = Get-Date -Format "yyyy-MM-dd_HHmm"
$outFile = Join-Path $backupDir "cortex-$stamp.dump"

Push-Location $ComposeDir
$container = (docker compose --env-file .env ps -q postgres)
if (-not $container) { Pop-Location; Write-Error "Postgres container not running." }
$remotePath = "/tmp/cortex-backup.dump"
docker compose --env-file .env exec -T postgres pg_dump -U $pgUser -Fc $pgDb -f $remotePath
docker cp "${container}:${remotePath}" $outFile
docker compose --env-file .env exec -T postgres rm -f $remotePath | Out-Null
Pop-Location

Write-Host "Backup written: $outFile"
