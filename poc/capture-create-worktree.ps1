$ErrorActionPreference = 'Stop'

$appRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$runtimeRoot = 'C:\Users\moham\.cache\codex-runtimes\codex-primary-runtime\dependencies'
$node = Join-Path $runtimeRoot 'node\bin\node.exe'
$webpack = Join-Path $appRoot 'node_modules\webpack-dev-server\bin\webpack-dev-server.js'
$webpackConfig = Join-Path $appRoot 'poc\webpack.renderer.poc.ts'
$scenario = Join-Path $appRoot 'poc\create-worktree.js'
$encoder = Join-Path $appRoot 'poc\encode-media.ps1'
$serverLog = Join-Path $appRoot 'poc\artifacts\webpack-dev-server.log'
$serverErrorLog = Join-Path $appRoot 'poc\artifacts\webpack-dev-server.error.log'

New-Item -ItemType Directory -Force -Path (Split-Path -Parent $serverLog) | Out-Null
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
  if (-not $ready) {
    throw "WorktreeWise renderer did not become ready. See $serverLog"
  }
  & $node $scenario
  if ($LASTEXITCODE -ne 0) { throw "Create Worktree scenario failed with exit code $LASTEXITCODE" }
  & powershell -NoProfile -ExecutionPolicy Bypass -File $encoder
  if ($LASTEXITCODE -ne 0) { throw "Media encoding failed with exit code $LASTEXITCODE" }
} finally {
  if (-not $server.HasExited) { Stop-Process -Id $server.Id -Force }
}
