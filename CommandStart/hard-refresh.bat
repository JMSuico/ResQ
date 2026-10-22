@echo off
title Hard Refresh ResQTrack Incident AI System [Ports 5000, 5173]
cls
echo ======================================================================
echo   RESQTRACK INCIDENT AI SYSTEM -- HARD REFRESH ^& REBUILD
echo   Purging Vite/Dist Caches, .NET Bin/Obj, and Restarting Services
echo ======================================================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0manage.ps1" refresh
pause
