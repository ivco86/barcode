import { StorageService } from './StorageService.js';
import { ValidationService } from './ValidationService.js';

/**
 * GiftCardService - Управление на подаръчни карти и ваучери
 *
 * Функционалност:
 * - Създаване и управление на gift cards
 * - Voucher system с различни типове отстъпки
 * - Balance tracking и история
 * - Expiry management
 * - Automatic code generation
 * - Sales vs redemption analytics
 *
 * v9.0 - Revenue Boost Suite
 */
export class GiftCardService {
    constructor(salesService) {
        this.salesService = salesService;
        this.giftCards = StorageService.load('giftCards') || [];
        this.vouchers = StorageService.load('vouchers') || [];
        this.cardTransactions = StorageService.load('cardTransactions') || [];
        this.voucherUsage = StorageService.load('voucherUsage') || [];
    }

    /**
     * Генериране на уникален код за карта/ваучер
     */
    _generateCode(prefix = 'GC') {
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.random().toString(36).substring(2, 8).toUpperCase();
        return `${prefix}-${timestamp}-${random}`;
    }

    /**
     * Проверка дали код съществува
     */
    _codeExists(code) {
        return this.giftCards.some(gc => gc.code === code) ||
               this.vouchers.some(v => v.code === code);
    }

    /**
     * Създаване на подаръчна карта
     *
     * @param {Object} cardData {
     *   amount: number - начална стойност
     *   expiryDays: number - валидност в дни (default 365)
     *   recipientName: string - име на получател
     *   recipientPhone: string - телефон
     *   message: string - лично съобщение
     *   customCode: string - optional custom code
     * }
     */
    createGiftCard(cardData) {
        if (!cardData.amount || cardData.amount <= 0) {
            throw new Error('Невалидна сума за подаръчна карта');
        }

        const code = cardData.customCode && !this._codeExists(cardData.customCode)
            ? cardData.customCode
            : this._generateCode('GC');

        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + (cardData.expiryDays || 365));

        const giftCard = {
            id: Date.now() + Math.random(),
            code: code,
            type: 'gift_card',
            originalAmount: parseFloat(cardData.amount),
            currentBalance: parseFloat(cardData.amount),
            recipientName: ValidationService.sanitizeString(cardData.recipientName || ''),
            recipientPhone: cardData.recipientPhone || '',
            message: ValidationService.sanitizeString(cardData.message || ''),
            issuedDate: new Date().toISOString(),
            expiryDate: expiryDate.toISOString(),
            status: 'active', // active, depleted, expired, cancelled
            issuedBy: cardData.issuedBy || 'system',
            transactions: []
        };

        this.giftCards.push(giftCard);
        this._save();

