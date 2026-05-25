# Install Kimi Code CLI (same as: curl -L code.kimi.com/install.sh | bash)
# Uses uv; on Windows run this instead of piping to bash.
$ErrorActionPreference = "Stop"

$Uv = Join-Path $env:USERPROFILE ".local\bin\uv.exe"
if (-not (Test-Path $Uv)) {
  Write-Host "uv not found. Installing uv ..."
  curl.exe -fsSL https://astral.sh/uv/install.sh | bash
  if (-not (Test-Path $Uv)) {
    Write-Error "uv install failed. Install from https://docs.astral.sh/uv/ then re-run."
  }
}

Write-Host "Installing kimi-cli (Python 3.13) via uv ..."
& $Uv tool install --python 3.13 kimi-cli
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$Kimi = Join-Path $env:USERPROFILE ".local\bin\kimi.exe"
if (-not (Test-Path $Kimi)) {
  Write-Error "kimi not found after install. Add %USERPROFILE%\.local\bin to PATH and restart the terminal."
}

Write-Host ""
& $Kimi info
Write-Host ""
Write-Host "Done. From Cortex repo root:"
Write-Host "  npm run kimi          # interactive agent in this repo"
Write-Host "  npm run kimi:web      # browser UI on http://127.0.0.1:5494"
Write-Host "  docs/kimi-code-cli.md"
