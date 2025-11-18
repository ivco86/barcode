import { StorageService } from './StorageService.js';
import { ValidationService } from './ValidationService.js';

/**
 * BundleOptimizerService - Автоматично създаване и оптимизация на product bundles
 *
 * Функционалност:
 * - AI detection на "често купувани заедно" комбинации
 * - Създаване на meal deals, family packs
 * - Seasonal bundles (празнични кошници)
 * - Smart bundle pricing (discount но печалба от обем)
 * - Performance tracking на bundles
 * - A/B testing на bundle combinations
 * - Auto-suggestion на касата
 *
 * v9.0 - Revenue Boost Suite
 */
export class BundleOptimizerService {
    constructor(productService, salesService) {
        this.productService = productService;
        this.salesService = salesService;

        this.bundles = StorageService.load('productBundles') || [];
        this.bundleSales = StorageService.load('bundleSales') || [];
        this.bundleAnalytics = StorageService.load('bundleAnalytics') || [];

        // Initialize default bundles
        if (this.bundles.length === 0) {
            this._initializeDefaultBundles();
        }
    }

    /**
     * Инициализиране на default bundles
     */
    _initializeDefaultBundles() {
        // Тази функция може да се извика след като има продукти
        // За момента оставяме празна, bundles ще се създават динамично
    }

    /**
     * Автоматично откриване на често купувани заедно продукти
     *
     * @param {number} minSupport - минимален брой съвместни покупки (default 5)
     * @param {number} minConfidence - минимална увереност 0-1 (default 0.3)
     */
    discoverBundleOpportunities(minSupport = 5, minConfidence = 0.3) {
        const sales = this.salesService.getAllSales();
        const productPairs = {};

        // Count co-occurrences
        sales.forEach(sale => {
            if (sale.items.length < 2) return;

            for (let i = 0; i < sale.items.length; i++) {
                for (let j = i + 1; j < sale.items.length; j++) {
                    const id1 = sale.items[i].id;
                    const id2 = sale.items[j].id;
                    const pairKey = [id1, id2].sort().join('-');

                    if (!productPairs[pairKey]) {
                        productPairs[pairKey] = {
                            product1: id1,
                            product2: id2,
                            count: 0,
                            totalRevenue: 0
                        };
                    }

                    productPairs[pairKey].count++;
                    productPairs[pairKey].totalRevenue += sale.total;
                }
            }
        });

        // Filter by support and confidence
        const opportunities = Object.values(productPairs)
            .filter(pair => pair.count >= minSupport)
            .map(pair => {
                const product1 = this.productService.getProduct(pair.product1);
                const product2 = this.productService.getProduct(pair.product2);

                if (!product1 || !product2) return null;

                const confidence = pair.count / sales.length;
                const avgRevenue = pair.totalRevenue / pair.count;

                return {
                    products: [product1, product2],
                    frequency: pair.count,
                    confidence: confidence,
                    avgRevenue: avgRevenue,
                    recommendedDiscount: this._calculateOptimalDiscount(
                        [product1, product2],
                        confidence
                    )
                };
            })
            .filter(opp => opp !== null && opp.confidence >= minConfidence)
            .sort((a, b) => b.frequency - a.frequency);

        return opportunities;
    }

    /**
     * Калкулиране на оптимална отстъпка за bundle
     */
    _calculateOptimalDiscount(products, confidence) {
        const totalPrice = products.reduce((sum, p) => sum + p.price, 0);
        const avgMargin = products.reduce((sum, p) => {
            const margin = p.price > 0 ? ((p.price - (p.cost || 0)) / p.price) : 0;
            return sum + margin;
        }, 0) / products.length;

        // Higher confidence = can offer smaller discount
        // Lower confidence = need bigger discount to attract
        let discountPercent = 0;

        if (confidence > 0.5) {
            discountPercent = 5; // Strong pairing, small discount
        } else if (confidence > 0.3) {
            discountPercent = 10; // Medium pairing
        } else {
            discountPercent = 15; // Weak pairing, bigger incentive
        }

        // Ensure we maintain minimum margin
        const maxDiscountForMargin = avgMargin * 100 * 0.5; // Use max 50% of margin
        discountPercent = Math.min(discountPercent, maxDiscountForMargin);

        return {
            percent: Math.round(discountPercent),
            amount: totalPrice * (discountPercent / 100)
        };
    }

