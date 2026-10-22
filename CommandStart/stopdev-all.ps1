param(
    [int[]]$Ports = @(5000, 5173, 5174, 5175)
)

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "     INCIDENT AI SYSTEM - STOP DEV SERVICES       " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

$killedCount = 0

foreach ($port in $Ports) {
    Write-Host "Checking port $port..." -ForegroundColor Yellow
    
    # Method 1: Get-NetTCPConnection
    try {
        $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
        if ($connections) {
            foreach ($conn in $connections) {
                $targetPid = $conn.OwningProcess
                if ($targetPid -and $targetPid -gt 4 -and $targetPid -ne $PID) {
                    Write-Host "Found process PID $targetPid listening on port $port. Terminating..." -ForegroundColor Red
                    & taskkill /F /PID $targetPid /T 2>$null | Out-Null
                    Stop-Process -Id $targetPid -Force -ErrorAction SilentlyContinue
                    $killedCount++
                }
            }
        }
    } catch {
        # Fallback
    }

    # Method 2: netstat fallback
    try {
        $lines = netstat -ano | Select-String ":$port\s+.*LISTENING\s+(\d+)"
        foreach ($line in $lines) {
            if ($line.Matches.Groups[1].Value) {
                $targetPid = [int]$line.Matches.Groups[1].Value
                if ($targetPid -gt 4 -and $targetPid -ne $PID) {
                    Write-Host "Found netstat PID $targetPid on port $port. Terminating..." -ForegroundColor Red
                    & taskkill /F /PID $targetPid /T 2>$null | Out-Null
                    Stop-Process -Id $targetPid -Force -ErrorAction SilentlyContinue
                    $killedCount++
                }
            }
        }
    } catch {
        # Ignore
    }
}

Write-Host "==================================================" -ForegroundColor Cyan
if ($killedCount -gt 0) {
    Write-Host "Ports 5000, 5173, 5174, and 5175 have been successfully freed ($killedCount process(es) terminated)." -ForegroundColor Green
} else {
    Write-Host "No active processes were listening on ports 5000, 5173, 5174, or 5175." -ForegroundColor Gray
}
Write-Host "==================================================" -ForegroundColor Cyan
