# Multi-agent UI revamp: Kimi, Claude (OpenClaw), Pi.
# Usage:
#   npm run revamp:ui                    # show plan + commands
#   npm run revamp:ui:kimi -- -Batch 1   # Kimi edits batch 1
#   npm run revamp:ui:claude -- -Batch 1 # Claude via OpenClaw local
#   npm run revamp:ui:pi                 # Pi review + typecheck
#   npm run openclaw:revamp                # OpenClaw TUI coordinator
param(
  [ValidateSet("plan", "kimi", "claude", "pi", "openclaw")]
  [string]$Agent = "plan",
  [ValidateSet("1", "2", "3", "all")]
  [string]$Batch = "all",
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Brief = Join-Path $Root "prompts\ui-revamp\AGENT-BRIEF.md"

function Get-BatchFiles {
  param([string]$Id)
  switch ($Id) {
    "1" {
      return @(
        "frontend/src/pages/DashboardPage.tsx",
        "frontend/src/pages/HomePage.tsx",
        "frontend/src/pages/ProjectsPage.tsx",
        "frontend/src/pages/SettingsPage.tsx"
      )
    }
    "2" {
      return @(
        "frontend/src/pages/LoginPage.tsx",
        "frontend/src/pages/AIPage.tsx",
        "frontend/src/pages/MemoryPage.tsx",
        "frontend/src/pages/McpLinkPage.tsx"
      )
    }
    "3" {
      return @(
        "frontend/src/pages/SpotifyPage.tsx",
        "frontend/src/pages/MailPage.tsx",
        "frontend/src/pages/NotesPage.tsx",
        "frontend/src/pages/TasksCalendarPage.tsx",
        "frontend/src/styles.css"
      )
    }
    default { return @() }
  }
}

function Build-Prompt {
  param(
    [string[]]$Files,
    [string]$Role
  )
  $brief = Get-Content $Brief -Raw
  $fileList = ($Files | ForEach-Object { "- $_" }) -join "`n"
  @"
$brief

## Role: $Role

Edit ONLY these files:
$fileList

Revamp to professional SaaS layout (titlebar + subtitle + page-workbench). When done, run: cd frontend && npm run typecheck
"@
}

function Invoke-KimiBatch {
  param([string[]]$Files, [string]$BatchId)
  $prompt = Build-Prompt -Files $Files -Role "Kimi - layout and CSS structure pass"
  $promptDir = Join-Path $Root "prompts\ui-revamp"
  if (-not (Test-Path $promptDir)) { New-Item -ItemType Directory -Path $promptDir -Force | Out-Null }
  $promptFile = Join-Path $promptDir "batch-$BatchId-kimi.prompt.txt"
  $prompt += "`n`nIMPORTANT: Do not ask what to do next. Edit the listed files now using your tools. Use --yolo behavior."
  Set-Content -Path $promptFile -Value $prompt -Encoding UTF8
  if ($DryRun) {
    Write-Host "[dry-run] wrote $promptFile ($($prompt.Length) chars)"
    return
  }
  Write-Host "Prompt file: $promptFile"
  $promptText = Get-Content $promptFile -Raw
  Push-Location $Root
  try {
    & (Join-Path $Root "scripts\kimi-cortex.ps1") -p $promptText -m "kimi-code/kimi-for-coding" -y --print
  } finally {
    Pop-Location
  }
}

function Invoke-ClaudeBatch {
  param([string[]]$Files)
  $prompt = Build-Prompt -Files $Files -Role "Claude - polish, hierarchy, and component structure"
  if ($DryRun) {
    Write-Host "[dry-run] openclaw:claude:local prompt length: $($prompt.Length)"
    return
  }
  Push-Location $Root
  try {
    & npm run openclaw:claude:local -- $prompt
  } finally {
    Pop-Location
  }
}

function Invoke-PiReview {
  $prompt = @"
Read prompts/ui-revamp/AGENT-BRIEF.md and review frontend/src/pages/*.tsx for consistent page-titlebar, page-subtitle, and page-workbench usage.

Fix any inconsistencies you find (edit allowed). Run npm run typecheck in frontend/ and report pass/fail.
"@
  if ($DryRun) {
    Write-Host "[dry-run] pi:task review"
    return
  }
  Push-Location $Root
  try {
    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Root "scripts\pi-task.ps1") -Tools "read,edit,bash,grep,find" @($prompt)
  } finally {
    Pop-Location
  }
}

function Show-Plan {
  Write-Host ""
  Write-Host "Cortex UI revamp - OpenClaw + Kimi + Claude + Pi" -ForegroundColor Cyan
  Write-Host "Brief: prompts/ui-revamp/AGENT-BRIEF.md"
  Write-Host ""
  Write-Host "Batch 1 (Kimi first): Dashboard, Home, Projects, Settings"
  Write-Host "Batch 2 (Kimi):       Login, AI, Memory, MCP Link"
  Write-Host "Batch 3 (Claude polish): Mail, Notes, Tasks, Spotify + styles.css"
  Write-Host ""
  Write-Host "Commands:"
  Write-Host "  npm run revamp:ui:kimi -- -Batch 1"
  Write-Host "  npm run revamp:ui:claude -- -Batch 3"
  Write-Host "  npm run revamp:ui:pi"
  Write-Host "  npm run openclaw:revamp    # interactive coordinator TUI"
  Write-Host ""
  Write-Host "Recommended order: Kimi batch 1, 2, then Claude batch 3, then Pi review"
  Write-Host ""
}

function Get-BatchesToRun {
  if ($Batch -eq "all") { return @("1", "2", "3") }
  return @($Batch)
}

switch ($Agent) {
  "plan" { Show-Plan }
  "kimi" {
    foreach ($b in Get-BatchesToRun) {
      if ($b -eq "3") {
        Write-Warning "Batch 3 is usually Claude polish; Kimi may still run it if you intend a quick pass."
      }
      Write-Host "=== Kimi batch $b ===" -ForegroundColor Yellow
      Invoke-KimiBatch -Files (Get-BatchFiles -Id $b) -BatchId $b
    }
  }
  "claude" {
    foreach ($b in Get-BatchesToRun) {
      Write-Host "=== Claude (OpenClaw) batch $b ===" -ForegroundColor Yellow
      Invoke-ClaudeBatch -Files (Get-BatchFiles -Id $b)
    }
  }
  "pi" { Invoke-PiReview }
  "openclaw" {
    Show-Plan
    Write-Host "Starting OpenClaw TUI - paste coordinator prompt from docs/ui-revamp-pipeline.md" -ForegroundColor Green
    & (Join-Path $Root "scripts\openclaw-cortex.ps1") dev
  }
}
