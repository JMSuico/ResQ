@echo off
setlocal enabledelayedexpansion
title ResQTrack Incident AI System - 1-Click System Launcher [Backend :5000 | Responders :5173 | Admin :5174 | Civilian :5175]
cd /d "%~dp0"

echo ================================================================================
echo    RESQTRACK INCIDENT AI DETECTION SYSTEM - 1-CLICK SYSTEM LAUNCHER
echo    Sector: Katipunan, Zamboanga del Norte (7109)
echo ================================================================================
echo.
echo Launching Backend Web API and 3 Role-Isolated Frontend Portals...
echo   - Backend Core API  : http://localhost:5000/scalar/v1
echo   - Responders Portal : http://localhost:5173
echo   - Admin Portal      : http://localhost:5174
echo   - Civilian Portal   : http://localhost:5175
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "& { & '%~dp0CommandStart\manage.ps1' -Action start; Start-Process 'http://localhost:5174'; Start-Process 'http://localhost:5173'; Start-Process 'http://localhost:5175'; }"

echo.
echo ================================================================================
echo ResQTrack System is running. Press any key to manage or stop processes.
echo ================================================================================
pause
