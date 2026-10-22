@echo off
:: ============================================================================
:: ResQTrack Incident AI System Detection -- Database Migration Utility
:: Target RDBMS: Microsoft SQL Server (SSMS 19 Compatible)
:: Executes EF Core database migrations targeting SQL Server via manage.ps1
:: ============================================================================
title ResQTrack Incident AI System EF Core SQL Server Migrations
cls
echo ======================================================================
echo   RESQTRACK INCIDENT AI SYSTEM -- EF CORE SQL SERVER MIGRATIONS
echo   Interactive Microsoft SQL Server (SSMS 19) Schema Migration Utility
echo ======================================================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0manage.ps1" migrate
pause
