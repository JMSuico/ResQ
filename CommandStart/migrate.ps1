param(
    [string]$Action = "",
    [string]$Name = ""
)

$ErrorActionPreference = "Stop"

# Colors for interactive menu
function Write-Header {
    param([string]$Text)
    Write-Host ""
    Write-Host "========================================================" -ForegroundColor Cyan
    Write-Host "  $Text" -ForegroundColor Cyan
    Write-Host "========================================================" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Text)
    Write-Host "[SUCCESS] $Text" -ForegroundColor Green
}

function Write-Info {
    param([string]$Text)
    Write-Host "[INFO] $Text" -ForegroundColor Yellow
}

function Write-Err {
    param([string]$Text)
    Write-Host "[ERROR] $Text" -ForegroundColor Red
}

# Resolve Backend Directory
$BackendDir = $null
$possibleBackend = Join-Path $PSScriptRoot "..\Project system ENGINE\Backend"
if (Test-Path $possibleBackend) {
    $BackendDir = (Resolve-Path $possibleBackend).Path
} else {
    $possibleBackend2 = Join-Path (Get-Location) "Project system ENGINE\Backend"
    if (Test-Path $possibleBackend2) {
        $BackendDir = (Resolve-Path $possibleBackend2).Path
    } else {
        $BackendDir = $possibleBackend
    }
}

# Function to parse appsettings.json for Database Provider and Connection String
function Get-DatabaseConfig {
    param([string]$Dir)
    
    $settingsPath = Join-Path $Dir "appsettings.json"
    $configInfo = @{
        Provider          = "Unknown"
        ConnectionString  = "Not Found"
        AuthMode          = "Unknown"
        AppSettingsExists = $false
    }

    if (Test-Path $settingsPath) {
        $configInfo.AppSettingsExists = $true
        try {
            $jsonContent = Get-Content $settingsPath -Raw | ConvertFrom-Json
            
            if ($jsonContent.ConnectionStrings) {
                $connName = $jsonContent.ConnectionStrings.PSObject.Properties | Select-Object -First 1
                if ($connName) {
                    $configInfo.ConnectionString = $connName.Value
                }
            }

            $cs = $configInfo.ConnectionString
            if ($cs -match "Server\s*=|Data Source\s*=") {
                if ($cs -match "TrustServerCertificate|Integrated Security|Initial Catalog|AttachDbFilename") {
                    $configInfo.Provider = "SqlServer"
                    if ($cs -match "Integrated Security\s*=\s*true|Trusted_Connection\s*=\s*true") {
                        $configInfo.AuthMode = "Windows Authentication"
                    } else {
                        $configInfo.AuthMode = "SQL Server Authentication"
                    }
                } else {
                    $configInfo.Provider = "PostgreSql / SqlServer / Other"
                    $configInfo.AuthMode = "Standard"
                }
            } elseif ($cs -match "Host\s*=|Port\s*=|Database\s*=|User Id\s*=") {
                $configInfo.Provider = "PostgreSql"
                $configInfo.AuthMode = "PostgreSQL Credentials"
            } elseif ($cs -match "Server\s*=|Database\s*=|Uid\s*=|Pwd\s*=") {
                $configInfo.Provider = "MySql"
                $configInfo.AuthMode = "MySQL Credentials"
            }

            if ($jsonContent.DatabaseProvider) {
                $configInfo.Provider = $jsonContent.DatabaseProvider
            }
        } catch {
            Write-Err "Failed to parse appsettings.json: $_"
        }
    }

    return $configInfo
}

function Test-DotNetEf {
    try {
        $null = dotnet ef --version 2>&1
        return $true
    } catch {
        return $false
    }
}

