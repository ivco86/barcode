import { StorageService } from './StorageService.js';
import { ValidationService } from './ValidationService.js';

/**
 * LossLeaderService - Стратегическо ценообразуване чрез loss leaders
 *
 * Функционалност:
 * - Управление на loss leader продукти (магнит продукти под себестойност)
 * - Automatic pairing с high-margin items
 * - Basket impact analysis (какво друго купуват клиентите)
 * - ROI tracking (загуба vs допълнителна печалба)
 * - Suggestions за optimal loss leaders
 * - Performance analytics
 * - Strategic pricing rules
 *
 * Loss Leader Strategy:
 * Продаваме продукт на или под себестойност, за да привлечем клиенти
 * които ще купят и други високомаржинални продукти.
 *
 * Example: Евтин хляб (загуба 0.50 лв) → клиентът купува и масло, сирене (печалба 3 лв)
 *
 * v9.1 - Revenue Boost Suite Phase 2
 */
export class LossLeaderService {
    constructor(productService, salesService) {
        this.productService = productService;
        this.salesService = salesService;

        this.lossLeaders = StorageService.load('lossLeaders') || [];
        this.pairings = StorageService.load('lossLeaderPairings') || [];
        this.lossLeaderSales = StorageService.load('lossLeaderSales') || [];
    }

    /**
     * Създаване на loss leader продукт
     *
     * @param {Object} lossLeaderData {
     *   productId: number
     *   lossLeaderPrice: number - новата ниска цена (може да е под себестойност)
     *   targetPairings: Array<number> - IDs на високомаржинални продукти за паринг
     *   validFrom: Date
     *   validUntil: Date
     *   goal: string - "traffic", "basket_size", "new_customers"
     * }
     */
    createLossLeader(lossLeaderData) {
        const product = this.productService.getProduct(lossLeaderData.productId);
        if (!product) {
            throw new Error('Продукт не е намерен');
        }

        const lossLeaderPrice = parseFloat(lossLeaderData.lossLeaderPrice);
        const productCost = product.cost || product.price * 0.6; // estimate if no cost

        const lossPerUnit = productCost - lossLeaderPrice;
        const lossPercent = ((productCost - lossLeaderPrice) / productCost * 100);

        // Validate target pairings exist and have good margins
        const pairingProducts = lossLeaderData.targetPairings.map(id => {
            const p = this.productService.getProduct(id);
            if (!p) {
                throw new Error(`Pairing продукт с ID ${id} не е намерен`);
            }

            const margin = p.cost ? ((p.price - p.cost) / p.price * 100) : 30;
            return {
                productId: p.id,
                name: p.name,
                price: p.price,
                margin: margin,
                expectedProfit: p.price - (p.cost || p.price * 0.7)
            };
        });

        const lossLeader = {
            id: Date.now() + Math.random(),
            productId: product.id,
            productName: product.name,
            originalPrice: product.price,
            productCost: productCost,
            lossLeaderPrice: lossLeaderPrice,
            lossPerUnit: lossPerUnit,
            lossPercent: lossPercent.toFixed(1),
            targetPairings: pairingProducts,
            validFrom: lossLeaderData.validFrom ? new Date(lossLeaderData.validFrom).toISOString() : new Date().toISOString(),
            validUntil: lossLeaderData.validUntil ? new Date(lossLeaderData.validUntil).toISOString() : null,
            goal: lossLeaderData.goal || 'basket_size',
            active: true,
            stats: {
                unitsSold: 0,
                totalLoss: 0,
                basketsWithPairings: 0,
                totalPairingRevenue: 0,
                netProfit: 0,
                avgBasketSize: 0
            },
            createdAt: new Date().toISOString()
        };

        this.lossLeaders.push(lossLeader);
        this._save();

        return lossLeader;
    }

