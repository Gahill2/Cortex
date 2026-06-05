# Launch Pi in the Cortex repo with env + MCP ready.
# Usage: npm run pi -- -p "task" --tools read,grep --no-session
#        npm run pi   (interactive)
param()

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$BackendEnv = Join-Path $Root "backend\.env"

if (-not $env:PI_SKIP_VERSION_CHECK) { $env:PI_SKIP_VERSION_CHECK = "1" }

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

Import-DotenvLine -Path $BackendEnv -Key "ANTHROPIC_API_KEY"
Import-DotenvLine -Path $BackendEnv -Key "OPENAI_API_KEY"

if (-not (Test-Path (Join-Path $Root ".mcp.json"))) {
  $ex = Join-Path $Root ".mcp.json.example"
  if (Test-Path $ex) {
    Copy-Item $ex (Join-Path $Root ".mcp.json")
    Write-Host "Created .mcp.json from example (Cortex MCP at :3001)."
  }
}

# npm's pi.ps1 shim can be slow/noisy in non-TTY shells; call the CLI entry directly.
$PiCli = Join-Path $env:APPDATA "npm\node_modules\@earendil-works\pi-coding-agent\dist\cli.js"
if (-not (Test-Path $PiCli)) {
  $PiCli = $null
}

Push-Location $Root
try {
  if ($PiCli) {
    if ($args.Count -eq 0) {
      & node $PiCli
    } else {
      & node $PiCli @args
    }
  } elseif ($args.Count -eq 0) {
    & pi
  } else {
    & pi @args
  }
} finally {
  Pop-Location
}
