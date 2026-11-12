@echo off
setlocal enabledelayedexpansion
title ResQTrack Incident AI Management Console [Backend :1999 ^| Admin :1996 ^| Responders :1997 ^| Civilian :1998]

cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1" %*

if "%~1"=="" (
    pause
)
