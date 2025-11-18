/**
 * Price Optimization Service - v8.0
 * Интелигентно ценообразуване и оптимизация
 */
import { StorageService } from './StorageService.js';
import { ValidationService } from './ValidationService.js';

export class PriceOptimizationService {
    constructor(productService, salesService, competitorTrackingService) {
        this.productService = productService;
        this.salesService = salesService;
        this.competitorTrackingService = competitorTrackingService;

        // Price change history
        this.priceHistory = StorageService.get('priceChangeHistory', []);

        // Pricing rules
        this.pricingRules = StorageService.get('pricingRules', {
            minMargin: 15, // Minimum acceptable margin %
            targetMargin: 25, // Target margin %
            maxDiscount: 30, // Maximum discount %
            roundingRule: 'nearest_50st' // nearest_50st, nearest_lev, no_rounding
        });
    }

    /**
     * Smart price suggestion за продукт
     * @param {number} productId - Product ID
     * @param {Object} options - Options
     * @returns {Object} Price suggestions
     */
    getSuggestions(productId, options = {}) {
        const product = this.productService.getProductById(productId);

        if (!product) {
            return {
                success: false,
                errors: ['Продуктът не е намерен']
            };
        }

        const cost = product.cost || product.price * 0.6;
        const currentPrice = product.price;
        const currentMargin = ((currentPrice - cost) / currentPrice) * 100;

        // Get competitor prices
        const competitorComparison = this.competitorTrackingService.getPriceComparison(productId);
        const competitors = competitorComparison.comparison[0] || null;

        // Calculate suggestions
        const suggestions = [];

        // 1. Cost-based pricing
        const costBasedPrice = this._calculateCostBasedPrice(cost, this.pricingRules.targetMargin);
        suggestions.push({
            type: 'cost_based',
            price: costBasedPrice,
            margin: this.pricingRules.targetMargin,
            reason: `Осигурява ${this.pricingRules.targetMargin}% марж`
        });

        // 2. Competition-based pricing
        if (competitors && competitors.avgCompetitorPrice > 0) {
            const competitivePriceMatch = competitors.avgCompetitorPrice;
            const competitivePriceBeat = competitors.lowestCompetitorPrice * 0.98; // 2% under lowest

            const matchMargin = ((competitivePriceMatch - cost) / competitivePriceMatch) * 100;
            const beatMargin = ((competitivePriceBeat - cost) / competitivePriceBeat) * 100;

            if (matchMargin >= this.pricingRules.minMargin) {
                suggestions.push({
                    type: 'competitive_match',
                    price: this._roundPrice(competitivePriceMatch),
                    margin: Math.round(matchMargin * 100) / 100,
                    reason: 'Съответства на средната конкурентна цена'
                });
            }

            if (beatMargin >= this.pricingRules.minMargin) {
                suggestions.push({
                    type: 'competitive_beat',
                    price: this._roundPrice(competitivePriceBeat),
                    margin: Math.round(beatMargin * 100) / 100,
                    reason: 'Под най-ниската конкурентна цена (price leader)'
                });
            }
        }

        // 3. Sweet spot (optimal price for max profit)
        const sweetSpot = this._calculateSweetSpot(productId, cost);
        if (sweetSpot) {
            suggestions.push({
                type: 'sweet_spot',
                price: sweetSpot.price,
                margin: sweetSpot.margin,
                reason: 'Оптимална цена за максимална печалба (на база история)'
            });
        }

        // 4. Psychological pricing
        const psychPrice = this._calculatePsychologicalPrice(currentPrice);
        const psychMargin = ((psychPrice - cost) / psychPrice) * 100;
        if (psychMargin >= this.pricingRules.minMargin) {
            suggestions.push({
                type: 'psychological',
                price: psychPrice,
                margin: Math.round(psychMargin * 100) / 100,
                reason: 'Психологическа цена (завършва на .99 или .95)'
            });
        }

        // Sort by margin descending
        suggestions.sort((a, b) => b.margin - a.margin);

        // Determine best suggestion
        const bestSuggestion = this._selectBestSuggestion(suggestions, currentPrice, competitors);

        return {
            success: true,
            productId: productId,
            productName: product.name,
            currentPrice: currentPrice,
            currentMargin: Math.round(currentMargin * 100) / 100,
            cost: cost,
            competitors: competitors,
            suggestions: suggestions,
            recommended: bestSuggestion
        };
    }

