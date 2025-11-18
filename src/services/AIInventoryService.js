/**
 * AI Inventory Optimization Engine - v5.0
 * Intelligent inventory management with ML-based optimization
 */
import { ValidationService } from './ValidationService.js';
import { StorageService } from './StorageService.js';

export class AIInventoryService {
    constructor(productService, salesService, forecastService) {
        this.productService = productService;
        this.salesService = salesService;
        this.forecastService = forecastService;

        this.optimizationSettings = StorageService.get('aiInventorySettings', {
            targetServiceLevel: 0.95, // 95% service level (low stockout risk)
            leadTimeDays: 7, // Default supplier lead time
            safetyStockDays: 3, // Safety stock buffer
            holdingCostPercent: 20, // Annual holding cost as % of product value
            stockoutCostMultiplier: 3, // Cost of stockout vs holding
            seasonalityWeight: 0.7, // Weight for seasonal adjustments
            trendWeight: 0.5 // Weight for trend adjustments
        });

        this.optimizationHistory = StorageService.get('aiInventoryHistory', []);
    }

    /**
     * Optimize inventory for all products
     * @param {Object} options - Optimization options
     * @returns {Object} Optimization recommendations
     */
    optimizeAllProducts(options = {}) {
        const products = this.productService.getAllProducts();
        const optimizations = [];

        products.forEach(product => {
            const optimization = this.optimizeProduct(product.id, options);
            if (optimization.success) {
                optimizations.push(optimization.optimization);
            }
        });

        // Sort by urgency (products that need ordering first)
        optimizations.sort((a, b) => {
            const urgencyOrder = { 'critical': 0, 'high': 1, 'medium': 2, 'low': 3 };
            return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
        });

        return {
            success: true,
            optimization: {
                timestamp: new Date().toISOString(),
                totalProducts: optimizations.length,
                criticalCount: optimizations.filter(o => o.urgency === 'critical').length,
                highCount: optimizations.filter(o => o.urgency === 'high').length,
                products: optimizations,
                totalOrderValue: optimizations.reduce((sum, o) => sum + o.orderValue, 0),
                potentialSavings: optimizations.reduce((sum, o) => sum + (o.savings || 0), 0)
            }
        };
    }

    /**
     * Optimize single product
     * @param {number} productId - Product ID
     * @param {Object} options - Optimization options
     * @returns {Object} Optimization recommendation
     */
    optimizeProduct(productId, options = {}) {
        const product = this.productService.getProductById(productId);

        if (!product) {
            return {
                success: false,
                errors: ['Продуктът не съществува']
            };
        }

        // Get historical data
        const forecast = this.forecastService.predictSales(30, 90);
        const sales = this._getProductSales(productId);

        if (sales.length === 0) {
            // No sales history - use conservative approach
            return {
                success: true,
                optimization: {
                    productId: productId,
                    productName: product.name,
                    currentStock: product.stock,
                    optimalStock: Math.max(10, product.minStock || 5),
                    orderQuantity: 0,
                    orderValue: 0,
                    urgency: 'low',
                    reason: 'Няма история на продажби - запазете текущо ниво',
                    confidence: 'low'
                }
            };
        }

        // Calculate demand metrics
        const demandMetrics = this._calculateDemandMetrics(sales);

        // Calculate optimal stock levels
        const optimalLevels = this._calculateOptimalStockLevels(
            demandMetrics,
            product,
            options
        );

        // Determine urgency
        const urgency = this._calculateUrgency(
            product.stock,
            optimalLevels.reorderPoint,
            demandMetrics.avgDailyDemand
        );

        // Calculate order quantity (Economic Order Quantity)
        const eoq = this._calculateEOQ(
            demandMetrics.avgDailyDemand * 365,
            product.price || 0,
            options.orderCost || 50
        );

        // Determine actual order quantity
        let orderQuantity = 0;
        if (product.stock < optimalLevels.reorderPoint) {
            orderQuantity = Math.max(
                optimalLevels.targetStock - product.stock,
                eoq
            );
        }

        // Calculate potential savings
        const savings = this._calculatePotentialSavings(
            product,
            optimalLevels.targetStock,
            demandMetrics
        );

        return {
            success: true,
            optimization: {
                productId: productId,
                productName: product.name,
                currentStock: product.stock,
                optimalStock: optimalLevels.targetStock,
                reorderPoint: optimalLevels.reorderPoint,
                safetyStock: optimalLevels.safetyStock,
                orderQuantity: Math.round(orderQuantity),
                orderValue: Math.round((orderQuantity * product.price) * 100) / 100,
                eoq: Math.round(eoq),
                urgency: urgency,
                daysUntilStockout: Math.floor(product.stock / Math.max(0.01, demandMetrics.avgDailyDemand)),
                avgDailyDemand: Math.round(demandMetrics.avgDailyDemand * 100) / 100,
                demandVariability: demandMetrics.variability,
                trend: demandMetrics.trend,
                seasonalFactor: demandMetrics.seasonalFactor,
                confidence: this._calculateConfidence(sales, demandMetrics),
                savings: Math.round(savings * 100) / 100,
                reason: this._generateRecommendationReason(urgency, product, optimalLevels, demandMetrics)
            }
        };
    }

