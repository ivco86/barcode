/**
 * Cash Helper Pro - v7.0
 * Помощник за пари, ресто и броене на каса
 */
import { StorageService } from './StorageService.js';

export class CashHelperService {
    constructor(shiftService, authService) {
        this.shiftService = shiftService;
        this.authService = authService;

        // Български валути
        this.denominations = {
            bgn: {
                banknotes: [100, 50, 20, 10, 5, 2],
                coins: [2, 1, 0.50, 0.20, 0.10, 0.05, 0.02, 0.01]
            },
            eur: {
                banknotes: [500, 200, 100, 50, 20, 10, 5],
                coins: [2, 1, 0.50, 0.20, 0.10, 0.05, 0.02, 0.01]
            },
            usd: {
                banknotes: [100, 50, 20, 10, 5, 2, 1],
                coins: [1, 0.50, 0.25, 0.10, 0.05, 0.01]
            }
        };

        // Визуални имена на монети/банкноти
        this.denominationNames = {
            100: '100лв банкнота',
            50: '50лв банкнота',
            20: '20лв банкнота',
            10: '10лв банкнота',
            5: '5лв банкнота',
            2: '2лв монета',
            1: '1лв монета',
            0.50: '50ст монета',
            0.20: '20ст монета',
            0.10: '10ст монета',
            0.05: '5ст монета',
            0.02: '2ст монета',
            0.01: '1ст монета'
        };

        // Cash drop история
        this.cashDrops = StorageService.get('cashDrops', []);

        // Настройки
        this.settings = StorageService.get('cashHelperSettings', {
            cashDropThreshold: 500, // Автоматично напомняне за cash drop
            lowChangeThreshold: 10, // Предупреждение за малко ресто
            preferredChangeMethod: 'optimal' // 'optimal' или 'minimal_coins'
        });
    }

    /**
     * Изчисли ресто и покажи разбивка по банкноти/монети
     * @param {number} totalAmount - Обща сума
     * @param {number} paidAmount - Платена сума
     * @param {string} currency - Валута ('bgn', 'eur', 'usd')
     * @returns {Object} Разбивка на рестото
     */
    calculateChange(totalAmount, paidAmount, currency = 'bgn') {
        if (paidAmount < totalAmount) {
            return {
                success: false,
                errors: ['Платената сума е по-малка от общата сума']
            };
        }

        const changeAmount = paidAmount - totalAmount;

        if (changeAmount === 0) {
            return {
                success: true,
                changeAmount: 0,
                breakdown: [],
                message: 'Точна сума - няма ресто'
            };
        }

        // Изчисли оптимална разбивка
        const breakdown = this._calculateOptimalBreakdown(changeAmount, currency);

        // Генерирай visual guide
        const visualGuide = this._generateVisualGuide(breakdown);

        // Проверка дали има достатъчно ресто в касата
        const availabilityCheck = this._checkChangeAvailability(breakdown);

        return {
            success: true,
            totalAmount: Math.round(totalAmount * 100) / 100,
            paidAmount: Math.round(paidAmount * 100) / 100,
            changeAmount: Math.round(changeAmount * 100) / 100,
            breakdown: breakdown,
            visualGuide: visualGuide,
            totalPieces: breakdown.reduce((sum, b) => sum + b.count, 0),
            availability: availabilityCheck
        };
    }