    /**
     * Auto-discovery на потенциални loss leaders
     *
     * Критерии:
     * - Високочестотни продукти (често купувани)
     - Често купувани с high-margin items
     * - Currently profitable (имат място за намаляване)
     */
    discoverLossLeaderOpportunities() {
        const allProducts = this.productService.getAllProducts();
        const allSales = this.salesService.getAllSales();
        const opportunities = [];

        allProducts.forEach(product => {
            if (!product.cost || product.stock <= 0) return;

            // Calculate how often this product is bought
            const salesWithProduct = allSales.filter(sale =>
                sale.items.some(item => item.id === product.id)
            );

            if (salesWithProduct.length < 10) return; // Need minimum data

            // Find what else is bought with this product
            const coOccurrences = {};
            salesWithProduct.forEach(sale => {
                sale.items.forEach(item => {
                    if (item.id === product.id) return;

                    if (!coOccurrences[item.id]) {
                        coOccurrences[item.id] = {
                            productId: item.id,
                            count: 0,
                            totalRevenue: 0
                        };
                    }

                    coOccurrences[item.id].count++;
                    coOccurrences[item.id].totalRevenue += item.price * item.quantity;
                });
            });

            // Find high-margin pairings
            const pairings = Object.values(coOccurrences)
                .map(pair => {
                    const pairProduct = this.productService.getProduct(pair.productId);
                    if (!pairProduct) return null;

                    const margin = pairProduct.cost
                        ? ((pairProduct.price - pairProduct.cost) / pairProduct.price * 100)
                        : 30;

                    return {
                        ...pair,
                        product: pairProduct,
                        margin: margin,
                        frequency: pair.count / salesWithProduct.length
                    };
                })
                .filter(p => p !== null && p.margin > 20 && p.frequency > 0.3)
                .sort((a, b) => b.totalRevenue - a.totalRevenue);

            if (pairings.length === 0) return;

            // Calculate potential loss leader scenario
            const currentMargin = ((product.price - product.cost) / product.price * 100);
            const proposedPrice = product.cost * 0.95; // 5% below cost
            const lossPerUnit = product.cost - proposedPrice;

            // Estimate revenue from pairings
            const avgPairingRevenue = pairings.reduce((sum, p) => sum + p.totalRevenue, 0) / salesWithProduct.length;
            const estimatedNetProfit = avgPairingRevenue - lossPerUnit;

            if (estimatedNetProfit > 0) {
                opportunities.push({
                    product: product,
                    currentPrice: product.price,
                    currentMargin: currentMargin.toFixed(1),
                    proposedPrice: proposedPrice,
                    lossPerUnit: lossPerUnit,
                    frequency: salesWithProduct.length,
                    topPairings: pairings.slice(0, 5),
                    avgPairingRevenue: avgPairingRevenue,
                    estimatedNetProfit: estimatedNetProfit,
                    roi: (estimatedNetProfit / lossPerUnit * 100).toFixed(0)
                });
            }
        });

        return opportunities.sort((a, b) => b.estimatedNetProfit - a.estimatedNetProfit);
    }

    /**
     * Получаване на активни loss leaders
     */
    getActiveLossLeaders() {
        const now = new Date();

        return this.lossLeaders.filter(ll => {
            if (!ll.active) return false;

            const validFrom = new Date(ll.validFrom);
            if (validFrom > now) return false;

            if (ll.validUntil) {
                const validUntil = new Date(ll.validUntil);
                if (validUntil < now) return false;
            }

            return true;
        });
    }

    /**
     * Проверка дали продукт е loss leader
     */
    getLossLeaderPrice(productId) {
        const lossLeader = this.getActiveLossLeaders().find(ll => ll.productId === productId);

        if (lossLeader) {
            return {
                isLossLeader: true,
                originalPrice: lossLeader.originalPrice,
                lossLeaderPrice: lossLeader.lossLeaderPrice,
                savings: lossLeader.originalPrice - lossLeader.lossLeaderPrice,
                savingsPercent: ((lossLeader.originalPrice - lossLeader.lossLeaderPrice) / lossLeader.originalPrice * 100).toFixed(1),
                lossLeader: lossLeader
            };
        }

        return { isLossLeader: false };
    }

    /**
     * Получаване на препоръки за pairing
     */
    getPairingRecommendations(lossLeaderId, currentCart = []) {
        const lossLeader = this.lossLeaders.find(ll => ll.id === lossLeaderId);
        if (!lossLeader) return [];

        const currentProductIds = currentCart.map(item => item.id);

        const recommendations = lossLeader.targetPairings
            .filter(pairing => !currentProductIds.includes(pairing.productId))
            .map(pairing => {
                const product = this.productService.getProduct(pairing.productId);
                return {
                    ...pairing,
                    product: product,
                    message: `Препоръчано: ${pairing.name} (${pairing.expectedProfit.toFixed(2)} лв печалба)`
                };
            })
            .slice(0, 3);

        return recommendations;
    }

