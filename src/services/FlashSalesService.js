import { StorageService } from './StorageService.js';
import { ValidationService } from './ValidationService.js';

/**
 * FlashSalesService - Управление на flash sales, happy hours и limited offers
 *
 * Функционалност:
 * - Happy hour pricing (различни цени по часове)
 * - Daily deals (продукт на деня)
 * - Limited time offers (countdown timer)
 * - Flash sales (internal до изчерпване на stock)
 * - FOMO marketing ("само 5 бройки остават!")
 * - Automatic scheduling
 * - Performance tracking & ROI
 *
 * v9.1 - Revenue Boost Suite Phase 2
 */
export class FlashSalesService {
    constructor(productService, salesService) {
        this.productService = productService;
        this.salesService = salesService;

        this.flashSales = StorageService.load('flashSales') || [];
        this.happyHours = StorageService.load('happyHours') || [];
        this.dailyDeals = StorageService.load('dailyDeals') || [];
        this.flashSalesHistory = StorageService.load('flashSalesHistory') || [];

        // Auto-check and update active sales
        this._updateActiveSales();
    }

    /**
     * Създаване на Flash Sale
     *
     * @param {Object} saleData {
     *   name: string
     *   productIds: Array<number> - продукти в промоцията
     *   discountType: 'percentage' | 'fixed_amount' | 'new_price'
     *   discountValue: number
     *   startTime: Date
     *   endTime: Date
     *   maxQuantity: number - максимално количество за продажба (optional)
     *   maxPerCustomer: number - максимум за един клиент (optional)
     *   showCountdown: boolean - показва countdown timer
     *   showStockLeft: boolean - показва "Остават X бройки"
     * }
     */
    createFlashSale(saleData) {
        if (!saleData.productIds || saleData.productIds.length === 0) {
            throw new Error('Flash sale трябва да съдържа поне 1 продукт');
        }

        const startTime = new Date(saleData.startTime);
        const endTime = new Date(saleData.endTime);

        if (endTime <= startTime) {
            throw new Error('Крайното време трябва да е след началното');
        }

        // Validate products exist
        const products = saleData.productIds.map(id => {
            const product = this.productService.getProduct(id);
            if (!product) {
                throw new Error(`Продукт с ID ${id} не е намерен`);
            }
            return product;
        });

        // Calculate discounted prices
        const productPricing = products.map(product => {
            let discountedPrice = product.price;

            if (saleData.discountType === 'percentage') {
                discountedPrice = product.price * (1 - saleData.discountValue / 100);
            } else if (saleData.discountType === 'fixed_amount') {
                discountedPrice = Math.max(0, product.price - saleData.discountValue);
            } else if (saleData.discountType === 'new_price') {
                discountedPrice = saleData.discountValue;
            }

            return {
                productId: product.id,
                originalPrice: product.price,
                flashPrice: discountedPrice,
                savings: product.price - discountedPrice,
                savingsPercent: ((product.price - discountedPrice) / product.price * 100).toFixed(1)
            };
        });

        const flashSale = {
            id: Date.now() + Math.random(),
            name: ValidationService.sanitizeString(saleData.name),
            productIds: saleData.productIds,
            productPricing: productPricing,
            discountType: saleData.discountType,
            discountValue: saleData.discountValue,
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            maxQuantity: saleData.maxQuantity || null,
            maxPerCustomer: saleData.maxPerCustomer || 10,
            showCountdown: saleData.showCountdown !== false,
            showStockLeft: saleData.showStockLeft !== false,
            status: 'scheduled', // scheduled, active, ended, cancelled
            soldQuantity: 0,
            revenue: 0,
            customersPurchased: [],
            createdAt: new Date().toISOString()
        };

        this.flashSales.push(flashSale);
        this._save();

        return flashSale;
    }

    /**
     * Създаване на Happy Hour
     *
     * @param {Object} happyHourData {
     *   name: string
     *   productIds: Array<number> | 'all' | categoryId
     *   discountPercent: number
     *   daysOfWeek: Array<number> - 0=Sunday, 6=Saturday
     *   startHour: number - 0-23
     *   endHour: number - 0-23
     *   validFrom: Date
     *   validUntil: Date
     * }
     */
    createHappyHour(happyHourData) {
        if (happyHourData.startHour < 0 || happyHourData.startHour > 23 ||
            happyHourData.endHour < 0 || happyHourData.endHour > 23) {
            throw new Error('Часовете трябва да са между 0 и 23');
        }

        const happyHour = {
            id: Date.now() + Math.random(),
            name: ValidationService.sanitizeString(happyHourData.name),
            productIds: happyHourData.productIds,
            discountPercent: parseFloat(happyHourData.discountPercent),
            daysOfWeek: happyHourData.daysOfWeek || [0, 1, 2, 3, 4, 5, 6], // всички дни
            startHour: parseInt(happyHourData.startHour),
            endHour: parseInt(happyHourData.endHour),
            validFrom: happyHourData.validFrom ? new Date(happyHourData.validFrom).toISOString() : new Date().toISOString(),
            validUntil: happyHourData.validUntil ? new Date(happyHourData.validUntil).toISOString() : null,
            active: true,
            totalSales: 0,
            totalRevenue: 0,
            createdAt: new Date().toISOString()
        };

        this.happyHours.push(happyHour);
        this._save();

        return happyHour;
    }

