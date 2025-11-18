#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
POS System - Quick Start Script (Universal)
Автоматично стартиране на локален HTTP сървър с отваряне на браузър
"""

import sys
import os
import webbrowser
import socket
from threading import Timer

PORT = 8000

def check_port(port):
    """Проверка дали портът е свободен"""
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    result = sock.connect_ex(('localhost', port))
    sock.close()
    return result != 0

def open_browser(url):
    """Отваряне на браузър след 2 секунди"""
    webbrowser.open(url)

def main():
    print("\n🛒 POS Система - Стартиране...")
    print()

    # Проверка за порт
    if not check_port(PORT):
        print(f"❌ Порт {PORT} вече се използва!")
        print(f"💡 Отворете браузър на: http://localhost:{PORT}")
        sys.exit(1)

    url = f"http://localhost:{PORT}"

    print(f"✅ Стартиране на HTTP сървър")
    print(f"🚀 URL: {url}")
    print()
    print("📝 За спиране натиснете: Ctrl+C")
    print()
    print("ℹ️  Браузърът ще се отвори автоматично след 2 секунди...")
    print()

    # Отваряне на браузър след 2 секунди
    Timer(2.0, open_browser, args=[url]).start()

    # Стартиране на сървър
    try:
        if sys.version_info >= (3, 0):
            # Python 3
            from http.server import HTTPServer, SimpleHTTPRequestHandler

            # Сменяне на директория до местоположението на скрипта
            os.chdir(os.path.dirname(os.path.abspath(__file__)))

            server = HTTPServer(('localhost', PORT), SimpleHTTPRequestHandler)
            print(f"✅ HTTP сървър стартиран успешно!")
            print()
            server.serve_forever()
        else:
            # Python 2
            import SimpleHTTPServer
            import SocketServer

            os.chdir(os.path.dirname(os.path.abspath(__file__)))

            Handler = SimpleHTTPServer.SimpleHTTPRequestHandler
            httpd = SocketServer.TCPServer(("localhost", PORT), Handler)
            print(f"✅ HTTP сървър стартиран успешно!")
            print()
            httpd.serve_forever()

    except KeyboardInterrupt:
        print("\n\n⏹️  Сървърът е спрян.")
        print("👋 Благодарим, че използвате POS системата!")
        sys.exit(0)
    except Exception as e:
        print(f"\n❌ Грешка: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
