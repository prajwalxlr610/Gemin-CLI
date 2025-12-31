#!/bin/bash

# Setup and Run Script for Mac/Linux
# This script automates the setup process for the Auction Bidding App

echo "========================================"
echo "  Auction Bidding App - Setup & Run"
echo "========================================"
echo ""

# Step 1: Check if Node.js is installed
echo "[1/4] Checking Node.js installation..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "✓ Node.js is installed: $NODE_VERSION"
else
    echo "✗ Node.js is not installed!"
    echo "  Please install Node.js from https://nodejs.org/"
    echo "  Then run this script again."
    exit 1
fi

# Step 2: Check if npm is installed
echo "[2/4] Checking npm installation..."
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo "✓ npm is installed: $NPM_VERSION"
else
    echo "✗ npm is not installed!"
    exit 1
fi

# Step 3: Install dependencies
echo "[3/4] Installing dependencies..."
echo "  This may take a few minutes..."
npm install
if [ $? -ne 0 ]; then
    echo "✗ Failed to install dependencies!"
    exit 1
fi
echo "✓ Dependencies installed successfully"

# Step 4: Check for .env.local file
echo "[4/4] Checking environment configuration..."
if [ -f ".env.local" ]; then
    if grep -q "GEMINI_API_KEY" .env.local; then
        echo "✓ .env.local file found with GEMINI_API_KEY"
    else
        echo "⚠ .env.local exists but GEMINI_API_KEY is missing"
        echo "  Please add GEMINI_API_KEY=your_api_key to .env.local"
    fi
else
    echo "⚠ .env.local file not found"
    echo "  Creating .env.local template..."
    cat > .env.local << EOF
# Gemini API Key
# Get your API key from: https://makersuite.google.com/app/apikey
GEMINI_API_KEY=your_api_key_here
EOF
    echo "  ✓ Created .env.local template"
    echo "  Please edit .env.local and add your GEMINI_API_KEY"
    echo ""
    read -p "Press Enter to continue anyway, or Ctrl+C to exit and add your API key..."
fi

echo ""
echo "========================================"
echo "  Starting development server..."
echo "========================================"
echo ""
echo "The app will be available at: http://localhost:3000"
echo "Press Ctrl+C to stop the server"
echo ""

# Start the development server
npm run dev

