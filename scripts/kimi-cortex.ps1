# Launch Kimi Code CLI in the Cortex repo.
# Usage: npm run kimi
#        npm run kimi -- -p "summarize tasks API" --quiet
param()

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$LocalBin = Join-Path $env:USERPROFILE ".local\bin"
$Kimi = Join-Path $LocalBin "kimi.exe"

if (-not (Test-Path $Kimi)) {
  Write-Host "kimi not installed. Run: npm run kimi:install"
  exit 1
}

if ($env:PATH -notlike "*$LocalBin*") {
  $env:PATH = "$LocalBin;$env:PATH"
}

$BackendEnv = Join-Path $Root "backend\.env"

function Import-DotenvLine {
  param([string]$Path, [string]$Key)
  if (-not (Test-Path $Path)) { return }
  foreach ($line in Get-Content $Path) {
    $t = $line.Trim()
    if (-not $t -or $t.StartsWith("#")) { continue }
    if ($t -match "^\s*$([regex]::Escape($Key))\s*=\s*(.+)\s*$") {
      $val = $Matches[1].Trim().Trim('"').Trim("'")
      if (-not [string]::IsNullOrWhiteSpace($val) -and -not [Environment]::GetEnvironmentVariable($Key)) {
        [Environment]::SetEnvironmentVariable($Key, $val, "Process")
      }
      return
    }
  }
}

Import-DotenvLine -Path $BackendEnv -Key "OPENAI_API_KEY"
Import-DotenvLine -Path $BackendEnv -Key "ANTHROPIC_API_KEY"
Import-DotenvLine -Path $BackendEnv -Key "KIMI_API_KEY"
Import-DotenvLine -Path $BackendEnv -Key "MOONSHOT_API_KEY"
Import-DotenvLine -Path $BackendEnv -Key "KIMI_CODE_API_KEY"
Import-DotenvLine -Path $BackendEnv -Key "KIMICODE"
Import-DotenvLine -Path $BackendEnv -Key "KIMI"
Import-DotenvLine -Path $BackendEnv -Key "KIMI_MODEL_NAME"
Import-DotenvLine -Path $BackendEnv -Key "KIMI_BASE_URL"

$KimiEnv = Join-Path $Root ".env.kimi"
Import-DotenvLine -Path $KimiEnv -Key "KIMI_API_KEY"
Import-DotenvLine -Path $KimiEnv -Key "MOONSHOT_API_KEY"
Import-DotenvLine -Path $KimiEnv -Key "KIMI_CODE_API_KEY"
Import-DotenvLine -Path $KimiEnv -Key "KIMI_MODEL_NAME"
Import-DotenvLine -Path $KimiEnv -Key "KIMI_BASE_URL"

if (-not $env:KIMI_API_KEY -and $env:KIMICODE) { $env:KIMI_API_KEY = $env:KIMICODE.Trim() }
if (-not $env:KIMI_API_KEY -and $env:KIMI) { $env:KIMI_API_KEY = $env:KIMI }
if (-not $env:KIMI_API_KEY -and $env:KIMI_CODE_API_KEY) { $env:KIMI_API_KEY = $env:KIMI_CODE_API_KEY }
if (-not $env:KIMI_API_KEY -and $env:MOONSHOT_API_KEY) { $env:KIMI_API_KEY = $env:MOONSHOT_API_KEY }

function Sync-KimiConfigFromBackend {
  param([string]$BackendEnvPath)
  if (-not (Test-Path $BackendEnvPath)) { return }
  $key = $null
  foreach ($line in Get-Content $BackendEnvPath) {
    $t = $line.Trim()
    if (-not $t -or $t.StartsWith("#")) { continue }
    if ($t -match '^\s*(KIMI_CODE_API_KEY|KIMI_API_KEY|MOONSHOT_API_KEY)\s*=\s*(.+)\s*$') {
      $val = $Matches[2].Trim().Trim('"').Trim("'")
      if ($val) { $key = $val; break }
    }
  }
  if (-not $key) { return }
  $cfg = Join-Path $env:USERPROFILE ".kimi\config.toml"
  if (-not (Test-Path $cfg)) { return }
  $content = Get-Content $cfg -Raw
  $escaped = $key.Replace('"', '\"')
  $content = $content -replace '(?m)^api_key = ".*"$', "api_key = `"$escaped`""
  Set-Content -Path $cfg -Value $content -NoNewline
}

Sync-KimiConfigFromBackend -BackendEnvPath $BackendEnv

if ($env:KIMI_API_KEY -match "^sk-kimi-" -or $env:KIMI_CODE_API_KEY) {
  if (-not $env:KIMI_BASE_URL) { $env:KIMI_BASE_URL = "https://api.kimi.com/coding/v1" }
  if (-not $env:KIMI_MODEL_NAME) { $env:KIMI_MODEL_NAME = "kimi-for-coding" }
} elseif ($env:KIMI_API_KEY -and -not $env:KIMI_MODEL_NAME) {
  $env:KIMI_MODEL_NAME = "kimi-k2.6"
}

Push-Location $Root
try {
  if ($args.Count -eq 0) {
    & $Kimi
  } else {
    & $Kimi @args
  }
} finally {
  Pop-Location
}
