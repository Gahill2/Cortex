# Sync skills from vendor/anthropic-skills into .cursor/skills/ (Cursor native format).
# Run from repo root:  .\scripts\sync-anthropic-skills.ps1
# Requires: git submodule at vendor/anthropic-skills (see docs/anthropic-skills.md)

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$vendorRoot = Join-Path $repoRoot "vendor\anthropic-skills"
$skillsSrc = Join-Path $vendorRoot "skills"
$destRoot = Join-Path $repoRoot ".cursor\skills"

if (-not (Test-Path $skillsSrc)) {
  Write-Error "Missing vendor/anthropic-skills/skills. Run: git submodule update --init vendor/anthropic-skills"
}

$reserved = @("design", "goal", "lazyweb")
$prefix = "anthropic-"

New-Item -ItemType Directory -Force -Path $destRoot | Out-Null

$installed = 0
$skipped = 0
Get-ChildItem -Path $skillsSrc -Directory | ForEach-Object {
  $name = $_.Name
  if ($name -match '^(template|spec)$') {
    $skipped++
    return
  }

  $skillFile = Join-Path $_.FullName "SKILL.md"
  if (-not (Test-Path $skillFile)) {
    $skipped++
    return
  }

  $destName = "$prefix$name"
  if ($reserved -contains $destName) {
    Write-Warning "Skipping reserved name: $destName"
    $skipped++
    return
  }

  $dst = Join-Path $destRoot $destName
  if (Test-Path $dst) {
    Remove-Item -Recurse -Force $dst
  }
  Copy-Item -Path $_.FullName -Destination $dst -Recurse -Force
  $installed++
}

Write-Host "Synced $installed Anthropic skills to .cursor/skills/ ($prefix*). Skipped $skipped. Source: $skillsSrc"
