/**
 * Product Performance Scorecard - v6.0
 * Advanced product analytics and profitability tracking
 */
import { StorageService } from './StorageService.js';

export class ProductPerformanceService {
    constructor(productService, salesService, customerService) {
        this.productService = productService;
        this.salesService = salesService;
        this.customerService = customerService;
    }

    /**
     * Get comprehensive performance scorecard for a product
     * @param {number} productId - Product ID
     * @param {string} period - Period ('week', 'month', 'quarter', 'year')
     * @returns {Object} Performance scorecard
     */
    getProductScorecard(productId, period = 'month') {
        const product = this.productService.getProductById(productId);

        if (!product) {
            return {
                success: false,
                errors: ['Продуктът не е намерен']
            };
        }

        const dateRange = this._parsePeriod(period);
        const sales = this._getProductSales(productId, dateRange);

        // Sales metrics
        const totalUnits = sales.reduce((sum, s) => sum + s.quantity, 0);
        const totalRevenue = sales.reduce((sum, s) => sum + s.itemTotal, 0);
        const totalCost = totalUnits * (product.cost || product.price * 0.6);
        const grossProfit = totalRevenue - totalCost;

        // Profitability metrics
        const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
        const contributionMargin = product.price - (product.cost || product.price * 0.6);
        const contributionMarginPercent = product.price > 0 ? (contributionMargin / product.price) * 100 : 0;

        // Sales velocity
        const daysInPeriod = this._getDaysInPeriod(period);
        const salesPerDay = totalUnits / daysInPeriod;
        const revenuePerDay = totalRevenue / daysInPeriod;

        // Customer metrics
        const uniqueCustomers = new Set(sales.map(s => s.customerId).filter(c => c)).size;
        const repeatPurchaseRate = this._calculateRepeatRate(productId, dateRange);

        // Inventory metrics
        const stockValue = product.quantity * (product.cost || product.price * 0.6);
        const turnoverRate = stockValue > 0 ? totalCost / stockValue : 0;
        const daysOfInventory = turnoverRate > 0 ? 365 / turnoverRate : Infinity;

        // Trends
        const trend = this._calculateTrend(productId, period);
        const priceElasticity = this._calculatePriceElasticity(productId, dateRange);

        // Lifecycle stage
        const lifecycle = this._detectLifecycleStage(productId);

        // Performance score (0-100)
        const score = this._calculatePerformanceScore({
            grossMargin,
            salesPerDay,
            turnoverRate,
            trend,
            lifecycle
        });

        return {
            success: true,
            scorecard: {
                productId: productId,
                productName: product.name,
                period: period,

                // Sales metrics
                sales: {
                    units: totalUnits,
                    revenue: Math.round(totalRevenue * 100) / 100,
                    cost: Math.round(totalCost * 100) / 100,
                    grossProfit: Math.round(grossProfit * 100) / 100,
                    uniqueCustomers: uniqueCustomers,
                    repeatRate: Math.round(repeatPurchaseRate * 100) / 100
                },

                // Profitability
                profitability: {
                    grossMargin: Math.round(grossMargin * 100) / 100,
                    contributionMargin: Math.round(contributionMargin * 100) / 100,
                    contributionMarginPercent: Math.round(contributionMarginPercent * 100) / 100,
                    revenuePerDay: Math.round(revenuePerDay * 100) / 100,
                    profitPerDay: Math.round((grossProfit / daysInPeriod) * 100) / 100
                },

                // Inventory
                inventory: {
                    currentStock: product.quantity,
                    stockValue: Math.round(stockValue * 100) / 100,
                    turnoverRate: Math.round(turnoverRate * 100) / 100,
                    daysOfInventory: Math.round(daysOfInventory),
                    salesPerDay: Math.round(salesPerDay * 100) / 100
                },

                // Performance indicators
                performance: {
                    score: score,
                    grade: this._getGrade(score),
                    trend: trend,
                    lifecycle: lifecycle,
                    priceElasticity: priceElasticity
                },

                // Recommendations
                recommendations: this._generateRecommendations({
                    score,
                    grossMargin,
                    turnoverRate,
                    trend,
                    lifecycle,
                    daysOfInventory
                })
            }
        };
    }