    /**
     * Създаване на bundle
     *
     * @param {Object} bundleData {
     *   name: string - име на bundle
     *   products: Array<{id, quantity}> - продукти в bundle
     *   discountType: 'percentage' | 'fixed_amount'
     *   discountValue: number
     *   description: string
     *   imageUrl: string
     *   active: boolean
     *   validFrom: Date
     *   validUntil: Date
     *   tags: Array<string> - ['meal_deal', 'family_pack', 'seasonal']
     * }
     */
    createBundle(bundleData) {
        if (!bundleData.products || bundleData.products.length < 2) {
            throw new Error('Bundle трябва да съдържа поне 2 продукта');
        }

        // Calculate bundle pricing
        const products = bundleData.products.map(item => {
            const product = this.productService.getProduct(item.id);
            if (!product) {
                throw new Error(`Продукт с ID ${item.id} не е намерен`);
            }
            return {
                ...product,
                bundleQuantity: item.quantity || 1
            };
        });

        const totalRegularPrice = products.reduce(
            (sum, p) => sum + (p.price * p.bundleQuantity),
            0
        );

        let bundlePrice = totalRegularPrice;
        if (bundleData.discountType === 'percentage') {
            bundlePrice = totalRegularPrice * (1 - bundleData.discountValue / 100);
        } else if (bundleData.discountType === 'fixed_amount') {
            bundlePrice = totalRegularPrice - bundleData.discountValue;
        }

        // Ensure bundle price is not below cost
        const totalCost = products.reduce(
            (sum, p) => sum + ((p.cost || 0) * p.bundleQuantity),
            0
        );

        if (bundlePrice < totalCost) {
            throw new Error('Bundle цената не може да бъде под себестойността');
        }

        const bundle = {
            id: Date.now() + Math.random(),
            name: ValidationService.sanitizeString(bundleData.name),
            description: ValidationService.sanitizeString(bundleData.description || ''),
            products: bundleData.products,
            productDetails: products,
            regularPrice: totalRegularPrice,
            bundlePrice: bundlePrice,
            savings: totalRegularPrice - bundlePrice,
            savingsPercent: ((totalRegularPrice - bundlePrice) / totalRegularPrice * 100).toFixed(1),
            discountType: bundleData.discountType,
            discountValue: bundleData.discountValue,
            imageUrl: bundleData.imageUrl || '',
            active: bundleData.active !== false,
            validFrom: bundleData.validFrom || new Date().toISOString(),
            validUntil: bundleData.validUntil || null,
            tags: bundleData.tags || [],
            salesCount: 0,
            totalRevenue: 0,
            createdAt: new Date().toISOString()
        };

        this.bundles.push(bundle);
        this._save();

        return bundle;
    }

    /**
     * Автоматично създаване на bundles от opportunities
     */
    autoCreateBundlesFromOpportunities(limit = 5) {
        const opportunities = this.discoverBundleOpportunities();
        const created = [];

        opportunities.slice(0, limit).forEach(opp => {
            const bundleData = {
                name: `${opp.products[0].name} + ${opp.products[1].name}`,
                description: `Често купувано заедно! Спестете ${opp.recommendedDiscount.percent}%`,
                products: opp.products.map(p => ({ id: p.id, quantity: 1 })),
                discountType: 'percentage',
                discountValue: opp.recommendedDiscount.percent,
                tags: ['auto_generated', 'frequently_bought_together']
            };

            try {
                const bundle = this.createBundle(bundleData);
                created.push(bundle);
            } catch (error) {
                console.error('Error creating bundle:', error);
            }
        });

        return created;
    }

    /**
     * Създаване на meal deal bundle
     */
    createMealDeal(mainDishId, sideId, drinkId, discountPercent = 15) {
        const mainDish = this.productService.getProduct(mainDishId);
        const side = this.productService.getProduct(sideId);
        const drink = this.productService.getProduct(drinkId);

        if (!mainDish || !side || !drink) {
            throw new Error('Всички продукти трябва да съществуват');
        }

        return this.createBundle({
            name: `Meal Deal: ${mainDish.name}`,
            description: 'Основно ястие + гарнитура + напитка',
            products: [
                { id: mainDishId, quantity: 1 },
                { id: sideId, quantity: 1 },
                { id: drinkId, quantity: 1 }
            ],
            discountType: 'percentage',
            discountValue: discountPercent,
            tags: ['meal_deal']
        });
    }

