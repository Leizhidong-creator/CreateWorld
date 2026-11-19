param()
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$destination = Join-Path $projectRoot 'beyond-the-walls'
$source = 'https://github.com/SSxs-wym/Beyond-The-Walls-.git'
if (Test-Path -LiteralPath $destination) {
    if (-not (Test-Path -LiteralPath (Join-Path $destination 'Beyond the wall/index.html'))) {
        throw "Existing installation is incomplete: $destination. Preserve or rename it before reinstalling."
    }
    Write-Host "Already installed: $destination"
} else {
    & git clone --depth 1 $source $destination
    if ($LASTEXITCODE -ne 0) { throw 'Could not clone Beyond The Walls.' }
}
Write-Host 'Start Create World with start-local.cmd, then visit http://127.0.0.1:8787/#/explore/walls'