    /**
     * Tracking на loss leader продажба
     */
    recordLossLeaderSale(lossLeaderId, saleId, cartItems) {
        const lossLeader = this.lossLeaders.find(ll => ll.id === lossLeaderId);
        if (!lossLeader) {
            throw new Error('Loss leader не е намерен');
        }

        // Find loss leader product in cart
        const lossLeaderItem = cartItems.find(item => item.id === lossLeader.productId);
        if (!lossLeaderItem) return;

        const quantity = lossLeaderItem.quantity;
        const totalLoss = lossLeader.lossPerUnit * quantity;

        // Find pairing products in cart
        const pairingItems = cartItems.filter(item =>
            lossLeader.targetPairings.some(p => p.productId === item.id)
        );

        const hasPairings = pairingItems.length > 0;
        const pairingRevenue = pairingItems.reduce((sum, item) => {
            const pairing = lossLeader.targetPairings.find(p => p.productId === item.id);
            return sum + (pairing.expectedProfit * item.quantity);
        }, 0);

        const netProfit = pairingRevenue - totalLoss;

        // Update stats
        lossLeader.stats.unitsSold += quantity;
        lossLeader.stats.totalLoss += totalLoss;

        if (hasPairings) {
            lossLeader.stats.basketsWithPairings++;
            lossLeader.stats.totalPairingRevenue += pairingRevenue;
        }

        lossLeader.stats.netProfit += netProfit;

        const totalBaskets = lossLeader.stats.unitsSold; // simplified
        const totalBasketValue = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        lossLeader.stats.avgBasketSize = (lossLeader.stats.avgBasketSize * (totalBaskets - 1) + totalBasketValue) / totalBaskets;

        // Record individual sale
        const saleRecord = {
            id: Date.now() + Math.random(),
            lossLeaderId: lossLeaderId,
            saleId: saleId,
            quantity: quantity,
            loss: totalLoss,
            hasPairings: hasPairings,
            pairingRevenue: pairingRevenue,
            netProfit: netProfit,
            basketSize: totalBasketValue,
            timestamp: new Date().toISOString()
        };

        this.lossLeaderSales.push(saleRecord);
        this._save();

        return saleRecord;
    }

    /**
     * Performance report на loss leader
     */
    getLossLeaderPerformance(lossLeaderId) {
        const lossLeader = this.lossLeaders.find(ll => ll.id === lossLeaderId);
        if (!lossLeader) {
            throw new Error('Loss leader не е намерен');
        }

        const sales = this.lossLeaderSales.filter(s => s.lossLeaderId === lossLeaderId);

        const pairingRate = lossLeader.stats.unitsSold > 0
            ? (lossLeader.stats.basketsWithPairings / lossLeader.stats.unitsSold * 100)
            : 0;

        const roi = lossLeader.stats.totalLoss > 0
            ? (lossLeader.stats.netProfit / Math.abs(lossLeader.stats.totalLoss) * 100)
            : 0;

        const isSuccessful = roi > 0;

        return {
            lossLeader: lossLeader,
            unitsSold: lossLeader.stats.unitsSold,
            totalLoss: lossLeader.stats.totalLoss,
            basketsWithPairings: lossLeader.stats.basketsWithPairings,
            pairingRate: pairingRate.toFixed(1),
            totalPairingRevenue: lossLeader.stats.totalPairingRevenue,
            netProfit: lossLeader.stats.netProfit,
            roi: roi.toFixed(1),
            isSuccessful: isSuccessful,
            avgBasketSize: lossLeader.stats.avgBasketSize,
            recommendation: this._getRecommendation(roi, pairingRate)
        };
    }

    /**
     * Препоръка базирана на performance
     */
    _getRecommendation(roi, pairingRate) {
        if (roi > 50 && pairingRate > 50) {
            return 'Отлична стратегия! Продължете.';
        } else if (roi > 20) {
            return 'Добра стратегия. Работи добре.';
        } else if (roi > 0) {
            return 'Позитивен ROI, но има място за подобрение.';
        } else if (pairingRate < 30) {
            return 'Нисък pairing rate. Промотирайте по-агресивно паринг продуктите.';
        } else {
            return 'Негативен ROI. Обмислете увеличаване на loss leader цената или по-добри pairings.';
        }
    }