    /**
     * Калкулатор за бързо изчисление на ресто (в главата)
     * @param {number} totalAmount - Обща сума
     * @param {number} paidAmount - Платена сума
     * @returns {Object} Бърз начин за изчисление
     */
    quickChangeCalculator(totalAmount, paidAmount) {
        const change = paidAmount - totalAmount;

        if (change < 0) {
            return {
                success: false,
                errors: ['Недостатъчна сума']
            };
        }

        // Shortcuts за често срещани случаи
        const shortcuts = [];

        // Закръгление нагоре
        const roundedTotal = Math.ceil(totalAmount);
        if (paidAmount === roundedTotal) {
            shortcuts.push(`Закръглено: ${change.toFixed(2)}лв ресто`);
        }

        // Кръгли числа
        if (paidAmount % 10 === 0 && totalAmount < paidAmount) {
            const tens = Math.floor(change / 10);
            const remainder = change % 10;
            if (tens > 0) {
                shortcuts.push(`${tens}×10лв + ${remainder.toFixed(2)}лв`);
            }
        }

        return {
            success: true,
            changeAmount: Math.round(change * 100) / 100,
            shortcuts: shortcuts,
            mentalMath: {
                step1: `${paidAmount} - ${Math.floor(totalAmount)} = ${paidAmount - Math.floor(totalAmount)}`,
                step2: `${paidAmount - Math.floor(totalAmount)} - ${(totalAmount % 1).toFixed(2)} = ${change.toFixed(2)}`
            }
        };
    }

    /**
     * Броене на каса в края на смяна
     * @param {Object} cashCount - Брой на всяка деноминация
     * @returns {Object} Резултат от броене
     */
    countCash(cashCount) {
        // cashCount = { '100': 2, '50': 5, '20': 10, '2': 15, '1': 20, '0.50': 10, ... }

        let total = 0;
        const breakdown = [];

        Object.keys(cashCount).forEach(denomination => {
            const value = parseFloat(denomination);
            const count = parseInt(cashCount[denomination]);

            if (count > 0) {
                const subtotal = value * count;
                total += subtotal;

                breakdown.push({
                    denomination: value,
                    denominationName: this.denominationNames[value] || `${value}лв`,
                    count: count,
                    subtotal: Math.round(subtotal * 100) / 100
                });
            }
        });

        // Сортирай от най-големи към най-малки
        breakdown.sort((a, b) => b.denomination - a.denomination);

        return {
            success: true,
            total: Math.round(total * 100) / 100,
            breakdown: breakdown,
            totalPieces: breakdown.reduce((sum, b) => sum + b.count, 0)
        };
    }

    /**
     * Guided End-of-Shift count (стъпка по стъпка)
     * @returns {Object} Интерактивен wizard
     */
    startEndOfShiftCount() {
        const wizard = {
            id: Date.now(),
            startedAt: new Date().toISOString(),
            userId: this.authService.currentUser?.id,
            steps: [],
            currentStep: 0,
            totalSteps: this.denominations.bgn.banknotes.length + this.denominations.bgn.coins.length
        };

        // Генерирай стъпки
        this.denominations.bgn.banknotes.forEach(denomination => {
            wizard.steps.push({
                type: 'banknote',
                denomination: denomination,
                denominationName: this.denominationNames[denomination],
                question: `Колко ${this.denominationNames[denomination]} има?`,
                count: null
            });
        });

        this.denominations.bgn.coins.forEach(denomination => {
            wizard.steps.push({
                type: 'coin',
                denomination: denomination,
                denominationName: this.denominationNames[denomination],
                question: `Колко ${this.denominationNames[denomination]} има?`,
                count: null
            });
        });

        return {
            success: true,
            wizard: wizard
        };
    }

    /**
     * Запиши отговор на стъпка от wizard
     * @param {Object} wizard - Wizard обект
     * @param {number} stepIndex - Индекс на стъпка
     * @param {number} count - Брой
     * @returns {Object} Обновен wizard
     */
    recordWizardStep(wizard, stepIndex, count) {
        if (stepIndex < 0 || stepIndex >= wizard.steps.length) {
            return {
                success: false,
                errors: ['Невалиден индекс на стъпка']
            };
        }

        wizard.steps[stepIndex].count = count;
        wizard.currentStep = stepIndex + 1;

        // Проверка дали е финализиран
        const isComplete = wizard.steps.every(step => step.count !== null);

        if (isComplete) {
            // Изчисли тотал
            let total = 0;
            wizard.steps.forEach(step => {
                total += step.denomination * step.count;
            });

            wizard.total = Math.round(total * 100) / 100;
            wizard.completedAt = new Date().toISOString();
        }

        return {
            success: true,
            wizard: wizard,
            isComplete: isComplete,
            nextStep: isComplete ? null : wizard.steps[wizard.currentStep]
        };
    }

