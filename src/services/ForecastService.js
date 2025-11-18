/**
 * AI Sales Forecasting Service - v4.0
 * Predicts future sales using statistical algorithms and historical data
 */
import { ValidationService } from './ValidationService.js';

export class ForecastService {
    constructor(salesService, productService) {
        this.salesService = salesService;
        this.productService = productService;
    }

    /**
     * Predict sales for a given period using moving average
     * @param {number} days - Number of days to predict
     * @param {number} historicalDays - Days of historical data to analyze (default 30)
     * @returns {Object} Prediction results
     */
    predictSales(days = 7, historicalDays = 30) {
        const allSales = this.salesService.getAllSales();

        if (allSales.length === 0) {
            return {
                success: false,
                errors: ['Няма достатъчно данни за прогноза']
            };
        }

        const now = new Date();
        const historicalStart = new Date(now.getTime() - (historicalDays * 24 * 60 * 60 * 1000));

        // Filter historical sales
        const historicalSales = allSales.filter(sale => {
            const saleDate = new Date(sale.date);
            return saleDate >= historicalStart && saleDate <= now;
        });

        if (historicalSales.length < 3) {
            return {
                success: false,
                errors: ['Недостатъчно исторически данни (минимум 3 продажби)']
            };
        }

        // Calculate daily sales totals
        const dailySales = this._groupSalesByDay(historicalSales);
        const dailyTotals = Object.values(dailySales).map(sales =>
            sales.reduce((sum, sale) => sum + sale.total, 0)
        );

        // Calculate moving average
        const movingAverage = this._calculateMovingAverage(dailyTotals, Math.min(7, dailyTotals.length));

        // Detect trend
        const trend = this._calculateTrend(dailyTotals);

        // Generate predictions
        const predictions = [];
        for (let i = 1; i <= days; i++) {
            const predictedDate = new Date(now.getTime() + (i * 24 * 60 * 60 * 1000));
            const dayOfWeek = predictedDate.getDay();

            // Apply weekly seasonality factor
            const seasonalityFactor = this._getSeasonalityFactor(dailySales, dayOfWeek);

            // Base prediction + trend + seasonality
            const basePrediction = movingAverage;
            const trendAdjustment = trend * i;
            const prediction = (basePrediction + trendAdjustment) * seasonalityFactor;

            predictions.push({
                date: predictedDate.toISOString().split('T')[0],
                dayOfWeek: ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'][dayOfWeek],
                predictedSales: Math.max(0, Math.round(prediction * 100) / 100),
                confidence: this._calculateConfidence(dailyTotals)
            });
        }

        // Calculate total predicted revenue
        const totalPredicted = predictions.reduce((sum, p) => sum + p.predictedSales, 0);

        return {
            success: true,
            forecast: {
                period: `${days} дни`,
                historicalDays: historicalDays,
                historicalSalesCount: historicalSales.length,
                averageDailySales: Math.round(movingAverage * 100) / 100,
                trend: trend > 0 ? 'нагоре' : trend < 0 ? 'надолу' : 'стабилна',
                trendValue: Math.round(trend * 100) / 100,
                totalPredicted: Math.round(totalPredicted * 100) / 100,
                predictions: predictions
            }
        };
    }

