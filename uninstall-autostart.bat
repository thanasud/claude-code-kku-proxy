@echo off
setlocal

set "VBS_PATH=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\StartClaudeProxy.vbs"

if exist "%VBS_PATH%" (
  del "%VBS_PATH%"
  echo Auto-start removed. The proxy will no longer start automatically at login.
) else (
  echo Auto-start was not installed - nothing to remove.
)

echo.
pause
