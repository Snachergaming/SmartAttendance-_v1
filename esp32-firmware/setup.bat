@echo off
REM ATTENDRO ESP32 Quick Setup Script for Windows
REM This script helps you quickly configure and upload the ESP32 firmware

echo ======================================
echo   ATTENDRO ESP32 Quick Setup
echo ======================================
echo.

REM Check if PlatformIO is installed
where pio >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo X PlatformIO not found!
    echo.
    echo Please install PlatformIO first:
    echo   Option 1: VS Code Extension ^(Recommended^)
    echo     1. Install VS Code: https://code.visualstudio.com/
    echo     2. Install PlatformIO IDE extension
    echo.
    echo   Option 2: CLI
    echo     pip install platformio
    echo.
    pause
    exit /b 1
)

echo √ PlatformIO found!
echo.

REM Check if config_local.h exists
if not exist "src\config_local.h" (
    echo Creating config_local.h from template...
    copy src\config.h src\config_local.h
    echo √ config_local.h created!
    echo.
    echo WARNING: Edit src\config_local.h with your credentials:
    echo    - WiFi SSID and Password
    echo    - Supabase URL and Anon Key
    echo    - Device Code ^(must match admin panel^)
    echo.
    pause
) else (
    echo √ config_local.h exists
)

echo.
echo ======================================
echo   Build Options
echo ======================================
echo 1. Build firmware only
echo 2. Build and upload to ESP32
echo 3. Upload and monitor serial
echo 4. Just monitor serial
echo.
set /p option="Select option (1-4): "

if "%option%"=="1" (
    echo.
    echo Building firmware...
    pio run
) else if "%option%"=="2" (
    echo.
    echo Building and uploading...
    pio run -t upload
) else if "%option%"=="3" (
    echo.
    echo Building, uploading, and monitoring...
    pio run -t upload
    pio device monitor
) else if "%option%"=="4" (
    echo.
    echo Monitoring serial...
    pio device monitor
) else (
    echo Invalid option!
    exit /b 1
)

echo.
echo ======================================
echo   Setup Complete!
echo ======================================
echo.
echo Next steps:
echo 1. Register device in Admin - Device Management
echo 2. Enroll students in Admin - Student Enrollment
echo 3. Faculty can now use device for attendance!
echo.
pause
