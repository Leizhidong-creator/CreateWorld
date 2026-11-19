param([switch]$Rebuild)
$ErrorActionPreference = 'Stop'
$workbench = Join-Path $PSScriptRoot 'create-world-workbench'
Set-Location -LiteralPath $workbench
$nodeVersion = (& node --version).TrimStart('v')
if ([int]$nodeVersion.Split('.')[0] -lt 24) { throw 'Node.js 24 or newer is required.' }

# Use the installed native executable; Node cannot spawn the Windows npm shim directly.
if (-not $env:CODEX_BINARY) {
    $appBin = Join-Path $env:LOCALAPPDATA 'OpenAI\Codex\bin'
    if (Test-Path -LiteralPath $appBin) {
        $native = Get-ChildItem -LiteralPath $appBin -Recurse -Filter codex.exe -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if ($native) { $env:CODEX_BINARY = $native.FullName }
    }
}
if (-not $env:CODEX_BINARY) {
    $shim = Get-Command codex.cmd -ErrorAction SilentlyContinue
    if ($shim) {
        $package = Join-Path (Split-Path $shim.Source) 'node_modules\@openai\codex'
        $native = Get-ChildItem -LiteralPath $package -Recurse -Filter codex.exe -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($native) { $env:CODEX_BINARY = $native.FullName }
    }
}
if (-not $env:CODEX_BINARY -or -not (Test-Path -LiteralPath $env:CODEX_BINARY)) { throw 'Set CODEX_BINARY to the installed native codex.exe.' }

if (-not $env:CREATE_WORLD_PYTHON) {
    $python = Get-Command python.exe -ErrorAction SilentlyContinue
    if ($python) { $env:CREATE_WORLD_PYTHON = $python.Source }
}
if (-not $env:CREATE_WORLD_PYTHON) { throw 'Set CREATE_WORLD_PYTHON to Python 3 with Pillow.' }
& $env:CREATE_WORLD_PYTHON -c 'from PIL import Image'
if ($LASTEXITCODE -ne 0) { throw 'The selected Python needs Pillow.' }
$env:CW_PYTHON = $env:CREATE_WORLD_PYTHON
if (-not $env:CW_CHROME_PATH) {
    foreach ($candidate in @("$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe")) {
        if (Test-Path -LiteralPath $candidate) { $env:CW_CHROME_PATH = $candidate; break }
    }
}
if (-not $env:CW_PORT) { $env:CW_PORT = '8787' }
if (-not $env:CW_PREVIEW_PORT) { $env:CW_PREVIEW_PORT = '8790' }
if (-not $env:CW_DATA_DIR) { $env:CW_DATA_DIR = Join-Path $workbench 'data' }
$listening = Get-NetTCPConnection -LocalPort ([int]$env:CW_PORT) -State Listen -ErrorAction SilentlyContinue
if ($listening) {
    $existing = Invoke-RestMethod "http://127.0.0.1:$env:CW_PORT/api/bootstrap" -TimeoutSec 15
    if ($existing.version -ne '0.2.0-autonomous') { throw 'This port belongs to another service.' }
    Write-Host "Workbench is already running: http://127.0.0.1:$env:CW_PORT"
    exit 0
}

if (-not (Test-Path -LiteralPath (Join-Path $workbench 'node_modules'))) {
    & npm.cmd ci
    if ($LASTEXITCODE -ne 0) { throw 'npm ci failed.' }
}
if ($Rebuild -or -not (Test-Path -LiteralPath (Join-Path $workbench 'dist\web\index.html'))) {
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' }
}
Write-Host "Workbench: http://127.0.0.1:$env:CW_PORT"
Write-Host 'Keep this process running. Press Ctrl+C to stop.'
& npm.cmd start
exit $LASTEXITCODE
