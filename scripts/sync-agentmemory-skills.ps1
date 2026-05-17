# Sync agentmemory plugin skills into .cursor/skills/ (Cursor native format).
# Run from repo root:  .\scripts\sync-agentmemory-skills.ps1
# Source: vendor/agentmemory (submodule) or AGENTMEMORY_REPO env or ../agentmemory

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$vendorRoot = Join-Path $repoRoot "vendor\agentmemory"
$skillsSrc = Join-Path $vendorRoot "plugin\skills"
$destRoot = Join-Path $repoRoot ".cursor\skills"

if ($env:AGENTMEMORY_REPO) {
  $alt = Resolve-Path $env:AGENTMEMORY_REPO -ErrorAction SilentlyContinue
  if ($alt) {
    $skillsSrc = Join-Path $alt "plugin\skills"
  }
}

if (-not (Test-Path $skillsSrc)) {
  $sibling = Join-Path (Split-Path $repoRoot -Parent) "agentmemory\plugin\skills"
  if (Test-Path $sibling) {
    $skillsSrc = $sibling
  }
}

if (-not (Test-Path $skillsSrc)) {
  Write-Error @"
Missing agentmemory skills at plugin/skills.
Run: git submodule update --init vendor/agentmemory
Or clone: git clone --depth 1 https://github.com/rohitg00/agentmemory.git vendor/agentmemory
"@
}

$reserved = @("design", "goal", "lazyweb")

New-Item -ItemType Directory -Force -Path $destRoot | Out-Null

$cortexFooter = @"

## Cortex

- Memory server: ``npm run dev:memory`` or ``npm run dev:stack`` (port 3111).
- Set ``AGENTMEMORY_PROJECT=cortex`` and ``AGENTMEMORY_URL=http://127.0.0.1:3111`` in ``backend/.env``.
- Cursor MCP: ``npx -y @agentmemory/mcp`` with the same ``AGENTMEMORY_URL`` (see Memory page or ``docs/agentmemory-setup.md``).
- If MCP tools are missing, start the server first; the shim exposes the full tool surface only when ``AGENTMEMORY_URL`` is reachable.
"@

$installed = 0
Get-ChildItem -Path $skillsSrc -Directory | ForEach-Object {
  $name = $_.Name
  $skillFile = Join-Path $_.FullName "SKILL.md"
  if (-not (Test-Path $skillFile)) { return }

  $destName = "agentmemory-$name"
  if ($reserved -contains $destName) {
    Write-Warning "Skipping reserved name: $destName"
    return
  }

  $dst = Join-Path $destRoot $destName
  if (Test-Path $dst) {
    Remove-Item -Recurse -Force $dst
  }
  New-Item -ItemType Directory -Force -Path $dst | Out-Null

  $content = Get-Content -Path $skillFile -Raw
  if ($content -notmatch "## Cortex") {
    $content = $content.TrimEnd() + $cortexFooter + "`n"
  }
  Set-Content -Path (Join-Path $dst "SKILL.md") -Value $content -NoNewline

  $installed++
}

Write-Host "Synced $installed agentmemory skills to .cursor/skills/ (agentmemory-*). Source: $skillsSrc"