    /**
     * Detect dead stock (slow-moving inventory)
     * @param {number} thresholdDays - Days without sales to consider dead
     * @returns {Object} Dead stock items
     */
    detectDeadStock(thresholdDays = 90) {
        const products = this.productService.getAllProducts();
        const deadStock = [];
        const now = new Date();

        products.forEach(product => {
            const sales = this._getProductSales(product.id);

            if (sales.length === 0 && product.stock > 0) {
                // Never sold but has stock
                deadStock.push({
                    productId: product.id,
                    productName: product.name,
                    stock: product.stock,
                    stockValue: product.stock * product.price,
                    daysSinceLastSale: 999,
                    recommendation: 'Промоция -50%',
                    severity: 'high'
                });
            } else if (sales.length > 0) {
                const lastSaleDate = new Date(Math.max(...sales.map(s => new Date(s.date))));
                const daysSinceLastSale = Math.floor((now - lastSaleDate) / (1000 * 60 * 60 * 24));

                if (daysSinceLastSale > thresholdDays && product.stock > 0) {
                    let recommendation = '';
                    let severity = 'low';

                    if (daysSinceLastSale > 180) {
                        recommendation = 'Ликвидация -70%';
                        severity = 'critical';
                    } else if (daysSinceLastSale > 120) {
                        recommendation = 'Разпродажба -50%';
                        severity = 'high';
                    } else {
                        recommendation = 'Промоция -30%';
                        severity = 'medium';
                    }

                    deadStock.push({
                        productId: product.id,
                        productName: product.name,
                        stock: product.stock,
                        stockValue: product.stock * product.price,
                        daysSinceLastSale: daysSinceLastSale,
                        lastSaleDate: lastSaleDate.toISOString().split('T')[0],
                        recommendation: recommendation,
                        severity: severity
                    });
                }
            }
        });

        // Sort by severity
        const severityOrder = { 'critical': 0, 'high': 1, 'medium': 2, 'low': 3 };
        deadStock.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

        return {
            success: true,
            deadStock: {
                items: deadStock,
                totalItems: deadStock.length,
                totalStockValue: deadStock.reduce((sum, item) => sum + item.stockValue, 0),
                criticalItems: deadStock.filter(i => i.severity === 'critical').length
            }
        };
    }

    /**
     * Calculate optimal reorder timing
     * @param {number} productId - Product ID
     * @returns {Object} Reorder timing recommendation
     */
    calculateReorderTiming(productId) {
        const product = this.productService.getProductById(productId);

        if (!product) {
            return {
                success: false,
                errors: ['Продуктът не съществува']
            };
        }

        const sales = this._getProductSales(productId);
        const demandMetrics = this._calculateDemandMetrics(sales);
        const leadTime = this.optimizationSettings.leadTimeDays;

        // Calculate when to order
        const daysOfStock = product.stock / Math.max(0.01, demandMetrics.avgDailyDemand);
        const daysUntilReorder = Math.max(0, daysOfStock - leadTime - this.optimizationSettings.safetyStockDays);

        const reorderDate = new Date();
        reorderDate.setDate(reorderDate.getDate() + Math.floor(daysUntilReorder));

        return {
            success: true,
            timing: {
                productId: productId,
                productName: product.name,
                currentStock: product.stock,
                avgDailyDemand: Math.round(demandMetrics.avgDailyDemand * 100) / 100,
                daysOfStock: Math.round(daysOfStock * 10) / 10,
                leadTimeDays: leadTime,
                safetyStockDays: this.optimizationSettings.safetyStockDays,
                daysUntilReorder: Math.floor(daysUntilReorder),
                reorderDate: reorderDate.toISOString().split('T')[0],
                shouldOrderNow: daysUntilReorder <= 0,
                urgency: daysUntilReorder <= 0 ? 'critical' :
                        daysUntilReorder <= 3 ? 'high' :
                        daysUntilReorder <= 7 ? 'medium' : 'low'
            }
        };
    }

