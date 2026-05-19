# One-shot Pi for Cortex. Usage:
#   npm run pi:task -- Summarize backend/src/routes/cortex
param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$Rest,
  [string]$Tools = "read,grep,find,ls"
)

$ErrorActionPreference = "Stop"
$prompt = ($Rest -join " ").Trim()
if (-not $prompt) {
  Write-Error "Usage: npm run pi:task -- <your prompt>"
  exit 1
}

$Root = Split-Path -Parent $PSScriptRoot
$piArgs = @("-p", $prompt, "--tools", $Tools, "--no-session")
& (Join-Path $Root "scripts\pi-cortex.ps1") @piArgs