    /**
     * Създаване на Daily Deal
     *
     * @param {Object} dealData {
     *   productId: number
     *   discountPercent: number
     *   date: Date - датата на промоцията
     *   maxQuantity: number
     * }
     */
    createDailyDeal(dealData) {
        const product = this.productService.getProduct(dealData.productId);
        if (!product) {
            throw new Error('Продукт не е намерен');
        }

        const dealDate = new Date(dealData.date);
        dealDate.setHours(0, 0, 0, 0);

        const endDate = new Date(dealDate);
        endDate.setHours(23, 59, 59, 999);

        const discountedPrice = product.price * (1 - dealData.discountPercent / 100);

        const dailyDeal = {
            id: Date.now() + Math.random(),
            productId: dealData.productId,
            productName: product.name,
            originalPrice: product.price,
            dealPrice: discountedPrice,
            discountPercent: parseFloat(dealData.discountPercent),
            savings: product.price - discountedPrice,
            date: dealDate.toISOString(),
            startTime: dealDate.toISOString(),
            endTime: endDate.toISOString(),
            maxQuantity: dealData.maxQuantity || null,
            soldQuantity: 0,
            revenue: 0,
            status: 'scheduled',
            createdAt: new Date().toISOString()
        };

        this.dailyDeals.push(dailyDeal);
        this._save();

        return dailyDeal;
    }

    /**
     * Проверка дали продукт е в активна flash sale
     */
    getActiveFlashSaleForProduct(productId) {
        const now = new Date();

        const activeSale = this.flashSales.find(sale => {
            if (sale.status !== 'active') return false;
            if (!sale.productIds.includes(productId)) return false;

            const startTime = new Date(sale.startTime);
            const endTime = new Date(sale.endTime);

            if (now < startTime || now > endTime) return false;

            // Check if max quantity reached
            if (sale.maxQuantity && sale.soldQuantity >= sale.maxQuantity) {
                return false;
            }

            return true;
        });

        if (activeSale) {
            const pricing = activeSale.productPricing.find(p => p.productId === productId);
            return {
                sale: activeSale,
                pricing: pricing,
                timeLeft: this._getTimeLeft(activeSale.endTime),
                quantityLeft: activeSale.maxQuantity ? activeSale.maxQuantity - activeSale.soldQuantity : null
            };
        }

        return null;
    }

    /**
     * Проверка дали продукт е в активен happy hour
     */
    getActiveHappyHourForProduct(productId) {
        const now = new Date();
        const currentHour = now.getHours();
        const currentDay = now.getDay();

        const activeHappyHour = this.happyHours.find(hh => {
            if (!hh.active) return false;

            // Check day of week
            if (!hh.daysOfWeek.includes(currentDay)) return false;

            // Check hour range
            if (hh.startHour <= hh.endHour) {
                if (currentHour < hh.startHour || currentHour >= hh.endHour) return false;
            } else {
                // Overnight happy hour (e.g., 22:00 - 02:00)
                if (currentHour < hh.startHour && currentHour >= hh.endHour) return false;
            }

            // Check validity period
            if (hh.validFrom && new Date(hh.validFrom) > now) return false;
            if (hh.validUntil && new Date(hh.validUntil) < now) return false;

            // Check if product is included
            if (hh.productIds === 'all') return true;
            if (Array.isArray(hh.productIds)) {
                return hh.productIds.includes(productId);
            }

            // Check by category
            const product = this.productService.getProduct(productId);
            if (product && product.category === hh.productIds) return true;

            return false;
        });

        if (activeHappyHour) {
            const product = this.productService.getProduct(productId);
            const discountedPrice = product.price * (1 - activeHappyHour.discountPercent / 100);

            return {
                happyHour: activeHappyHour,
                originalPrice: product.price,
                discountedPrice: discountedPrice,
                savings: product.price - discountedPrice,
                endsInHours: this._getHappyHourTimeLeft(activeHappyHour, currentHour)
            };
        }

        return null;
    }

