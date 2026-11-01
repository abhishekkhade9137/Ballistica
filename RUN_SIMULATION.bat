@echo off
title Launching Ballistica Simulation Engine...
echo =========================================================================
echo       BALLISTICA - GEOSPATIAL TRAJECTORY SIMULATION ENGINE
echo =========================================================================
echo.
echo Starting Vite Development Server and opening your browser...
echo.

cd /d "%~dp0"

start http://localhost:5173

npm run dev