    /**
     * Perform ABC classification (Pareto analysis)
     * @param {string} period - Period for analysis
     * @param {string} metric - Metric to use ('revenue', 'profit', 'units')
     * @returns {Object} ABC classification
     */
    performABCAnalysis(period = 'month', metric = 'revenue') {
        const allProducts = this.productService.getAllProducts();
        const dateRange = this._parsePeriod(period);

        // Calculate metric for each product
        const productMetrics = allProducts.map(product => {
            const sales = this._getProductSales(product.id, dateRange);

            let value;
            if (metric === 'revenue') {
                value = sales.reduce((sum, s) => sum + s.itemTotal, 0);
            } else if (metric === 'profit') {
                const revenue = sales.reduce((sum, s) => sum + s.itemTotal, 0);
                const cost = sales.reduce((sum, s) => sum + s.quantity, 0) * (product.cost || product.price * 0.6);
                value = revenue - cost;
            } else if (metric === 'units') {
                value = sales.reduce((sum, s) => sum + s.quantity, 0);
            }

            return {
                productId: product.id,
                productName: product.name,
                value: value,
                currentStock: product.quantity
            };
        });

        // Sort by value descending
        productMetrics.sort((a, b) => b.value - a.value);

        // Calculate cumulative percentage
        const totalValue = productMetrics.reduce((sum, p) => sum + p.value, 0);
        let cumulativeValue = 0;
        let cumulativePercent = 0;

        const classified = productMetrics.map((product, index) => {
            cumulativeValue += product.value;
            cumulativePercent = (cumulativeValue / totalValue) * 100;

            let category;
            if (cumulativePercent <= 80) {
                category = 'A'; // Top 80% of value
            } else if (cumulativePercent <= 95) {
                category = 'B'; // Next 15% of value
            } else {
                category = 'C'; // Bottom 5% of value
            }

            return {
                ...product,
                rank: index + 1,
                category: category,
                percentOfTotal: Math.round((product.value / totalValue) * 10000) / 100,
                cumulativePercent: Math.round(cumulativePercent * 100) / 100,
                value: Math.round(product.value * 100) / 100
            };
        });

        const categoryA = classified.filter(p => p.category === 'A');
        const categoryB = classified.filter(p => p.category === 'B');
        const categoryC = classified.filter(p => p.category === 'C');

        return {
            success: true,
            analysis: {
                period: period,
                metric: metric,
                totalProducts: classified.length,
                totalValue: Math.round(totalValue * 100) / 100,

                summary: {
                    categoryA: {
                        count: categoryA.length,
                        percent: Math.round((categoryA.length / classified.length) * 10000) / 100,
                        value: Math.round(categoryA.reduce((sum, p) => sum + p.value, 0) * 100) / 100,
                        valuePercent: Math.round((categoryA.reduce((sum, p) => sum + p.value, 0) / totalValue) * 10000) / 100
                    },
                    categoryB: {
                        count: categoryB.length,
                        percent: Math.round((categoryB.length / classified.length) * 10000) / 100,
                        value: Math.round(categoryB.reduce((sum, p) => sum + p.value, 0) * 100) / 100,
                        valuePercent: Math.round((categoryB.reduce((sum, p) => sum + p.value, 0) / totalValue) * 10000) / 100
                    },
                    categoryC: {
                        count: categoryC.length,
                        percent: Math.round((categoryC.length / classified.length) * 10000) / 100,
                        value: Math.round(categoryC.reduce((sum, p) => sum + p.value, 0) * 100) / 100,
                        valuePercent: Math.round((categoryC.reduce((sum, p) => sum + p.value, 0) / totalValue) * 10000) / 100
                    }
                },

                products: classified,

                recommendations: this._generateABCRecommendations(categoryA, categoryB, categoryC)
            }
        };
    }

