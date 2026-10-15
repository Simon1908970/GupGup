@echo off
rem Run once: creates a desktop shortcut that opens the Jupjup News Viewer
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0viewer\make-desktop-shortcut.ps1"
pause
