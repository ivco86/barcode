/**
 * Dynamic Pricing Service - v4.0
 * Smart pricing algorithms based on demand, time, and market conditions
 */
import { ValidationService } from './ValidationService.js';
import { StorageService } from './StorageService.js';

export class DynamicPricingService {
    constructor(productService, salesService) {
        this.productService = productService;
        this.salesService = salesService;

        this.pricingRules = StorageService.get('pricingRules', []);
        this.priceHistory = StorageService.get('priceHistory', {});
        this.enabled = StorageService.get('dynamicPricingEnabled', false);
    }

    /**
     * Enable/disable dynamic pricing
     * @param {boolean} enabled - Enable state
     * @returns {Object} Result
     */
    setEnabled(enabled) {
        this.enabled = enabled;
        StorageService.set('dynamicPricingEnabled', enabled);

        return {
            success: true,
            dynamicPricing: {
                enabled: enabled
            }
        };
    }

    /**
     * Create pricing rule
     * @param {Object} ruleData - Rule configuration
     * @returns {Object} Result with rule
     */
    createPricingRule(ruleData) {
        const validation = this._validateRuleData(ruleData);
        if (!validation.isValid) {
            return { success: false, errors: validation.errors };
        }

        const rule = {
            id: Date.now(),
            name: ValidationService.sanitizeString(ruleData.name),
            type: ruleData.type, // 'time_based', 'demand_based', 'inventory_based', 'competitor_based'
            productIds: ruleData.productIds || [], // Empty = all products
            categoryIds: ruleData.categoryIds || [],
            conditions: ruleData.conditions,
            adjustment: ruleData.adjustment, // { type: 'percentage'/'fixed', value: number }
            priority: ruleData.priority || 0,
            active: true,
            createdAt: new Date().toISOString()
        };

        this.pricingRules.push(rule);
        this._savePricingRules();

        return {
            success: true,
            rule: rule
        };
    }

    /**
     * Calculate dynamic price for a product
     * @param {number} productId - Product ID
     * @param {Object} context - Contextual information (time, demand, etc.)
     * @returns {Object} Price calculation result
     */
    calculateDynamicPrice(productId, context = {}) {
        const product = this.productService.getProductById(productId);

        if (!product) {
            return {
                success: false,
                errors: ['Продуктът не съществува']
            };
        }

        if (!this.enabled) {
            return {
                success: true,
                pricing: {
                    basePrice: product.price,
                    dynamicPrice: product.price,
                    adjustment: 0,
                    adjustmentPercent: 0,
                    appliedRules: [],
                    dynamicPricingEnabled: false
                }
            };
        }

        // Get applicable rules
        const applicableRules = this._getApplicableRules(product, context);

        // Sort by priority (higher priority first)
        applicableRules.sort((a, b) => b.priority - a.priority);

        let currentPrice = product.price;
        const appliedRules = [];

        // Apply each rule
        for (const rule of applicableRules) {
            const ruleMatches = this._evaluateRule(rule, product, context);

            if (ruleMatches) {
                const adjustment = this._calculateAdjustment(currentPrice, rule.adjustment);
                currentPrice += adjustment;

                appliedRules.push({
                    ruleId: rule.id,
                    ruleName: rule.name,
                    ruleType: rule.type,
                    adjustment: adjustment
                });
            }
        }

        // Ensure price doesn't go below minimum or above maximum
        const minPrice = product.price * 0.5; // Max 50% discount
        const maxPrice = product.price * 2.0; // Max 100% markup
        currentPrice = Math.max(minPrice, Math.min(maxPrice, currentPrice));

        const totalAdjustment = currentPrice - product.price;
        const adjustmentPercent = (totalAdjustment / product.price) * 100;

        // Log price change
        this._logPriceChange(productId, product.price, currentPrice, appliedRules);

        return {
            success: true,
            pricing: {
                basePrice: product.price,
                dynamicPrice: Math.round(currentPrice * 100) / 100,
                adjustment: Math.round(totalAdjustment * 100) / 100,
                adjustmentPercent: Math.round(adjustmentPercent * 100) / 100,
                appliedRules: appliedRules,
                dynamicPricingEnabled: true
            }
        };
    }

