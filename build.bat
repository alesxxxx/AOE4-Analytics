@echo off
rem ============================================================================
rem  RTSLytics - full packaged build + launch
rem ----------------------------------------------------------------------------
rem  Rebuilds the REAL packaged app (release\win-unpacked) from the latest source
rem  via electron-builder (incl. the better-sqlite3 native rebuild), then runs it.
rem
rem  It first CLOSES any running RTSLytics instance, because a running app locks
rem  its own DLLs (dxcompiler.dll etc.) and electron-builder can't replace them
rem  (the "EPERM ... unlink" error).
rem
rem  Slow (~5-7 min). For a fast dev launch that skips packaging, use run-dev.bat.
rem ============================================================================
title RTSLytics (build + launch)
cd /d "%~dp0"

echo Closing any running RTSLytics instance...
taskkill /IM RTSLytics.exe /F >nul 2>&1
rem give Windows a moment to release the file locks before the packager runs
timeout /t 2 /nobreak >nul

echo Building packaged app - this can take a few minutes...
call npm run pack
if errorlevel 1 (
  echo.
  echo *** BUILD FAILED - see the output above. ***
  pause
  exit /b 1
)

echo.
echo Build OK. Launching RTSLytics...
start "" "%~dp0release\win-unpacked\RTSLytics.exe"
