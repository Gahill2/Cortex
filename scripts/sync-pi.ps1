# Optional: shallow clone Pi monorepo into vendor/pi (for reading upstream source).
param([string]$Ref = "main")

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Target = Join-Path $Root "vendor\pi"
$Repo = "https://github.com/earendil-works/pi.git"

if (Test-Path (Join-Path $Target ".git")) {
  Write-Host "Updating vendor/pi ..."
  Push-Location $Target
  git fetch origin $Ref --depth 1 2>$null
  git checkout $Ref 2>$null
  git pull origin $Ref --depth 1 2>$null
  Pop-Location
} else {
  New-Item -ItemType Directory -Force -Path (Join-Path $Root "vendor") | Out-Null
  Write-Host "Cloning Pi into vendor/pi ..."
  git clone --depth 1 --branch $Ref $Repo $Target
}

Write-Host "Done. Use Pi via: npm run pi:install && npm run pi"
