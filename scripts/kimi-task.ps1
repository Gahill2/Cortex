# One-shot Kimi for Cortex. Usage:
#   npm run kimi:task -- "your prompt here"
param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$Rest,
  [string]$Model = "kimi-code/kimi-for-coding"
)

$ErrorActionPreference = "Stop"
$prompt = ($Rest -join " ").Trim()
if (-not $prompt) {
  Write-Error 'Usage: npm run kimi:task -- "your prompt"'
  exit 1
}

$Root = Split-Path -Parent $PSScriptRoot
$kimiArgs = @("-p", $prompt, "-m", $Model, "--quiet")
& (Join-Path $Root "scripts\kimi-cortex.ps1") @kimiArgs
