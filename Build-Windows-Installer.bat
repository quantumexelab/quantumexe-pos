@echo off
title QUANTUMEXE POS - Build Windows Installer
cd /d "%~dp0"

echo === Building QUANTUMEXE POS Windows Setup ===
echo This downloads Electron + deps on first run. Stay online.
echo.

call npm run desktop:dist
if errorlevel 1 (
  echo.
  echo BUILD FAILED
  pause
  exit /b 1
)

echo.
echo SUCCESS
echo Installer: apps\desktop\release\QUANTUMEXE-POS-Setup-*.exe
echo Copy that EXE to any Windows PC and run it — no Node install needed.
echo For later updates from home: use Publish-Update.bat + GH_TOKEN.
echo.
pause
