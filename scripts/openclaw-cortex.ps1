# OpenClaw helpers for Cortex. Usage:
#   npm run openclaw:dev          # interactive terminal UI (coding in this shell)
#   npm run openclaw:setup
#   npm run openclaw:status
#   npm run openclaw:start
#   npm run openclaw:ask -- "your prompt"
param(
  [Parameter(Position = 0)]
  [ValidateSet("setup", "status", "start", "dev", "ask", "local")]
  [string]$Action = "status",
  [Parameter(Position = 1)]
  [ValidateSet("", "kimi", "claude")]
  [string]$Provider = "",
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$Rest
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Openclaw = Get-Command openclaw -ErrorAction SilentlyContinue
if (-not $Openclaw) {
  Write-Error "openclaw not found. Install: npm install -g openclaw@latest"
  exit 1
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

function Import-BackendEnv {
  Import-DotenvLine -Path $BackendEnv -Key "KIMI_API_KEY"
  Import-DotenvLine -Path $BackendEnv -Key "MOONSHOT_API_KEY"
  Import-DotenvLine -Path $BackendEnv -Key "KIMI_CODE_API_KEY"
  Import-DotenvLine -Path $BackendEnv -Key "KIMI"
  Import-DotenvLine -Path $BackendEnv -Key "KIMICODE"
  Import-DotenvLine -Path $BackendEnv -Key "KIMI_MODEL_NAME"
  if (-not $env:KIMI_API_KEY -and $env:KIMICODE) { $env:KIMI_API_KEY = $env:KIMICODE.Trim() }
  if (-not $env:KIMI_CODE_API_KEY -and $env:KIMI_API_KEY) { $env:KIMI_CODE_API_KEY = $env:KIMI_API_KEY }
  if (-not $env:KIMI_API_KEY -and $env:KIMI) { $env:KIMI_API_KEY = $env:KIMI }
  if (-not $env:MOONSHOT_API_KEY -and $env:KIMI_API_KEY) { $env:MOONSHOT_API_KEY = $env:KIMI_API_KEY }
  if (-not $env:KIMI_API_KEY -and $env:MOONSHOT_API_KEY) { $env:KIMI_API_KEY = $env:MOONSHOT_API_KEY }
}

function Sync-OpenClawAuthFromBackend {
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
  $authPath = Join-Path $env:USERPROFILE ".openclaw\agents\main\agent\auth-profiles.json"
  if (-not (Test-Path $authPath)) { return }
  try {
    $j = Get-Content $authPath -Raw | ConvertFrom-Json
    if (-not $j.profiles) { return }
    $updated = $false
    foreach ($name in @("moonshot:default", "kimi:default", "kimi-code:default")) {
      if ($j.profiles.PSObject.Properties.Name -contains $name) {
        $p = $j.profiles.$name
        if ($p.PSObject.Properties.Name -contains "key") {
          if ($p.key -ne $key) { $p.key = $key; $updated = $true }
        }
      }
    }
    if ($updated) {
      $j | ConvertTo-Json -Depth 20 | Set-Content -Path $authPath -Encoding UTF8
      Write-Host "Synced OpenClaw auth profiles from backend/.env"
    }
  } catch {
    Write-Warning "Could not sync OpenClaw auth: $($_.Exception.Message)"
  }
}

function Get-OpenClawProvider {
  if ($Provider) { return $Provider.ToLowerInvariant() }
  $p = if ($env:OPENCLAW_PROVIDER) { $env:OPENCLAW_PROVIDER.Trim().ToLowerInvariant() } else { "kimi" }
  if ($p -in @("claude", "anthropic")) { return "claude" }
  return "kimi"
}

function Ensure-KimiModel {
  Import-BackendEnv
  Sync-OpenClawAuthFromBackend -BackendEnvPath $BackendEnv
  if (-not $env:MOONSHOT_API_KEY -and -not $env:KIMI_CODE_API_KEY) {
    Write-Error "KIMI_API_KEY, KIMI_CODE_API_KEY, or MOONSHOT_API_KEY missing in backend/.env (no spaces around =)"
    exit 1
  }
  $apiKey = $env:KIMI_CODE_API_KEY
  if ([string]::IsNullOrWhiteSpace($apiKey)) { $apiKey = $env:MOONSHOT_API_KEY }

  $modelRef = "moonshot/kimi-k2.6"
  if ($apiKey -match "^sk-kimi-") {
    $modelRef = "kimi/kimi-code"
    if ($env:KIMI_MODEL_NAME) {
      $id = $env:KIMI_MODEL_NAME.Trim()
      if ($id -eq "kimi-code" -or $id -eq "kimi/kimi-code") { $modelRef = "kimi/kimi-code" }
      elseif ($id -match "^kimi/") { $modelRef = $id }
    }
  } elseif ($env:KIMI_MODEL_NAME) {
    $id = $env:KIMI_MODEL_NAME.Trim()
    if ($id -match "^moonshot/") { $modelRef = $id }
    elseif ($id -match "^kimi/") { $modelRef = $id }
    elseif ($id -notmatch "/") { $modelRef = "moonshot/$id" }
    else { $modelRef = $id }
  }

  $current = & openclaw config get agents.defaults.model.primary 2>$null
  if ($current -ne $modelRef) {
    Write-Host "Setting OpenClaw model -> $modelRef"
    & openclaw config set agents.defaults.model.primary $modelRef
  }
}

function Ensure-ClaudeCliBackend {
  # OpenClaw spawns argv[0] directly. On Windows, "claude" resolves to claude.ps1/.cmd shims
  # (ENOENT/EINVAL). Point at node.exe + cli.js instead.
  $node = Get-Command node -ErrorAction SilentlyContinue
  if (-not $node) {
    Write-Error "node not found. Install Node.js, then: npm install -g @anthropic-ai/claude-code"
    exit 1
  }
  $cli = Join-Path $env:APPDATA "npm\node_modules\@anthropic-ai\claude-code\cli.js"
  if (-not (Test-Path $cli)) {
    Write-Error "claude-code CLI not found at $cli. Install: npm install -g @anthropic-ai/claude-code"
    exit 1
  }
  $configPath = Join-Path $env:USERPROFILE ".openclaw\openclaw.json"
  if (-not (Test-Path $configPath)) { return }
  try {
    $cfg = Get-Content $configPath -Raw | ConvertFrom-Json
    if (-not $cfg.agents) { $cfg | Add-Member -NotePropertyName agents -NotePropertyValue ([pscustomobject]@{}) }
    if (-not $cfg.agents.defaults) { $cfg.agents | Add-Member -NotePropertyName defaults -NotePropertyValue ([pscustomobject]@{}) }
    if (-not $cfg.agents.defaults.cliBackends) {
      $cfg.agents.defaults | Add-Member -NotePropertyName cliBackends -NotePropertyValue ([pscustomobject]@{})
    }
    $backendArgs = @(
      $cli,
      "-p",
      "--output-format", "stream-json",
      "--include-partial-messages",
      "--verbose",
      "--setting-sources", "user",
      "--permission-mode", "bypassPermissions"
    )
    $backend = [pscustomobject]@{
      command = $node.Source
      args    = $backendArgs
    }
    $cfg.agents.defaults.cliBackends | Add-Member -NotePropertyName "claude-cli" -NotePropertyValue $backend -Force
    $cfg | ConvertTo-Json -Depth 30 | Set-Content -Path $configPath -Encoding UTF8
    Write-Host "Configured OpenClaw claude-cli -> node + cli.js (Windows-safe spawn)"
  } catch {
    Write-Warning "Could not patch OpenClaw claude-cli backend: $($_.Exception.Message)"
  }
}

function Ensure-ClaudeModel {
  # Claude Code CLI auth (Pro/Max). Do NOT inject ANTHROPIC_API_KEY — backend/.env key has no credits
  # and would override the subscription session.
  Remove-Item Env:ANTHROPIC_API_KEY -ErrorAction SilentlyContinue
  $npmBin = Join-Path $env:APPDATA "npm"
  if ($env:PATH -notlike "*$npmBin*") {
    $env:PATH = "$npmBin;$env:PATH"
  }
  $claude = Get-Command claude -ErrorAction SilentlyContinue
  if (-not $claude) {
    Write-Error "claude CLI not found. Install: npm install -g @anthropic-ai/claude-code"
    exit 1
  }
  Ensure-ClaudeCliBackend
  $modelRef = "claude-cli/claude-opus-4-7"
  if ($env:OPENCLAW_MODEL) {
    $id = $env:OPENCLAW_MODEL.Trim()
    if ($id -match "^claude-cli/") { $modelRef = $id }
    elseif ($id -match "^anthropic/") { $modelRef = $id -replace "^anthropic/", "claude-cli/" }
    elseif ($id -notmatch "/") { $modelRef = "claude-cli/$id" }
    else { $modelRef = $id }
  }
  $current = & openclaw config get agents.defaults.model.primary 2>$null
  if ($current -ne $modelRef) {
    Write-Host "Setting OpenClaw model -> $modelRef"
    & openclaw config set agents.defaults.model.primary $modelRef
  }
}

function Ensure-ProviderModel {
  if ((Get-OpenClawProvider) -eq "claude") {
    Ensure-ClaudeModel
  } else {
    Ensure-KimiModel
  }
}

function Ensure-LlmEnv {
  Import-BackendEnv
  if ((Get-OpenClawProvider) -eq "claude") {
    Remove-Item Env:ANTHROPIC_API_KEY -ErrorAction SilentlyContinue
  } else {
    Import-DotenvLine -Path $BackendEnv -Key "ANTHROPIC_API_KEY"
  }
}

function Ensure-Workspace {
  $current = & openclaw config get agents.defaults.workspace 2>$null
  $normalizedRoot = (Resolve-Path $Root).Path
  if ($current -and ($current.Trim() -eq $normalizedRoot)) {
    Write-Host "Workspace already set: $normalizedRoot"
    return
  }
  Write-Host "Setting OpenClaw workspace -> $normalizedRoot"
  & openclaw config set agents.defaults.workspace $normalizedRoot
}

function Start-GatewayBackground {
  $probe = & openclaw gateway probe 2>&1 | Out-String
  if ($probe -match "Reachable:\s*yes") {
    Write-Host "Gateway already reachable on port 18789."
    return
  }
  Write-Host "Starting Gateway in background (openclaw gateway run)..."
  $openclawExe = (Get-Command openclaw).Source
  Start-Process -FilePath $openclawExe -ArgumentList @("gateway", "run", "--port", "18789") -WindowStyle Minimized
  Start-Sleep -Seconds 6
  & openclaw gateway probe
}

switch ($Action) {
  "setup" {
    Ensure-Workspace
    Ensure-ProviderModel
    Write-Host "Installing Gateway logon startup item..."
    & openclaw gateway install --force
    Start-GatewayBackground
    Write-Host ""
    Write-Host "Done. In this repo, run:"
    Write-Host "  npm run openclaw:dev     # interactive coding in your terminal"
  }
  "dev" {
    Ensure-Workspace
    Ensure-LlmEnv
    Ensure-ProviderModel
    Start-GatewayBackground
    $label = if ((Get-OpenClawProvider) -eq "claude") { "Claude (Pro via claude-cli)" } else { "Kimi" }
    Write-Host "OpenClaw TUI - $label - workspace: $Root"
    Write-Host "Type tasks here; agent can run shell commands and edit files."
    Push-Location $Root
    try {
      & openclaw tui --session main
    } finally {
      Pop-Location
    }
  }
  "start" {
    & openclaw gateway start 2>$null
    Start-GatewayBackground
  }
  "status" {
    & openclaw agents list
    Write-Host ""
    & openclaw gateway probe
  }
  "ask" {
    $prompt = ($Rest -join " ").Trim()
    if (-not $prompt) {
      Write-Error "Usage: npm run openclaw:ask -- your prompt"
      exit 1
    }
    Ensure-Workspace
    Ensure-LlmEnv
    Ensure-ProviderModel
    Start-GatewayBackground
    Push-Location $Root
    try {
      & openclaw agent --agent main --message $prompt --thinking off
    } finally {
      Pop-Location
    }
  }
  "local" {
    $prompt = ($Rest -join " ").Trim()
    if (-not $prompt) {
      Write-Error "Usage: npm run openclaw:local -- your prompt"
      exit 1
    }
    Ensure-Workspace
    Ensure-LlmEnv
    Ensure-ProviderModel
    Push-Location $Root
    try {
      & openclaw agent --agent main --message $prompt --local --thinking off
    } finally {
      Pop-Location
    }
  }
}
