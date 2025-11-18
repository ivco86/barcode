# 🚀 Бързо Стартиране на POS Система

## Как да стартирате системата?

### 🐧 Linux / Mac:

```bash
./start.sh
```

Или:

```bash
python3 start.py
```

### 🪟 Windows:

Двоен клик на:
```
start.bat
```

Или:

```bash
python start.py
```

---

## Какво прави скриптът?

1. ✅ Автоматично проверява за наличен HTTP сървър (Python/PHP/Node.js)
2. ✅ Стартира сървър на **http://localhost:8000**
3. ✅ Автоматично отваря браузър
4. ✅ Зарежда POS системата с всички функции

---

## Ръчно стартиране (ако скриптовете не работят):

### Python 3:
```bash
python3 -m http.server 8000
```

### Python 2:
```bash
python -m SimpleHTTPServer 8000
```

### PHP:
```bash
php -S localhost:8000
```

### Node.js:
```bash
npx http-server -p 8000
```

След стартиране отворете: **http://localhost:8000**

---

## За спиране на сървъра:

Натиснете **Ctrl+C** в терминала

---

## Login данни:

- **Потребител:** `admin`
- **Парола:** `admin`

---

## ❗ Важно:

- **НЕ отваряйте** `index.html` директно от файловата система (`file://`)
- **ВИНАГИ** използвайте HTTP сървър за пълна функционалност
- PWA функциите (Service Worker, офлайн режим) работят **само чрез HTTP**

---

## Помощ:

Ако скриптовете не работят:

1. Уверете се, че имате инсталиран Python:
   - Linux/Mac: `sudo apt install python3`
   - Windows: https://www.python.org/downloads/

2. Проверете дали портът 8000 е свободен:
   ```bash
   lsof -i :8000    # Linux/Mac
   netstat -ano | findstr :8000    # Windows
   ```

3. Използвайте различен порт (редактирайте PORT в скрипта)

---

**Готово! Приятна работа с POS системата! 🎉**
