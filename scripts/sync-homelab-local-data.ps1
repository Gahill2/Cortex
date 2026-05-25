# Copy local dev files (Obsidian sidecar, vault index, canvas photos) into deploy/homelab/data/api
# and ensure Obsidian env is set for Docker. Run before server:up or after local dev changes.
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Backend = Join-Path $Root "backend"
$Homelab = Join-Path $Root "deploy\homelab"
$DataApi = Join-Path $Homelab "data\api"
$EnvFile = Join-Path $Homelab ".env"
$ApiEnv = Join-Path $Homelab "env\api.env"

$VaultDefault = "C:\Users\greyh\Documents\GitHub\greyhill_brain"

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

New-Item -ItemType Directory -Force -Path $DataApi | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $DataApi "canvas-assets") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $DataApi ".cortex") | Out-Null

# Obsidian vault bind path
if (Test-Path $EnvFile) {
  $envLines = Get-Content $EnvFile
  $vaultHost = $VaultDefault
  if (Test-Path (Join-Path $Backend ".env")) {
    foreach ($line in Get-Content (Join-Path $Backend ".env")) {
      if ($line -match '^\s*OBSIDIAN_VAULT_PATH=(.+)$') {
        $v = $Matches[1].Trim().Trim('"')
        if ($v -and (Test-Path $v)) { $vaultHost = $v }
      }
    }
  }
  if (-not (Test-Path $vaultHost)) {
    Write-Warning "Obsidian vault not found at $vaultHost; set OBSIDIAN_VAULT_HOST_PATH in deploy/homelab/.env"
  } else {
    $envLines = Set-EnvKey $envLines "OBSIDIAN_VAULT_HOST_PATH" ($vaultHost -replace '\\', '/')
    $envLines | Set-Content $EnvFile -Encoding utf8
    Write-Host "OBSIDIAN_VAULT_HOST_PATH=$vaultHost"
  }
}

# api.env: Obsidian inside container
if (Test-Path $ApiEnv) {
  $apiLines = Get-Content $ApiEnv
  $apiLines = Set-EnvKey $apiLines "OBSIDIAN_VAULT_PATH" "/vault"
  $apiLines = Set-EnvKey $apiLines "OBSIDIAN_VAULT_NAME" "greyhill_brain"
  $apiLines = Set-EnvKey $apiLines "OBSIDIAN_AI_LOG_ENABLED" "true"
  $apiLines = Set-EnvKey $apiLines "OBSIDIAN_USE_CLI" "false"
  $apiLines | Set-Content $ApiEnv -Encoding utf8
}

# obsidian-vaults.json (API falls back to OBSIDIAN_VAULT_PATH when Windows paths are invalid in Linux)
$sidecarSrc = Join-Path $Backend "obsidian-vaults.json"
if (Test-Path $sidecarSrc) {
  Copy-Item $sidecarSrc (Join-Path $DataApi "obsidian-vaults.json") -Force
  Write-Host "Copied obsidian-vaults.json"
}

# Vault search index cache
$cortexSrc = Join-Path $Backend ".cortex"
if (Test-Path $cortexSrc) {
  Copy-Item $cortexSrc (Join-Path $DataApi ".cortex") -Recurse -Force
  Write-Host "Copied .cortex/ (vault index cache)"
}

# Canvas photos
$canvasSrc = Join-Path $Backend "data\canvas-assets"
$canvasDst = Join-Path $DataApi "canvas-assets"
if (Test-Path $canvasSrc) {
  $n = (Get-ChildItem $canvasSrc -Recurse -File | Measure-Object).Count
  if ($n -gt 0) {
    Copy-Item "$canvasSrc\*" $canvasDst -Recurse -Force
    Write-Host "Copied $n canvas image file(s)"
  } else {
    Write-Host "No canvas images in backend/data/canvas-assets yet"
  }
} else {
  Write-Host "No backend/data/canvas-assets; upload home canvas images once while logged into Docker"
}

Write-Host ""
Write-Host "Local data staged in deploy/homelab/data/api"
Write-Host "Restart stack: npm run server:up"
Write-Host "Tailscale: npm run server:tailscale"
Write-Host "Health: http://127.0.0.1:4000/api/health - obsidian_vaults should be 1 or more"
