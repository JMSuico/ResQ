@echo off
title Start ResQTrack Incident AI System Dev [Backend :5000 | Frontend :5173]
cls
echo ======================================================================
echo   RESQTRACK INCIDENT AI SYSTEM -- STARTING 2-SERVICE DEV PREVIEW
echo   Backend (:5000) ^| Frontend (:5173)
echo ======================================================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0manage.ps1" start
pause
