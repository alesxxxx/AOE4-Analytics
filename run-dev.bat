@echo off
rem Fast launcher: rebuilds from source (~6s) and runs the app via electron-vite,
rem skipping electron-builder entirely (no native rebuild, no code-signing, no
rem Defender scan of a 222 MB exe). ~15-20s vs ~5-7 min for a packed build.
rem Always launches the LATEST code. Keep this window open while the app runs.
title RTSLytics (dev launch)
cd /d "%~dp0"
echo Building + launching RTSLytics (latest code)...
call npm run start
