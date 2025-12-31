<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1MAZsQKvqXYbrk1pXGRpCnEu9ors1Thon

## Run Locally

**Prerequisites:**  Node.js

### Quick Start (Automated Setup)

**For Windows:**
- **PowerShell** (Recommended):
  ```powershell
  .\setup-and-run.ps1
  ```
- **Command Prompt** (Alternative):
  ```cmd
  setup-and-run.bat
  ```

**For Mac/Linux:**
```bash
chmod +x setup-and-run.sh
./setup-and-run.sh
```

The script will automatically:
- ✅ Check if Node.js and npm are installed
- ✅ Install all dependencies
- ✅ Check/create `.env.local` file
- ✅ Start the development server

### Manual Setup

If you prefer to set up manually:

1. Install dependencies:
   ```bash
   npm install
   ```
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key:
   ```bash
   # Create .env.local file
   echo "GEMINI_API_KEY=your_api_key_here" > .env.local
   ```
3. Run the app:
   ```bash
   npm run dev
   ```

The app will be available at `http://localhost:3000`