    /**
     * Get optimal price for a product based on demand analysis
     * @param {number} productId - Product ID
     * @returns {Object} Optimal price recommendation
     */
    getOptimalPrice(productId) {
        const product = this.productService.getProductById(productId);

        if (!product) {
            return {
                success: false,
                errors: ['Продуктът не съществува']
            };
        }

        const sales = this.salesService.getAllSales();

        // Get historical sales for this product at different price points
        const productSales = [];
        sales.forEach(sale => {
            const item = sale.items.find(i => i.productId === productId);
            if (item) {
                productSales.push({
                    date: sale.date,
                    price: item.price,
                    quantity: item.quantity,
                    revenue: item.price * item.quantity
                });
            }
        });

        if (productSales.length < 5) {
            return {
                success: false,
                errors: ['Недостатъчно данни за анализ (минимум 5 продажби)']
            };
        }

        // Calculate price elasticity
        const pricePoints = {};
        productSales.forEach(sale => {
            if (!pricePoints[sale.price]) {
                pricePoints[sale.price] = { totalQuantity: 0, totalRevenue: 0, salesCount: 0 };
            }
            pricePoints[sale.price].totalQuantity += sale.quantity;
            pricePoints[sale.price].totalRevenue += sale.revenue;
            pricePoints[sale.price].salesCount++;
        });

        // Find optimal price (maximize revenue)
        let optimalPrice = product.price;
        let maxRevenue = 0;

        Object.keys(pricePoints).forEach(price => {
            const avgRevenue = pricePoints[price].totalRevenue / pricePoints[price].salesCount;
            if (avgRevenue > maxRevenue) {
                maxRevenue = avgRevenue;
                optimalPrice = parseFloat(price);
            }
        });

        const currentAvgRevenue = product.price * (productSales.reduce((s, ps) => s + ps.quantity, 0) / productSales.length);
        const potentialIncrease = ((maxRevenue - currentAvgRevenue) / currentAvgRevenue) * 100;

        return {
            success: true,
            optimalPrice: {
                currentPrice: product.price,
                recommendedPrice: Math.round(optimalPrice * 100) / 100,
                potentialRevenueIncrease: Math.round(potentialIncrease * 100) / 100,
                basedOnSales: productSales.length,
                pricePoints: Object.keys(pricePoints).length
            }
        };
    }

    /**
     * Create time-based pricing rule (happy hour, night discount, etc.)
     * @param {string} name - Rule name
     * @param {number} startHour - Start hour (0-23)
     * @param {number} endHour - End hour (0-23)
     * @param {number} discountPercent - Discount percentage
     * @param {Array} productIds - Product IDs (optional)
     * @returns {Object} Result
     */
    createTimeBasedRule(name, startHour, endHour, discountPercent, productIds = []) {
        return this.createPricingRule({
            name: name,
            type: 'time_based',
            productIds: productIds,
            conditions: {
                startHour: startHour,
                endHour: endHour,
                daysOfWeek: [0, 1, 2, 3, 4, 5, 6] // All days
            },
            adjustment: {
                type: 'percentage',
                value: -discountPercent // Negative for discount
            },
            priority: 1
        });
    }

    /**
     * Create demand-based pricing rule
     * @param {string} name - Rule name
     * @param {number} minSalesPerDay - Minimum sales to trigger
     * @param {number} markupPercent - Markup percentage
     * @param {Array} productIds - Product IDs
     * @returns {Object} Result
     */
    createDemandBasedRule(name, minSalesPerDay, markupPercent, productIds = []) {
        return this.createPricingRule({
            name: name,
            type: 'demand_based',
            productIds: productIds,
            conditions: {
                minSalesPerDay: minSalesPerDay
            },
            adjustment: {
                type: 'percentage',
                value: markupPercent
            },
            priority: 2
        });
    }

    /**
     * Create inventory-based pricing rule (clearance, expiration, etc.)
     * @param {string} name - Rule name
     * @param {number} maxStock - Maximum stock to trigger
     * @param {number} discountPercent - Discount percentage
     * @param {Array} productIds - Product IDs
     * @returns {Object} Result
     */
    createInventoryBasedRule(name, maxStock, discountPercent, productIds = []) {
        return this.createPricingRule({
            name: name,
            type: 'inventory_based',
            productIds: productIds,
            conditions: {
                maxStock: maxStock
            },
            adjustment: {
                type: 'percentage',
                value: -discountPercent
            },
            priority: 3
        });
    }

    /**
     * Get all pricing rules
     * @returns {Object} Rules list
     */
    getAllPricingRules() {
        return {
            success: true,
            rules: this.pricingRules,
            totalRules: this.pricingRules.length,
            activeRules: this.pricingRules.filter(r => r.active).length
        };
    }

    /**
     * Update pricing rule
     * @param {number} ruleId - Rule ID
     * @param {Object} updates - Updates
     * @returns {Object} Result
     */
    updatePricingRule(ruleId, updates) {
        const rule = this.pricingRules.find(r => r.id === ruleId);

        if (!rule) {
            return {
                success: false,
                errors: ['Правилото не съществува']
            };
        }

        // Update fields
        if (updates.name) rule.name = ValidationService.sanitizeString(updates.name);
        if (updates.active !== undefined) rule.active = updates.active;
        if (updates.priority !== undefined) rule.priority = updates.priority;
        if (updates.conditions) rule.conditions = { ...rule.conditions, ...updates.conditions };
        if (updates.adjustment) rule.adjustment = updates.adjustment;

        rule.updatedAt = new Date().toISOString();

        this._savePricingRules();

        return {
            success: true,
            rule: rule
        };
    }

    /**
     * Delete pricing rule
     * @param {number} ruleId - Rule ID
     * @returns {Object} Result
     */
    deletePricingRule(ruleId) {
        const index = this.pricingRules.findIndex(r => r.id === ruleId);

        if (index === -1) {
            return {
                success: false,
                errors: ['Правилото не съществува']
            };
        }

        this.pricingRules.splice(index, 1);
        this._savePricingRules();

        return {
            success: true,
            ruleId: ruleId
        };
    }

