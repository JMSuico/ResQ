@echo off
title ResQTrack Incident AI System - Stop Dev Services [Ports 5000, 5173, 5174, 5175]
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0stopdev-all.ps1" %*
pause
