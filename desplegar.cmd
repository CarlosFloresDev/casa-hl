@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul
cd /d "%~dp0"
set "npm_config_cache=D:\DevTools\npm-cache"

echo.
echo === Casa H^&L: publicar en Cloudflare ===
echo.

echo [1/3] Aplicando la estructura de la base de datos en Cloudflare D1...
call npm run db:migrate:remote
if errorlevel 1 goto :error

if exist "data\clave-admin-inicial.txt" (
  echo [2/3] Datos iniciales ya cargados antes; se omite.
) else (
  echo [2/3] Creando usuario admin y habitaciones de ejemplo...
  for /f "usebackq delims=" %%P in (`powershell -NoProfile -Command "-join ((48..57)+(65..90)+(97..122) | Get-Random -Count 16 | ForEach-Object {[char]$_})"`) do set "ADMIN_PASSWORD=%%P"
  call npm run db:seed:remote
  if errorlevel 1 goto :error
  > "data\clave-admin-inicial.txt" echo Usuario: admin
  >> "data\clave-admin-inicial.txt" echo Clave inicial: !ADMIN_PASSWORD!
  >> "data\clave-admin-inicial.txt" echo Cambiala en Ajustes al entrar y luego borra este archivo.
  del /q "data\seed.sql" 2>nul
)

echo [3/3] Compilando y publicando el sitio...
call npm run deploy
if errorlevel 1 goto :error

echo.
echo === LISTO: https://casa-hl.chefsitturchey.workers.dev ===
echo La clave del admin esta en data\clave-admin-inicial.txt
echo.
pause
exit /b 0

:error
echo.
echo *** Algo fallo. Revisa el mensaje de error que sale arriba. ***
pause
exit /b 1