        return giftCard;
    }

    /**
     * Създаване на ваучер за отстъпка
     *
     * @param {Object} voucherData {
     *   type: 'percentage' | 'fixed_amount' | 'free_product'
     *   value: number - процент или фиксирана сума
     *   minPurchase: number - минимална покупка за активиране
     *   maxDiscount: number - максимална отстъпка (за percentage)
     *   categoryRestriction: array - ID на категории (optional)
     *   productRestriction: array - ID на продукти (optional)
     *   usageLimit: number - колко пъти може да се използва
     *   expiryDays: number - валидност
     *   campaign: string - име на кампания
     * }
     */
    createVoucher(voucherData) {
        if (!voucherData.type || !voucherData.value) {
            throw new Error('Type и value са задължителни');
        }

        const code = voucherData.customCode && !this._codeExists(voucherData.customCode)
            ? voucherData.customCode
            : this._generateCode('VC');

        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + (voucherData.expiryDays || 30));

        const voucher = {
            id: Date.now() + Math.random(),
            code: code,
            type: voucherData.type, // percentage, fixed_amount, free_product
            value: parseFloat(voucherData.value),
            minPurchase: parseFloat(voucherData.minPurchase || 0),
            maxDiscount: voucherData.maxDiscount ? parseFloat(voucherData.maxDiscount) : null,
            categoryRestriction: voucherData.categoryRestriction || null,
            productRestriction: voucherData.productRestriction || null,
            usageLimit: parseInt(voucherData.usageLimit) || null,
            currentUsageCount: 0,
            issuedDate: new Date().toISOString(),
            expiryDate: expiryDate.toISOString(),
            status: 'active',
            campaign: ValidationService.sanitizeString(voucherData.campaign || ''),
            createdBy: voucherData.createdBy || 'system'
        };

        this.vouchers.push(voucher);
        this._save();

        return voucher;
    }

    /**
     * Проверка на gift card/voucher код
     */
    checkCode(code) {
        const giftCard = this.giftCards.find(gc => gc.code === code);
        if (giftCard) {
            return {
                found: true,
                cardType: 'gift_card',
                data: giftCard,
                valid: this._isGiftCardValid(giftCard),
                balance: giftCard.currentBalance,
                status: giftCard.status,
                expiryDate: giftCard.expiryDate
            };
        }

        const voucher = this.vouchers.find(v => v.code === code);
        if (voucher) {
            return {
                found: true,
                cardType: 'voucher',
                data: voucher,
                valid: this._isVoucherValid(voucher),
                discountType: voucher.type,
                discountValue: voucher.value,
                status: voucher.status,
                expiryDate: voucher.expiryDate
            };
        }

        return { found: false };
    }

    /**
     * Валидиране на gift card
     */
    _isGiftCardValid(giftCard) {
        if (giftCard.status !== 'active') return false;
        if (giftCard.currentBalance <= 0) return false;
        if (new Date(giftCard.expiryDate) < new Date()) return false;
        return true;
    }

    /**
     * Валидиране на voucher
     */
    _isVoucherValid(voucher) {
        if (voucher.status !== 'active') return false;
        if (new Date(voucher.expiryDate) < new Date()) return false;
        if (voucher.usageLimit && voucher.currentUsageCount >= voucher.usageLimit) return false;
        return true;
    }

    /**
     * Използване на gift card за плащане
     *
     * @param {string} code - код на картата
     * @param {number} amount - сума за използване
     * @param {number} saleId - ID на продажба
     */
    useGiftCard(code, amount, saleId) {
        const giftCard = this.giftCards.find(gc => gc.code === code);

        if (!giftCard) {
            throw new Error('Подаръчна карта не е намерена');
        }

        if (!this._isGiftCardValid(giftCard)) {
            throw new Error(`Картата не е валидна. Статус: ${giftCard.status}`);
        }

        const useAmount = Math.min(parseFloat(amount), giftCard.currentBalance);

        // Update balance
        giftCard.currentBalance -= useAmount;

        if (giftCard.currentBalance <= 0) {
            giftCard.status = 'depleted';
        }

        // Record transaction
        const transaction = {
            id: Date.now() + Math.random(),
            cardId: giftCard.id,
            cardCode: giftCard.code,
            type: 'usage',
            amount: useAmount,
            balanceBefore: giftCard.currentBalance + useAmount,
            balanceAfter: giftCard.currentBalance,
            saleId: saleId,
            timestamp: new Date().toISOString()
        };

        giftCard.transactions.push(transaction);
        this.cardTransactions.push(transaction);

        this._save();

        return {
            success: true,
            amountUsed: useAmount,
            remainingBalance: giftCard.currentBalance,
            transaction: transaction
        };
    }

    /**
     * Калкулиране на отстъпка от voucher
     *
     * @param {string} code - код на ваучер
     * @param {Array} items - продукти в кошницата
     * @param {number} subtotal - междинна сума
     */
    calculateVoucherDiscount(code, items, subtotal) {
        const voucher = this.vouchers.find(v => v.code === code);

        if (!voucher) {
            throw new Error('Ваучер не е намерен');
        }

        if (!this._isVoucherValid(voucher)) {
            throw new Error(`Ваучерът не е валиден. Статус: ${voucher.status}`);
        }

        // Check minimum purchase
        if (voucher.minPurchase && subtotal < voucher.minPurchase) {
            throw new Error(`Минимална покупка: ${voucher.minPurchase.toFixed(2)} лв`);
        }

        let discount = 0;
        const eligibleItems = this._getEligibleItems(voucher, items);

        if (eligibleItems.length === 0 && (voucher.categoryRestriction || voucher.productRestriction)) {
            throw new Error('Няма продукти, валидни за този ваучер');
        }

        const eligibleSubtotal = eligibleItems.reduce((sum, item) =>
            sum + (item.price * item.quantity), 0);

        if (voucher.type === 'percentage') {
            discount = (eligibleSubtotal || subtotal) * (voucher.value / 100);
            if (voucher.maxDiscount) {
                discount = Math.min(discount, voucher.maxDiscount);
            }
        } else if (voucher.type === 'fixed_amount') {
            discount = Math.min(voucher.value, subtotal);
        }

        return {
            voucher: voucher,
            discount: discount,
            eligibleItems: eligibleItems.length,
            totalItems: items.length
        };
    }

    /**
     * Филтриране на продукти, валидни за ваучер
     */
    _getEligibleItems(voucher, items) {
        if (!voucher.categoryRestriction && !voucher.productRestriction) {
            return items;
        }

        return items.filter(item => {
            if (voucher.productRestriction && voucher.productRestriction.includes(item.id)) {
                return true;
            }
            if (voucher.categoryRestriction && voucher.categoryRestriction.includes(item.category)) {
                return true;
            }
            return false;
        });
    }

    /**
     * Използване на voucher
     */
    applyVoucher(code, saleId, discountAmount) {
        const voucher = this.vouchers.find(v => v.code === code);

        if (!voucher) {
            throw new Error('Ваучер не е намерен');
        }

        voucher.currentUsageCount++;

        if (voucher.usageLimit && voucher.currentUsageCount >= voucher.usageLimit) {
            voucher.status = 'depleted';
        }

        const usage = {
            id: Date.now() + Math.random(),
            voucherId: voucher.id,
            voucherCode: voucher.code,
            saleId: saleId,
            discountAmount: discountAmount,
            timestamp: new Date().toISOString()
        };

        this.voucherUsage.push(usage);
        this._save();

        return usage;
    }

    /**
     * Зареждане на баланс на gift card (top-up)
     */
    reloadGiftCard(code, amount) {
        const giftCard = this.giftCards.find(gc => gc.code === code);

        if (!giftCard) {
            throw new Error('Подаръчна карта не е намерена');
        }

        const addAmount = parseFloat(amount);
        const oldBalance = giftCard.currentBalance;

        giftCard.currentBalance += addAmount;

        if (giftCard.status === 'depleted') {
            giftCard.status = 'active';
        }

        const transaction = {
            id: Date.now() + Math.random(),
            cardId: giftCard.id,
            cardCode: giftCard.code,
            type: 'reload',
            amount: addAmount,
            balanceBefore: oldBalance,
            balanceAfter: giftCard.currentBalance,
            timestamp: new Date().toISOString()
        };

        giftCard.transactions.push(transaction);
        this.cardTransactions.push(transaction);

        this._save();

        return {
            success: true,
            amountAdded: addAmount,
            newBalance: giftCard.currentBalance,
            transaction: transaction
        };
    }

    /**
     * Анулиране на gift card/voucher
     */
    cancelCode(code, reason = '') {
        const giftCard = this.giftCards.find(gc => gc.code === code);
        if (giftCard) {
            giftCard.status = 'cancelled';
            giftCard.cancelReason = reason;
            giftCard.cancelledAt = new Date().toISOString();
            this._save();
            return { success: true, type: 'gift_card' };
        }

        const voucher = this.vouchers.find(v => v.code === code);
        if (voucher) {
            voucher.status = 'cancelled';
            voucher.cancelReason = reason;
            voucher.cancelledAt = new Date().toISOString();
            this._save();
            return { success: true, type: 'voucher' };
        }

        throw new Error('Код не е намерен');
    }

    /**
     * Автоматично изтичане на expired карти
     */
    processExpiredCards() {
        const now = new Date();
        let expiredCount = 0;

        this.giftCards.forEach(gc => {
            if (gc.status === 'active' && new Date(gc.expiryDate) < now) {
                gc.status = 'expired';
                expiredCount++;
            }
        });

        this.vouchers.forEach(v => {
            if (v.status === 'active' && new Date(v.expiryDate) < now) {
                v.status = 'expired';
                expiredCount++;
            }
        });

        if (expiredCount > 0) {
            this._save();
        }

        return { expiredCount };
    }

    /**
     * Отчет за gift cards
     */
    getGiftCardReport(period = 'all') {
        const { startDate, endDate } = this._getPeriodDates(period);

        const periodCards = this.giftCards.filter(gc => {
            const issueDate = new Date(gc.issuedDate);
            return issueDate >= startDate && issueDate <= endDate;
        });

        const totalIssued = periodCards.length;
        const totalSales = periodCards.reduce((sum, gc) => sum + gc.originalAmount, 0);
        const totalRedeemed = this.cardTransactions
            .filter(t => t.type === 'usage' &&
                         new Date(t.timestamp) >= startDate &&
                         new Date(t.timestamp) <= endDate)
            .reduce((sum, t) => sum + t.amount, 0);

        const outstandingBalance = this.giftCards
            .filter(gc => gc.status === 'active')
            .reduce((sum, gc) => sum + gc.currentBalance, 0);

        const statusBreakdown = {
            active: this.giftCards.filter(gc => gc.status === 'active').length,
            depleted: this.giftCards.filter(gc => gc.status === 'depleted').length,
            expired: this.giftCards.filter(gc => gc.status === 'expired').length,
            cancelled: this.giftCards.filter(gc => gc.status === 'cancelled').length
        };

        return {
            period,
            totalIssued,
            totalSales,
            totalRedeemed,
            redemptionRate: totalSales > 0 ? (totalRedeemed / totalSales * 100) : 0,
            outstandingBalance,
            outstandingLiability: outstandingBalance,
            statusBreakdown,
            cards: periodCards
        };
    }

    /**
     * Отчет за vouchers
     */
    getVoucherReport(period = 'all') {
        const { startDate, endDate } = this._getPeriodDates(period);

        const periodVouchers = this.vouchers.filter(v => {
            const issueDate = new Date(v.issuedDate);
            return issueDate >= startDate && issueDate <= endDate;
        });

        const periodUsage = this.voucherUsage.filter(u => {
            const useDate = new Date(u.timestamp);
            return useDate >= startDate && useDate <= endDate;
        });

        const totalIssued = periodVouchers.length;
        const totalUsed = periodUsage.length;
        const totalDiscount = periodUsage.reduce((sum, u) => sum + u.discountAmount, 0);

        const campaignBreakdown = {};
        periodVouchers.forEach(v => {
            const campaign = v.campaign || 'Uncategorized';
            if (!campaignBreakdown[campaign]) {
                campaignBreakdown[campaign] = { issued: 0, used: 0, discount: 0 };
            }
            campaignBreakdown[campaign].issued++;
        });

        periodUsage.forEach(u => {
            const voucher = this.vouchers.find(v => v.id === u.voucherId);
            const campaign = voucher?.campaign || 'Uncategorized';
            if (campaignBreakdown[campaign]) {
                campaignBreakdown[campaign].used++;
                campaignBreakdown[campaign].discount += u.discountAmount;
            }
        });

        return {
            period,
            totalIssued,
            totalUsed,
            usageRate: totalIssued > 0 ? (totalUsed / totalIssued * 100) : 0,
            totalDiscount,
            avgDiscountPerUse: totalUsed > 0 ? (totalDiscount / totalUsed) : 0,
            campaignBreakdown,
            vouchers: periodVouchers
        };
    }

    /**
     * Helper: период за отчети
     */
    _getPeriodDates(period) {
        const endDate = new Date();
        let startDate = new Date();

        if (period === 'today') {
            startDate.setHours(0, 0, 0, 0);
        } else if (period === 'week') {
            startDate.setDate(startDate.getDate() - 7);
        } else if (period === 'month') {
            startDate.setMonth(startDate.getMonth() - 1);
        } else if (period === 'year') {
            startDate.setFullYear(startDate.getFullYear() - 1);
        } else {
            startDate = new Date(0); // all time
        }

        return { startDate, endDate };
    }

    /**
     * Bulk creation на vouchers за campaign
     */
    createBulkVouchers(voucherTemplate, quantity) {
        const created = [];

        for (let i = 0; i < quantity; i++) {
            const voucher = this.createVoucher({
                ...voucherTemplate,
                customCode: null // auto-generate unique codes
            });
            created.push(voucher);
        }

        return {
            count: created.length,
            vouchers: created,
            codes: created.map(v => v.code)
        };
    }

    /**
     * Export на voucher codes за печат/email
     */
    exportVoucherCodes(campaignName = null) {
        let vouchers = this.vouchers;

        if (campaignName) {
            vouchers = vouchers.filter(v => v.campaign === campaignName);
        }

        return vouchers
            .filter(v => v.status === 'active')
            .map(v => ({
                code: v.code,
                type: v.type,
                value: v.value,
                expiryDate: new Date(v.expiryDate).toLocaleDateString('bg-BG'),
                usageLeft: v.usageLimit ? (v.usageLimit - v.currentUsageCount) : 'Unlimited',
                campaign: v.campaign
            }));
    }

    _save() {
        StorageService.save('giftCards', this.giftCards);
        StorageService.save('vouchers', this.vouchers);
        StorageService.save('cardTransactions', this.cardTransactions);
        StorageService.save('voucherUsage', this.voucherUsage);
    }
}