    /**
     * Forecast inventory costs
     * @param {number} days - Days to forecast
     * @returns {Object} Cost forecast
     */
    forecastInventoryCosts(days = 30) {
        const products = this.productService.getAllProducts();
        let totalHoldingCost = 0;
        let estimatedStockoutCost = 0;

        products.forEach(product => {
            const sales = this._getProductSales(product.id);
            const demandMetrics = this._calculateDemandMetrics(sales);

            // Holding cost
            const avgInventoryValue = product.stock * product.price * 0.5; // Average over period
            const dailyHoldingCost = (avgInventoryValue * this.optimizationSettings.holdingCostPercent / 100) / 365;
            totalHoldingCost += dailyHoldingCost * days;

            // Stockout risk
            const daysOfStock = product.stock / Math.max(0.01, demandMetrics.avgDailyDemand);
            if (daysOfStock < days) {
                const stockoutDays = days - daysOfStock;
                const lostSales = stockoutDays * demandMetrics.avgDailyDemand;
                estimatedStockoutCost += lostSales * product.price * this.optimizationSettings.stockoutCostMultiplier;
            }
        });

        return {
            success: true,
            forecast: {
                period: `${days} дни`,
                totalHoldingCost: Math.round(totalHoldingCost * 100) / 100,
                estimatedStockoutCost: Math.round(estimatedStockoutCost * 100) / 100,
                totalCost: Math.round((totalHoldingCost + estimatedStockoutCost) * 100) / 100,
                breakdown: {
                    holdingCostPercent: Math.round((totalHoldingCost / (totalHoldingCost + estimatedStockoutCost)) * 100),
                    stockoutCostPercent: Math.round((estimatedStockoutCost / (totalHoldingCost + estimatedStockoutCost)) * 100)
                }
            }
        };
    }

    /**
     * Update optimization settings
     * @param {Object} settings - New settings
     * @returns {Object} Result
     */
    updateSettings(settings) {
        this.optimizationSettings = { ...this.optimizationSettings, ...settings };
        StorageService.set('aiInventorySettings', this.optimizationSettings);

        return {
            success: true,
            settings: this.optimizationSettings
        };
    }

    // ============ PRIVATE METHODS ============

