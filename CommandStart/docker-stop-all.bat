@echo off
title ResQTrack Incident AI -- Docker Stop All
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0docker-stop-all.ps1" %*
pause
