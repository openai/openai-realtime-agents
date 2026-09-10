$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$existing = Get-NetTCPConnection -LocalPort 3210 -State Listen -ErrorAction SilentlyContinue
if ($existing) {
 Write-Host 'Port 3210 is already in use. If this is Vinson Voice, it is already running.'
 exit 0
}
if (-not (Test-Path -LiteralPath '.env.local')) {Copy-Item -LiteralPath '.env.sample' -Destination '.env.local'}
if (-not (Test-Path -LiteralPath '.next/BUILD_ID')) {throw 'Run npm run build once before launching.'}
New-Item -ItemType Directory -Force -Path 'logs' | Out-Null
$env:NODE_USE_SYSTEM_CA='1'
$nodePath = (Get-Command node.exe).Source
$entry = Join-Path $PSScriptRoot 'node_modules/next/dist/bin/next'
$proc = Start-Process -FilePath $nodePath -ArgumentList @('"' + $entry + '"','start','--hostname','127.0.0.1','--port','3210') -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $PSScriptRoot 'logs/server.log') -RedirectStandardError (Join-Path $PSScriptRoot 'logs/server-error.log') -PassThru
$proc.Id | Set-Content -LiteralPath 'logs/server.pid'
Write-Host 'Vinson Voice started. Open http://localhost:3210'
