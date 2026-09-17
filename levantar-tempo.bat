@echo off
setlocal
title Tempo - servidor web

rem ===========================================================================
rem  Levanta el web de Tempo (no el movil) sin abrir el editor.
rem  Doble clic, o un acceso directo en el escritorio apuntando aqui.
rem
rem    levantar-tempo.bat          desarrollo  (next dev, recarga en caliente)
rem    levantar-tempo.bat prod     produccion  (next build + next start)
rem
rem  Ctrl+C en esta ventana para el servidor.
rem  Sin acentos a proposito: la consola de Windows no los pinta igual.
rem ===========================================================================

rem --- Donde vive el proyecto ------------------------------------------------
rem  Si este .bat esta dentro del proyecto se usa su propia carpeta. Si lo
rem  copiaste al escritorio, manda esta ruta de aqui abajo.
set "PROYECTO=C:\fer\Proyects\Tempo"
if exist "%~dp0package.json" set "PROYECTO=%~dp0"

set "PUERTO=3000"
set "URL=http://localhost:%PUERTO%"

set "MODO=dev"
if /i "%~1"=="prod" set "MODO=prod"

rem --- Comprobaciones --------------------------------------------------------
cd /d "%PROYECTO%" 2>nul
if errorlevel 1 (
  echo [X] No existe la carpeta del proyecto:
  echo     %PROYECTO%
  echo     Edita la variable PROYECTO dentro de este .bat
  goto :fin
)

if not exist "package.json" (
  echo [X] En %PROYECTO% no hay ningun package.json.
  echo     Edita la variable PROYECTO dentro de este .bat
  goto :fin
)

where node >nul 2>nul
if errorlevel 1 (
  echo [X] No se encontro Node.js en el PATH.
  echo     Instalalo desde https://nodejs.org y volve a intentar.
  goto :fin
)

if not exist ".env" (
  echo [X] Falta el archivo .env con DATABASE_URL y las claves de Supabase.
  echo     Copia .env.example a .env y completalo.
  goto :fin
)

if not exist "node_modules" (
  echo [*] Primera vez: instalando dependencias con npm install...
  call npm install
  if errorlevel 1 (
    echo [X] npm install fallo.
    goto :fin
  )
)

rem --- Puerto ya ocupado: no levantamos un segundo servidor ------------------
netstat -ano -p tcp | findstr /r /c:":%PUERTO% .*LISTENING" >nul 2>nul
if not errorlevel 1 (
  echo [*] Ya hay algo escuchando en el puerto %PUERTO%.
  echo     Abriendo %URL% en el navegador.
  start "" "%URL%"
  goto :fin
)

rem --- Produccion: build antes de arrancar -----------------------------------
if /i "%MODO%"=="prod" (
  echo [*] Compilando para produccion...
  call npm run build
  if errorlevel 1 (
    echo [X] El build fallo. Mira el error de arriba.
    goto :fin
  )
)

rem --- Abre el navegador cuando el servidor conteste de verdad ---------------
start "" /min powershell -NoProfile -WindowStyle Hidden -Command "for($i=0;$i -lt 120;$i++){ try { $null = Invoke-WebRequest '%URL%' -UseBasicParsing -TimeoutSec 2; Start-Process '%URL%'; break } catch { Start-Sleep -Seconds 1 } }"

echo.
echo   Tempo - %MODO%   %URL%
echo   Ctrl+C para parar. El navegador se abre solo cuando este listo.
echo.

if /i "%MODO%"=="prod" (
  call npm run start
) else (
  call npm run dev
)

echo.
echo [*] Servidor detenido.

:fin
echo.
pause
endlocal
