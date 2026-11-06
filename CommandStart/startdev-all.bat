@echo off
title ResQTrack Incident AI Dev [Backend :5000 ^| Responders :5173 ^| Admin :5174 ^| Civilian :5175]
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0startdev-all.ps1" %*
pause