    /**
     * Сравни очаквано vs действително (за край на смяна)
     * @param {number} expected - Очаквана сума
     * @param {number} actual - Действителна сума
     * @returns {Object} Сравнение
     */
    compareExpectedVsActual(expected, actual) {
        const variance = actual - expected;
        const variancePercent = expected > 0 ? (variance / expected) * 100 : 0;

        let status;
        let severity;

        if (Math.abs(variance) < 0.01) {
            status = 'perfect_match';
            severity = 'success';
        } else if (Math.abs(variance) < 5) {
            status = 'acceptable';
            severity = 'info';
        } else if (Math.abs(variance) < 20) {
            status = 'review_needed';
            severity = 'warning';
        } else {
            status = 'significant_variance';
            severity = 'error';
        }

        return {
            success: true,
            expected: Math.round(expected * 100) / 100,
            actual: Math.round(actual * 100) / 100,
            variance: Math.round(variance * 100) / 100,
            variancePercent: Math.round(variancePercent * 100) / 100,
            status: status,
            severity: severity,
            message: this._getVarianceMessage(variance, status)
        };
    }

    /**
     * Cash drop (изнасяне на пари от касата)
     * @param {number} amount - Сума
     * @param {string} reason - Причина
     * @returns {Object} Резултат
     */
    recordCashDrop(amount, reason = '') {
        const drop = {
            id: Date.now() + Math.random(),
            timestamp: new Date().toISOString(),
            userId: this.authService.currentUser?.id,
            amount: Math.round(amount * 100) / 100,
            reason: reason
        };

        this.cashDrops.push(drop);
        this._saveCashDrops();

        return {
            success: true,
            drop: drop,
            message: `Cash drop: ${amount}лв`
        };
    }

    /**
     * Проверка дали трябва да направиш cash drop
     * @param {number} currentCashAmount - Текуща сума в касата
     * @returns {Object} Препоръка
     */
    checkCashDropNeeded(currentCashAmount) {
        const threshold = this.settings.cashDropThreshold;

        if (currentCashAmount >= threshold) {
            const recommendedDrop = Math.floor((currentCashAmount - threshold / 2) / 50) * 50; // Закръгли до 50лв

            return {
                success: true,
                dropNeeded: true,
                currentAmount: currentCashAmount,
                threshold: threshold,
                recommendedAmount: recommendedDrop,
                message: `Препоръчва се cash drop от ${recommendedDrop}лв`
            };
        }

        return {
            success: true,
            dropNeeded: false,
            currentAmount: currentCashAmount,
            threshold: threshold,
            message: 'Cash drop не е необходим'
        };
    }

    /**
     * История на cash drops
     * @param {string} period - Период ('today', 'week', 'month')
     * @returns {Object} История
     */
    getCashDropHistory(period = 'today') {
        let filtered = this.cashDrops;

        const now = new Date();
        if (period === 'today') {
            const startOfDay = new Date(now.setHours(0, 0, 0, 0));
            filtered = this.cashDrops.filter(d => new Date(d.timestamp) >= startOfDay);
        } else if (period === 'week') {
            const startOfWeek = new Date(now.setDate(now.getDate() - 7));
            filtered = this.cashDrops.filter(d => new Date(d.timestamp) >= startOfWeek);
        } else if (period === 'month') {
            const startOfMonth = new Date(now.setDate(1));
            filtered = this.cashDrops.filter(d => new Date(d.timestamp) >= startOfMonth);
        }

        const total = filtered.reduce((sum, d) => sum + d.amount, 0);

        return {
            success: true,
            period: period,
            drops: filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
            totalAmount: Math.round(total * 100) / 100,
            count: filtered.length
        };
    }

