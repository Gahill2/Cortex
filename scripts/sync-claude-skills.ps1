# Sync skills from vendor/claude-skills into .cursor/skills/ (Cursor native format).
# Run from repo root:  .\scripts\sync-claude-skills.ps1
# Requires: git submodule at vendor/claude-skills (see docs/claude-skills.md)

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$vendorRoot = Join-Path $repoRoot "vendor\claude-skills"
$destRoot = Join-Path $repoRoot ".cursor\skills"

if (-not (Test-Path $vendorRoot)) {
  Write-Error "Missing vendor/claude-skills. Run: git submodule update --init --recursive"
}

$excludePattern = '(\\\.gemini\\|\\\.codex\\|\\\.claude\\|\\tests\\|eval-workspace|\\templates\\|\\\.github\\|\\docs\\|\\scripts\\)'
$reserved = @("design", "goal")  # project-local skills — never overwrite

New-Item -ItemType Directory -Force -Path $destRoot | Out-Null

$skills = Get-ChildItem -Path $vendorRoot -Recurse -Filter "SKILL.md" -File |
  Where-Object { $_.FullName -notmatch $excludePattern }

$byName = @{}
foreach ($file in $skills) {
  $dir = $file.Directory.FullName
  $name = $file.Directory.Name
  if ($name -match '^(README|TEMPLATE)$') { continue }

  # Prefer deeper paths when names collide (e.g. skills/foo vs bundle/foo)
  if (-not $byName.ContainsKey($name) -or $dir.Length -gt $byName[$name].Length) {
    $byName[$name] = $dir
  }
}

$installed = 0
$skipped = 0
foreach ($entry in $byName.GetEnumerator()) {
  $name = $entry.Key
  $src = $entry.Value

  if ($reserved -contains $name) {
    $skipped++
    continue
  }

  $dst = Join-Path $destRoot $name
  if (Test-Path $dst) {
    Remove-Item -Recurse -Force $dst
  }
  Copy-Item -Path $src -Destination $dst -Recurse -Force
  $installed++
}

Write-Host "Synced $installed skills to .cursor/skills/ (skipped $skipped reserved + $($skills.Count - $byName.Count) duplicates)."
