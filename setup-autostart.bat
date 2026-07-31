@echo off
setlocal

set "PROXY_DIR=%~dp0"
if "%PROXY_DIR:~-1%"=="\" set "PROXY_DIR=%PROXY_DIR:~0,-1%"
set "PROXY_PATH=%PROXY_DIR%\proxy.mjs"
set "VBS_PATH=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\StartClaudeProxy.vbs"

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js was not found in PATH. Install it from https://nodejs.org/ and try again.
  pause
  exit /b 1
)

if not exist "%PROXY_PATH%" (
  echo [ERROR] proxy.mjs not found at "%PROXY_PATH%"
  pause
  exit /b 1
)

echo Set WshShell = CreateObject("WScript.Shell") > "%VBS_PATH%"
echo WshShell.Run "node ""%PROXY_PATH%""", 0, False >> "%VBS_PATH%"

echo.
echo Auto-start installed.
echo The proxy will now start automatically (hidden, no window) every time you log in.
echo To start it right now without logging out: node "%PROXY_PATH%"
echo To remove auto-start later, run uninstall-autostart.bat
echo.
pause
