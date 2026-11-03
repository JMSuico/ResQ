@echo off
title ResQTrack Incident AI -- Docker Multi-Container Launcher
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0docker-start-all.ps1" %*
pause
