# Shallow clone / update InsForge into vendor/insforge for docker compose include.
param(
  [string]$Ref = "main"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Target = Join-Path $Root "vendor\insforge"
$Repo = "https://github.com/InsForge/InsForge.git"

if (Test-Path (Join-Path $Target ".git")) {
  Write-Host "Updating vendor/insforge ..."
  Push-Location $Target
  git fetch origin $Ref --depth 1 2>$null
  git checkout $Ref 2>$null
  git pull origin $Ref --depth 1 2>$null
  Pop-Location
} else {
  New-Item -ItemType Directory -Force -Path (Join-Path $Root "vendor") | Out-Null
  Write-Host "Cloning InsForge into vendor/insforge ..."
  git clone --depth 1 --branch $Ref $Repo $Target
}

Write-Host "Done. Start with: npm run insforge:up"