    /**
     * Analyze cross-sell and upsell opportunities
     * @param {number} productId - Product ID
     * @param {number} minConfidence - Minimum confidence threshold (0-1)
     * @returns {Object} Cross-sell analysis
     */
    analyzeCrossSell(productId, minConfidence = 0.1) {
        const product = this.productService.getProductById(productId);

        if (!product) {
            return {
                success: false,
                errors: ['Продуктът не е намерен']
            };
        }

        // Get all sales containing this product
        const allSales = this.salesService.getAllSales();
        const salesWithProduct = allSales.filter(sale =>
            sale.items.some(item => item.productId === productId)
        );

        // Count co-occurrences
        const coOccurrences = {};
        salesWithProduct.forEach(sale => {
            sale.items.forEach(item => {
                if (item.productId !== productId) {
                    if (!coOccurrences[item.productId]) {
                        coOccurrences[item.productId] = {
                            productId: item.productId,
                            productName: item.productName,
                            count: 0,
                            totalRevenue: 0
                        };
                    }
                    coOccurrences[item.productId].count++;
                    coOccurrences[item.productId].totalRevenue += item.price * item.quantity;
                }
            });
        });

        // Calculate confidence and lift
        const totalSales = allSales.length;
        const productSalesCount = salesWithProduct.length;
        const productSupport = productSalesCount / totalSales;

        const crossSellOpportunities = Object.values(coOccurrences).map(coProduct => {
            const coProductSales = allSales.filter(sale =>
                sale.items.some(item => item.productId === coProduct.productId)
            ).length;

            const confidence = coProduct.count / productSalesCount; // P(B|A)
            const support = coProductSales / totalSales; // P(B)
            const lift = support > 0 ? confidence / support : 0;

            return {
                ...coProduct,
                occurrences: coProduct.count,
                confidence: Math.round(confidence * 10000) / 100,
                support: Math.round(support * 10000) / 100,
                lift: Math.round(lift * 100) / 100,
                avgRevenuePerOccurrence: Math.round((coProduct.totalRevenue / coProduct.count) * 100) / 100
            };
        });

        // Filter by minimum confidence and sort by lift
        const opportunities = crossSellOpportunities
            .filter(opp => opp.confidence >= (minConfidence * 100))
            .sort((a, b) => b.lift - a.lift);

        return {
            success: true,
            crossSell: {
                productId: productId,
                productName: product.name,
                totalSalesWithProduct: productSalesCount,
                opportunities: opportunities.slice(0, 10), // Top 10
                recommendations: this._generateCrossSellRecommendations(opportunities)
            }
        };
    }

