# Stop orphan Cortex dev / MCP processes (safe for daily use before starting Docker or npm run dev).
# Run from repo root:  .\scripts\cleanup-dev-processes.ps1
# Dry run:            .\scripts\cleanup-dev-processes.ps1 -WhatIf

param(
  [switch]$WhatIf,
  [switch]$IncludeMcp
)

$ErrorActionPreference = "Continue"

function Stop-ProcTree {
  param([int]$RootPid, [string]$Reason)
  if ($RootPid -le 0) { return }
  $proc = Get-Process -Id $RootPid -ErrorAction SilentlyContinue
  if (-not $proc) { return }

  $children = @(Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq $RootPid })
  foreach ($child in $children) {
    Stop-ProcTree -RootPid $child.ProcessId -Reason $Reason
  }

  if ($WhatIf) {
    Write-Host "[whatif] stop PID $RootPid ($($proc.ProcessName)) - $Reason"
    return
  }
  Stop-Process -Id $RootPid -Force -ErrorAction SilentlyContinue
  Write-Host "Stopped PID $RootPid ($($proc.ProcessName)) - $Reason"
}

function Stop-ByPort {
  param([int]$Port, [string]$Reason)
  $conns = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
  foreach ($conn in $conns) {
    Stop-ProcTree -RootPid $conn.OwningProcess -Reason "$Reason (port $Port)"
  }
}

function Stop-ByCommandMatch {
  param([string]$Pattern, [string]$Reason)
  $procs = @(Get-CimInstance Win32_Process | Where-Object {
    $_.CommandLine -and ($_.CommandLine -match $Pattern)
  })
  foreach ($m in $procs) {
    Stop-ProcTree -RootPid $m.ProcessId -Reason $Reason
  }
}

Write-Host "Cortex dev process cleanup$(if ($WhatIf) { ' (dry run)' })..."
Write-Host ""

# Dev servers (Vite + API)
Stop-ByPort -Port 5173 -Reason "Vite dev server"
Stop-ByPort -Port 4000 -Reason "Cortex API"

# Orphan npm dev trees from this repo
Stop-ByCommandMatch -Pattern 'dev-web\.mjs|dev-servers\.mjs|tsx watch src/server\.ts' -Reason "Cortex npm dev"
Stop-ByCommandMatch -Pattern 'concurrently.*dev:backend|concurrently.*dev:frontend' -Reason "concurrently dev parent"

if ($IncludeMcp) {
  Stop-ByCommandMatch -Pattern '@azure/mcp|azmcp\.exe' -Reason "Azure MCP (Cursor will respawn on use)"
}

Write-Host ""
Write-Host "Done. Tip: use ONE of:"
Write-Host "  npm run server:up   - Docker API + UI + Postgres (this PC as server)"
Write-Host "  npm run dev         - local API + Vite only (no Docker stack)"
Write-Host "See docs/local-server-docker.md"
