# Install Pi coding agent + Cortex MCP adapter for this repo.
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

Write-Host "Installing @earendil-works/pi-coding-agent globally ..."
npm install -g @earendil-works/pi-coding-agent
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Push-Location $Root
if (-not (Get-Command pi -ErrorAction SilentlyContinue)) {
  Write-Error "pi not on PATH after npm install. Restart the terminal and run again."
}
Write-Host "Installing pi-mcp-adapter (project-local) ..."
pi install npm:pi-mcp-adapter -l
if ($LASTEXITCODE -ne 0) {
  Pop-Location
  exit $LASTEXITCODE
}

$mcpExample = Join-Path $Root ".mcp.json.example"
$mcpFile = Join-Path $Root ".mcp.json"
if (-not (Test-Path $mcpFile) -and (Test-Path $mcpExample)) {
  Copy-Item $mcpExample $mcpFile
  Write-Host "Created .mcp.json from .mcp.json.example"
}

Pop-Location

Write-Host ""
Write-Host "Done. From repo root:"
Write-Host "  npm run dev:mcp    # Cortex MCP (port 3001)"
Write-Host "  npm run pi         # Pi coding agent"
Write-Host "  docs/pi-coding-agent.md"
