@echo off
title Start ResQTrack Incident AI Dev [Backend :5000 ^| Responders :5173 ^| Admin :5174 ^| Civilian :5175]
cls
echo ======================================================================
echo   RESQTRACK INCIDENT AI SYSTEM -- MULTI-PORT SEPARATED DEV ENVIRONMENT
echo   Backend (:5000) ^| Responders (:5173) ^| Admin (:5174) ^| Civilian (:5175)
echo   Distributed Redis Cache (:6379) ^| Relational Database Tier
echo ======================================================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0startdev-all.ps1" %*
pause