    /**
     * Bulk price change
     * @param {Object} criteria - Selection criteria
     * @param {Object} changeData - Change to apply
     * @returns {Object} Result
     */
    bulkPriceChange(criteria, changeData) {
        const allProducts = this.productService.getAllProducts();
        let selectedProducts = allProducts;

        // Filter by criteria
        if (criteria.category) {
            selectedProducts = selectedProducts.filter(p =>
                p.category && p.category.toLowerCase() === criteria.category.toLowerCase()
            );
        }

        if (criteria.supplier) {
            selectedProducts = selectedProducts.filter(p =>
                p.supplier && p.supplier === criteria.supplier
            );
        }

        if (criteria.productIds) {
            selectedProducts = selectedProducts.filter(p =>
                criteria.productIds.includes(p.id)
            );
        }

        if (selectedProducts.length === 0) {
            return {
                success: false,
                errors: ['Няма продукти, отговарящи на критериите']
            };
        }

        // Apply changes
        const changes = [];

        selectedProducts.forEach(product => {
            const oldPrice = product.price;
            let newPrice;

            if (changeData.type === 'percent_increase') {
                newPrice = oldPrice * (1 + changeData.value / 100);
            } else if (changeData.type === 'percent_decrease') {
                newPrice = oldPrice * (1 - changeData.value / 100);
            } else if (changeData.type === 'fixed_increase') {
                newPrice = oldPrice + changeData.value;
            } else if (changeData.type === 'fixed_decrease') {
                newPrice = oldPrice - changeData.value;
            } else if (changeData.type === 'set_price') {
                newPrice = changeData.value;
            } else if (changeData.type === 'set_margin') {
                const cost = product.cost || oldPrice * 0.6;
                newPrice = cost / (1 - changeData.value / 100);
            }

            newPrice = this._roundPrice(newPrice);

            // Validate min margin
            const cost = product.cost || oldPrice * 0.6;
            const newMargin = ((newPrice - cost) / newPrice) * 100;

            if (newMargin < this.pricingRules.minMargin) {
                changes.push({
                    productId: product.id,
                    productName: product.name,
                    oldPrice: oldPrice,
                    newPrice: newPrice,
                    skipped: true,
                    reason: `Маржът би бил ${Math.round(newMargin)}% (под минимум ${this.pricingRules.minMargin}%)`
                });
            } else {
                // Update price
                product.price = newPrice;

                // Record change
                this._recordPriceChange(product.id, oldPrice, newPrice, `Bulk change: ${changeData.type}`, changeData.reason);

                changes.push({
                    productId: product.id,
                    productName: product.name,
                    oldPrice: oldPrice,
                    newPrice: newPrice,
                    margin: Math.round(newMargin * 100) / 100,
                    success: true
                });
            }
        });

        const successCount = changes.filter(c => c.success).length;
        const skippedCount = changes.filter(c => c.skipped).length;

        return {
            success: true,
            totalProducts: selectedProducts.length,
            successCount: successCount,
            skippedCount: skippedCount,
            changes: changes
        };
    }

    /**
     * Profit margin calculator
     * @param {number} cost - Cost
     * @param {number} price - Price
     * @returns {Object} Margin calculation
     */
    calculateMargin(cost, price) {
        if (cost <= 0 || price <= 0) {
            return {
                success: false,
                errors: ['Цената и себестойността трябва да са положителни']
            };
        }

        const profit = price - cost;
        const marginPercent = (profit / price) * 100;
        const markupPercent = (profit / cost) * 100;

        return {
            success: true,
            cost: Math.round(cost * 100) / 100,
            price: Math.round(price * 100) / 100,
            profit: Math.round(profit * 100) / 100,
            marginPercent: Math.round(marginPercent * 100) / 100,
            markupPercent: Math.round(markupPercent * 100) / 100,
            status: marginPercent >= this.pricingRules.targetMargin ? 'good' : 'low'
        };
    }

