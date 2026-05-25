# Show homelab Docker stack status and URLs.
$ErrorActionPreference = "Continue"
$Root = Split-Path -Parent $PSScriptRoot
$ComposeDir = Join-Path $Root "deploy\homelab"
$EnvFile = Join-Path $ComposeDir ".env"

Push-Location $ComposeDir
if (Test-Path $EnvFile) {
  docker compose --env-file .env ps
} else {
  docker compose ps
}
Pop-Location

Write-Host ""
$checks = @(
  @{ Name = "API health"; Url = "http://127.0.0.1:4000/api/health" },
  @{ Name = "Web UI"; Url = "http://127.0.0.1:8080/" }
)
foreach ($c in $checks) {
  try {
    $r = Invoke-WebRequest -Uri $c.Url -UseBasicParsing -TimeoutSec 5
    Write-Host ("  {0}: OK ({1})" -f $c.Name, $r.StatusCode)
  } catch {
    Write-Host ("  {0}: unreachable" -f $c.Name)
  }
}

if (Test-Path $EnvFile) {
  $user = "cortex"
  $db = "cortex"
  $port = "5432"
  foreach ($line in Get-Content $EnvFile) {
    if ($line -match '^\s*POSTGRES_USER\s*=\s*(.+)\s*$') { $user = $Matches[1].Trim().Trim('"') }
    if ($line -match '^\s*POSTGRES_DB\s*=\s*(.+)\s*$') { $db = $Matches[1].Trim().Trim('"') }
    if ($line -match '^\s*POSTGRES_PORT\s*=\s*(.+)\s*$') { $port = $Matches[1].Trim().Trim('"') }
  }
  Write-Host ""
  Write-Host "Host DATABASE_URL (for backend/.env when using Docker DB only):"
  Write-Host "  postgresql://${user}:<POSTGRES_PASSWORD from deploy/homelab/.env>@127.0.0.1:${port}/${db}"
  Write-Host "  Example file: backend/.env.homelab.example"
}
