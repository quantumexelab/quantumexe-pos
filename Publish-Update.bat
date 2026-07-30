@echo off
title QUANTUMEXE POS - Publish Update to GitHub
cd /d "%~dp0"

echo.
echo === Publish desktop update ===
echo 1) Edit apps\desktop\package.json version  (e.g. 1.0.0 -^> 1.0.1)
echo 2) Set GitHub token in this window:
echo      set GH_TOKEN=ghp_your_token_here
echo    Token needs "repo" scope (quantumexelab/quantumexe-pos).
echo 3) This builds Setup.exe and uploads a GitHub Release.
echo    Shop PCs will auto-download when they open the app.
echo.
pause

if "%GH_TOKEN%"=="" (
  echo ERROR: GH_TOKEN is not set.
  echo Create token: GitHub -^> Settings -^> Developer settings -^> Personal access tokens
  pause
  exit /b 1
)

call npm run desktop:prepare
if errorlevel 1 goto fail

pushd apps\desktop
call npm install
call npm run dist:publish
popd
if errorlevel 1 goto fail

echo.
echo SUCCESS - Release published on GitHub.
echo Shops: open QUANTUMEXE POS -^> Update available -^> Restart.
echo.
pause
exit /b 0

:fail
echo BUILD/PUBLISH FAILED
pause
exit /b 1