    /**
     * Calculate price from desired margin
     * @param {number} cost - Cost
     * @param {number} desiredMargin - Desired margin %
     * @returns {Object} Calculated price
     */
    calculatePriceFromMargin(cost, desiredMargin) {
        if (cost <= 0 || desiredMargin <= 0 || desiredMargin >= 100) {
            return {
                success: false,
                errors: ['Невалидни параметри']
            };
        }

        const price = cost / (1 - desiredMargin / 100);
        const roundedPrice = this._roundPrice(price);

        return {
            success: true,
            cost: cost,
            desiredMargin: desiredMargin,
            calculatedPrice: Math.round(price * 100) / 100,
            roundedPrice: roundedPrice,
            actualMargin: ((roundedPrice - cost) / roundedPrice) * 100
        };
    }

    /**
     * Quick price adjustments (±5%, ±10%, etc.)
     * @param {number} productId - Product ID
     * @param {number} adjustment - Adjustment % (e.g. +5, -10)
     * @returns {Object} Result
     */
    quickPriceAdjustment(productId, adjustment) {
        const product = this.productService.getProductById(productId);

        if (!product) {
            return {
                success: false,
                errors: ['Продуктът не е намерен']
            };
        }

        const oldPrice = product.price;
        const newPrice = this._roundPrice(oldPrice * (1 + adjustment / 100));

        // Validate margin
        const cost = product.cost || oldPrice * 0.6;
        const newMargin = ((newPrice - cost) / newPrice) * 100;

        if (newMargin < this.pricingRules.minMargin) {
            return {
                success: false,
                errors: [`Маржът би бил ${Math.round(newMargin)}% (под минимум ${this.pricingRules.minMargin}%)`]
            };
        }

        // Update price
        product.price = newPrice;

        // Record change
        this._recordPriceChange(productId, oldPrice, newPrice, `Quick adjustment ${adjustment > 0 ? '+' : ''}${adjustment}%`);

        return {
            success: true,
            productId: productId,
            productName: product.name,
            oldPrice: oldPrice,
            newPrice: newPrice,
            adjustment: adjustment,
            newMargin: Math.round(newMargin * 100) / 100
        };
    }

    /**
     * Price history за продукт
     * @param {number} productId - Product ID
     * @param {number} limit - Limit
     * @returns {Object} Price history
     */
    getPriceHistory(productId, limit = 20) {
        const history = this.priceHistory
            .filter(h => h.productId === productId)
            .sort((a, b) => new Date(b.changedAt) - new Date(a.changedAt))
            .slice(0, limit);

        return {
            success: true,
            productId: productId,
            history: history,
            count: history.length
        };
    }

    /**
     * Price trend analysis
     * @param {number} productId - Product ID
     * @returns {Object} Trend
     */
    getPriceTrend(productId) {
        const history = this.priceHistory.filter(h => h.productId === productId);

        if (history.length < 2) {
            return {
                success: true,
                trend: 'stable',
                message: 'Недостатъчна история'
            };
        }

        // Sort chronologically
        history.sort((a, b) => new Date(a.changedAt) - new Date(b.changedAt));

        const firstPrice = history[0].oldPrice;
        const lastPrice = history[history.length - 1].newPrice;

        const totalChange = ((lastPrice - firstPrice) / firstPrice) * 100;

        let trend;
        if (totalChange > 5) trend = 'increasing';
        else if (totalChange < -5) trend = 'decreasing';
        else trend = 'stable';

        return {
            success: true,
            productId: productId,
            trend: trend,
            totalChanges: history.length,
            firstPrice: firstPrice,
            lastPrice: lastPrice,
            totalChange: Math.round(totalChange * 100) / 100,
            history: history
        };
    }

    /**
     * Update pricing rules
     * @param {Object} rules - Rules
     * @returns {Object} Result
     */
    updatePricingRules(rules) {
        this.pricingRules = { ...this.pricingRules, ...rules };
        StorageService.set('pricingRules', this.pricingRules);

        return {
            success: true,
            rules: this.pricingRules
        };
    }

    /**
     * Get pricing rules
     * @returns {Object} Rules
     */
    getPricingRules() {
        return {
            success: true,
            rules: this.pricingRules
        };
    }