    /**
     * Calculate price elasticity of demand
     * @param {number} productId - Product ID
     * @param {string} period - Period for analysis
     * @returns {Object} Price elasticity analysis
     */
    analyzePriceElasticity(productId, period = 'quarter') {
        const product = this.productService.getProductById(productId);

        if (!product) {
            return {
                success: false,
                errors: ['Продуктът не е намерен']
            };
        }

        const dateRange = this._parsePeriod(period);
        const sales = this._getProductSales(productId, dateRange);

        // Group sales by price point
        const pricePoints = {};
        sales.forEach(sale => {
            const price = sale.price;
            if (!pricePoints[price]) {
                pricePoints[price] = {
                    price: price,
                    quantity: 0,
                    revenue: 0,
                    transactions: 0
                };
            }
            pricePoints[price].quantity += sale.quantity;
            pricePoints[price].revenue += sale.itemTotal;
            pricePoints[price].transactions++;
        });

        const priceData = Object.values(pricePoints).sort((a, b) => a.price - b.price);

        if (priceData.length < 2) {
            return {
                success: true,
                elasticity: {
                    productId: productId,
                    productName: product.name,
                    currentPrice: product.price,
                    elasticity: null,
                    classification: 'insufficient_data',
                    message: 'Недостатъчно ценови точки за анализ'
                }
            };
        }

        // Calculate elasticity between consecutive price points
        const elasticityValues = [];
        for (let i = 1; i < priceData.length; i++) {
            const p1 = priceData[i - 1];
            const p2 = priceData[i];

            const priceChange = ((p2.price - p1.price) / p1.price) * 100;
            const quantityChange = ((p2.quantity - p1.quantity) / p1.quantity) * 100;

            if (priceChange !== 0) {
                const elasticity = quantityChange / priceChange;
                elasticityValues.push({
                    fromPrice: p1.price,
                    toPrice: p2.price,
                    elasticity: elasticity
                });
            }
        }

        // Average elasticity
        const avgElasticity = elasticityValues.length > 0
            ? elasticityValues.reduce((sum, e) => sum + e.elasticity, 0) / elasticityValues.length
            : 0;

        // Classify demand
        let classification;
        let interpretation;
        if (Math.abs(avgElasticity) > 1) {
            classification = 'elastic';
            interpretation = 'Търсенето е еластично - клиентите са чувствителни към промяна на цената';
        } else if (Math.abs(avgElasticity) < 1 && Math.abs(avgElasticity) > 0.1) {
            classification = 'inelastic';
            interpretation = 'Търсенето е нееластично - клиентите са по-малко чувствителни към цената';
        } else {
            classification = 'unit_elastic';
            interpretation = 'Търсенето е единично еластично - промяната в цената води до пропорционална промяна в количеството';
        }

        // Optimal price recommendation
        const optimalPrice = this._calculateOptimalPrice(priceData, avgElasticity);

        return {
            success: true,
            elasticity: {
                productId: productId,
                productName: product.name,
                currentPrice: product.price,
                elasticity: Math.round(avgElasticity * 1000) / 1000,
                classification: classification,
                interpretation: interpretation,
                pricePoints: priceData.map(p => ({
                    price: p.price,
                    quantity: p.quantity,
                    revenue: Math.round(p.revenue * 100) / 100
                })),
                optimalPrice: optimalPrice,
                potentialRevenueGain: this._calculateRevenueGain(product.price, optimalPrice, priceData)
            }
        };
    }

