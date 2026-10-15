@echo off
rem Jupjup News Viewer - starts the local viewer server and opens http://localhost:3030
setlocal
set "NODE=node"
where node >nul 2>nul || set "NODE=C:\Program Files\nodejs\node.exe"
start "Jupjup News Viewer (close this window to stop)" /min "%NODE%" "%~dp0viewer\server.mjs"
