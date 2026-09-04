$ErrorActionPreference = 'Stop'

$appRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$runtimeRoot = 'C:\Users\moham\.cache\codex-runtimes\codex-primary-runtime\dependencies'
$node = Join-Path $runtimeRoot 'node\bin\node.exe'
$webpack = Join-Path $appRoot 'node_modules\webpack-dev-server\bin\webpack-dev-server.js'
$webpackConfig = Join-Path $appRoot 'poc\webpack.renderer.poc.ts'
$scenario = Join-Path $appRoot 'poc\capture-all-features.js'
$serverLog = Join-Path $env:TEMP 'worktreewise-poc-renderer.log'
$serverErrorLog = Join-Path $env:TEMP 'worktreewise-poc-renderer.error.log'

$env:NODE_ENV = 'development'
$env:TS_NODE_TRANSPILE_ONLY = 'true'
$env:NODE_OPTIONS = '-r ts-node/register --no-warnings'

$server = Start-Process -FilePath $node -ArgumentList @($webpack, '--config', $webpackConfig) -WorkingDirectory $appRoot -WindowStyle Hidden -RedirectStandardOutput $serverLog -RedirectStandardError $serverErrorLog -PassThru
try {
  $deadline = (Get-Date).AddSeconds(90)
  do {
    Start-Sleep -Milliseconds 500
    $ready = Test-NetConnection -ComputerName localhost -Port 1212 -InformationLevel Quiet -WarningAction SilentlyContinue
  } until ($ready -or (Get-Date) -gt $deadline -or $server.HasExited)
  if (-not $ready) { throw "Renderer did not become ready. See $serverErrorLog" }
  & $node $scenario
  if ($LASTEXITCODE -ne 0) { throw "Feature screenshot capture failed with exit code $LASTEXITCODE" }
} finally {
  if (-not $server.HasExited) { Stop-Process -Id $server.Id -Force }
}

