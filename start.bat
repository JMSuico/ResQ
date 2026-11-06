@echo off
setlocal enabledelayedexpansion
title ResQTrack Incident AI Management Console [Backend :5000 ^| Responders :5173 ^| Admin :5174 ^| Civilian :5175]

cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1" %*

if "%~1"=="" (
    pause
)
