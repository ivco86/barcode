# 🚀 POS System v3.0 - Ръководство за Нови Функции

## 📋 Съдържание

1. [💼 Работни Смени](#работни-смени)
2. [↩️ Връщания](#връщания)
3. [🎯 Промоции](#промоции)
4. [⚖️ Единици Мярка](#единици-мярка)
5. [📦 Доставчици](#доставчици)
6. [🔍 Audit Log](#audit-log)
7. [💳 Множествени Плащания](#множествени-плащания)
8. [⚡ Quick Buttons](#quick-buttons)
9. [📊 Разширени Отчети](#разширени-отчети)
10. [🏷️ Етикети](#етикети)

---

## 💼 Работни Смени

### За какво служи?
Управление на касиерски смени с контрол на парите в касата.

### Как да използвам?

**Отваряне на смяна:**
```javascript
// Програмно
window.posApp.services.shift.openShift(100.00); // 100лв начално салдо

// Чрез UI (ще бъде добавено):
// Кликни "Отвори Смяна" бутон
// Въведи начално салдо
```

**Затваряне на смяна:**
```javascript
// Програмно
window.posApp.services.shift.closeShift(350.50, "Добра смяна");

// Чрез UI:
// Кликни "Затвори Смяна"
// Преброй парите и въведи крайно салдо
// Системата автоматично изчислява разликата
```

**Проверка на текуща смяна:**
```javascript
const shift = window.posApp.services.shift.getCurrentShift();
console.log(shift); // null ако няма отворена смяна
```

**История на смените:**
```javascript
const allShifts = window.posApp.services.shift.getAllShifts();
const myShifts = window.posApp.services.shift.getShiftsByUser(userId);
```

### Важно!
- ⚠️ Трябва да има отворена смяна преди продажби
- ✅ Системата автоматично изчислява очаквани пари = начално + кеш продажби
- 📊 Показва разлика ако има несъответствие

---

## ↩️ Връщания

### За какво служи?
Обработка на връщания от клиенти с автоматично възстановяване на инвентар.

### Как да използвам?

**Пълно връщане:**
```javascript
const result = window.posApp.services.refund.processFullRefund(
    saleId,
    "Клиентът не е доволен от качеството"
);
```

**Частично връщане:**
```javascript
const itemsToRefund = [
    { productId: 1, quantity: 2 },
    { productId: 5, quantity: 1 }
];

const result = window.posApp.services.refund.processPartialRefund(
    saleId,
    itemsToRefund,
    "Част от стоките са дефектни"
);
```

**Проверка дали може да се върне:**
```javascript
const canRefund = window.posApp.services.refund.canRefund(saleId);
if (canRefund.canRefund) {
    console.log("Налични за връщане:", canRefund.availableItems);
} else {
    console.log("Причина:", canRefund.reason);
}
```

**Статистика на връщанията:**
```javascript
const stats = window.posApp.services.refund.getRefundStats('month');
console.log(`Общо връщания: ${stats.totalRefunds}`);
console.log(`Обща сума: ${stats.totalAmount} лв`);
```

### Важно!
- ✅ Инвентарът се възстановява автоматично
- ✅ Не можеш да върнеш повече от продаденото
- ✅ Пълната история на връщанията се запазва

---

## 🎯 Промоции

### За какво служи?
Създаване и управление на отстъпки и промоции.

### Типове промоции:

**1. Процентна отстъпка (10%, 20%, 50%)**
```javascript
window.posApp.services.promotion.createPromotion({
    name: "Черен петък",
    description: "20% отстъпка на всичко",
    type: "percentage",
    value: 20,
    startDate: "2025-11-29",
    endDate: "2025-11-29"
});
```

**2. Фиксирана отстъпка (5лв, 10лв)**
```javascript
window.posApp.services.promotion.createPromotion({
    name: "5лв отстъпка",
    type: "fixed",
    value: 5,
    productIds: [1, 2, 3] // Само за тези продукти
});
```

**3. Buy X Get Y**
```javascript
window.posApp.services.promotion.createPromotion({
    name: "Вземи 3, плати 2",
    type: "buyXgetY",
    buyQuantity: 3,
    getQuantity: 1, // Получаваш 1 безплатно
    productIds: [5]
});
```

**Активиране/Деактивиране:**
```javascript
window.posApp.services.promotion.updatePromotion(promotionId, {
    active: false // Деактивира
});
```

**Прилагане на промоции към количка:**
```javascript
const cart = window.posApp.services.cart.getCart();
const result = window.posApp.services.promotion.applyPromotionsToCart(cart);

console.log("Обща отстъпка:", result.totalDiscount);
console.log("Количка с промоции:", result.cart);
```

### Важно!
- ✅ Промоциите се прилагат автоматично при checkout (ще бъде имплементирано в UI)
- ✅ Можеш да зададеш период на валидност
- ✅ Можеш да ограничиш промоция до определени продукти

---

## ⚖️ Единици Мярка

### За какво служи?
Продажба на продукти по тегло, обем или дължина.

### Налични единици:
- **Тегло:** кг, г
- **Обем:** л, мл
- **Дължина:** м
- **Брой:** бр., пакет, кутия

### Как да използвам?

**Изчисляване на цена:**
```javascript
// 12.50лв/кг × 2.5кг = 31.25лв
const price = window.posApp.services.unit.calculatePrice(12.50, 'kg', 2.5);

// 5.00лв/л × 1.5л = 7.50лв
const price2 = window.posApp.services.unit.calculatePrice(5.00, 'l', 1.5);
```

**Форматиране на количество:**
```javascript
window.posApp.services.unit.formatQuantity(2.5, 'kg');
// Резултат: "2.50 kg"

window.posApp.services.unit.formatQuantity(5, 'pcs');
// Резултат: "5 Броя (бр.)"
```

### Важно!
- ✅ За тегло/обем се изисква въвеждане на количество
- ✅ Цената се изчислява автоматично
- ✅ UI за везна ще бъде добавено в v3.1

---

## 📦 Доставчици

### За какво служи?
Управление на доставчици и поръчки към тях.

### Как да използвам?

**Добавяне на доставчик:**
```javascript
window.posApp.services.supplier.addSupplier({
    name: "БГ Храни ЕООД",
    phone: "0888123456",
    email: "orders@bghrani.bg",
    address: "София, ул. Витоша 10"
});
```

**Създаване на поръчка:**
```javascript
window.posApp.services.supplier.createOrder({
    supplierId: 1,
    expectedDate: "2025-12-01",
    items: [
        { productId: 1, quantity: 100, costPrice: 1.20 },
        { productId: 2, quantity: 50, costPrice: 2.50 }
    ],
    notes: "Спешна поръчка"
});
```

**Получаване на поръчка:**
```javascript
// Автоматично обновява инвентара
const result = window.posApp.services.supplier.receiveOrder(orderId);
```

**Преглед на поръчки:**
```javascript
const orders = window.posApp.services.supplier.getAllOrders();
const pending = orders.filter(o => o.status === 'pending');
const received = orders.filter(o => o.status === 'received');
```

### Важно!
- ✅ При получаване на поръчка инвентарът се обновява автоматично
- ✅ Можеш да проследяваш себестойност на продуктите
- ✅ История на всички поръчки се запазва

---

## 🔍 Audit Log

### За какво служи?
Пълна история на всички действия в системата за сигурност и отчетност.

### Какво се логва автоматично?
- ✅ Създаване/променяне/изтриване на продукти
- ✅ Създаване/променяне/изтриване на клиенти
- ✅ Продажби
- ✅ Връщания
- ✅ Отваряне/затваряне на смени
- ✅ Промени в промоции

### Как да използвам?

**Ръчно логване:**
```javascript
window.posApp.services.audit.log(
    'custom_action',
    'product',
    productId,
    { oldPrice: 10, newPrice: 12 }
);
```

**Преглед на логове:**
```javascript
// Всички логове (последни 1000)
const logs = window.posApp.services.audit.getAllLogs();

// По потребител
const userLogs = window.posApp.services.audit.getLogsByUser(userId);

// По обект
const productLogs = window.posApp.services.audit.getLogsByEntity('product', productId);

// По период
const logs = window.posApp.services.audit.getLogsByDateRange('2025-11-01', '2025-11-30');
```

**Export:**
```javascript
const { headers, rows } = window.posApp.services.audit.exportToCSV();
// Използвай downloadCSV() за да свалиш файла
```

**Почистване на стари логове:**
```javascript
// Изтрива логове по-стари от 90 дни
const result = window.posApp.services.audit.clearOldLogs(90);
console.log(`Изтрити ${result.deleted} записа`);
```

### Важно!
- ✅ Логовете се пазят до 1000 записа (auto-cleanup)
- ✅ Всеки лог съдържа: кой, какво, кога, детайли
- ✅ Не може да се редактират или изтриват индивидуални логове

---

## 💳 Множествени Плащания

### За какво служи?
Комбиниране на различни методи на плащане (кеш + карта).

### Как да използвам?

```javascript
// Обща сума: 100лв
// Клиентът плаща: 50лв кеш + 50лв карта

const result = window.posApp.services.sales.processCheckoutWithMultiplePayments({
    cart: cartItems,
    payments: [
        { method: 'cash', amount: 50.00 },
        { method: 'card', amount: 50.00 }
    ],
    customerId: 5,
    subtotal: 100,
    discount: 0,
    total: 100
});
```

### Важно!
- ✅ Сумата на всички плащания трябва да съвпада с тоталната сума
- ✅ Автоматична валидация
- ✅ UI за множествени плащания ще бъде добавено в v3.1

---

## ⚡ Quick Buttons

### За какво служи?
Бързи бутони за често продавани продукти - без сканиране.

### Статус:
🚧 Backend готов, UI в процес на разработка (v3.1)

### Как ще работи:
- Grid с бутони за топ продукти
- Клик = добави в количка
- Customizable - избери кои продукти да показваш

---

## 📊 Разширени Отчети

### Статус:
🚧 Backend готов, UI в процес на разработка (v3.1)

### Планирани отчети:
- ABC анализ (топ 20% продукти = 80% приходи)
- Продажби по час на деня
- Сравнение период-към-период
- Печалба (Продажби - Себестойност)

---

## 🏷️ Етикети

### Статус:
🚧 В процес на разработка (v3.1)

### Планирани функции:
- Печат на етикети с баркод + цена
- Масов печат за всички продукти
- Различни размери

---

## 🆘 Поддръжка

Ако имаш въпроси или проблеми:

1. Виж [CHANGELOG.md](CHANGELOG.md) за детайлна информация
2. Виж [README.md](README.md) за основни функции
3. Отвори console в браузъра за debugging:
   ```javascript
   // Провери версия
   console.log(window.posApp);

   // Провери services
   console.log(window.posApp.services);
   ```

**Версия:** 3.0.0
**Дата:** 2025-11-18
**Статус:** Backend 100%, UI 40%
