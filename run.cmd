@echo off
setlocal
cd /d "%~dp0"
if /i "%~1"=="install" goto install
where node >nul 2>nul
if %errorlevel%==0 (
  node scripts\start.js %*
  goto finish
)
set "DVOTE_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if exist "%DVOTE_NODE%" (
  "%DVOTE_NODE%" scripts\start.js %*
  goto finish
)
echo Node.js is required. Install Node.js 22 or 24 LTS, then try again.
exit /b 1
:install
where pnpm >nul 2>nul
if %errorlevel%==0 (
  call pnpm install --frozen-lockfile
  goto finish
)
set "DVOTE_PNPM=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd"
if exist "%DVOTE_PNPM%" (
  call "%DVOTE_PNPM%" install --frozen-lockfile
  goto finish
)
echo pnpm is required for installation. Install pnpm, then run: pnpm install --frozen-lockfile
exit /b 1
:finish
if errorlevel 1 (
  echo.
  echo The command failed. Review the error above.
  exit /b 1
)
