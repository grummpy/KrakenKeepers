@echo off
setlocal
cd /d "%~dp0"

where py >nul 2>&1
if %errorlevel%==0 (
  py -3 server.py
  goto :done
)

where python >nul 2>&1
if %errorlevel%==0 (
  python server.py
  goto :done
)

echo Python 3 is required to launch Kraken Keepers.
echo Install it from https://www.python.org/downloads/ and try again.
pause
exit /b 1

:done
endlocal
