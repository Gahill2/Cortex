# Sync task-observer into .cursor/skills/ (Cursor native format).
# Run from repo root: .\scripts\sync-task-observer.ps1

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$vendor = Join-Path $repoRoot "vendor\task-observer"
$dest = Join-Path $repoRoot ".cursor\skills\task-observer"

if (-not (Test-Path (Join-Path $vendor "SKILL.md"))) {
  Write-Error "Missing vendor/task-observer. Run: git submodule update --init vendor/task-observer"
}

New-Item -ItemType Directory -Force -Path $dest | Out-Null
Copy-Item (Join-Path $vendor "SKILL.md") (Join-Path $dest "SKILL.md") -Force
if (Test-Path (Join-Path $vendor "LICENSE.txt")) {
  Copy-Item (Join-Path $vendor "LICENSE.txt") (Join-Path $dest "LICENSE.txt") -Force
}
if (Test-Path (Join-Path $vendor "USER-GUIDE.md")) {
  Copy-Item (Join-Path $vendor "USER-GUIDE.md") (Join-Path $dest "USER-GUIDE.md") -Force
}
Copy-Item (Join-Path $repoRoot "skills\task-observer-cortex.md") (Join-Path $dest "CORTEX-WORKSPACE.md") -Force

Write-Host "Synced task-observer to .cursor/skills/task-observer/"
