@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-postgres-docker.ps1" %*
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] PostgreSQL Docker failed to start.
    pause
)
