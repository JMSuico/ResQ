@echo off
title ResQTrack Incident AI System - Create Custom SuperAdmin CLI
cls
echo ======================================================================
echo   RESQTRACK INCIDENT AI SYSTEM -- CREATE CUSTOM SUPERADMIN
echo ======================================================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0customcreatesuperadmin.ps1" %*
pause