    // ============ PRIVATE METHODS ============

    _calculateCostBasedPrice(cost, targetMargin) {
        const price = cost / (1 - targetMargin / 100);
        return this._roundPrice(price);
    }

    _calculateSweetSpot(productId, cost) {
        // Analyze sales history at different price points
        const salesHistory = this.salesService.getAllSales();
        const priceHistory = this.priceHistory.filter(h => h.productId === productId);

        if (priceHistory.length < 3) return null;

        // Group sales by price periods
        const pricePeriods = [];
        priceHistory.forEach((change, index) => {
            const startDate = new Date(change.changedAt);
            const endDate = index < priceHistory.length - 1
                ? new Date(priceHistory[index + 1].changedAt)
                : new Date();

            const periodSales = salesHistory.filter(sale => {
                const saleDate = new Date(sale.date);
                return saleDate >= startDate && saleDate < endDate &&
                    sale.items.some(item => item.productId === productId);
            });

            const quantity = periodSales.reduce((sum, sale) => {
                const item = sale.items.find(i => i.productId === productId);
                return sum + (item ? item.quantity : 0);
            }, 0);

            const revenue = quantity * change.newPrice;
            const profit = quantity * (change.newPrice - cost);

            pricePeriods.push({
                price: change.newPrice,
                quantity: quantity,
                revenue: revenue,
                profit: profit
            });
        });

        // Find price with max profit
        const maxProfitPeriod = pricePeriods.reduce((max, period) =>
            period.profit > max.profit ? period : max, pricePeriods[0]
        );

        if (!maxProfitPeriod || maxProfitPeriod.profit <= 0) return null;

        const margin = ((maxProfitPeriod.price - cost) / maxProfitPeriod.price) * 100;

        return {
            price: this._roundPrice(maxProfitPeriod.price),
            margin: Math.round(margin * 100) / 100
        };
    }

    _calculatePsychologicalPrice(price) {
        // Round to .99 or .95
        if (price < 1) return 0.99;

        const rounded = Math.floor(price);
        const decimals = price - rounded;

        if (decimals < 0.45) {
            return rounded - 0.05; // e.g. 2.40 → 1.95
        } else if (decimals < 0.95) {
            return rounded + 0.95; // e.g. 2.60 → 2.95
        } else {
            return rounded + 0.99; // e.g. 3.10 → 3.99
        }
    }

    _selectBestSuggestion(suggestions, currentPrice, competitors) {
        if (suggestions.length === 0) return null;

        // Prioritize competitive suggestions if available
        if (competitors) {
            const competitive = suggestions.find(s => s.type === 'competitive_match');
            if (competitive && competitive.margin >= this.pricingRules.targetMargin * 0.8) {
                return competitive;
            }
        }

        // Otherwise select suggestion with highest margin >= target
        const highMargin = suggestions.find(s => s.margin >= this.pricingRules.targetMargin);
        if (highMargin) return highMargin;

        // If no suggestion meets target, select highest margin
        return suggestions[0];
    }

    _roundPrice(price) {
        const rule = this.pricingRules.roundingRule;

        if (rule === 'nearest_50st') {
            return Math.round(price * 2) / 2;
        } else if (rule === 'nearest_lev') {
            return Math.round(price);
        } else {
            return Math.round(price * 100) / 100;
        }
    }

    _recordPriceChange(productId, oldPrice, newPrice, changeType, reason = '') {
        const change = {
            id: Date.now() + Math.random(),
            productId: productId,
            oldPrice: Math.round(oldPrice * 100) / 100,
            newPrice: Math.round(newPrice * 100) / 100,
            change: Math.round((newPrice - oldPrice) * 100) / 100,
            changePercent: Math.round(((newPrice - oldPrice) / oldPrice) * 10000) / 100,
            changeType: changeType,
            reason: reason,
            changedAt: new Date().toISOString()
        };

        this.priceHistory.unshift(change);

        // Keep only last 1000 changes
        if (this.priceHistory.length > 1000) {
            this.priceHistory = this.priceHistory.slice(0, 1000);
        }

        StorageService.set('priceChangeHistory', this.priceHistory);
    }
}
