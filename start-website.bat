@echo off
setlocal

cd /d "%~dp0"
if errorlevel 1 (
    echo Could not open the website project folder.
    pause
    exit /b 1
)

where npm.cmd >nul 2>&1
if errorlevel 1 (
    echo Node.js and npm are required. Install Node.js, then run this file again.
    pause
    exit /b 1
)

if not exist "node_modules\.bin\astro.cmd" (
    echo Installing website dependencies...
    call npm ci
    if errorlevel 1 (
        echo Dependency installation failed.
        pause
        exit /b 1
    )
)

echo Starting TavernRoamer website at http://127.0.0.1:4321/
echo Keep this window open. Press Ctrl+C to stop the server.
call npm run dev -- --open

if errorlevel 1 (
    echo The website server stopped with an error.
    pause
    exit /b 1
)

echo The website server has stopped.
pause