    /**
     * Get price history for a product
     * @param {number} productId - Product ID
     * @param {number} days - Number of days to look back
     * @returns {Object} Price history
     */
    getPriceHistory(productId, days = 30) {
        const product = this.productService.getProductById(productId);

        if (!product) {
            return {
                success: false,
                errors: ['Продуктът не съществува']
            };
        }

        const history = this.priceHistory[productId] || [];
        const cutoffDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));

        const recentHistory = history.filter(h =>
            new Date(h.timestamp) >= cutoffDate
        );

        return {
            success: true,
            priceHistory: {
                productId: productId,
                productName: product.name,
                currentPrice: product.price,
                history: recentHistory,
                totalChanges: recentHistory.length
            }
        };
    }

    /**
     * Bulk calculate dynamic prices for all products
     * @param {Object} context - Context
     * @returns {Object} All prices
     */
    calculateAllDynamicPrices(context = {}) {
        const products = this.productService.getAllProducts();
        const prices = [];

        products.forEach(product => {
            const result = this.calculateDynamicPrice(product.id, context);
            if (result.success) {
                prices.push({
                    productId: product.id,
                    productName: product.name,
                    ...result.pricing
                });
            }
        });

        return {
            success: true,
            prices: prices,
            totalProducts: prices.length,
            dynamicPricingEnabled: this.enabled
        };
    }

    // ============ PRIVATE METHODS ============

    _validateRuleData(data) {
        const errors = [];

        const nameValidation = ValidationService.validateString(data.name, 'Име на правило', 2, 100);
        if (!nameValidation.isValid) {
            errors.push(...nameValidation.errors);
        }

        if (!['time_based', 'demand_based', 'inventory_based', 'competitor_based'].includes(data.type)) {
            errors.push('Невалиден тип правило');
        }

        if (!data.conditions) {
            errors.push('Липсват условия');
        }

        if (!data.adjustment || !data.adjustment.type || data.adjustment.value === undefined) {
            errors.push('Липсва или е невалидна корекция на цената');
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    _getApplicableRules(product, context) {
        return this.pricingRules.filter(rule => {
            if (!rule.active) return false;

            // Check if rule applies to this product
            if (rule.productIds.length > 0 && !rule.productIds.includes(product.id)) {
                return false;
            }

            if (rule.categoryIds.length > 0 && !rule.categoryIds.includes(product.category)) {
                return false;
            }

            return true;
        });
    }

    _evaluateRule(rule, product, context) {
        const now = context.timestamp ? new Date(context.timestamp) : new Date();

        switch (rule.type) {
            case 'time_based':
                const hour = now.getHours();
                const dayOfWeek = now.getDay();

                const { startHour, endHour, daysOfWeek } = rule.conditions;

                const hourMatches = (startHour <= endHour) ?
                                   (hour >= startHour && hour < endHour) :
                                   (hour >= startHour || hour < endHour);

                const dayMatches = !daysOfWeek || daysOfWeek.includes(dayOfWeek);

                return hourMatches && dayMatches;

            case 'demand_based':
                // Calculate recent demand
                const recentSales = this._getRecentSales(product.id, 7); // Last 7 days
                const avgSalesPerDay = recentSales.length / 7;

                return avgSalesPerDay >= rule.conditions.minSalesPerDay;

            case 'inventory_based':
                return product.stock <= rule.conditions.maxStock;

            case 'competitor_based':
                // Would compare with competitor prices if available
                return false;

            default:
                return false;
        }
    }

    _calculateAdjustment(currentPrice, adjustment) {
        if (adjustment.type === 'percentage') {
            return currentPrice * (adjustment.value / 100);
        } else if (adjustment.type === 'fixed') {
            return adjustment.value;
        }
        return 0;
    }

    _getRecentSales(productId, days) {
        const allSales = this.salesService.getAllSales();
        const cutoffDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));

        return allSales.filter(sale => {
            if (new Date(sale.date) < cutoffDate) return false;
            return sale.items.some(item => item.productId === productId);
        });
    }

    _logPriceChange(productId, oldPrice, newPrice, appliedRules) {
        if (!this.priceHistory[productId]) {
            this.priceHistory[productId] = [];
        }

        this.priceHistory[productId].push({
            timestamp: new Date().toISOString(),
            oldPrice: oldPrice,
            newPrice: newPrice,
            appliedRules: appliedRules.map(r => r.ruleId)
        });

        // Keep only last 100 entries per product
        if (this.priceHistory[productId].length > 100) {
            this.priceHistory[productId] = this.priceHistory[productId].slice(-100);
        }

        this._savePriceHistory();
    }

    _savePricingRules() {
        StorageService.set('pricingRules', this.pricingRules);
    }

    _savePriceHistory() {
        StorageService.set('priceHistory', this.priceHistory);
    }
}
