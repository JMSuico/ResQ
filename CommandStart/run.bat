@echo off
title ResQTrack Incident AI System Dev ^& Ops Runner [Ports 5000, 5173, 5174, 5175]
cls
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0manage.ps1" %*
pause