    /**
     * Analyze seasonal patterns (day of week, time of day)
     * @returns {Object} Seasonality analysis
     */
    analyzeSeasonalPatterns() {
        const allSales = this.salesService.getAllSales();

        if (allSales.length < 7) {
            return {
                success: false,
                errors: ['Недостатъчно данни за анализ на сезонност (минимум 7 продажби)']
            };
        }

        // Group by day of week
        const byDayOfWeek = {
            0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: []
        };

        // Group by hour
        const byHour = {};
        for (let i = 0; i < 24; i++) {
            byHour[i] = [];
        }

        allSales.forEach(sale => {
            const date = new Date(sale.date);
            const dayOfWeek = date.getDay();
            const hour = date.getHours();

            byDayOfWeek[dayOfWeek].push(sale.total);
            byHour[hour].push(sale.total);
        });

        // Calculate averages
        const dayNames = ['Неделя', 'Понеделник', 'Вторник', 'Сряда', 'Четвъртък', 'Петък', 'Събота'];
        const dayOfWeekStats = Object.keys(byDayOfWeek).map(day => {
            const sales = byDayOfWeek[day];
            const avg = sales.length > 0 ? sales.reduce((a, b) => a + b, 0) / sales.length : 0;
            return {
                day: dayNames[day],
                dayNumber: parseInt(day),
                averageSales: Math.round(avg * 100) / 100,
                salesCount: sales.length
            };
        }).sort((a, b) => b.averageSales - a.averageSales);

        const hourStats = Object.keys(byHour).map(hour => {
            const sales = byHour[hour];
            const avg = sales.length > 0 ? sales.reduce((a, b) => a + b, 0) / sales.length : 0;
            return {
                hour: `${hour}:00`,
                hourNumber: parseInt(hour),
                averageSales: Math.round(avg * 100) / 100,
                salesCount: sales.length
            };
        }).filter(h => h.salesCount > 0).sort((a, b) => b.averageSales - a.averageSales);

        // Find peak times
        const bestDay = dayOfWeekStats[0];
        const worstDay = dayOfWeekStats[dayOfWeekStats.length - 1];
        const peakHours = hourStats.slice(0, 3);

        return {
            success: true,
            patterns: {
                byDayOfWeek: dayOfWeekStats,
                byHour: hourStats,
                insights: {
                    bestDay: {
                        name: bestDay.day,
                        averageSales: bestDay.averageSales
                    },
                    worstDay: {
                        name: worstDay.day,
                        averageSales: worstDay.averageSales
                    },
                    peakHours: peakHours.map(h => ({
                        hour: h.hour,
                        averageSales: h.averageSales
                    })),
                    recommendation: this._generateSeasonalRecommendation(dayOfWeekStats, hourStats)
                }
            }
        };
    }

    /**
     * Generate reorder suggestions based on predicted demand
     * @param {number} daysAhead - Days to predict ahead (default 14)
     * @returns {Object} Reorder suggestions
     */
    generateReorderSuggestions(daysAhead = 14) {
        const products = this.productService.getAllProducts();
        const allSales = this.salesService.getAllSales();

        if (allSales.length === 0) {
            return {
                success: false,
                errors: ['Няма данни за продажби']
            };
        }

        const suggestions = [];
        const now = new Date();
        const lookbackDays = 30;
        const lookbackStart = new Date(now.getTime() - (lookbackDays * 24 * 60 * 60 * 1000));

        // Analyze each product
        products.forEach(product => {
            // Get historical sales for this product
            const productSales = allSales.filter(sale => {
                const saleDate = new Date(sale.date);
                return saleDate >= lookbackStart &&
                       sale.items.some(item => item.productId === product.id);
            });

            if (productSales.length === 0) {
                return; // Skip products with no sales history
            }

            // Calculate total quantity sold
            const totalQuantitySold = productSales.reduce((sum, sale) => {
                const saleItem = sale.items.find(item => item.productId === product.id);
                return sum + (saleItem ? saleItem.quantity : 0);
            }, 0);

            // Calculate average daily demand
            const averageDailyDemand = totalQuantitySold / lookbackDays;

            // Predict demand for next period
            const predictedDemand = Math.ceil(averageDailyDemand * daysAhead);

            // Current stock
            const currentStock = product.stock;

            // Calculate reorder point (including safety stock)
            const safetyStock = Math.ceil(averageDailyDemand * 3); // 3 days safety
            const reorderPoint = predictedDemand + safetyStock;

            // Determine if reorder is needed
            if (currentStock < reorderPoint) {
                const orderQuantity = Math.max(reorderPoint - currentStock, Math.ceil(averageDailyDemand * 7));

                suggestions.push({
                    productId: product.id,
                    productName: product.name,
                    currentStock: currentStock,
                    averageDailyDemand: Math.round(averageDailyDemand * 100) / 100,
                    predictedDemand: predictedDemand,
                    reorderPoint: reorderPoint,
                    suggestedOrderQuantity: orderQuantity,
                    daysUntilStockout: currentStock > 0 ? Math.floor(currentStock / averageDailyDemand) : 0,
                    priority: currentStock === 0 ? 'КРИТИЧНО' :
                             currentStock < safetyStock ? 'ВИСОКО' : 'СРЕДНО'
                });
            }
        });

        // Sort by priority
        const priorityOrder = { 'КРИТИЧНО': 0, 'ВИСОКО': 1, 'СРЕДНО': 2 };
        suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

        return {
            success: true,
            reorderSuggestions: {
                generatedDate: now.toISOString(),
                periodDays: daysAhead,
                totalSuggestions: suggestions.length,
                criticalCount: suggestions.filter(s => s.priority === 'КРИТИЧНО').length,
                highCount: suggestions.filter(s => s.priority === 'ВИСОКО').length,
                suggestions: suggestions
            }
        };
    }