    /**
     * Get SKU rationalization recommendations
     * @param {Object} criteria - Criteria for rationalization
     * @returns {Object} SKU recommendations
     */
    getSKURationalization(criteria = {}) {
        const {
            minTurnover = 2, // Minimum acceptable turnover rate
            minMargin = 15, // Minimum acceptable gross margin %
            maxDaysOfInventory = 90,
            period = 'quarter'
        } = criteria;

        const allProducts = this.productService.getAllProducts();
        const dateRange = this._parsePeriod(period);

        const analysis = allProducts.map(product => {
            const sales = this._getProductSales(product.id, dateRange);
            const totalUnits = sales.reduce((sum, s) => sum + s.quantity, 0);
            const totalRevenue = sales.reduce((sum, s) => sum + s.itemTotal, 0);
            const totalCost = totalUnits * (product.cost || product.price * 0.6);
            const grossProfit = totalRevenue - totalCost;
            const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

            const stockValue = product.quantity * (product.cost || product.price * 0.6);
            const turnoverRate = stockValue > 0 ? totalCost / stockValue : 0;
            const daysOfInventory = turnoverRate > 0 ? 365 / turnoverRate : Infinity;

            let recommendation;
            const reasons = [];

            if (totalUnits === 0) {
                recommendation = 'discontinue';
                reasons.push('Няма продажби');
            } else if (turnoverRate < minTurnover) {
                recommendation = 'review';
                reasons.push(`Бавен оборот (${Math.round(turnoverRate * 100) / 100}x)`);
            }

            if (grossMargin < minMargin && totalUnits > 0) {
                recommendation = recommendation === 'discontinue' ? 'discontinue' : 'review';
                reasons.push(`Ниска марж (${Math.round(grossMargin)}%)`);
            }

            if (daysOfInventory > maxDaysOfInventory && totalUnits > 0) {
                recommendation = recommendation === 'discontinue' ? 'discontinue' : 'review';
                reasons.push(`Високи дни на запас (${Math.round(daysOfInventory)})`);
            }

            if (!recommendation) {
                if (grossMargin >= 30 && turnoverRate >= 4) {
                    recommendation = 'promote';
                    reasons.push('Висока рентабилност и оборот');
                } else {
                    recommendation = 'maintain';
                }
            }

            return {
                productId: product.id,
                productName: product.name,
                category: product.category,
                currentStock: product.quantity,
                metrics: {
                    units: totalUnits,
                    revenue: Math.round(totalRevenue * 100) / 100,
                    grossMargin: Math.round(grossMargin * 100) / 100,
                    turnoverRate: Math.round(turnoverRate * 100) / 100,
                    daysOfInventory: Math.round(daysOfInventory)
                },
                recommendation: recommendation,
                reasons: reasons
            };
        });

        const discontinue = analysis.filter(p => p.recommendation === 'discontinue');
        const review = analysis.filter(p => p.recommendation === 'review');
        const maintain = analysis.filter(p => p.recommendation === 'maintain');
        const promote = analysis.filter(p => p.recommendation === 'promote');

        return {
            success: true,
            rationalization: {
                period: period,
                criteria: criteria,
                totalProducts: analysis.length,

                summary: {
                    discontinue: {
                        count: discontinue.length,
                        products: discontinue
                    },
                    review: {
                        count: review.length,
                        products: review
                    },
                    maintain: {
                        count: maintain.length,
                        products: maintain
                    },
                    promote: {
                        count: promote.length,
                        products: promote
                    }
                },

                potentialSavings: this._calculateRationalizationSavings(discontinue, review)
            }
        };
    }

    // ============ PRIVATE METHODS ============

    _getProductSales(productId, dateRange) {
        const allSales = this.salesService.getAllSales();
        const sales = [];

        allSales.forEach(sale => {
            if (dateRange && (new Date(sale.date) < dateRange.start || new Date(sale.date) > dateRange.end)) {
                return;
            }

            sale.items.forEach(item => {
                if (item.productId === productId) {
                    sales.push({
                        saleId: sale.id,
                        date: sale.date,
                        productId: item.productId,
                        productName: item.productName,
                        quantity: item.quantity,
                        price: item.price,
                        itemTotal: item.price * item.quantity,
                        customerId: sale.customerId
                    });
                }
            });
        });

        return sales;
    }

