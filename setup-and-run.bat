@echo off
REM Setup and Run Script for Windows (Batch File)
REM This script automates the setup process for the Auction Bidding App

echo ========================================
echo   Auction Bidding App - Setup ^& Run
echo ========================================
echo.

REM Step 1: Check if Node.js is installed
echo [1/4] Checking Node.js installation...
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [X] Node.js is not installed!
    echo   Please install Node.js from https://nodejs.org/
    echo   Then run this script again.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo [OK] Node.js is installed: %NODE_VERSION%

REM Step 2: Check if npm is installed
echo [2/4] Checking npm installation...
where npm >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [X] npm is not installed!
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
echo [OK] npm is installed: %NPM_VERSION%

REM Step 3: Install dependencies
echo [3/4] Installing dependencies...
echo   This may take a few minutes...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo [X] Failed to install dependencies!
    pause
    exit /b 1
)
echo [OK] Dependencies installed successfully

REM Step 4: Check for .env.local file
echo [4/4] Checking environment configuration...
if exist .env.local (
    findstr /C:"GEMINI_API_KEY" .env.local >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        echo [OK] .env.local file found with GEMINI_API_KEY
    ) else (
        echo [WARNING] .env.local exists but GEMINI_API_KEY is missing
        echo   Please add GEMINI_API_KEY=your_api_key to .env.local
    )
) else (
    echo [WARNING] .env.local file not found
    echo   Creating .env.local template...
    (
        echo # Gemini API Key
        echo # Get your API key from: https://makersuite.google.com/app/apikey
        echo GEMINI_API_KEY=your_api_key_here
    ) > .env.local
    echo   [OK] Created .env.local template
    echo   Please edit .env.local and add your GEMINI_API_KEY
    echo.
    pause
)

echo.
echo ========================================
echo   Starting development server...
echo ========================================
echo.
echo The app will be available at: http://localhost:3000
echo Press Ctrl+C to stop the server
echo.

REM Start the development server
call npm run dev

