param(
    [string]$EnvFile = ".env"
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

if (-not (Test-Path $EnvFile)) {
    Write-Error "Env file '$EnvFile' was not found in $scriptDir"
    exit 1
}

Get-Content $EnvFile | ForEach-Object {
    $line = $_.Trim()

    if ([string]::IsNullOrWhiteSpace($line) -or $line.StartsWith("#")) {
        return
    }

    $pair = $line -split '=', 2
    if ($pair.Count -ne 2) {
        return
    }

    $name = $pair[0].Trim()
    $value = $pair[1]

    # Allow quoted values in .env files.
    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
        $value = $value.Substring(1, $value.Length - 2)
    }

    Set-Item -Path ("Env:" + $name) -Value $value
}

Write-Host "Loaded environment from $EnvFile"
go run ./cmd/api/main.go
exit $LASTEXITCODE
