@echo off
title Desk Racer Pro - Launcher
cd /d "%~dp0"
echo Starting Desk Racer Pro local server on http://localhost:8765 ...
start "" /min cmd /c "python -m http.server 8765 || npx --yes serve -l 8765 ."
timeout /t 2 /nobreak >nul
start "" "http://localhost:8765/desk_racer_pro.html"
exit /b 0
