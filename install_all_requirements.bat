@echo off
setlocal enabledelayedexpansion
title ResQTrack Incident AI - Automated 1-Click Requirements Installer
cd /d "%~dp0"

echo ================================================================================
echo    RESQTRACK INCIDENT AI SYSTEM DETECTION - AUTOMATED REQUIREMENTS INSTALLER
echo    Sector: Katipunan, Zamboanga del Norte (7109)
echo ================================================================================
echo.

:: Check for Administrator privileges
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Administrative privileges required for installer execution.
    echo Requesting elevation...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process cmd -ArgumentList '/c \"\"%~f0\"\" %*' -Verb RunAs"
    exit /b
)

echo [OK] Running with Administrative privileges.
echo.
echo Select Database Engine to configure / verify:
echo   [1] Auto-Detect (Default: Existing SQL Server / SSMS 19 / LocalDB or PostgreSQL)
echo   [2] Microsoft SQL Server Express 2022 + SSMS 19
echo   [3] PostgreSQL (Any edition / v16 LTS)
echo.
set /p dbchoice="Choose option [1-3] (Default: 1): "

set DB_ARG=Auto
if "%dbchoice%"=="2" set DB_ARG=SSMS
if "%dbchoice%"=="3" set DB_ARG=PostgreSql

echo.
echo Starting automated requirements installation with Database=%DB_ARG%...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0CommandStart\install_requirements.ps1" -Database %DB_ARG%

echo.
echo ================================================================================
echo Setup process finished. Press any key to exit.
echo ================================================================================
pause
