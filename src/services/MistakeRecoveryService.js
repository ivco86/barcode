/**
 * Mistake Recovery Assistant - v7.0
 * Помощник за коригиране на грешки БЕЗ supervisor
 */
import { StorageService } from './StorageService.js';

export class MistakeRecoveryService {
    constructor(salesService, productService, authService) {
        this.salesService = salesService;
        this.productService = productService;
        this.authService = authService;

        // История на действия за undo
        this.actionHistory = [];
        this.maxHistorySize = 50;

        // Паузирани транзакции
        this.pausedTransactions = StorageService.get('pausedTransactions', []);

        // Статистика за грешки
        this.errorStats = StorageService.get('errorStats', {
            totalMistakes: 0,
            mistakeTypes: {},
            correctedWithoutSupervisor: 0
        });
    }

    /**
     * Добави действие в историята (за undo)
     * @param {Object} action - Действие
     */
    recordAction(action) {
        const record = {
            id: Date.now() + Math.random(),
            timestamp: new Date().toISOString(),
            userId: this.authService.currentUser?.id,
            ...action
        };

        this.actionHistory.unshift(record);

        // Пази само последните N действия
        if (this.actionHistory.length > this.maxHistorySize) {
            this.actionHistory = this.actionHistory.slice(0, this.maxHistorySize);
        }

        return record;
    }

    /**
     * Отмени последното действие (Undo)
     * @param {string} actionType - Тип действие ('add_item', 'remove_item', 'change_quantity', etc.)
     * @returns {Object} Резултат
     */
    undoLastAction(actionType = null) {
        // Филтрирай по тип ако е зададен
        const relevantActions = actionType
            ? this.actionHistory.filter(a => a.type === actionType)
            : this.actionHistory;

        if (relevantActions.length === 0) {
            return {
                success: false,
                errors: ['Няма действия за отмяна']
            };
        }

        const lastAction = relevantActions[0];

        // Премахни от история
        const index = this.actionHistory.indexOf(lastAction);
        this.actionHistory.splice(index, 1);

        // Запиши статистика
        this._recordMistake('undo', lastAction.type);

        return {
            success: true,
            undoneAction: lastAction,
            message: 'Действието беше отменено'
        };
    }

    /**
     * Бърза корекция на количество
     * @param {Object} currentSale - Текуща продажба
     * @param {number} itemIndex - Индекс на продукт
     * @param {number} newQuantity - Ново количество
     * @returns {Object} Резултат
     */
    quickFixQuantity(currentSale, itemIndex, newQuantity) {
        if (!currentSale || !currentSale.items || itemIndex < 0 || itemIndex >= currentSale.items.length) {
            return {
                success: false,
                errors: ['Невалидна продажба или индекс']
            };
        }

        const item = currentSale.items[itemIndex];
        const oldQuantity = item.quantity;

        // Валидация
        if (newQuantity <= 0) {
            return {
                success: false,
                errors: ['Количеството трябва да е по-голямо от 0']
            };
        }

        // Провери налично количество
        const product = this.productService.getProductById(item.productId);
        if (product && newQuantity > oldQuantity) {
            const additionalNeeded = newQuantity - oldQuantity;
            if (product.quantity < additionalNeeded) {
                return {
                    success: false,
                    errors: [`Недостатъчно количество. Налични: ${product.quantity}`]
                };
            }
        }

        // Запиши в история преди промяната
        this.recordAction({
            type: 'change_quantity',
            itemIndex: itemIndex,
            productId: item.productId,
            productName: item.productName,
            oldQuantity: oldQuantity,
            newQuantity: newQuantity
        });

        // Промени количеството
        item.quantity = newQuantity;

        // Преизчисли тотала
        const newTotal = currentSale.items.reduce((sum, itm) => sum + (itm.price * itm.quantity), 0);

        this._recordMistake('quantity_fix', 'success');

        return {
            success: true,
            updatedItem: item,
            oldQuantity: oldQuantity,
            newQuantity: newQuantity,
            newTotal: Math.round(newTotal * 100) / 100,
            message: `Количеството е променено от ${oldQuantity} на ${newQuantity}`
        };
    }

