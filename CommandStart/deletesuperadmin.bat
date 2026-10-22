@echo off
title ResQTrack Incident AI System - Delete SuperAdmin CLI
cls
echo ======================================================================
echo   RESQTRACK INCIDENT AI SYSTEM -- DELETE SUPERADMIN ACCOUNT
echo ======================================================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0deletesuperadmin.ps1" %*
pause