    /**
     * Създаване на family pack
     */
    createFamilyPack(productId, familyQuantity = 4, discountPercent = 20) {
        const product = this.productService.getProduct(productId);

        if (!product) {
            throw new Error('Продукт не е намерен');
        }

        return this.createBundle({
            name: `Семеен пакет: ${product.name}`,
            description: `${familyQuantity} бройки за цялото семейство`,
            products: [{ id: productId, quantity: familyQuantity }],
            discountType: 'percentage',
            discountValue: discountPercent,
            tags: ['family_pack']
        });
    }

    /**
     * Създаване на seasonal bundle (коледен, великденски и т.н.)
     */
    createSeasonalBundle(name, productIds, occasion, discountPercent = 10) {
        const products = productIds.map(id => ({ id: id, quantity: 1 }));

        const validUntil = new Date();
        validUntil.setDate(validUntil.getDate() + 30); // Valid for 30 days

        return this.createBundle({
            name: name,
            description: `Специална оферта за ${occasion}`,
            products: products,
            discountType: 'percentage',
            discountValue: discountPercent,
            validUntil: validUntil.toISOString(),
            tags: ['seasonal', occasion.toLowerCase()]
        });
    }

    /**
     * Получаване на активни bundles
     */
    getActiveBundles() {
        const now = new Date();

        return this.bundles.filter(bundle => {
            if (!bundle.active) return false;

            const validFrom = new Date(bundle.validFrom);
            if (validFrom > now) return false;

            if (bundle.validUntil) {
                const validUntil = new Date(bundle.validUntil);
                if (validUntil < now) return false;
            }

            // Check stock availability
            const hasStock = bundle.products.every(item => {
                const product = this.productService.getProduct(item.id);
                return product && product.stock >= item.quantity;
            });

            return hasStock;
        });
    }

    /**
     * Получаване на bundle suggestions за текуща кошница
     */
    getBundleSuggestionsForCart(cartItems) {
        const activeBundles = this.getActiveBundles();
        const suggestions = [];

        activeBundles.forEach(bundle => {
            // Check how many bundle products are in cart
            const matchingProducts = bundle.products.filter(bundleItem =>
                cartItems.some(cartItem => cartItem.id === bundleItem.id)
            );

            if (matchingProducts.length > 0 && matchingProducts.length < bundle.products.length) {
                // Partial match - suggest completing the bundle
                const missingProducts = bundle.products.filter(bundleItem =>
                    !cartItems.some(cartItem => cartItem.id === bundleItem.id)
                ).map(item => {
                    const product = this.productService.getProduct(item.id);
                    return { ...product, bundleQuantity: item.quantity };
                });

                suggestions.push({
                    bundle: bundle,
                    matchingCount: matchingProducts.length,
                    totalProducts: bundle.products.length,
                    missingProducts: missingProducts,
                    potentialSavings: bundle.savings,
                    message: `Добавете още ${missingProducts.length} продукт(а) и спестете ${bundle.savingsPercent}%!`
                });
            } else if (matchingProducts.length === 0) {
                // No match - suggest as new offer
                suggestions.push({
                    bundle: bundle,
                    matchingCount: 0,
                    totalProducts: bundle.products.length,
                    missingProducts: bundle.productDetails,
                    potentialSavings: bundle.savings,
                    message: `${bundle.name} - спестете ${bundle.savings.toFixed(2)} лв!`
                });
            }
        });

        // Sort by potential savings
        return suggestions.sort((a, b) => b.potentialSavings - a.potentialSavings);
    }

    /**
     * Tracking на bundle sale
     */
    recordBundleSale(bundleId, saleId, actualPrice) {
        const bundle = this.bundles.find(b => b.id === bundleId);

        if (!bundle) {
            throw new Error('Bundle не е намерен');
        }

        bundle.salesCount++;
        bundle.totalRevenue += actualPrice;

        const sale = {
            id: Date.now() + Math.random(),
            bundleId: bundleId,
            saleId: saleId,
            price: actualPrice,
            savings: bundle.regularPrice - actualPrice,
            timestamp: new Date().toISOString()
        };

        this.bundleSales.push(sale);
        this._save();

        return sale;
    }