    /**
     * Замени грешен продукт с правилен
     * @param {Object} currentSale - Текуща продажба
     * @param {number} itemIndex - Индекс на грешния продукт
     * @param {number} correctProductId - ID на правилния продукт
     * @returns {Object} Резултат
     */
    swapProduct(currentSale, itemIndex, correctProductId) {
        if (!currentSale || !currentSale.items || itemIndex < 0 || itemIndex >= currentSale.items.length) {
            return {
                success: false,
                errors: ['Невалидна продажба или индекс']
            };
        }

        const wrongItem = currentSale.items[itemIndex];
        const correctProduct = this.productService.getProductById(correctProductId);

        if (!correctProduct) {
            return {
                success: false,
                errors: ['Продуктът не е намерен']
            };
        }

        // Провери налично количество
        if (correctProduct.quantity < wrongItem.quantity) {
            return {
                success: false,
                errors: [`Недостатъчно количество. Налични: ${correctProduct.quantity}`]
            };
        }

        // Запиши в история
        this.recordAction({
            type: 'swap_product',
            itemIndex: itemIndex,
            wrongProductId: wrongItem.productId,
            wrongProductName: wrongItem.productName,
            correctProductId: correctProductId,
            correctProductName: correctProduct.name,
            quantity: wrongItem.quantity
        });

        // Замени продукта
        currentSale.items[itemIndex] = {
            productId: correctProduct.id,
            productName: correctProduct.name,
            price: correctProduct.price,
            quantity: wrongItem.quantity
        };

        // Преизчисли тотала
        const newTotal = currentSale.items.reduce((sum, itm) => sum + (itm.price * itm.quantity), 0);

        this._recordMistake('product_swap', 'success');

        return {
            success: true,
            swappedFrom: wrongItem.productName,
            swappedTo: correctProduct.name,
            newTotal: Math.round(newTotal * 100) / 100,
            message: `Продуктът беше заменен: ${wrongItem.productName} → ${correctProduct.name}`
        };
    }

    /**
     * Премахни последния добавен продукт
     * @param {Object} currentSale - Текуща продажба
     * @returns {Object} Резултат
     */
    removeLastItem(currentSale) {
        if (!currentSale || !currentSale.items || currentSale.items.length === 0) {
            return {
                success: false,
                errors: ['Няма продукти в кошницата']
            };
        }

        const removedItem = currentSale.items.pop();

        // Запиши в история
        this.recordAction({
            type: 'remove_item',
            productId: removedItem.productId,
            productName: removedItem.productName,
            price: removedItem.price,
            quantity: removedItem.quantity
        });

        // Преизчисли тотала
        const newTotal = currentSale.items.reduce((sum, itm) => sum + (itm.price * itm.quantity), 0);

        this._recordMistake('remove_last', 'success');

        return {
            success: true,
            removedItem: removedItem,
            newTotal: Math.round(newTotal * 100) / 100,
            remainingItems: currentSale.items.length,
            message: `Премахнат: ${removedItem.productName}`
        };
    }

    /**
     * Премахни конкретен продукт по индекс
     * @param {Object} currentSale - Текуща продажба
     * @param {number} itemIndex - Индекс
     * @returns {Object} Резултат
     */
    removeItemByIndex(currentSale, itemIndex) {
        if (!currentSale || !currentSale.items || itemIndex < 0 || itemIndex >= currentSale.items.length) {
            return {
                success: false,
                errors: ['Невалиден индекс']
            };
        }

        const removedItem = currentSale.items.splice(itemIndex, 1)[0];

        // Запиши в история
        this.recordAction({
            type: 'remove_item_index',
            itemIndex: itemIndex,
            productId: removedItem.productId,
            productName: removedItem.productName,
            price: removedItem.price,
            quantity: removedItem.quantity
        });

        // Преизчисли тотала
        const newTotal = currentSale.items.reduce((sum, itm) => sum + (itm.price * itm.quantity), 0);

        this._recordMistake('remove_by_index', 'success');

        return {
            success: true,
            removedItem: removedItem,
            newTotal: Math.round(newTotal * 100) / 100,
            message: `Премахнат: ${removedItem.productName}`
        };
    }

