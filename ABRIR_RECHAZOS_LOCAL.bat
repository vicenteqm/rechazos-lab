@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
"%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" -X utf8 "%~dp0automation\launch.py" %*
if errorlevel 1 pause
