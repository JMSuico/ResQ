@echo off
title Stop Incident AI System Services [Ports 5000, 5173, 5174, 5175]
cls
echo ======================================================================
echo   RESQTRACK INCIDENT AI SYSTEM -- STOPPING ALL SERVICES
echo   Freeing Ports 5000, 5173, 5174, and 5175
echo ======================================================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0stopdev-all.ps1" %*
pause
