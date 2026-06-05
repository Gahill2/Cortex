# Commit and push tracked changes on main (for Task Scheduler / manual runs).
# Skips if working tree is clean. Never stages .env (gitignored).
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$status = git status --porcelain 2>&1
if (-not $status) {
  Write-Host "[cloud-sync-push] Nothing to commit."
  exit 0
}

$branch = git rev-parse --abbrev-ref HEAD
if ($branch -ne "main") {
  Write-Warning "[cloud-sync-push] On branch '$branch', not main — pushing current branch only."
}

git add -A
$staged = git diff --cached --name-only
if (-not $staged) {
  Write-Host "[cloud-sync-push] No staged changes after add."
  exit 0
}

$msg = "chore: auto sync $(Get-Date -Format 'yyyy-MM-dd HH:mm') UTC"
git commit -m $msg
git push origin HEAD
Write-Host "[cloud-sync-push] Pushed: $msg"