    _getProductSales(productId) {
        const allSales = this.salesService.getAllSales();
        const productSales = [];

        allSales.forEach(sale => {
            const item = sale.items.find(i => i.productId === productId);
            if (item) {
                productSales.push({
                    date: sale.date,
                    quantity: item.quantity,
                    price: item.price
                });
            }
        });

        return productSales.sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    _calculateDemandMetrics(sales) {
        if (sales.length === 0) {
            return {
                avgDailyDemand: 0,
                variability: 0,
                trend: 'stable',
                seasonalFactor: 1.0
            };
        }

        const totalQuantity = sales.reduce((sum, s) => sum + s.quantity, 0);
        const firstDate = new Date(sales[0].date);
        const lastDate = new Date(sales[sales.length - 1].date);
        const daysCovered = Math.max(1, Math.ceil((lastDate - firstDate) / (1000 * 60 * 60 * 24)));

        const avgDailyDemand = totalQuantity / daysCovered;

        // Calculate variability (coefficient of variation)
        const dailyDemands = this._groupByDay(sales);
        const mean = avgDailyDemand;
        const variance = dailyDemands.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / dailyDemands.length;
        const stdDev = Math.sqrt(variance);
        const variability = mean > 0 ? stdDev / mean : 0;

        // Calculate trend
        const trend = this._calculateTrend(dailyDemands);

        return {
            avgDailyDemand: avgDailyDemand,
            variability: variability,
            trend: trend > 0.1 ? 'increasing' : trend < -0.1 ? 'decreasing' : 'stable',
            trendValue: trend,
            seasonalFactor: 1.0 // Simplified for now
        };
    }

    _calculateOptimalStockLevels(demandMetrics, product, options) {
        const leadTime = options.leadTime || this.optimizationSettings.leadTimeDays;
        const serviceLevel = options.serviceLevel || this.optimizationSettings.targetServiceLevel;
        const safetyStockDays = this.optimizationSettings.safetyStockDays;

        // Lead time demand
        const leadTimeDemand = demandMetrics.avgDailyDemand * leadTime;

        // Safety stock (based on variability and service level)
        const zScore = this._getZScore(serviceLevel);
        const safetyStock = zScore * demandMetrics.avgDailyDemand * Math.sqrt(leadTime) * demandMetrics.variability;

        // Reorder point
        const reorderPoint = leadTimeDemand + safetyStock;

        // Target stock (cycle stock + safety stock)
        const cycleStock = demandMetrics.avgDailyDemand * 14; // 2 weeks
        const targetStock = cycleStock + safetyStock;

        return {
            targetStock: Math.ceil(targetStock),
            reorderPoint: Math.ceil(reorderPoint),
            safetyStock: Math.ceil(safetyStock),
            leadTimeDemand: Math.ceil(leadTimeDemand)
        };
    }

    _calculateEOQ(annualDemand, unitCost, orderCost) {
        // Economic Order Quantity formula
        const holdingCostPerUnit = unitCost * (this.optimizationSettings.holdingCostPercent / 100);
        const eoq = Math.sqrt((2 * annualDemand * orderCost) / holdingCostPerUnit);
        return eoq;
    }

    _calculateUrgency(currentStock, reorderPoint, avgDailyDemand) {
        if (currentStock <= 0) return 'critical';
        if (currentStock <= reorderPoint * 0.5) return 'critical';
        if (currentStock <= reorderPoint) return 'high';
        if (currentStock <= reorderPoint * 1.5) return 'medium';
        return 'low';
    }

    _calculatePotentialSavings(product, optimalStock, demandMetrics) {
        const currentHoldingCost = product.stock * product.price * (this.optimizationSettings.holdingCostPercent / 100);
        const optimalHoldingCost = optimalStock * product.price * (this.optimizationSettings.holdingCostPercent / 100);

        return Math.abs(currentHoldingCost - optimalHoldingCost);
    }

    _calculateConfidence(sales, demandMetrics) {
        if (sales.length < 5) return 'low';
        if (sales.length < 15) return 'medium';
        if (demandMetrics.variability > 0.5) return 'medium';
        return 'high';
    }

    _generateRecommendationReason(urgency, product, optimalLevels, demandMetrics) {
        if (urgency === 'critical') {
            return `КРИТИЧНО: Поръчайте незабавно! Текущ запас: ${product.stock}, Препоръчан: ${optimalLevels.reorderPoint}`;
        } else if (urgency === 'high') {
            return `Време за поръчка. Текущ запас под reorder point (${optimalLevels.reorderPoint})`;
        } else if (urgency === 'medium') {
            return `Планирайте поръчка скоро. Текущ запас е адекватен но наближава reorder point`;
        } else {
            return `Текущ запас е добър. Следваща поръчка след ${Math.floor(product.stock / demandMetrics.avgDailyDemand - this.optimizationSettings.leadTimeDays)} дни`;
        }
    }

    _groupByDay(sales) {
        const dailyDemands = {};

        sales.forEach(sale => {
            const day = new Date(sale.date).toISOString().split('T')[0];
            dailyDemands[day] = (dailyDemands[day] || 0) + sale.quantity;
        });

        return Object.values(dailyDemands);
    }

    _calculateTrend(data) {
        if (data.length < 2) return 0;

        const n = data.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

        for (let i = 0; i < n; i++) {
            sumX += i;
            sumY += data[i];
            sumXY += i * data[i];
            sumX2 += i * i;
        }

        return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    }

    _getZScore(serviceLevel) {
        // Z-scores for common service levels
        const zScores = {
            0.90: 1.28,
            0.95: 1.65,
            0.98: 2.05,
            0.99: 2.33
        };

        return zScores[serviceLevel] || 1.65;
    }
}
