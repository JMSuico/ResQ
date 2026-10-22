@echo off
title ResQTrack Incident AI System - Create SuperAdmin CLI
cls
echo ======================================================================
echo   RESQTRACK INCIDENT AI SYSTEM -- CREATE SUPERADMIN (LDRRMO)
echo ======================================================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0createsuperadmin.ps1" %*
pause
