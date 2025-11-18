#!/bin/bash

# POS System - Quick Start Script
# Автоматично стартиране на локален HTTP сървър

echo "🛒 POS Система - Стартиране..."
echo ""

PORT=8000

# Проверка за порт
check_port() {
    if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        echo "❌ Порт $PORT вече се използва!"
        echo "💡 Отворете браузър на: http://localhost:$PORT"
        exit 1
    fi
}

# Функция за отваряне на браузър
open_browser() {
    sleep 2
    URL="http://localhost:$PORT"
    echo ""
    echo "🌐 Отваряне на браузър..."

    if command -v xdg-open > /dev/null; then
        xdg-open "$URL" 2>/dev/null
    elif command -v gnome-open > /dev/null; then
        gnome-open "$URL" 2>/dev/null
    elif command -v open > /dev/null; then
        open "$URL" 2>/dev/null
    else
        echo "ℹ️  Моля, отворете ръчно: $URL"
    fi
}

check_port

# Опит 1: Python 3
if command -v python3 > /dev/null 2>&1; then
    echo "✅ Намерен Python 3"
    echo "🚀 Стартиране на сървър на http://localhost:$PORT"
    echo ""
    echo "📝 За спиране натиснете: Ctrl+C"
    echo ""

    open_browser &
    python3 -m http.server $PORT
    exit 0
fi

# Опит 2: Python 2
if command -v python > /dev/null 2>&1; then
    echo "✅ Намерен Python"
    echo "🚀 Стартиране на сървър на http://localhost:$PORT"
    echo ""
    echo "📝 За спиране натиснете: Ctrl+C"
    echo ""

    open_browser &
    python -m SimpleHTTPServer $PORT
    exit 0
fi

# Опит 3: PHP
if command -v php > /dev/null 2>&1; then
    echo "✅ Намерен PHP"
    echo "🚀 Стартиране на сървър на http://localhost:$PORT"
    echo ""
    echo "📝 За спиране натиснете: Ctrl+C"
    echo ""

    open_browser &
    php -S localhost:$PORT
    exit 0
fi

# Опит 4: Node.js (http-server)
if command -v npx > /dev/null 2>&1; then
    echo "✅ Намерен Node.js"
    echo "🚀 Стартиране на сървър на http://localhost:$PORT"
    echo ""
    echo "📝 За спиране натиснете: Ctrl+C"
    echo ""

    open_browser &
    npx http-server -p $PORT
    exit 0
fi

# Ако нищо не е намерено
echo "❌ Не е намерен подходящ HTTP сървър!"
echo ""
echo "Моля, инсталирайте един от следните:"
echo "  • Python 3:  sudo apt install python3"
echo "  • Python 2:  sudo apt install python"
echo "  • PHP:       sudo apt install php"
echo "  • Node.js:   sudo apt install nodejs npm"
echo ""
exit 1