function Invoke-Check {
    Write-Header "Database Migration & Environment Inspection"
    Write-Info "Backend Directory: $BackendDir"
    
    if (-not (Test-Path $BackendDir)) {
        Write-Err "Backend directory does not exist at: $BackendDir"
        return
    }

    $dbConfig = Get-DatabaseConfig -Dir $BackendDir
    Write-Host "Appsettings.json Found: " -NoNewline; if ($dbConfig.AppSettingsExists) { Write-Host "Yes" -ForegroundColor Green } else { Write-Host "No" -ForegroundColor Red }
    Write-Host "Database Provider:     " -NoNewline; Write-Host $dbConfig.Provider -ForegroundColor Cyan
    Write-Host "Connection String:     " -NoNewline; Write-Host $dbConfig.ConnectionString -ForegroundColor DarkGray
    Write-Host "Authentication Mode:   " -NoNewline; Write-Host $dbConfig.AuthMode -ForegroundColor Yellow

    Write-Host ""
    Write-Host "Checking .NET EF CLI Tool..." -NoNewline
    if (Test-DotNetEf) {
        $efVer = dotnet ef --version
        Write-Host " Available ($efVer)" -ForegroundColor Green
    } else {
        Write-Host " Not Found" -ForegroundColor Red
        Write-Info "Tip: Install dotnet-ef via 'dotnet tool install --global dotnet-ef'"
    }
}

function Invoke-Update {
    Write-Host "[*] Synchronizing SQL Server Database Schema via EF Core..." -ForegroundColor Magenta

    if (-not (Test-Path $BackendDir)) {
        Write-Err "Backend directory not found: $BackendDir"
        exit 1
    }

    if (-not (Test-DotNetEf)) {
        Write-Err "dotnet-ef tool is not installed or not in PATH."
        exit 1
    }

    Push-Location $BackendDir
    try {
        & dotnet ef database update
        Write-Host "  [OK] Database schema is up to date." -ForegroundColor Green
    } catch {
        Write-Err "Failed to apply migrations: $_"
        exit 1
    } finally {
        Pop-Location
    }
}

function Invoke-Add {
    param([string]$MigrationName)

    if ([string]::IsNullOrWhiteSpace($MigrationName)) {
        Write-Err "Migration name is required! Use -Name <MigrationName>"
        exit 1
    }

    Write-Header "Creating New Migration: $MigrationName & Applying"
    Write-Info "Target Project: $BackendDir"

    if (-not (Test-Path $BackendDir)) {
        Write-Err "Backend directory not found: $BackendDir"
        exit 1
    }

    if (-not (Test-DotNetEf)) {
        Write-Err "dotnet-ef tool is not installed or not in PATH."
        exit 1
    }

    Push-Location $BackendDir
    try {
        dotnet ef migrations add $MigrationName
        Write-Success "Migration '$MigrationName' created successfully."
        
        dotnet ef database update
        Write-Success "Database updated with migration '$MigrationName'."
    } catch {
        Write-Err "Failed during migration add/update: $_"
        exit 1
    } finally {
        Pop-Location
    }
}

if (-not [string]::IsNullOrEmpty($Action)) {
    switch ($Action.ToLower()) {
        "update" { Invoke-Update }
        "add"    { Invoke-Add -MigrationName $Name }
        "check"  { Invoke-Check }
        default  { 
            Write-Err "Unknown action: $Action. Valid actions are: Update, Add, Check."
            exit 1
        }
    }
} else {
    do {
        Write-Header "INCIDENT AI SYSTEM - Database Migration Management"
        Write-Host " [1] Apply all pending migrations (dotnet ef database update)" -ForegroundColor White
        Write-Host " [2] Create a new migration and apply it" -ForegroundColor White
        Write-Host " [3] Inspect database provider & connection string" -ForegroundColor White
        Write-Host " [0] Exit" -ForegroundColor Gray
        Write-Host ""
        
        $choice = Read-Host "Select an option [0-3]"
        
        switch ($choice) {
            "1" {
                Invoke-Update
                Read-Host "Press Enter to continue..."
            }
            "2" {
                $migName = Read-Host "Enter new migration name (e.g. AddUserTable)"
                if (-not [string]::IsNullOrWhiteSpace($migName)) {
                    Invoke-Add -MigrationName $migName
                } else {
                    Write-Err "Migration name cannot be empty."
                }
                Read-Host "Press Enter to continue..."
            }
            "3" {
                Invoke-Check
                Read-Host "Press Enter to continue..."
            }
            "0" {
                Write-Info "Exiting..."
                exit 0
            }
            default {
                Write-Err "Invalid choice. Please select 0, 1, 2, or 3."
                Start-Sleep -Seconds 1
            }
        }
    } while ($true)
}