    /**
     * Calculate optimal stock levels for all products
     * @returns {Object} Optimal stock recommendations
     */
    calculateOptimalStock() {
        const products = this.productService.getAllProducts();
        const allSales = this.salesService.getAllSales();

        if (allSales.length === 0) {
            return {
                success: false,
                errors: ['Няма данни за продажби']
            };
        }

        const recommendations = [];
        const lookbackDays = 60;
        const now = new Date();
        const lookbackStart = new Date(now.getTime() - (lookbackDays * 24 * 60 * 60 * 1000));

        products.forEach(product => {
            // Get sales history
            const productSales = allSales.filter(sale => {
                const saleDate = new Date(sale.date);
                return saleDate >= lookbackStart &&
                       sale.items.some(item => item.productId === product.id);
            });

            if (productSales.length === 0) {
                return;
            }

            // Calculate statistics
            const totalQuantitySold = productSales.reduce((sum, sale) => {
                const saleItem = sale.items.find(item => item.productId === product.id);
                return sum + (saleItem ? saleItem.quantity : 0);
            }, 0);

            const averageDailyDemand = totalQuantitySold / lookbackDays;

            // Optimal stock = 14 days demand + safety stock (7 days)
            const optimalStock = Math.ceil(averageDailyDemand * 14 + averageDailyDemand * 7);
            const currentStock = product.stock;
            const difference = currentStock - optimalStock;

            recommendations.push({
                productId: product.id,
                productName: product.name,
                currentStock: currentStock,
                optimalStock: optimalStock,
                difference: difference,
                status: difference > 10 ? 'Надстокиран' :
                       difference < -10 ? 'Недостокиран' : 'Оптимален',
                averageDailyDemand: Math.round(averageDailyDemand * 100) / 100,
                daysOfStock: averageDailyDemand > 0 ? Math.floor(currentStock / averageDailyDemand) : 999
            });
        });

        // Sort by status priority
        const statusOrder = { 'Недостокиран': 0, 'Оптимален': 1, 'Надстокиран': 2 };
        recommendations.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

        return {
            success: true,
            optimalStockLevels: {
                generatedDate: now.toISOString(),
                analyzedProducts: recommendations.length,
                understocked: recommendations.filter(r => r.status === 'Недостокиран').length,
                overstocked: recommendations.filter(r => r.status === 'Надстокиран').length,
                optimal: recommendations.filter(r => r.status === 'Оптимален').length,
                recommendations: recommendations
            }
        };
    }