    /**
     * Получаване на днешния Daily Deal
     */
    getTodaysDailyDeal() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return this.dailyDeals.find(deal => {
            const dealDate = new Date(deal.date);
            dealDate.setHours(0, 0, 0, 0);

            return dealDate.getTime() === today.getTime() && deal.status === 'active';
        });
    }

    /**
     * Калкулиране на цена с flash sale discount
     */
    calculateFlashPrice(productId, quantity = 1, customerId = null) {
        const product = this.productService.getProduct(productId);
        if (!product) return null;

        let finalPrice = product.price;
        let appliedPromo = null;
        let promoType = null;

        // 1. Check Flash Sale (highest priority)
        const flashSale = this.getActiveFlashSaleForProduct(productId);
        if (flashSale) {
            // Check customer limit
            if (customerId && flashSale.sale.maxPerCustomer) {
                const customerPurchases = flashSale.sale.customersPurchased.filter(
                    c => c.customerId === customerId
                ).reduce((sum, c) => sum + c.quantity, 0);

                if (customerPurchases + quantity > flashSale.sale.maxPerCustomer) {
                    const allowedQuantity = flashSale.sale.maxPerCustomer - customerPurchases;
                    if (allowedQuantity <= 0) {
                        return {
                            canPurchase: false,
                            reason: `Достигнат лимит от ${flashSale.sale.maxPerCustomer} бройки за този flash sale`
                        };
                    }
                    quantity = allowedQuantity;
                }
            }

            finalPrice = flashSale.pricing.flashPrice;
            appliedPromo = flashSale.sale;
            promoType = 'flash_sale';
        }
        // 2. Check Happy Hour
        else {
            const happyHour = this.getActiveHappyHourForProduct(productId);
            if (happyHour) {
                finalPrice = happyHour.discountedPrice;
                appliedPromo = happyHour.happyHour;
                promoType = 'happy_hour';
            }
            // 3. Check Daily Deal
            else {
                const dailyDeal = this.getTodaysDailyDeal();
                if (dailyDeal && dailyDeal.productId === productId) {
                    finalPrice = dailyDeal.dealPrice;
                    appliedPromo = dailyDeal;
                    promoType = 'daily_deal';
                }
            }
        }

        return {
            canPurchase: true,
            productId: productId,
            originalPrice: product.price,
            finalPrice: finalPrice,
            quantity: quantity,
            totalOriginal: product.price * quantity,
            totalFinal: finalPrice * quantity,
            savings: (product.price - finalPrice) * quantity,
            savingsPercent: ((product.price - finalPrice) / product.price * 100).toFixed(1),
            appliedPromo: appliedPromo,
            promoType: promoType
        };
    }

    /**
     * Записване на flash sale покупка
     */
    recordFlashSalePurchase(flashSaleId, productId, quantity, customerId, saleId) {
        const flashSale = this.flashSales.find(fs => fs.id === flashSaleId);
        if (!flashSale) {
            throw new Error('Flash sale не е намерен');
        }

        flashSale.soldQuantity += quantity;

        if (customerId) {
            const existing = flashSale.customersPurchased.find(c => c.customerId === customerId);
            if (existing) {
                existing.quantity += quantity;
            } else {
                flashSale.customersPurchased.push({
                    customerId: customerId,
                    quantity: quantity,
                    timestamp: new Date().toISOString()
                });
            }
        }

        const pricing = flashSale.productPricing.find(p => p.productId === productId);
        flashSale.revenue += pricing.flashPrice * quantity;

        // Check if max quantity reached
        if (flashSale.maxQuantity && flashSale.soldQuantity >= flashSale.maxQuantity) {
            flashSale.status = 'ended';
            flashSale.endedAt = new Date().toISOString();
            flashSale.endReason = 'max_quantity_reached';
        }

        this._save();
    }

    /**
     * Записване на happy hour покупка
     */
    recordHappyHourPurchase(happyHourId, revenue) {
        const happyHour = this.happyHours.find(hh => hh.id === happyHourId);
        if (happyHour) {
            happyHour.totalSales++;
            happyHour.totalRevenue += revenue;
            this._save();
        }
    }

    /**
     * Записване на daily deal покупка
     */
    recordDailyDealPurchase(dailyDealId, quantity, revenue) {
        const dailyDeal = this.dailyDeals.find(dd => dd.id === dailyDealId);
        if (dailyDeal) {
            dailyDeal.soldQuantity += quantity;
            dailyDeal.revenue += revenue;

            if (dailyDeal.maxQuantity && dailyDeal.soldQuantity >= dailyDeal.maxQuantity) {
                dailyDeal.status = 'ended';
            }

            this._save();
        }
    }

    /**
     * Автоматично update на статуси
     */
    _updateActiveSales() {
        const now = new Date();
        let updated = false;

        // Update flash sales
        this.flashSales.forEach(sale => {
            const startTime = new Date(sale.startTime);
            const endTime = new Date(sale.endTime);

            if (sale.status === 'scheduled' && now >= startTime) {
                sale.status = 'active';
                updated = true;
            }

            if (sale.status === 'active' && now > endTime) {
                sale.status = 'ended';
                sale.endedAt = now.toISOString();
                sale.endReason = 'time_expired';

                // Archive to history
                this.flashSalesHistory.push({
                    ...sale,
                    archivedAt: now.toISOString()
                });

                updated = true;
            }
        });

        // Update daily deals
        this.dailyDeals.forEach(deal => {
            const startTime = new Date(deal.startTime);
            const endTime = new Date(deal.endTime);

            if (deal.status === 'scheduled' && now >= startTime) {
                deal.status = 'active';
                updated = true;
            }

            if (deal.status === 'active' && now > endTime) {
                deal.status = 'ended';
                updated = true;
            }
        });

        if (updated) {
            this._save();
        }
    }

    /**
     * Helper: колко време остава
     */
    _getTimeLeft(endTime) {
        const now = new Date();
        const end = new Date(endTime);
        const diff = end - now;

        if (diff <= 0) return { expired: true };

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        return {
            expired: false,
            totalSeconds: Math.floor(diff / 1000),
            hours: hours,
            minutes: minutes,
            seconds: seconds,
            displayText: hours > 0
                ? `${hours}ч ${minutes}м`
                : `${minutes}м ${seconds}с`
        };
    }

    /**
     * Helper: колко време до края на happy hour
     */
    _getHappyHourTimeLeft(happyHour, currentHour) {
        if (happyHour.startHour <= happyHour.endHour) {
            return happyHour.endHour - currentHour;
        } else {
            // Overnight
            if (currentHour >= happyHour.startHour) {
                return 24 - currentHour + happyHour.endHour;
            } else {
                return happyHour.endHour - currentHour;
            }
        }
    }

    /**
     * Отчет за flash sales performance
     */
    getFlashSalesReport(period = 'month') {
        const { startDate, endDate } = this._getPeriodDates(period);

        const periodSales = this.flashSales.filter(sale => {
            const created = new Date(sale.createdAt);
            return created >= startDate && created <= endDate;
        });

        const totalSales = periodSales.length;
        const activeSales = periodSales.filter(s => s.status === 'active').length;
        const endedSales = periodSales.filter(s => s.status === 'ended').length;

        const totalRevenue = periodSales.reduce((sum, s) => sum + s.revenue, 0);
        const totalQuantity = periodSales.reduce((sum, s) => sum + s.soldQuantity, 0);

        const avgRevenuePerSale = totalSales > 0 ? totalRevenue / totalSales : 0;

        return {
            period,
            totalSales,
            activeSales,
            endedSales,
            totalRevenue,
            totalQuantity,
            avgRevenuePerSale,
            sales: periodSales.sort((a, b) => b.revenue - a.revenue)
        };
    }

    /**
     * Отчет за happy hours
     */
    getHappyHoursReport() {
        return {
            total: this.happyHours.length,
            active: this.happyHours.filter(hh => hh.active).length,
            totalSales: this.happyHours.reduce((sum, hh) => sum + hh.totalSales, 0),
            totalRevenue: this.happyHours.reduce((sum, hh) => sum + hh.totalRevenue, 0),
            happyHours: this.happyHours.sort((a, b) => b.totalRevenue - a.totalRevenue)
        };
    }

    /**
     * Отчет за daily deals
     */
    getDailyDealsReport(period = 'month') {
        const { startDate, endDate } = this._getPeriodDates(period);

        const periodDeals = this.dailyDeals.filter(deal => {
            const date = new Date(deal.date);
            return date >= startDate && date <= endDate;
        });

        const totalRevenue = periodDeals.reduce((sum, d) => sum + d.revenue, 0);
        const totalQuantity = periodDeals.reduce((sum, d) => sum + d.soldQuantity, 0);

        return {
            period,
            totalDeals: periodDeals.length,
            totalRevenue,
            totalQuantity,
            avgRevenuePerDeal: periodDeals.length > 0 ? totalRevenue / periodDeals.length : 0,
            deals: periodDeals.sort((a, b) => b.revenue - a.revenue)
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
            startDate = new Date(0);
        }

        return { startDate, endDate };
    }

    _save() {
        StorageService.save('flashSales', this.flashSales);
        StorageService.save('happyHours', this.happyHours);
        StorageService.save('dailyDeals', this.dailyDeals);
        StorageService.save('flashSalesHistory', this.flashSalesHistory);
    }
}
