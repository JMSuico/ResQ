param(
    [int[]]$Ports = @(5000, 5173, 5174, 5175),
    [switch]$IncludeDocker = $false,
    [switch]$Quiet = $false
)

$killedCount = 0

foreach ($port in $Ports) {
    # Method 1: Get-NetTCPConnection
    try {
        $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
        if ($connections) {
            foreach ($conn in $connections) {
                $targetPid = $conn.OwningProcess
                if ($targetPid -and $targetPid -gt 4 -and $targetPid -ne $PID) {
                    $proc = Get-Process -Id $targetPid -ErrorAction SilentlyContinue
                    $pName = if ($proc) { $proc.ProcessName } else { "PID $targetPid" }
                    if (-not $IncludeDocker -and ($pName -eq "com.docker.backend" -or $pName -eq "docker-proxy")) {
                        continue
                    }
                    Write-Host "  [!] Terminating process $pName (PID: $targetPid) on port $port..." -ForegroundColor Yellow
                    & taskkill /F /PID $targetPid /T 2>$null | Out-Null
                    Stop-Process -Id $targetPid -Force -ErrorAction SilentlyContinue
                    $killedCount++
                }
            }
        }
    } catch { }

    # Method 2: netstat fallback
    try {
        $lines = netstat -ano | Select-String ":$port\s+.*LISTENING\s+(\d+)"
        foreach ($line in $lines) {
            if ($line.Matches.Groups[1].Value) {
                $targetPid = [int]$line.Matches.Groups[1].Value
                if ($targetPid -gt 4 -and $targetPid -ne $PID) {
                    $proc = Get-Process -Id $targetPid -ErrorAction SilentlyContinue
                    $pName = if ($proc) { $proc.ProcessName } else { "PID $targetPid" }
                    if (-not $IncludeDocker -and ($pName -eq "com.docker.backend" -or $pName -eq "docker-proxy")) {
                        continue
                    }
                    Write-Host "  [!] Terminating process $pName (PID: $targetPid) on port $port..." -ForegroundColor Yellow
                    & taskkill /F /PID $targetPid /T 2>$null | Out-Null
                    Stop-Process -Id $targetPid -Force -ErrorAction SilentlyContinue
                    $killedCount++
                }
            }
        }
    } catch { }
}

if ($IncludeDocker) {
    try {
        $ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
        if (-not $ScriptDir) { $ScriptDir = $PSScriptRoot }
        $dockerStopScript = Join-Path $ScriptDir "docker-stop-all.ps1"
        if (Test-Path $dockerStopScript) {
            & $dockerStopScript
        }
    } catch { }
}

if ($killedCount -gt 0) {
    Write-Host "  [OK] Stopped $killedCount service process(es). Ports 5000, 5173, 5174, and 5175 are now free." -ForegroundColor Green
} else {
    Write-Host "  [i] No active host services detected on ports 5000, 5173, 5174, or 5175." -ForegroundColor Gray
}
