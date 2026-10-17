@echo off
rem Podglad nowych stron produktowych (landingi informacyjne) na tym komputerze.
rem Strony sa wlaczone tylko lokalnie (.env.local: NEXT_PUBLIC_INFO_LANDINGS=1).
rem Po uruchomieniu otworz: http://localhost:3100/oferta
cd /d "%~dp0"
echo Buduje sklep (1-3 min)...
call npx next build
if errorlevel 1 ( echo BLAD BUDOWANIA & pause & exit /b 1 )
start "" http://localhost:3100/oferta
echo Serwer dziala pod http://localhost:3100 - zamknij to okno, zeby wylaczyc.
call npx next start -p 3100
