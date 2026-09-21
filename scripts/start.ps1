$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$pythonPath = Join-Path $projectRoot '.venv/Scripts/python.exe'
if (-not (Test-Path -LiteralPath $pythonPath)) { throw 'Run python -m venv .venv and install requirements.txt first.' }
$vitePath = Join-Path $projectRoot 'node_modules/vite/bin/vite.js'
if (-not (Test-Path -LiteralPath $vitePath)) { throw 'Run npm install first.' }
$nodePath = (Get-Command node.exe).Source
$logFolder = Join-Path $projectRoot 'data/logs'
New-Item -ItemType Directory -Force -Path $logFolder | Out-Null
foreach ($service in @(
    @{ Port = 9002; File = $pythonPath; Args = @('-m','uvicorn','backend.main:app','--host','127.0.0.1','--port','9002'); Name = 'backend' },
    @{ Port = 9003; File = $nodePath; Args = @('node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','9003','--strictPort'); Name = 'frontend' }
)) {
    $probe = [System.Net.Sockets.TcpClient]::new()
    $listening = $false
    try { $probe.Connect('127.0.0.1', $service.Port); $listening = $true } catch {} finally { $probe.Dispose() }
    if ($listening) { Write-Host "Port $($service.Port) is already listening; no process was replaced."; continue }
    $process = Start-Process -FilePath $service.File -ArgumentList $service.Args -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logFolder "$($service.Name).log") -RedirectStandardError (Join-Path $logFolder "$($service.Name).error.log")
    if ($process.WaitForExit(800)) { throw "$($service.Name) exited. Check logs in data/logs." }
    Write-Host "$($service.Name) started (PID $($process.Id), port $($service.Port))."
}
Write-Host 'Compass: http://127.0.0.1:9003/'
