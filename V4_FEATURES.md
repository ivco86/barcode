# 🚀 POS System v4.0 - Ръководство за Иновативни Функции

## 📋 Съдържание

1. [🤖 AI Предсказване на Продажби](#ai-предсказване-на-продажби)
2. [📸 Разпознаване на Продукти](#разпознаване-на-продукти)
3. [💬 AI Чатбот](#ai-чатбот)
4. [🎮 Геймификация](#геймификация)
5. [📱 Mobile App Интеграция](#mobile-app-интеграция)
6. [🔊 Гласови Команди](#гласови-команди)
7. [🌐 Multi-Store Управление](#multi-store-управление)
8. [📊 Динамично Ценообразуване](#динамично-ценообразуване)
9. [🎯 Аналитика на Поведение](#аналитика-на-поведение)
10. [🔐 Blockchain Фактури](#blockchain-фактури)

---

## 🤖 AI Предсказване на Продажби

### За какво служи?
AI прогнозиране на продажби и търсене, автоматични препоръки за презареждане на инвентар.

### Как да използвам?

**Прогноза за следващите 7 дни:**
```javascript
const forecast = window.posApp.services.forecast.predictSales(7, 30);
console.log(forecast.forecast.predictions);
// [{date: '2025-11-19', dayOfWeek: 'Вт', predictedSales: 450.50, confidence: 'Висока'}]
```

**Анализ на сезонни модели:**
```javascript
const patterns = window.posApp.services.forecast.analyzeSeasonalPatterns();
console.log(patterns.patterns.insights.bestDay); // Най-добрият ден за продажби
console.log(patterns.patterns.insights.peakHours); // Пикови часове
```

**Препоръки за поръчки:**
```javascript
const suggestions = window.posApp.services.forecast.generateReorderSuggestions(14);
suggestions.reorderSuggestions.suggestions.forEach(s => {
    console.log(`${s.productName}: Поръчай ${s.suggestedOrderQuantity} бр. (${s.priority})`);
});
```

**ABC Анализ:**
```javascript
const velocity = window.posApp.services.forecast.getProductVelocityAnalysis();
console.log('Категория A (80% приходи):', velocity.velocityAnalysis.categoryA.products);
```

---

## 📸 Разпознаване на Продукти

### За какво служи?
Разпознаване на продукти чрез камера с компютърно зрение.

### Как да използвам?

**Стартиране на камера:**
```javascript
const videoElement = document.getElementById('cameraVideo');
const result = await window.posApp.services.imageRecognition.initializeCamera(videoElement);
```

**Обучаване на продукт:**
```javascript
// Направи снимка на продукта
const capture = window.posApp.services.imageRecognition.captureImage();

// Запази за обучение
window.posApp.services.imageRecognition.trainProductImage(
    productId,
    capture.image.dataUrl
);
```

**Разпознаване на продукт:**
```javascript
const capture = window.posApp.services.imageRecognition.captureImage();
const recognition = window.posApp.services.imageRecognition.recognizeProduct(
    capture.image.dataUrl,
    0.7 // 70% праг на сходство
);

if (recognition.success) {
    console.log('Разпознат:', recognition.recognition.bestMatch.productName);
    console.log('Сходство:', recognition.recognition.bestMatch.similarity + '%');
}
```

**Сканиране на баркод от снимка:**
```javascript
// Изисква Quagga библиотека
const barcode = await window.posApp.services.imageRecognition.detectBarcodeFromImage(imageDataUrl);
if (barcode.success) {
    console.log('Баркод:', barcode.barcode.code);
}
```

---

## 💬 AI Чатбот

### За какво служи?
Интелигентен асистент за отговори на въпроси и помощ.

### Как да използвам?

**Изпращане на съобщение:**
```javascript
const response = window.posApp.services.chatbot.processMessage('Какви продукти имате?');
console.log(response.response.text);
console.log(response.response.suggestions); // Предложени въпроси
```

**Примерни въпроси:**
- "Какви продукти имате?"
- "Покажи топ продукти"
- "Колко е продажбата днес?"
- "Кои продукти свършват?"
- "Колко струва кафе?"
- "Помощ"

**Персонализиране:**
```javascript
// Добави собствен отговор
window.posApp.services.chatbot.trainCustomResponse(
    'какво е работно време',
    'Работим всеки ден от 8:00 до 22:00'
);
```

---

## 🎮 Геймификация

### За какво служи?
Система за точки, нива, бадж-ове и предизвикателства за мотивация на служители.

### Как да използвам?

**Профил на потребител:**
```javascript
const profile = window.posApp.services.gamification.getUserProfile(userId);
console.log('Ниво:', profile.profile.level);
console.log('XP:', profile.profile.experiencePoints);
console.log('Бадж-ове:', profile.profile.badges);
```

**Награждаване на XP (автоматично при продажба):**
```javascript
window.posApp.services.gamification.recordSaleEvent(userId, sale);
// Автоматично дава XP, проверява постижения, обновява предизвикателства
```

**Дневно предизвикателство:**
```javascript
const challenge = window.posApp.services.gamification.getDailyChallenge(userId);
console.log(challenge.challenge.name);
console.log('Прогрес:', challenge.challenge.progress, '/', challenge.challenge.target);
```

**Класация:**
```javascript
const leaderboard = window.posApp.services.gamification.getLeaderboard('week', 'xp', 10);
leaderboard.leaderboard.entries.forEach((entry, i) => {
    console.log(`${entry.rank}. ${entry.userName} - ${entry.score} XP (Ниво ${entry.level})`);
});
```

**Постижения:**
```javascript
const achievements = window.posApp.services.gamification.checkAchievements(userId);
if (achievements.newAchievements.length > 0) {
    console.log('Нови постижения:', achievements.newAchievements);
}
```

---

## 📱 Mobile App Интеграция

### За какво служи?
PWA функции, Scan & Go самообслужване, push нотификации.

### Как да използвам?

**Проверка за PWA:**
```javascript
const pwaStatus = window.posApp.services.mobileApp.isPWA();
console.log('Инсталирано като PWA:', pwaStatus.pwa.isInstalled);
```

**Scan & Go сесия:**
```javascript
// Стартиране на self-checkout
const session = window.posApp.services.mobileApp.initSelfCheckout(customerId);

// Сканиране на продукти
window.posApp.services.mobileApp.scanAndGo(session.session.sessionId, '123456', 2);
// Автоматично добавя в количка и показва нотификация

// Завършване на покупка
window.posApp.services.mobileApp.completeSelfCheckout(
    session.session.sessionId,
    'card'
);
```

**Push нотификации:**
```javascript
// Заявка за разрешение
await window.posApp.services.mobileApp.requestNotificationPermission();

// Показване на нотификация
window.posApp.services.mobileApp.showNotification('Промоция!', {
    body: '20% отстъпка на всички кафета днес!',
    icon: '/icon-192.png'
});
```

**Offline режим:**
```javascript
const status = window.posApp.services.mobileApp.getOfflineStatus();
console.log('Online:', status.offline.isOnline);

// Синхронизация при връщане online
await window.posApp.services.mobileApp.syncOfflineData();
```

---

## 🔊 Гласови Команди

### За какво служи?
Hands-free операции чрез гласови команди.

### Как да използвам?

**Стартиране на гласово разпознаване:**
```javascript
const support = window.posApp.services.voice.isSupported();
if (support.support.fullSupport) {
    window.posApp.services.voice.startListening(
        (result) => {
            console.log('Команда:', result.command);
            console.log('Резултат:', result.response);
        },
        (error) => {
            console.error('Грешка:', error);
        }
    );
}
```

**Налични команди:**
- "Добави кафе"
- "Добави 2 броя мляко"
- "Премахни кафе"
- "Покажи количка"
- "Изчисти количка"
- "Колко струва кафе?"
- "Колко има кафе?"
- "Търси кафе"
- "Помощ"

**Text-to-Speech:**
```javascript
window.posApp.services.voice.speak('Добре дошли в нашия магазин!');
```

**Спиране:**
```javascript
window.posApp.services.voice.stopListening();
```

---

## 🌐 Multi-Store Управление

### За какво служи?
Управление на множество магазини с cloud синхронизация.

### Как да използвам?

**Регистриране на магазин:**
```javascript
const store = window.posApp.services.multiStore.registerStore({
    name: 'София Център',
    address: 'ул. Витоша 10',
    city: 'София',
    phone: '0888123456',
    timezone: 'Europe/Sofia'
});
```

**Превключване между магазини:**
```javascript
window.posApp.services.multiStore.setCurrentStore(storeId);
```

**Трансфер на инвентар:**
```javascript
window.posApp.services.multiStore.transferInventory(
    fromStoreId,
    toStoreId,
    [
        { productId: 1, quantity: 10 },
        { productId: 5, quantity: 20 }
    ]
);
```

**Консолидиран инвентар:**
```javascript
const inventory = window.posApp.services.multiStore.getConsolidatedInventory();
inventory.inventory.forEach(item => {
    console.log(`${item.name}: ${item.totalStock} бр. общо в ${item.stores.length} магазина`);
});
```

**Сравнение на продажби:**
```javascript
const comparison = window.posApp.services.multiStore.getSalesComparison('month');
console.log('Най-добър магазин:', comparison.comparison.bestStore);
```

**Синхронизация:**
```javascript
// Еднократна синхронизация
await window.posApp.services.multiStore.syncData();

// Автоматична синхронизация на всеки 5 минути
window.posApp.services.multiStore.enableAutoSync(5);
```

---

## 📊 Динамично Ценообразуване

### За какво служи?
Автоматично променяне на цени според търсене, час, инвентар.

### Как да използвам?

**Активиране:**
```javascript
window.posApp.services.dynamicPricing.setEnabled(true);
```

**Създаване на правило - Happy Hour:**
```javascript
// 20% отстъпка от 14:00 до 16:00
window.posApp.services.dynamicPricing.createTimeBasedRule(
    'Happy Hour',
    14, // startHour
    16, // endHour
    20, // discount %
    [1, 2, 5] // productIds (optional)
);
```

**Създаване на правило - Високо търсене:**
```javascript
// +10% наценка при висока честота на продажби
window.posApp.services.dynamicPricing.createDemandBasedRule(
    'High Demand Markup',
    5, // минимум 5 продажби/ден
    10, // +10%
    [3, 7]
);
```

**Създаване на правило - Clearance:**
```javascript
// 30% отстъпка при малка наличност
window.posApp.services.dynamicPricing.createInventoryBasedRule(
    'Clearance Sale',
    5, // когато остават <= 5 бр
    30, // -30%
    []
);
```

**Изчисляване на динамична цена:**
```javascript
const pricing = window.posApp.services.dynamicPricing.calculateDynamicPrice(productId);
console.log('Базова цена:', pricing.pricing.basePrice);
console.log('Динамична цена:', pricing.pricing.dynamicPrice);
console.log('Корекция:', pricing.pricing.adjustmentPercent + '%');
console.log('Приложени правила:', pricing.pricing.appliedRules);
```

**Оптимална цена (AI препоръка):**
```javascript
const optimal = window.posApp.services.dynamicPricing.getOptimalPrice(productId);
console.log('Препоръчана цена:', optimal.optimalPrice.recommendedPrice);
console.log('Потенциално увеличение:', optimal.optimalPrice.potentialRevenueIncrease + '%');
```

---

## 🎯 Аналитика на Поведение

### За какво служи?
Разширена аналитика: RFM, Market Basket, CLV, сегментация.

### Как да използвам?

**RFM Анализ:**
```javascript
const rfm = window.posApp.services.analytics.getRFMAnalysis();

// Сегменти: Champions, Loyal Customers, At Risk, etc.
console.log('Champions:', rfm.rfm.segments['Champions'].length);
console.log('At Risk:', rfm.rfm.segments['At Risk'].length);

rfm.rfm.customers.forEach(c => {
    console.log(`${c.customerName}: R${c.recencyScore}F${c.frequencyScore}M${c.monetaryScore} - ${c.segment}`);
});
```

**Market Basket Analysis:**
```javascript
const basket = window.posApp.services.analytics.getMarketBasketAnalysis(0.01, 0.5);

basket.marketBasket.associations.forEach(assoc => {
    console.log(`Клиентите които купуват ${assoc.productA.name} често купуват и ${assoc.productB.name}`);
    console.log(`  Support: ${assoc.support}, Confidence: ${assoc.confidenceAtoB}, Lift: ${assoc.lift}`);
});
```

**Customer Lifetime Value:**
```javascript
const clv = window.posApp.services.analytics.getCustomerLifetimeValue();

clv.clv.customers.forEach(c => {
    console.log(`${c.customerName}: CLV = ${c.predictedLifetimeValue} лв (${c.purchaseFrequency} покупки)`);
});
console.log('Среден CLV:', clv.clv.averageCLV);
```

**Сегментация:**
```javascript
const segments = window.posApp.services.analytics.getCustomerSegmentation();

console.log('VIP:', segments.segmentation.segments.vip.customers.length);
console.log('Loyal:', segments.segmentation.segments.loyal.customers.length);
console.log('At Risk:', segments.segmentation.segments.atrisk.customers.length);
```

**Cohort Analysis:**
```javascript
const cohort = window.posApp.services.analytics.getCohortAnalysis('month');

cohort.cohort.cohorts.forEach(c => {
    console.log(`Cohort ${c.cohortPeriod}: ${c.cohortSize} клиенти`);
    console.log('Retention:', c.retentionRates);
});
```

---

## 🔐 Blockchain Фактури

### За какво служи?
Имутабилни (неизменяеми) фактури с blockchain и crypto плащания.

### Как да използвам?

**Създаване на blockchain фактура:**
```javascript
const receipt = window.posApp.services.blockchain.createReceipt(sale);

console.log('Block #', receipt.receipt.blockNumber);
console.log('Block Hash:', receipt.receipt.blockHash);
console.log('Verified:', receipt.receipt.verified);
```

**Верификация на фактура:**
```javascript
const verification = window.posApp.services.blockchain.verifyReceipt(blockNumber);
console.log('Валидна:', verification.verification.isValid);
```

**Верификация на целия blockchain:**
```javascript
const blockchain = window.posApp.services.blockchain.verifyBlockchain();
console.log('Blockchain валиден:', blockchain.verification.isValid);
console.log('Общо блокове:', blockchain.verification.totalBlocks);
```

**Crypto плащания:**
```javascript
// Инициализиране на портфейл
window.posApp.services.blockchain.initializeCryptoWallet(
    '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', // Bitcoin address
    'BTC'
);

// Обработка на плащане
const payment = await window.posApp.services.blockchain.processCryptoPayment(
    'BTC',
    100, // 100 лв
    'customerWalletAddress'
);

console.log('Transaction ID:', payment.payment.transactionId);
console.log('Crypto amount:', payment.payment.amountCrypto, 'BTC');
console.log('Status:', payment.payment.status);

// Проверка на статус
const status = window.posApp.services.blockchain.getCryptoPaymentStatus(transactionId);
console.log('Confirmations:', status.transaction.confirmations);
```

**Поддържани криптовалути:**
- Bitcoin (BTC)
- Ethereum (ETH)
- Tether (USDT)
- USD Coin (USDC)

---

## 🆘 Поддръжка

### Тестване в конзола:

```javascript
// Достъп до всички services
console.log(window.posApp.services);

// Примерен workflow
const services = window.posApp.services;

// 1. AI Прогноза
const forecast = services.forecast.predictSales(7);
console.log('Прогноза:', forecast);

// 2. Chatbot
const chat = services.chatbot.processMessage('Топ продукти');
console.log(chat.response.text);

// 3. RFM Анализ
const rfm = services.analytics.getRFMAnalysis();
console.log('RFM:', rfm);

// 4. Gamification
const profile = services.gamification.getUserProfile(1);
console.log('Level:', profile.profile.level);

// 5. Blockchain receipt
const receipt = services.blockchain.createReceipt({
    id: Date.now(),
    items: [{productId: 1, name: 'Test', quantity: 1, price: 10}],
    total: 10,
    paymentMethod: 'cash',
    customerId: 1,
    userId: 1
});
console.log('Receipt:', receipt);
```

**Версия:** 4.0.0
**Дата:** 2025-11-18
**Статус:** Backend 100%, UI в разработка

За пълна документация вижте [CHANGELOG.md](CHANGELOG.md) и [README.md](README.md).
