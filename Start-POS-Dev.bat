@echo off
REM Fallback for developers: run POS locally without Electron installer.
title QUANTUMEXE POS (Local)
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed.
  echo Download LTS from https://nodejs.org and install, then run this again.
  start https://nodejs.org
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Installing dependencies...
  call npm install
)

if not exist "apps\api\prisma\dev.db" (
  echo Creating local database...
  call npm run db:push -w apps/api
  call npm run db:seed -w apps/api
)

echo Starting QUANTUMEXE POS...
echo Browser: http://localhost:5173
echo Login: 0771234567 / 123456
call npm run dev
