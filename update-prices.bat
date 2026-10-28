@echo off
setlocal
cd /d "%~dp0"
title Vaultly - update prices

echo.
echo  Vaultly: refreshing every seller, then publishing to the live site.
echo  Takes about 10 minutes. Leave this window open.
echo.

echo [1/6] Getting the latest catalog from GitHub...
git checkout -- public/catalog.json
git pull --rebase
if errorlevel 1 goto :failed

echo.
echo [2/6] GyFTR and Woohoo...
call node scripts/scrape.mjs --only gyftr,woohoo
if errorlevel 1 echo      Something went wrong here - carrying on with the rest.

echo.
echo [3/6] Amazon (a CAPTCHA just keeps the old Amazon prices)...
call node scripts/scrape.mjs --only amazon
if errorlevel 1 echo      Amazon didn't update this time - its old prices are kept.

echo.
echo [4/6] CashKaro cashback...
call node scripts/fill-cashkaro.mjs
if errorlevel 1 echo      CashKaro didn't update this time - its old rates are kept.

echo.
echo [5/6] Saving the changes...
git add public/catalog.json
git diff --cached --quiet
if not errorlevel 1 (
  echo      Nothing changed since the last update.
  goto :done
)
git commit -m "Refresh prices (%date%)"
if errorlevel 1 goto :failed

echo.
echo [6/6] Publishing...
git push
if errorlevel 1 goto :failed

:done
echo.
echo  All done. The live site updates in about a minute.
echo.
pause
exit /b 0

:failed
echo.
echo  Stopped because a step failed - see the message above.
echo  Nothing was published. Closing and running this again usually fixes it.
echo.
pause
exit /b 1