    /**
     * Отчет за bundle performance
     */
    getBundlePerformanceReport(period = 'month') {
        const { startDate, endDate } = this._getPeriodDates(period);

        const periodSales = this.bundleSales.filter(sale => {
            const date = new Date(sale.timestamp);
            return date >= startDate && date <= endDate;
        });

        const totalSales = periodSales.length;
        const totalRevenue = periodSales.reduce((sum, s) => sum + s.price, 0);
        const totalSavings = periodSales.reduce((sum, s) => sum + s.savings, 0);

        // Per bundle breakdown
        const bundleBreakdown = this.bundles.map(bundle => {
            const bundleSales = periodSales.filter(s => s.bundleId === bundle.id);
            const revenue = bundleSales.reduce((sum, s) => sum + s.price, 0);

            return {
                id: bundle.id,
                name: bundle.name,
                salesCount: bundleSales.length,
                revenue: revenue,
                avgPrice: bundleSales.length > 0 ? revenue / bundleSales.length : 0,
                totalSavingsGiven: bundleSales.reduce((sum, s) => sum + s.savings, 0),
                active: bundle.active
            };
        }).sort((a, b) => b.revenue - a.revenue);

        // Top performers
        const topBundles = bundleBreakdown.slice(0, 5);

        // Tag analysis
        const tagPerformance = {};
        this.bundles.forEach(bundle => {
            bundle.tags.forEach(tag => {
                if (!tagPerformance[tag]) {
                    tagPerformance[tag] = { sales: 0, revenue: 0 };
                }

                const bundleSales = periodSales.filter(s => s.bundleId === bundle.id);
                tagPerformance[tag].sales += bundleSales.length;
                tagPerformance[tag].revenue += bundleSales.reduce((sum, s) => sum + s.price, 0);
            });
        });

        return {
            period,
            totalSales,
            totalRevenue,
            avgBundlePrice: totalSales > 0 ? totalRevenue / totalSales : 0,
            totalSavingsGiven: totalSavings,
            bundleBreakdown,
            topBundles,
            tagPerformance
        };
    }

    /**
     * A/B testing на bundles
     */
    compareBundleVariants(bundleId1, bundleId2, period = 'week') {
        const { startDate, endDate } = this._getPeriodDates(period);

        const bundle1 = this.bundles.find(b => b.id === bundleId1);
        const bundle2 = this.bundles.find(b => b.id === bundleId2);

        if (!bundle1 || !bundle2) {
            throw new Error('Bundles не са намерени');
        }

        const sales1 = this.bundleSales.filter(s =>
            s.bundleId === bundleId1 &&
            new Date(s.timestamp) >= startDate &&
            new Date(s.timestamp) <= endDate
        );

        const sales2 = this.bundleSales.filter(s =>
            s.bundleId === bundleId2 &&
            new Date(s.timestamp) >= startDate &&
            new Date(s.timestamp) <= endDate
        );

        const revenue1 = sales1.reduce((sum, s) => sum + s.price, 0);
        const revenue2 = sales2.reduce((sum, s) => sum + s.price, 0);

        return {
            bundle1: {
                name: bundle1.name,
                sales: sales1.length,
                revenue: revenue1,
                avgPrice: sales1.length > 0 ? revenue1 / sales1.length : 0
            },
            bundle2: {
                name: bundle2.name,
                sales: sales2.length,
                revenue: revenue2,
                avgPrice: sales2.length > 0 ? revenue2 / sales2.length : 0
            },
            winner: revenue1 > revenue2 ? 'bundle1' : 'bundle2',
            revenueImprovement: revenue1 > revenue2
                ? ((revenue1 - revenue2) / revenue2 * 100).toFixed(1)
                : ((revenue2 - revenue1) / revenue1 * 100).toFixed(1)
        };
    }

    /**
     * Деактивиране на underperforming bundles
     */
    deactivateUnderperformingBundles(minSalesThreshold = 5, period = 'month') {
        const { startDate } = this._getPeriodDates(period);
        let deactivatedCount = 0;

        this.bundles.forEach(bundle => {
            if (!bundle.active) return;

            const bundleSales = this.bundleSales.filter(s =>
                s.bundleId === bundle.id &&
                new Date(s.timestamp) >= startDate
            );

            if (bundleSales.length < minSalesThreshold) {
                bundle.active = false;
                bundle.deactivatedAt = new Date().toISOString();
                bundle.deactivationReason = 'underperforming';
                deactivatedCount++;
            }
        });

        if (deactivatedCount > 0) {
            this._save();
        }

        return { deactivatedCount };
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
        StorageService.save('productBundles', this.bundles);
        StorageService.save('bundleSales', this.bundleSales);
        StorageService.save('bundleAnalytics', this.bundleAnalytics);
    }
}
