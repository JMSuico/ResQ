@echo off
setlocal enabledelayedexpansion
title ResQTrack Incident AI Management Console

cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0manage.ps1" %*

if "%~1"=="" (
    pause
)
