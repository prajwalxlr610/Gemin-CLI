<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1MAZsQKvqXYbrk1pXGRpCnEu9ors1Thon

## Run Locally

**Prerequisites:**  Node.js (Download from [nodejs.org](https://nodejs.org/) if not installed)

### 🚀 Quick Start (Automated Setup - Recommended)

We've created setup scripts that handle everything automatically! Just follow the steps below for your operating system.

#### 📋 Step-by-Step Instructions

**For Windows Users:**

1. **Open PowerShell or Command Prompt**
   - Press `Windows Key + X` and select "Windows PowerShell" or "Terminal"
   - Or search for "PowerShell" in the Start menu

2. **Navigate to the project folder:**
   ```powershell
   cd "D:\Prajwal\Gemin CLI"
   ```
   *(Replace with your actual project path)*

3. **Run the setup script:**
   
   **Option A - PowerShell (Recommended):**
   ```powershell
   .\setup-and-run.ps1
   ```
   
   **Option B - Command Prompt (If PowerShell doesn't work):**
   ```cmd
   setup-and-run.bat
   ```

4. **Wait for the script to complete:**
   - The script will check Node.js installation
   - Install all required dependencies (this may take 2-3 minutes)
   - Check/create the `.env.local` file
   - Start the development server automatically

5. **Open your browser:**
   - The app will be available at: `http://localhost:3000`
   - The script will display this URL when the server starts

**For Mac/Linux Users:**

1. **Open Terminal**
   - Press `Cmd + Space` (Mac) or `Ctrl + Alt + T` (Linux) and type "Terminal"

2. **Navigate to the project folder:**
   ```bash
   cd /path/to/your/project
   ```

3. **Make the script executable (first time only):**
   ```bash
   chmod +x setup-and-run.sh
   ```

4. **Run the setup script:**
   ```bash
   ./setup-and-run.sh
   ```

5. **Open your browser:**
   - The app will be available at: `http://localhost:3000`

#### ✅ What the Script Does Automatically

The setup script will:
- ✅ Check if Node.js and npm are installed (with helpful error messages if not)
- ✅ Install all project dependencies (`npm install`)
- ✅ Check if `.env.local` exists and create a template if needed
- ✅ Start the development server (`npm run dev`)
- ✅ Display the local URL where your app is running

#### 🛑 Stopping the Server

When you're done testing:
- Press `Ctrl + C` in the terminal where the server is running
- This will stop the development server

---

### 🔧 Manual Setup (Alternative Method)

If you prefer to set up manually or the script doesn't work:

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create `.env.local` file:**
   ```bash
   # Windows (PowerShell)
   echo "GEMINI_API_KEY=your_api_key_here" > .env.local
   
   # Mac/Linux
   echo "GEMINI_API_KEY=your_api_key_here" > .env.local
   ```
   
   **Or manually create `.env.local` file with:**
   ```
   GEMINI_API_KEY=your_api_key_here
   ```
   
   > 💡 Get your API key from: [Google AI Studio](https://makersuite.google.com/app/apikey)

3. **Run the app:**
   ```bash
   npm run dev
   ```

4. **Open your browser:**
   - Navigate to: `http://localhost:3000`

---

### ❓ Troubleshooting

**Problem: "Node.js is not installed"**
- Solution: Download and install Node.js from [nodejs.org](https://nodejs.org/)
- Make sure to restart your terminal after installation

**Problem: "Script cannot be run" (Windows)**
- Solution: Right-click the script → Properties → Unblock → OK
- Or run PowerShell as Administrator and execute: `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`

**Problem: "Permission denied" (Mac/Linux)**
- Solution: Run `chmod +x setup-and-run.sh` first

**Problem: "Port 3000 already in use"**
- Solution: Stop any other applications using port 3000, or change the port in `vite.config.ts`

**Problem: "GEMINI_API_KEY not found"**
- Solution: Make sure `.env.local` file exists in the project root with your API key
