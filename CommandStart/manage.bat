@echo off
title ResQTrack Incident AI System Master Controller
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0manage.ps1" %*
pause
