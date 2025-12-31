# Setup and Run Script for Windows
# This script automates the setup process for the Auction Bidding App

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Auction Bidding App - Setup & Run" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check if Node.js is installed
Write-Host "[1/4] Checking Node.js installation..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "✓ Node.js is installed: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Node.js is not installed!" -ForegroundColor Red
    Write-Host "  Please install Node.js from https://nodejs.org/" -ForegroundColor Red
    Write-Host "  Then run this script again." -ForegroundColor Red
    exit 1
}

# Step 2: Check if npm is installed
Write-Host "[2/4] Checking npm installation..." -ForegroundColor Yellow
try {
    $npmVersion = npm --version
    Write-Host "✓ npm is installed: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ npm is not installed!" -ForegroundColor Red
    exit 1
}

# Step 3: Install dependencies
Write-Host "[3/4] Installing dependencies..." -ForegroundColor Yellow
Write-Host "  This may take a few minutes..." -ForegroundColor Gray
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Failed to install dependencies!" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Dependencies installed successfully" -ForegroundColor Green

# Step 4: Check for .env.local file
Write-Host "[4/4] Checking environment configuration..." -ForegroundColor Yellow
if (Test-Path ".env.local") {
    $envContent = Get-Content ".env.local" -Raw
    if ($envContent -match "GEMINI_API_KEY\s*=") {
        Write-Host "✓ .env.local file found with GEMINI_API_KEY" -ForegroundColor Green
    } else {
        Write-Host "⚠ .env.local exists but GEMINI_API_KEY is missing" -ForegroundColor Yellow
        Write-Host "  Please add GEMINI_API_KEY=your_api_key to .env.local" -ForegroundColor Yellow
    }
} else {
    Write-Host "⚠ .env.local file not found" -ForegroundColor Yellow
    Write-Host "  Creating .env.local template..." -ForegroundColor Yellow
    @"
# Gemini API Key
# Get your API key from: https://makersuite.google.com/app/apikey
GEMINI_API_KEY=your_api_key_here
"@ | Out-File -FilePath ".env.local" -Encoding UTF8
    Write-Host "  ✓ Created .env.local template" -ForegroundColor Green
    Write-Host "  Please edit .env.local and add your GEMINI_API_KEY" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Press any key to continue anyway, or Ctrl+C to exit and add your API key..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Starting development server..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "The app will be available at: http://localhost:3000" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

# Start the development server
npm run dev

