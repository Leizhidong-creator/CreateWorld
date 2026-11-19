@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0create-world-workbench"
if errorlevel 1 (
  echo [ERROR] create-world-workbench folder not found next to this script.
  pause
  exit /b 1
)

rem --- locate native codex.exe (npm shim cannot be spawned directly by node) ---
if not defined CODEX_BINARY (
  for /f "delims=" %%i in ('where /r "%LOCALAPPDATA%\OpenAI\Codex\bin" codex.exe 2^>nul') do set "CODEX_BINARY=%%i"
)
if not defined CODEX_BINARY (
  echo [WARN] codex.exe not found. Browsing and playing work; creating new games will be disabled.
)

rem --- locate python with Pillow ---
if not defined CREATE_WORLD_PYTHON (
  for /f "delims=" %%i in ('where python.exe 2^>nul') do if not defined CREATE_WORLD_PYTHON set "CREATE_WORLD_PYTHON=%%i"
)
if defined CREATE_WORLD_PYTHON set "CW_PYTHON=%CREATE_WORLD_PYTHON%"

rem --- locate chrome for automated acceptance ---
if not defined CW_CHROME_PATH (
  if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "CW_CHROME_PATH=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
  if not defined CW_CHROME_PATH if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "CW_CHROME_PATH=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
)

if not defined CW_PORT set "CW_PORT=8787"
if not defined CW_PREVIEW_PORT set "CW_PREVIEW_PORT=8790"
if not defined CW_DATA_DIR set "CW_DATA_DIR=%CD%\data"

if not exist node_modules (
  echo [1/3] Installing dependencies, first run only ...
  call npm ci --no-audit --no-fund
  if errorlevel 1 goto fail
)
if not exist dist\web\index.html (
  echo [2/3] Building frontend ...
  call npm run build
  if errorlevel 1 goto fail
)

echo.
echo [3/3] Create World Workbench  -^>  http://127.0.0.1:8787
echo        Game preview port       -^>  http://127.0.0.1:8790
echo        Keep this window open. Press Ctrl+C to stop the server.
echo.
start "" "http://127.0.0.1:%CW_PORT%"
call npm start
exit /b %errorlevel%

:fail
echo.
echo [ERROR] Setup failed. Read the messages above.
pause
exit /b 1