    /**
     * Comprehensive report за всички loss leaders
     */
    getAllLossLeadersReport(period = 'month') {
        const { startDate, endDate } = this._getPeriodDates(period);

        const periodSales = this.lossLeaderSales.filter(s => {
            const date = new Date(s.timestamp);
            return date >= startDate && date <= endDate;
        });

        const totalLoss = periodSales.reduce((sum, s) => sum + s.loss, 0);
        const totalPairingRevenue = periodSales.reduce((sum, s) => sum + s.pairingRevenue, 0);
        const totalNetProfit = periodSales.reduce((sum, s) => sum + s.netProfit, 0);

        const salesWithPairings = periodSales.filter(s => s.hasPairings).length;
        const pairingRate = periodSales.length > 0
            ? (salesWithPairings / periodSales.length * 100)
            : 0;

        const roi = Math.abs(totalLoss) > 0
            ? (totalNetProfit / Math.abs(totalLoss) * 100)
            : 0;

        // Per loss leader breakdown
        const breakdown = this.lossLeaders.map(ll => {
            const llSales = periodSales.filter(s => s.lossLeaderId === ll.id);
            const llLoss = llSales.reduce((sum, s) => sum + s.loss, 0);
            const llRevenue = llSales.reduce((sum, s) => sum + s.pairingRevenue, 0);
            const llProfit = llSales.reduce((sum, s) => sum + s.netProfit, 0);

            return {
                id: ll.id,
                productName: ll.productName,
                unitsSold: llSales.reduce((sum, s) => sum + s.quantity, 0),
                loss: llLoss,
                pairingRevenue: llRevenue,
                netProfit: llProfit,
                roi: Math.abs(llLoss) > 0 ? (llProfit / Math.abs(llLoss) * 100) : 0
            };
        }).sort((a, b) => b.netProfit - a.netProfit);

        return {
            period,
            totalSales: periodSales.length,
            totalLoss: totalLoss,
            totalPairingRevenue: totalPairingRevenue,
            totalNetProfit: totalNetProfit,
            pairingRate: pairingRate.toFixed(1),
            roi: roi.toFixed(1),
            isSuccessful: roi > 0,
            breakdown: breakdown,
            topPerformer: breakdown.length > 0 ? breakdown[0] : null
        };
    }

    /**
     * A/B testing на loss leader strategies
     */
    compareStrategies(lossLeaderId1, lossLeaderId2, period = 'week') {
        const ll1 = this.lossLeaders.find(ll => ll.id === lossLeaderId1);
        const ll2 = this.lossLeaders.find(ll => ll.id === lossLeaderId2);

        if (!ll1 || !ll2) {
            throw new Error('Loss leaders не са намерени');
        }

        const perf1 = this.getLossLeaderPerformance(lossLeaderId1);
        const perf2 = this.getLossLeaderPerformance(lossLeaderId2);

        const winner = parseFloat(perf1.roi) > parseFloat(perf2.roi) ? 'll1' : 'll2';

        return {
            ll1: {
                name: ll1.productName,
                roi: perf1.roi,
                netProfit: perf1.netProfit,
                pairingRate: perf1.pairingRate
            },
            ll2: {
                name: ll2.productName,
                roi: perf2.roi,
                netProfit: perf2.netProfit,
                pairingRate: perf2.pairingRate
            },
            winner: winner,
            roiDifference: Math.abs(parseFloat(perf1.roi) - parseFloat(perf2.roi)).toFixed(1)
        };
    }

    /**
     * Auto-suggestions за подобряване на loss leader
     */
    getOptimizationSuggestions(lossLeaderId) {
        const performance = this.getLossLeaderPerformance(lossLeaderId);
        const suggestions = [];

        // Low pairing rate
        if (parseFloat(performance.pairingRate) < 30) {
            suggestions.push({
                type: 'low_pairing_rate',
                priority: 'high',
                suggestion: 'Паринг rate е нисък. Добавете visual merchandising - поставете паринг продуктите до loss leader продукта.',
                expectedImprovement: '+20% pairing rate'
            });

            suggestions.push({
                type: 'promotion',
                priority: 'medium',
                suggestion: 'Създайте bundle с loss leader + top pairing продукт.',
                expectedImprovement: '+15% basket size'
            });
        }

        // Negative ROI
        if (parseFloat(performance.roi) < 0) {
            suggestions.push({
                type: 'negative_roi',
                priority: 'critical',
                suggestion: 'ROI е негативен. Увеличете loss leader цената с 10-20% или намерете по-печеливши pairing продукти.',
                expectedImprovement: 'Positive ROI'
            });
        }

        // Low basket size
        if (performance.avgBasketSize < 20) {
            suggestions.push({
                type: 'low_basket',
                priority: 'medium',
                suggestion: 'Средната кошница е ниска. Добавете upsell suggestions на касата.',
                expectedImprovement: '+25% basket size'
            });
        }

        // Good performance - scale up
        if (parseFloat(performance.roi) > 50) {
            suggestions.push({
                type: 'scale_up',
                priority: 'opportunity',
                suggestion: 'Отличен ROI! Обмислете да намалите още цената или да увеличите visibility.',
                expectedImprovement: '+30% traffic'
            });
        }

        return suggestions;
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
        StorageService.save('lossLeaders', this.lossLeaders);
        StorageService.save('lossLeaderPairings', this.pairings);
        StorageService.save('lossLeaderSales', this.lossLeaderSales);
    }
}
