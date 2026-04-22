param(
    [string]$EnvFile = ".env"
)

$backendScript = Join-Path $PSScriptRoot "backend\start-backend.ps1"

if (-not (Test-Path $backendScript)) {
    Write-Error "Could not find backend launcher at $backendScript"
    exit 1
}

& $backendScript -EnvFile $EnvFile
exit $LASTEXITCODE
