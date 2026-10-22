@echo off
title ResQTrack Incident AI System EF Core SQL Server Migrations
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0migrate.ps1" %*
pause
