$ErrorActionPreference = 'Stop'
$pidFile=Join-Path $PSScriptRoot 'logs/server.pid'
if (-not (Test-Path -LiteralPath $pidFile)){Write-Host 'No recorded server process.';exit 0}
$voicePid=[int](Get-Content -LiteralPath $pidFile)
$proc=Get-CimInstance Win32_Process -Filter "ProcessId=$voicePid"
$entry=Join-Path $PSScriptRoot 'node_modules/next/dist/bin/next'
if ($proc) {
 if (-not $proc.CommandLine.Contains($entry)) {throw 'PID belongs to a different process; refusing to stop it.'}
 Stop-Process -Id $voicePid
}
Remove-Item -LiteralPath $pidFile
Write-Host 'Vinson Voice stopped.'
