@echo off
title ResQTrack Incident AI System Administrative CLI Governance Console
cls
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0cli.ps1" %*
pause
