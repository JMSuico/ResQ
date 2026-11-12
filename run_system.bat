@echo off
setlocal enabledelayedexpansion
title ResQTrack Incident AI System - 1-Click System Launcher [Backend :1999 | Admin :1996 | Responders :1997 | Civilian :1998]
cd /d "%~dp0"

echo ================================================================================
echo    RESQTRACK INCIDENT AI DETECTION SYSTEM - 1-CLICK SYSTEM LAUNCHER
echo    Sector: Katipunan, Zamboanga del Norte (7109)
echo ================================================================================
echo.
echo Launching Backend Web API and 3 Role-Isolated Frontend Portals...
echo   - Backend Core API  : http://localhost:1999/scalar/v1
echo   - Admin Portal      : http://localhost:1996
echo   - Responders Portal : http://localhost:1997
echo   - Civilian Portal   : http://localhost:1998
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "& { & '%~dp0CommandStart\manage.ps1' -Action start; Start-Process 'http://localhost:1996'; Start-Process 'http://localhost:1997'; Start-Process 'http://localhost:1998'; }"

echo.
echo ================================================================================
echo ResQTrack System is running. Press any key to manage or stop processes.
echo ================================================================================
pause
