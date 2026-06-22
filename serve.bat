@echo off
title Par Sec - dev server
echo ============================================
echo   Par Sec  -  hole editor / game
echo ============================================
echo Starting local server (this uses Python inside WSL)...
echo.
for /f "tokens=1" %%i in ('wsl hostname -I 2^>nul') do set WSLIP=%%i
if "%WSLIP%"=="" set WSLIP=localhost
start "Par Sec server" wsl -e bash -c "cd /mnt/c/dev/indie/active/faceted-golf && python3 -m http.server 8236"
timeout /t 2 /nobreak >nul
echo   Play:   http://%WSLIP%:8236/run.html
echo   Editor: http://%WSLIP%:8236/run.html?edit
echo.
start "" http://%WSLIP%:8236/index.html
echo A browser tab should have opened. If the page looks blank, refresh it once.
echo.
echo Keep this window open while you play. Press any key here to STOP the server.
pause >nul
wsl -e bash -c "pkill -f 'http.server 8236'" >nul 2>&1
echo Server stopped. You can close this window.
timeout /t 2 /nobreak >nul
