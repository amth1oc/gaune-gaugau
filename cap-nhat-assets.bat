@echo off
chcp 65001 >nul
cd /d "%~dp0"
node tools\scan-assets.mjs
node tools\gen-preload.mjs
echo.
echo Xong! Mo game va bam Ctrl+F5.
pause
