@echo off
title ResQTrack Incident AI -- Auto Install Dependencies
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-dependencies.ps1" %*
pause