    /**
     * Smart validation преди финализиране на продажба
     * @param {Object} currentSale - Текуща продажба
     * @returns {Object} Валидация с предупреждения
     */
    validateBeforeCheckout(currentSale) {
        const warnings = [];
        const errors = [];

        if (!currentSale || !currentSale.items || currentSale.items.length === 0) {
            errors.push('Няма продукти в кошницата');
            return { valid: false, warnings, errors };
        }

        // Провери за необичайно високи цени
        currentSale.items.forEach((item, index) => {
            const avgPrice = this._getAveragePrice(item.productId);
            if (avgPrice && item.price > avgPrice * 1.5) {
                warnings.push({
                    type: 'unusual_price',
                    severity: 'warning',
                    itemIndex: index,
                    message: `${item.productName}: Цената (${item.price}лв) е необичайно висока. Обичайна цена: ${avgPrice.toFixed(2)}лв`
                });
            }
        });

        // Провери за необичайно високи количества
        currentSale.items.forEach((item, index) => {
            if (item.quantity > 10) {
                warnings.push({
                    type: 'high_quantity',
                    severity: 'info',
                    itemIndex: index,
                    message: `${item.productName}: Голямо количество (${item.quantity}). Потвърди че е правилно.`
                });
            }
        });

        // Провери общата сума
        const total = currentSale.items.reduce((sum, itm) => sum + (itm.price * itm.quantity), 0);
        if (total > 500) {
            warnings.push({
                type: 'high_total',
                severity: 'info',
                message: `Висок тотал: ${total.toFixed(2)}лв. Потвърди със клиента.`
            });
        }

        // Провери дупликати
        const productCounts = {};
        currentSale.items.forEach(item => {
            productCounts[item.productId] = (productCounts[item.productId] || 0) + 1;
        });

        Object.keys(productCounts).forEach(productId => {
            if (productCounts[productId] > 1) {
                const product = this.productService.getProductById(parseInt(productId));
                warnings.push({
                    type: 'duplicate',
                    severity: 'warning',
                    message: `${product?.name || 'Продукт'} е добавен ${productCounts[productId]} пъти. Сигурен ли си?`
                });
            }
        });

        return {
            valid: errors.length === 0,
            warnings: warnings,
            errors: errors,
            canProceed: errors.length === 0
        };
    }

    /**
     * Пауза на текуща транзакция (за да помогнеш на друг клиент)
     * @param {Object} currentSale - Текуща продажба
     * @param {string} reason - Причина за паузата
     * @returns {Object} Резултат
     */
    pauseTransaction(currentSale, reason = '') {
        if (!currentSale || !currentSale.items || currentSale.items.length === 0) {
            return {
                success: false,
                errors: ['Няма активна транзакция за пауза']
            };
        }

        const pausedTransaction = {
            id: Date.now() + Math.random(),
            pausedAt: new Date().toISOString(),
            pausedBy: this.authService.currentUser?.id,
            reason: reason,
            sale: JSON.parse(JSON.stringify(currentSale)), // Deep copy
            itemCount: currentSale.items.length,
            total: currentSale.items.reduce((sum, itm) => sum + (itm.price * itm.quantity), 0)
        };

        this.pausedTransactions.push(pausedTransaction);
        this._savePausedTransactions();

        return {
            success: true,
            transaction: pausedTransaction,
            message: `Транзакция паузирана. ID: ${pausedTransaction.id.toString().slice(-6)}`
        };
    }

    /**
     * Възстанови паузирана транзакция
     * @param {number} transactionId - ID на паузираната транзакция
     * @returns {Object} Възстановена продажба
     */
    resumeTransaction(transactionId) {
        const index = this.pausedTransactions.findIndex(t => t.id === transactionId);

        if (index === -1) {
            return {
                success: false,
                errors: ['Транзакцията не е намерена']
            };
        }

        const transaction = this.pausedTransactions[index];
        this.pausedTransactions.splice(index, 1);
        this._savePausedTransactions();

        return {
            success: true,
            sale: transaction.sale,
            pausedAt: transaction.pausedAt,
            duration: this._calculateDuration(transaction.pausedAt),
            message: `Транзакция възстановена (паузирана ${this._calculateDuration(transaction.pausedAt)})`
        };
    }

    /**
     * Вземи всички паузирани транзакции
     * @returns {Object} Списък
     */
    getPausedTransactions() {
        return {
            success: true,
            transactions: this.pausedTransactions.map(t => ({
                id: t.id,
                pausedAt: t.pausedAt,
                itemCount: t.itemCount,
                total: Math.round(t.total * 100) / 100,
                duration: this._calculateDuration(t.pausedAt),
                reason: t.reason
            }))
        };
    }