    _parsePeriod(period) {
        const now = new Date();
        let start;

        if (period === 'week') {
            start = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
        } else if (period === 'month') {
            start = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
        } else if (period === 'quarter') {
            start = new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000));
        } else if (period === 'year') {
            start = new Date(now.getTime() - (365 * 24 * 60 * 60 * 1000));
        } else {
            start = new Date(0);
        }

        return { start, end: now };
    }

    _getDaysInPeriod(period) {
        if (period === 'week') return 7;
        if (period === 'month') return 30;
        if (period === 'quarter') return 90;
        if (period === 'year') return 365;
        return 30;
    }

    _calculateRepeatRate(productId, dateRange) {
        const sales = this._getProductSales(productId, dateRange);
        const customerPurchases = {};

        sales.forEach(sale => {
            if (sale.customerId) {
                customerPurchases[sale.customerId] = (customerPurchases[sale.customerId] || 0) + 1;
            }
        });

        const customers = Object.keys(customerPurchases);
        const repeatCustomers = customers.filter(c => customerPurchases[c] > 1);

        return customers.length > 0 ? (repeatCustomers.length / customers.length) * 100 : 0;
    }

    _calculateTrend(productId, period) {
        // Simple trend: compare first half vs second half of period
        const dateRange = this._parsePeriod(period);
        const midPoint = new Date((dateRange.start.getTime() + dateRange.end.getTime()) / 2);

        const firstHalf = this._getProductSales(productId, { start: dateRange.start, end: midPoint });
        const secondHalf = this._getProductSales(productId, { start: midPoint, end: dateRange.end });

        const firstHalfUnits = firstHalf.reduce((sum, s) => sum + s.quantity, 0);
        const secondHalfUnits = secondHalf.reduce((sum, s) => sum + s.quantity, 0);

        if (firstHalfUnits === 0) return 'new';

        const change = ((secondHalfUnits - firstHalfUnits) / firstHalfUnits) * 100;

        if (change > 20) return 'growing';
        if (change < -20) return 'declining';
        return 'stable';
    }

    _calculatePriceElasticity(productId, dateRange) {
        const sales = this._getProductSales(productId, dateRange);

        if (sales.length < 5) return 'insufficient_data';

        const prices = [...new Set(sales.map(s => s.price))];

        if (prices.length < 2) return 'no_variation';

        return 'normal';
    }

    _detectLifecycleStage(productId) {
        const allTimeSales = this._getProductSales(productId, null);

        if (allTimeSales.length === 0) return 'inactive';

        // Check first sale date
        const firstSale = new Date(Math.min(...allTimeSales.map(s => new Date(s.date))));
        const daysSinceFirstSale = (new Date() - firstSale) / (1000 * 60 * 60 * 24);

        // Check recent sales trend
        const recentSales = this._getProductSales(productId, this._parsePeriod('month'));
        const recentUnits = recentSales.reduce((sum, s) => sum + s.quantity, 0);

        if (daysSinceFirstSale < 30) return 'introduction';
        if (recentUnits > 10 && daysSinceFirstSale < 90) return 'growth';
        if (recentUnits > 5) return 'maturity';
        if (recentUnits < 2) return 'decline';

        return 'maturity';
    }

    _calculatePerformanceScore(metrics) {
        let score = 50; // Base score

        // Gross margin contribution (max 25 points)
        if (metrics.grossMargin > 40) score += 25;
        else if (metrics.grossMargin > 30) score += 20;
        else if (metrics.grossMargin > 20) score += 15;
        else if (metrics.grossMargin > 10) score += 10;

        // Sales velocity (max 15 points)
        if (metrics.salesPerDay > 10) score += 15;
        else if (metrics.salesPerDay > 5) score += 10;
        else if (metrics.salesPerDay > 1) score += 5;

        // Inventory turnover (max 15 points)
        if (metrics.turnoverRate > 6) score += 15;
        else if (metrics.turnoverRate > 4) score += 10;
        else if (metrics.turnoverRate > 2) score += 5;

        // Trend bonus/penalty (±10 points)
        if (metrics.trend === 'growing') score += 10;
        else if (metrics.trend === 'declining') score -= 10;

        // Lifecycle adjustment (±5 points)
        if (metrics.lifecycle === 'growth') score += 5;
        else if (metrics.lifecycle === 'decline') score -= 5;

        return Math.max(0, Math.min(100, Math.round(score)));
    }

    _getGrade(score) {
        if (score >= 90) return 'A+';
        if (score >= 80) return 'A';
        if (score >= 70) return 'B';
        if (score >= 60) return 'C';
        if (score >= 50) return 'D';
        return 'F';
    }

    _generateRecommendations(metrics) {
        const recommendations = [];

        if (metrics.grossMargin < 20) {
            recommendations.push({
                type: 'pricing',
                priority: 'high',
                message: 'Маржът е нисък. Разгледайте увеличаване на цената или договаряне на по-добри условия с доставчика.'
            });
        }

        if (metrics.turnoverRate < 2) {
            recommendations.push({
                type: 'inventory',
                priority: 'high',
                message: 'Бавен оборот на стоката. Намалете нивата на запаси или планирайте промоции.'
            });
        }

        if (metrics.daysOfInventory > 60) {
            recommendations.push({
                type: 'inventory',
                priority: 'medium',
                message: `Висок брой дни на запас (${metrics.daysOfInventory}). Разгледайте кампания за разпродажба.`
            });
        }

        if (metrics.trend === 'declining') {
            recommendations.push({
                type: 'marketing',
                priority: 'high',
                message: 'Продажбите намаляват. Разгледайте маркетингова кампания или обновяване на продукта.'
            });
        }

        if (metrics.lifecycle === 'decline') {
            recommendations.push({
                type: 'lifecycle',
                priority: 'medium',
                message: 'Продуктът е в етап на спад. Планирайте фазово изключване или обновление.'
            });
        }

        if (metrics.score >= 80) {
            recommendations.push({
                type: 'promotion',
                priority: 'low',
                message: 'Отлични резултати! Разгледайте увеличаване на стоковите наличности и промоция.'
            });
        }

        return recommendations;
    }

    _generateABCRecommendations(categoryA, categoryB, categoryC) {
        const recommendations = [];

        recommendations.push({
            category: 'A',
            message: `Категория A (${categoryA.length} продукта) генерира най-много приходи. Осигурете винаги наличност и оптимални запаси.`,
            actions: ['Приоритетен мониторинг', 'Гарантирана наличност', 'Премиум позициониране']
        });

        recommendations.push({
            category: 'B',
            message: `Категория B (${categoryB.length} продукта) е важна за портфолиото. Поддържайте балансирани запаси.`,
            actions: ['Редовен преглед', 'Стандартно управление', 'Периодични промоции']
        });

        recommendations.push({
            category: 'C',
            message: `Категория C (${categoryC.length} продукта) има нисък принос. Разгледайте оптимизация на асортимента.`,
            actions: ['Намаляване на запасите', 'Разгледайте изключване', 'Минимална инвестиция']
        });

        return recommendations;
    }

    _generateCrossSellRecommendations(opportunities) {
        if (opportunities.length === 0) {
            return [{
                type: 'no_data',
                message: 'Недостатъчно данни за препоръки за кръстосани продажби'
            }];
        }

        const topOpportunities = opportunities.slice(0, 3);
        return topOpportunities.map(opp => ({
            type: 'cross_sell',
            productName: opp.productName,
            confidence: opp.confidence,
            message: `Клиентите често купуват "${opp.productName}" заедно с този продукт (${opp.confidence}% от случаите). Разгледайте комбинирана оферта.`
        }));
    }

    _calculateOptimalPrice(priceData, elasticity) {
        if (priceData.length === 0) return null;

        // Find price point with maximum revenue
        const maxRevenue = priceData.reduce((max, p) => p.revenue > max.revenue ? p : max, priceData[0]);

        return Math.round(maxRevenue.price * 100) / 100;
    }

    _calculateRevenueGain(currentPrice, optimalPrice, priceData) {
        if (!optimalPrice) return 0;

        const currentData = priceData.find(p => p.price === currentPrice);
        const optimalData = priceData.find(p => p.price === optimalPrice);

        if (!currentData || !optimalData) return 0;

        const gain = optimalData.revenue - currentData.revenue;
        return Math.round(gain * 100) / 100;
    }

    _calculateRationalizationSavings(discontinue, review) {
        // Calculate potential savings from discontinuing slow-moving inventory
        const discontinueSavings = discontinue.reduce((sum, p) => {
            return sum + (p.currentStock * (p.metrics.revenue / Math.max(p.metrics.units, 1)) * 0.6);
        }, 0);

        return {
            discontinueSavings: Math.round(discontinueSavings * 100) / 100,
            affectedProducts: discontinue.length + review.length,
            message: 'Освобождаване на капитал чрез намаляване на бавнооборотни стоки'
        };
    }
}
