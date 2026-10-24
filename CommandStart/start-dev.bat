@echo off
title Start ResQTrack Incident AI System Dev [Backend :5000 | Responders :5173 | Admin :5174]
cls
echo ======================================================================
echo   RESQTRACK INCIDENT AI SYSTEM -- STARTING MULTI-PORT DEV ENVIRONMENT
echo   Backend (:5000) ^| Responders (:5173) ^| Admin (:5174)
echo ======================================================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0startdev-all.ps1" %*
pause