    /**
     * Get product velocity analysis (ABC analysis)
     * @returns {Object} ABC analysis results
     */
    getProductVelocityAnalysis() {
        const products = this.productService.getAllProducts();
        const allSales = this.salesService.getAllSales();

        if (allSales.length === 0) {
            return {
                success: false,
                errors: ['Няма данни за продажби']
            };
        }

        // Calculate revenue per product
        const productRevenue = {};
        products.forEach(p => {
            productRevenue[p.id] = { product: p, revenue: 0, quantity: 0 };
        });

        allSales.forEach(sale => {
            sale.items.forEach(item => {
                if (productRevenue[item.productId]) {
                    productRevenue[item.productId].revenue += item.price * item.quantity;
                    productRevenue[item.productId].quantity += item.quantity;
                }
            });
        });

        // Sort by revenue
        const sorted = Object.values(productRevenue)
            .filter(pr => pr.revenue > 0)
            .sort((a, b) => b.revenue - a.revenue);

        const totalRevenue = sorted.reduce((sum, pr) => sum + pr.revenue, 0);
        let cumulativeRevenue = 0;

        // Classify into ABC
        const classified = sorted.map(pr => {
            cumulativeRevenue += pr.revenue;
            const revenuePercent = (pr.revenue / totalRevenue) * 100;
            const cumulativePercent = (cumulativeRevenue / totalRevenue) * 100;

            let category = 'C';
            if (cumulativePercent <= 80) category = 'A';
            else if (cumulativePercent <= 95) category = 'B';

            return {
                productId: pr.product.id,
                productName: pr.product.name,
                revenue: Math.round(pr.revenue * 100) / 100,
                quantity: pr.quantity,
                revenuePercent: Math.round(revenuePercent * 100) / 100,
                cumulativePercent: Math.round(cumulativePercent * 100) / 100,
                category: category
            };
        });

        const categoryA = classified.filter(p => p.category === 'A');
        const categoryB = classified.filter(p => p.category === 'B');
        const categoryC = classified.filter(p => p.category === 'C');

        return {
            success: true,
            velocityAnalysis: {
                totalProducts: classified.length,
                totalRevenue: Math.round(totalRevenue * 100) / 100,
                categoryA: {
                    count: categoryA.length,
                    percent: Math.round((categoryA.length / classified.length) * 100),
                    revenue: Math.round(categoryA.reduce((s, p) => s + p.revenue, 0) * 100) / 100,
                    revenuePercent: '0-80%',
                    products: categoryA
                },
                categoryB: {
                    count: categoryB.length,
                    percent: Math.round((categoryB.length / classified.length) * 100),
                    revenue: Math.round(categoryB.reduce((s, p) => s + p.revenue, 0) * 100) / 100,
                    revenuePercent: '80-95%',
                    products: categoryB
                },
                categoryC: {
                    count: categoryC.length,
                    percent: Math.round((categoryC.length / classified.length) * 100),
                    revenue: Math.round(categoryC.reduce((s, p) => s + p.revenue, 0) * 100) / 100,
                    revenuePercent: '95-100%',
                    products: categoryC
                }
            }
        };
    }

    // ============ PRIVATE HELPER METHODS ============

    _groupSalesByDay(sales) {
        const grouped = {};
        sales.forEach(sale => {
            const date = new Date(sale.date).toISOString().split('T')[0];
            if (!grouped[date]) {
                grouped[date] = [];
            }
            grouped[date].push(sale);
        });
        return grouped;
    }

    _calculateMovingAverage(data, period) {
        if (data.length < period) {
            return data.reduce((a, b) => a + b, 0) / data.length;
        }
        const recent = data.slice(-period);
        return recent.reduce((a, b) => a + b, 0) / period;
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

        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        return slope;
    }

    _getSeasonalityFactor(dailySales, dayOfWeek) {
        const days = Object.keys(dailySales);
        const dayTotals = {};

        days.forEach(dateStr => {
            const date = new Date(dateStr);
            const dow = date.getDay();
            if (!dayTotals[dow]) {
                dayTotals[dow] = [];
            }
            const dayTotal = dailySales[dateStr].reduce((sum, sale) => sum + sale.total, 0);
            dayTotals[dow].push(dayTotal);
        });

        const overallAverage = days.reduce((sum, dateStr) => {
            return sum + dailySales[dateStr].reduce((s, sale) => s + sale.total, 0);
        }, 0) / days.length;

        if (!dayTotals[dayOfWeek] || dayTotals[dayOfWeek].length === 0) {
            return 1.0;
        }

        const dayAverage = dayTotals[dayOfWeek].reduce((a, b) => a + b, 0) / dayTotals[dayOfWeek].length;

        return overallAverage > 0 ? dayAverage / overallAverage : 1.0;
    }

    _calculateConfidence(data) {
        if (data.length < 2) return 'Ниска';

        // Calculate coefficient of variation
        const mean = data.reduce((a, b) => a + b, 0) / data.length;
        const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
        const stdDev = Math.sqrt(variance);
        const cv = mean > 0 ? (stdDev / mean) : 1;

        if (cv < 0.3) return 'Висока';
        if (cv < 0.6) return 'Средна';
        return 'Ниска';
    }

    _generateSeasonalRecommendation(dayStats, hourStats) {
        const bestDay = dayStats[0];
        const peakHour = hourStats[0];

        return `Най-добрият ден е ${bestDay.day} (${bestDay.averageSales.toFixed(2)} лв средно). ` +
               `Най-активният час е ${peakHour.hour} (${peakHour.averageSales.toFixed(2)} лв средно). ` +
               `Планирайте персонал и промоции според тези периоди.`;
    }
}