    /**
     * Изтрий паузирана транзакция
     * @param {number} transactionId - ID
     * @returns {Object} Резултат
     */
    deletePausedTransaction(transactionId) {
        const index = this.pausedTransactions.findIndex(t => t.id === transactionId);

        if (index === -1) {
            return {
                success: false,
                errors: ['Транзакцията не е намерена']
            };
        }

        this.pausedTransactions.splice(index, 1);
        this._savePausedTransactions();

        return {
            success: true,
            message: 'Паузираната транзакция е изтрита'
        };
    }

    /**
     * Заявка за одобрение от мениджър (за по-големи корекции)
     * @param {Object} requestData - Данни за заявката
     * @returns {Object} Резултат
     */
    requestManagerOverride(requestData) {
        const request = {
            id: Date.now() + Math.random(),
            requestedAt: new Date().toISOString(),
            requestedBy: this.authService.currentUser?.id,
            type: requestData.type, // 'price_override', 'large_discount', 'void_sale', etc.
            reason: requestData.reason,
            details: requestData.details,
            status: 'pending'
        };

        // В реална система това би изпратило нотификация до мениджъра
        // Засега го записваме в storage
        const pendingRequests = StorageService.get('managerOverrideRequests', []);
        pendingRequests.push(request);
        StorageService.set('managerOverrideRequests', pendingRequests);

        return {
            success: true,
            request: request,
            message: 'Заявката е изпратена до мениджър'
        };
    }

    /**
     * Получи история на действия
     * @param {number} limit - Лимит
     * @returns {Object} История
     */
    getActionHistory(limit = 20) {
        return {
            success: true,
            history: this.actionHistory.slice(0, limit)
        };
    }

    /**
     * Получи статистика за грешки
     * @returns {Object} Статистика
     */
    getErrorStatistics() {
        const total = this.errorStats.totalMistakes;
        const correctedWithout = this.errorStats.correctedWithoutSupervisor;
        const successRate = total > 0 ? (correctedWithout / total) * 100 : 0;

        return {
            success: true,
            statistics: {
                totalMistakes: total,
                correctedWithoutSupervisor: correctedWithout,
                successRate: Math.round(successRate * 100) / 100,
                mistakeTypes: this.errorStats.mistakeTypes,
                topMistakes: this._getTopMistakes()
            }
        };
    }

    /**
     * Изчисти историята на действия
     */
    clearHistory() {
        this.actionHistory = [];
        return {
            success: true,
            message: 'Историята е изчистена'
        };
    }

    // ============ PRIVATE METHODS ============

    _recordMistake(type, status) {
        this.errorStats.totalMistakes++;

        if (status === 'success') {
            this.errorStats.correctedWithoutSupervisor++;
        }

        if (!this.errorStats.mistakeTypes[type]) {
            this.errorStats.mistakeTypes[type] = 0;
        }
        this.errorStats.mistakeTypes[type]++;

        this._saveErrorStats();
    }

    _getAveragePrice(productId) {
        // Вземи средната цена от последните 10 продажби на този продукт
        const allSales = this.salesService.getAllSales();
        const prices = [];

        allSales.forEach(sale => {
            sale.items.forEach(item => {
                if (item.productId === productId) {
                    prices.push(item.price);
                }
            });
        });

        if (prices.length === 0) return null;

        const recentPrices = prices.slice(-10);
        const sum = recentPrices.reduce((a, b) => a + b, 0);
        return sum / recentPrices.length;
    }

    _calculateDuration(pausedAt) {
        const now = new Date();
        const paused = new Date(pausedAt);
        const diff = now - paused;

        const minutes = Math.floor(diff / 60000);
        if (minutes < 1) return 'по-малко от минута';
        if (minutes === 1) return '1 минута';
        if (minutes < 60) return `${minutes} минути`;

        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        return `${hours}ч ${remainingMinutes}мин`;
    }

    _getTopMistakes() {
        const types = this.errorStats.mistakeTypes;
        const sorted = Object.keys(types)
            .map(key => ({ type: key, count: types[key] }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        return sorted;
    }

    _savePausedTransactions() {
        StorageService.set('pausedTransactions', this.pausedTransactions);
    }

    _saveErrorStats() {
        StorageService.set('errorStats', this.errorStats);
    }
}
