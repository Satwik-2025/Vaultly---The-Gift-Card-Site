@echo off
REM Scheduled full refresh: discovers newly-listed gift cards and re-reads prices.
REM Register it to run daily at 06:00 (run this once, from this folder):
REM
REM   schtasks /create /tn "Vaultly gift card refresh" /tr "\"%CD%\scripts\refresh.cmd\"" /sc daily /st 06:00
REM
REM Inspect or remove it later with:
REM   schtasks /query /tn "Vaultly gift card refresh"
REM   schtasks /delete /tn "Vaultly gift card refresh" /f

setlocal
cd /d "%~dp0.."

REM Node is not always on the PATH of a scheduled task's environment.
set "NODE_EXE=node.exe"
if exist "%ProgramFiles%\nodejs\node.exe" set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"

echo [%date% %time%] starting refresh >> "%TEMP%\vaultly-refresh.log"
"%NODE_EXE%" scripts\scrape.mjs >> "%TEMP%\vaultly-refresh.log" 2>&1
echo [%date% %time%] finished with exit code %ERRORLEVEL% >> "%TEMP%\vaultly-refresh.log"

endlocal
