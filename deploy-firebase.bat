@echo off
cd /d "%~dp0"
echo === QUANTUMEXE POS - Firebase Login + Deploy ===
echo.
call npx --yes firebase-tools login
if errorlevel 1 goto :fail
call npx --yes firebase-tools use quantumexe-pos
call npm install --prefix functions
echo.
echo Building and deploying (Hosting + Functions + Firestore rules)...
call npx --yes firebase-tools deploy
if errorlevel 1 goto :fail
echo.
echo === Deploy done ===
echo Site: https://quantumexe-pos.web.app
echo Seed once: curl -X POST https://quantumexe-pos.web.app/api/setup/seed
echo Login: 0771234567 / 123456
echo.
pause
exit /b 0
:fail
echo.
echo FAILED. Check errors above.
pause
exit /b 1
