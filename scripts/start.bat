@echo off
rem MyBrothar - arranque en Windows
cd /d "%~dp0"
set "NODE_ENV=production"
set "DATABASE_URL=file:%cd%/db/custom.db"
if "%PORT%"=="" set "PORT=3000"
set "HOSTNAME=0.0.0.0"

echo.
echo  ====================================
echo   MYBROTHAR - domino para 4 jugadores
echo  ====================================
echo   Abre http://localhost:%PORT% en tu navegador
echo   Para jugar en el telefono: pulsa "Probar en el movil"
echo   dentro del juego y escanea el QR (mismo WiFi)
echo   (cierra esta ventana para salir)
echo.
node server.js
pause
