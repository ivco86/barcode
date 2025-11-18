@echo off
REM POS System - Quick Start Script for Windows
REM Автоматично стартиране на локален HTTP сървър

echo.
echo 🛒 POS Система - Стартиране...
echo.

set PORT=8000

REM Проверка за Python 3
where python >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo ✅ Намерен Python
    echo 🚀 Стартиране на сървър на http://localhost:%PORT%
    echo.
    echo 📝 За спиране натиснете: Ctrl+C
    echo.
    echo ℹ️  Браузърът ще се отвори автоматично...
    echo.

    REM Отваряне на браузър след 2 секунди
    timeout /t 2 /nobreak >nul
    start http://localhost:%PORT%

    python -m http.server %PORT%
    goto :end
)

REM Проверка за PHP
where php >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo ✅ Намерен PHP
    echo 🚀 Стартиране на сървър на http://localhost:%PORT%
    echo.
    echo 📝 За спиране натиснете: Ctrl+C
    echo.
    echo ℹ️  Браузърът ще се отвори автоматично...
    echo.

    timeout /t 2 /nobreak >nul
    start http://localhost:%PORT%

    php -S localhost:%PORT%
    goto :end
)

REM Проверка за Node.js
where node >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo ✅ Намерен Node.js
    echo 🚀 Стартиране на сървър на http://localhost:%PORT%
    echo.
    echo 📝 За спиране натиснете: Ctrl+C
    echo.
    echo ℹ️  Браузърът ще се отвори автоматично...
    echo.

    timeout /t 2 /nobreak >nul
    start http://localhost:%PORT%

    npx http-server -p %PORT%
    goto :end
)

REM Ако нищо не е намерено
echo ❌ Не е намерен подходящ HTTP сървър!
echo.
echo Моля, инсталирайте един от следните:
echo   • Python:  https://www.python.org/downloads/
echo   • PHP:     https://windows.php.net/download/
echo   • Node.js: https://nodejs.org/
echo.
pause
exit /b 1

:end