    /**
     * Проверка за достатъчно ресто в касата
     * @param {Object} neededChange - Необходимо ресто { '1': 2, '0.50': 1, ... }
     * @returns {Object} Проверка
     */
    checkChangeAvailability(neededChange) {
        // В реална система това би проверило actual cash в касата
        // Засега симулация
        const warnings = [];

        Object.keys(neededChange).forEach(denomination => {
            const value = parseFloat(denomination);
            const needed = neededChange[denomination];

            // Симулация: предупреждение ако трябват повече от 5 монети от един тип
            if (needed > 5 && value < 1) {
                warnings.push({
                    denomination: value,
                    needed: needed,
                    message: `Внимание: Необходими ${needed}× ${this.denominationNames[value]}`
                });
            }
        });

        return {
            success: true,
            hasWarnings: warnings.length > 0,
            warnings: warnings
        };
    }

    /**
     * Настройки на Cash Helper
     * @param {Object} updates - Промени
     * @returns {Object} Резултат
     */
    updateSettings(updates) {
        this.settings = { ...this.settings, ...updates };
        StorageService.set('cashHelperSettings', this.settings);

        return {
            success: true,
            settings: this.settings
        };
    }

    /**
     * Получи настройки
     * @returns {Object} Настройки
     */
    getSettings() {
        return {
            success: true,
            settings: this.settings
        };
    }

    // ============ PRIVATE METHODS ============

    _calculateOptimalBreakdown(amount, currency = 'bgn') {
        const breakdown = [];
        let remaining = Math.round(amount * 100) / 100; // Закръгли до 2 decimal

        const denoms = this.denominations[currency];
        const allDenoms = [...denoms.banknotes, ...denoms.coins].sort((a, b) => b - a);

        allDenoms.forEach(denomination => {
            if (remaining >= denomination) {
                const count = Math.floor(remaining / denomination);
                if (count > 0) {
                    breakdown.push({
                        denomination: denomination,
                        denominationName: this.denominationNames[denomination] || `${denomination}`,
                        count: count,
                        subtotal: Math.round(denomination * count * 100) / 100,
                        type: denoms.banknotes.includes(denomination) ? 'banknote' : 'coin'
                    });

                    remaining = Math.round((remaining - (denomination * count)) * 100) / 100;
                }
            }
        });

        return breakdown;
    }

    _generateVisualGuide(breakdown) {
        const guide = [];

        breakdown.forEach(item => {
            let emoji = '';
            if (item.type === 'banknote') {
                emoji = '💵';
            } else {
                emoji = '🪙';
            }

            guide.push({
                text: `${item.count}× ${item.denominationName}`,
                emoji: emoji,
                visual: `${emoji} `.repeat(item.count)
            });
        });

        return guide;
    }

    _checkChangeAvailability(breakdown) {
        // Simplified check
        const warnings = [];

        breakdown.forEach(item => {
            if (item.type === 'coin' && item.count > 10) {
                warnings.push(`Много ${item.denominationName} (${item.count} броя)`);
            }
        });

        return {
            hasEnough: true,
            warnings: warnings
        };
    }

    _getVarianceMessage(variance, status) {
        if (status === 'perfect_match') {
            return 'Перфектно! Никаква разлика.';
        } else if (status === 'acceptable') {
            if (variance > 0) {
                return `Излишък: ${Math.abs(variance).toFixed(2)}лв (в рамките на нормалното)`;
            } else {
                return `Недостиг: ${Math.abs(variance).toFixed(2)}лв (в рамките на нормалното)`;
            }
        } else if (status === 'review_needed') {
            if (variance > 0) {
                return `ВНИМАНИЕ: Излишък от ${Math.abs(variance).toFixed(2)}лв - провери отново`;
            } else {
                return `ВНИМАНИЕ: Недостиг от ${Math.abs(variance).toFixed(2)}лв - провери отново`;
            }
        } else {
            if (variance > 0) {
                return `КРИТИЧНО: Значителен излишък от ${Math.abs(variance).toFixed(2)}лв!`;
            } else {
                return `КРИТИЧНО: Значителен недостиг от ${Math.abs(variance).toFixed(2)}лв!`;
            }
        }
    }

    _saveCashDrops() {
        // Keep only last 100 drops
        if (this.cashDrops.length > 100) {
            this.cashDrops = this.cashDrops.slice(-100);
        }
        StorageService.set('cashDrops', this.cashDrops);
    }
}
