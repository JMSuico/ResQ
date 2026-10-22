@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0stopdev-all.ps1" %*
pause
