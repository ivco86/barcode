/**
 * Comparative Period Analysis - v6.0
 * Compare business metrics across different time periods
 */
import { StorageService } from './StorageService.js';

export class ComparativeAnalysisService {
    constructor(salesService, productService, customerService) {
        this.salesService = salesService;
        this.productService = productService;
        this.customerService = customerService;
    }

    /**
     * Compare two periods across all key metrics
     * @param {string} periodType - Type ('month', 'quarter', 'year', 'custom')
     * @param {Object} customDates - For custom periods: { current: {start, end}, previous: {start, end} }
     * @returns {Object} Comparative analysis
     */
    comparePeriods(periodType = 'month', customDates = null) {
        let currentPeriod, previousPeriod;

        if (periodType === 'custom' && customDates) {
            currentPeriod = customDates.current;
            previousPeriod = customDates.previous;
        } else {
            const periods = this._generatePeriods(periodType);
            currentPeriod = periods.current;
            previousPeriod = periods.previous;
        }

        // Sales metrics
        const currentSales = this._getSalesMetrics(currentPeriod);
        const previousSales = this._getSalesMetrics(previousPeriod);

        // Customer metrics
        const currentCustomers = this._getCustomerMetrics(currentPeriod);
        const previousCustomers = this._getCustomerMetrics(previousPeriod);

        // Product metrics
        const currentProducts = this._getProductMetrics(currentPeriod);
        const previousProducts = this._getProductMetrics(previousPeriod);

        // Financial metrics
        const currentFinancials = this._getFinancialMetrics(currentPeriod);
        const previousFinancials = this._getFinancialMetrics(previousPeriod);

        return {
            success: true,
            comparison: {
                periodType: periodType,
                currentPeriod: {
                    start: currentPeriod.start.toISOString().split('T')[0],
                    end: currentPeriod.end.toISOString().split('T')[0]
                },
                previousPeriod: {
                    start: previousPeriod.start.toISOString().split('T')[0],
                    end: previousPeriod.end.toISOString().split('T')[0]
                },

                sales: this._compareMetrics(currentSales, previousSales),
                customers: this._compareMetrics(currentCustomers, previousCustomers),
                products: this._compareMetrics(currentProducts, previousProducts),
                financials: this._compareMetrics(currentFinancials, previousFinancials),

                summary: this._generateSummary(currentSales, previousSales, currentCustomers, previousCustomers),
                insights: this._generateInsights(currentSales, previousSales, currentCustomers, previousCustomers, currentProducts, previousProducts)
            }
        };
    }

    /**
     * Year-over-year comparison
     * @param {number} years - Number of years to compare (default 2)
     * @returns {Object} YoY comparison
     */
    compareYearOverYear(years = 2) {
        const yearlyData = [];

        for (let i = 0; i < years; i++) {
            const yearStart = new Date();
            yearStart.setFullYear(yearStart.getFullYear() - i);
            yearStart.setMonth(0, 1);
            yearStart.setHours(0, 0, 0, 0);

            const yearEnd = new Date(yearStart);
            yearEnd.setFullYear(yearEnd.getFullYear() + 1);
            yearEnd.setTime(yearEnd.getTime() - 1);

            const period = { start: yearStart, end: yearEnd };
            const sales = this._getSalesMetrics(period);
            const customers = this._getCustomerMetrics(period);
            const products = this._getProductMetrics(period);

            yearlyData.push({
                year: yearStart.getFullYear(),
                sales: sales,
                customers: customers,
                products: products
            });
        }

        // Calculate growth rates
        const growthRates = [];
        for (let i = 1; i < yearlyData.length; i++) {
            const current = yearlyData[i - 1];
            const previous = yearlyData[i];

            growthRates.push({
                year: current.year,
                revenueGrowth: this._calculateChange(current.sales.totalRevenue, previous.sales.totalRevenue),
                transactionGrowth: this._calculateChange(current.sales.transactionCount, previous.sales.transactionCount),
                customerGrowth: this._calculateChange(current.customers.activeCustomers, previous.customers.activeCustomers)
            });
        }

        return {
            success: true,
            yoy: {
                years: yearlyData,
                growthRates: growthRates,
                trends: this._analyzeTrends(yearlyData)
            }
        };
    }

    /**
     * Month-over-month comparison for last N months
     * @param {number} months - Number of months to analyze
     * @returns {Object} MoM comparison
     */
    compareMonthOverMonth(months = 6) {
        const monthlyData = [];

        for (let i = 0; i < months; i++) {
            const monthEnd = new Date();
            monthEnd.setMonth(monthEnd.getMonth() - i);
            monthEnd.setDate(0);
            monthEnd.setHours(23, 59, 59, 999);

            const monthStart = new Date(monthEnd);
            monthStart.setDate(1);
            monthStart.setHours(0, 0, 0, 0);

            const period = { start: monthStart, end: monthEnd };
            const sales = this._getSalesMetrics(period);

            monthlyData.push({
                month: monthStart.toLocaleString('bg-BG', { month: 'long', year: 'numeric' }),
                monthNumber: monthStart.getMonth() + 1,
                year: monthStart.getFullYear(),
                revenue: sales.totalRevenue,
                transactions: sales.transactionCount,
                avgTransaction: sales.avgTransactionValue,
                topCategory: sales.topCategory
            });
        }

        // Reverse to chronological order
        monthlyData.reverse();

        // Calculate month-over-month changes
        const momChanges = [];
        for (let i = 1; i < monthlyData.length; i++) {
            const current = monthlyData[i];
            const previous = monthlyData[i - 1];

            momChanges.push({
                month: current.month,
                revenueChange: this._calculateChange(current.revenue, previous.revenue),
                transactionChange: this._calculateChange(current.transactions, previous.transactions),
                avgTransactionChange: this._calculateChange(current.avgTransaction, previous.avgTransaction)
            });
        }

        return {
            success: true,
            mom: {
                monthlyData: monthlyData,
                changes: momChanges,
                trend: this._detectTrend(monthlyData.map(m => m.revenue))
            }
        };
    }

    /**
     * Compare performance by day of week
     * @param {string} period - Period to analyze ('month', 'quarter')
     * @returns {Object} Day of week analysis
     */
    compareDayOfWeek(period = 'month') {
        const dateRange = this._parsePeriod(period);
        const allSales = this._filterByDateRange(this.salesService.getAllSales(), dateRange);

        const dayStats = {
            0: { name: 'Неделя', transactions: 0, revenue: 0, customers: new Set() },
            1: { name: 'Понеделник', transactions: 0, revenue: 0, customers: new Set() },
            2: { name: 'Вторник', transactions: 0, revenue: 0, customers: new Set() },
            3: { name: 'Сряда', transactions: 0, revenue: 0, customers: new Set() },
            4: { name: 'Четвъртък', transactions: 0, revenue: 0, customers: new Set() },
            5: { name: 'Петък', transactions: 0, revenue: 0, customers: new Set() },
            6: { name: 'Събота', transactions: 0, revenue: 0, customers: new Set() }
        };

        const dayCounts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };

        // Count occurrences of each day in period
        let currentDate = new Date(dateRange.start);
        while (currentDate <= dateRange.end) {
            dayCounts[currentDate.getDay()]++;
            currentDate.setDate(currentDate.getDate() + 1);
        }

        allSales.forEach(sale => {
            const dayOfWeek = new Date(sale.date).getDay();
            dayStats[dayOfWeek].transactions++;
            dayStats[dayOfWeek].revenue += sale.total;
            if (sale.customerId) {
                dayStats[dayOfWeek].customers.add(sale.customerId);
            }
        });

        // Calculate averages
        const analysis = Object.keys(dayStats).map(day => {
            const stats = dayStats[day];
            const dayCount = dayCounts[day];

            return {
                day: parseInt(day),
                dayName: stats.name,
                totalTransactions: stats.transactions,
                totalRevenue: Math.round(stats.revenue * 100) / 100,
                avgTransactionsPerDay: dayCount > 0 ? Math.round((stats.transactions / dayCount) * 100) / 100 : 0,
                avgRevenuePerDay: dayCount > 0 ? Math.round((stats.revenue / dayCount) * 100) / 100 : 0,
                uniqueCustomers: stats.customers.size
            };
        });

        // Find best and worst days
        const bestDay = analysis.reduce((max, day) => day.avgRevenuePerDay > max.avgRevenuePerDay ? day : max, analysis[0]);
        const worstDay = analysis.reduce((min, day) => day.avgRevenuePerDay < min.avgRevenuePerDay ? day : min, analysis[0]);

        return {
            success: true,
            dayOfWeek: {
                period: period,
                analysis: analysis,
                insights: {
                    bestDay: bestDay.dayName,
                    bestDayRevenue: bestDay.avgRevenuePerDay,
                    worstDay: worstDay.dayName,
                    worstDayRevenue: worstDay.avgRevenuePerDay,
                    weekendVsWeekday: this._compareWeekendVsWeekday(analysis)
                }
            }
        };
    }

    /**
     * Compare performance by hour of day
     * @param {string} period - Period to analyze
     * @returns {Object} Hour of day analysis
     */
    compareHourOfDay(period = 'month') {
        const dateRange = this._parsePeriod(period);
        const allSales = this._filterByDateRange(this.salesService.getAllSales(), dateRange);

        const hourStats = {};
        for (let i = 0; i < 24; i++) {
            hourStats[i] = { hour: i, transactions: 0, revenue: 0 };
        }

        allSales.forEach(sale => {
            const hour = new Date(sale.date).getHours();
            hourStats[hour].transactions++;
            hourStats[hour].revenue += sale.total;
        });

        const analysis = Object.values(hourStats).map(stats => ({
            hour: stats.hour,
            hourLabel: `${stats.hour.toString().padStart(2, '0')}:00 - ${(stats.hour + 1).toString().padStart(2, '0')}:00`,
            transactions: stats.transactions,
            revenue: Math.round(stats.revenue * 100) / 100,
            avgTransactionValue: stats.transactions > 0 ? Math.round((stats.revenue / stats.transactions) * 100) / 100 : 0
        }));

        // Find peak hours
        const peakHour = analysis.reduce((max, hour) => hour.revenue > max.revenue ? hour : max, analysis[0]);

        return {
            success: true,
            hourOfDay: {
                period: period,
                analysis: analysis,
                insights: {
                    peakHour: peakHour.hourLabel,
                    peakRevenue: peakHour.revenue,
                    peakTransactions: peakHour.transactions,
                    shifts: this._categorizeByShift(analysis)
                }
            }
        };
    }

    /**
     * Compare categories performance
     * @param {string} period - Period to analyze
     * @returns {Object} Category comparison
     */
    compareCategories(period = 'month') {
        const dateRange = this._parsePeriod(period);
        const allSales = this._filterByDateRange(this.salesService.getAllSales(), dateRange);

        const categoryStats = {};

        allSales.forEach(sale => {
            sale.items.forEach(item => {
                const product = this.productService.getProductById(item.productId);
                const category = product ? product.category : 'Некатегоризирани';

                if (!categoryStats[category]) {
                    categoryStats[category] = {
                        category: category,
                        units: 0,
                        revenue: 0,
                        cost: 0,
                        transactions: new Set()
                    };
                }

                categoryStats[category].units += item.quantity;
                categoryStats[category].revenue += item.price * item.quantity;
                categoryStats[category].cost += item.quantity * (product?.cost || item.price * 0.6);
                categoryStats[category].transactions.add(sale.id);
            });
        });

        const analysis = Object.values(categoryStats).map(stats => {
            const profit = stats.revenue - stats.cost;
            const margin = stats.revenue > 0 ? (profit / stats.revenue) * 100 : 0;

            return {
                category: stats.category,
                units: stats.units,
                revenue: Math.round(stats.revenue * 100) / 100,
                cost: Math.round(stats.cost * 100) / 100,
                profit: Math.round(profit * 100) / 100,
                margin: Math.round(margin * 100) / 100,
                transactions: stats.transactions.size,
                avgTransactionValue: stats.transactions.size > 0 ? Math.round((stats.revenue / stats.transactions.size) * 100) / 100 : 0
            };
        });

        // Sort by revenue
        analysis.sort((a, b) => b.revenue - a.revenue);

        // Calculate percentages
        const totalRevenue = analysis.reduce((sum, cat) => sum + cat.revenue, 0);
        analysis.forEach(cat => {
            cat.percentOfTotal = totalRevenue > 0 ? Math.round((cat.revenue / totalRevenue) * 10000) / 100 : 0;
        });

        return {
            success: true,
            categories: {
                period: period,
                analysis: analysis,
                topCategory: analysis[0],
                totalCategories: analysis.length,
                totalRevenue: Math.round(totalRevenue * 100) / 100
            }
        };
    }

    /**
     * Generate executive summary dashboard
     * @param {string} period - Period to analyze
     * @returns {Object} Executive dashboard
     */
    getExecutiveDashboard(period = 'month') {
        const comparison = this.comparePeriods(period);
        const mom = this.compareMonthOverMonth(3);
        const dayOfWeek = this.compareDayOfWeek(period);
        const categories = this.compareCategories(period);

        return {
            success: true,
            dashboard: {
                period: period,
                generatedAt: new Date().toISOString(),

                // Key metrics
                keyMetrics: {
                    revenue: comparison.comparison.sales.current.totalRevenue,
                    revenueChange: comparison.comparison.sales.change.totalRevenue,
                    transactions: comparison.comparison.sales.current.transactionCount,
                    transactionChange: comparison.comparison.sales.change.transactionCount,
                    avgTransaction: comparison.comparison.sales.current.avgTransactionValue,
                    avgTransactionChange: comparison.comparison.sales.change.avgTransactionValue,
                    customers: comparison.comparison.customers.current.activeCustomers,
                    customerChange: comparison.comparison.customers.change.activeCustomers
                },

                // Trends
                trends: {
                    recentMonths: mom.mom.monthlyData.slice(-3),
                    trend: mom.mom.trend
                },

                // Top performers
                topPerformers: {
                    bestDay: dayOfWeek.dayOfWeek.insights.bestDay,
                    topCategory: categories.categories.topCategory.category,
                    topCategoryRevenue: categories.categories.topCategory.revenue
                },

                // Insights
                insights: comparison.comparison.insights,

                // Alerts
                alerts: this._generateAlerts(comparison.comparison)
            }
        };
    }

    // ============ PRIVATE METHODS ============

    _generatePeriods(periodType) {
        const now = new Date();
        let currentStart, currentEnd, previousStart, previousEnd;

        if (periodType === 'month') {
            // Current month
            currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
            currentEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

            // Previous month
            previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            previousEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

        } else if (periodType === 'quarter') {
            // Current quarter
            const currentQuarter = Math.floor(now.getMonth() / 3);
            currentStart = new Date(now.getFullYear(), currentQuarter * 3, 1);
            currentEnd = new Date(now.getFullYear(), (currentQuarter + 1) * 3, 0, 23, 59, 59, 999);

            // Previous quarter
            const previousQuarter = currentQuarter - 1;
            if (previousQuarter < 0) {
                previousStart = new Date(now.getFullYear() - 1, 9, 1);
                previousEnd = new Date(now.getFullYear() - 1, 12, 0, 23, 59, 59, 999);
            } else {
                previousStart = new Date(now.getFullYear(), previousQuarter * 3, 1);
                previousEnd = new Date(now.getFullYear(), (previousQuarter + 1) * 3, 0, 23, 59, 59, 999);
            }

        } else if (periodType === 'year') {
            // Current year
            currentStart = new Date(now.getFullYear(), 0, 1);
            currentEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);

            // Previous year
            previousStart = new Date(now.getFullYear() - 1, 0, 1);
            previousEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
        }

        return {
            current: { start: currentStart, end: currentEnd },
            previous: { start: previousStart, end: previousEnd }
        };
    }

    _getSalesMetrics(period) {
        const sales = this._filterByDateRange(this.salesService.getAllSales(), period);

        const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0);
        const transactionCount = sales.length;
        const avgTransactionValue = transactionCount > 0 ? totalRevenue / transactionCount : 0;

        // Calculate by category
        const categoryRevenue = {};
        sales.forEach(sale => {
            sale.items.forEach(item => {
                const product = this.productService.getProductById(item.productId);
                const category = product ? product.category : 'Other';
                categoryRevenue[category] = (categoryRevenue[category] || 0) + (item.price * item.quantity);
            });
        });

        const topCategory = Object.keys(categoryRevenue).reduce((max, cat) =>
            categoryRevenue[cat] > (categoryRevenue[max] || 0) ? cat : max, ''
        );

        return {
            totalRevenue: Math.round(totalRevenue * 100) / 100,
            transactionCount: transactionCount,
            avgTransactionValue: Math.round(avgTransactionValue * 100) / 100,
            topCategory: topCategory,
            topCategoryRevenue: categoryRevenue[topCategory] || 0
        };
    }

    _getCustomerMetrics(period) {
        const sales = this._filterByDateRange(this.salesService.getAllSales(), period);
        const customerIds = new Set(sales.map(s => s.customerId).filter(c => c));

        const newCustomers = new Set();
        customerIds.forEach(customerId => {
            const customerSales = this.salesService.getAllSales().filter(s => s.customerId === customerId);
            const firstSale = new Date(Math.min(...customerSales.map(s => new Date(s.date))));
            if (firstSale >= period.start && firstSale <= period.end) {
                newCustomers.add(customerId);
            }
        });

        return {
            activeCustomers: customerIds.size,
            newCustomers: newCustomers.size,
            returningCustomers: customerIds.size - newCustomers.size
        };
    }

    _getProductMetrics(period) {
        const sales = this._filterByDateRange(this.salesService.getAllSales(), period);
        const productsSold = new Set();
        let totalUnits = 0;

        sales.forEach(sale => {
            sale.items.forEach(item => {
                productsSold.add(item.productId);
                totalUnits += item.quantity;
            });
        });

        return {
            uniqueProductsSold: productsSold.size,
            totalUnitsSold: totalUnits,
            avgUnitsPerTransaction: sales.length > 0 ? Math.round((totalUnits / sales.length) * 100) / 100 : 0
        };
    }

    _getFinancialMetrics(period) {
        const sales = this._filterByDateRange(this.salesService.getAllSales(), period);

        let totalCost = 0;
        let totalRevenue = 0;

        sales.forEach(sale => {
            totalRevenue += sale.total;
            sale.items.forEach(item => {
                const product = this.productService.getProductById(item.productId);
                const cost = product?.cost || item.price * 0.6;
                totalCost += cost * item.quantity;
            });
        });

        const grossProfit = totalRevenue - totalCost;
        const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

        return {
            totalRevenue: Math.round(totalRevenue * 100) / 100,
            totalCost: Math.round(totalCost * 100) / 100,
            grossProfit: Math.round(grossProfit * 100) / 100,
            grossMargin: Math.round(grossMargin * 100) / 100
        };
    }

    _compareMetrics(current, previous) {
        const comparison = {
            current: current,
            previous: previous,
            change: {},
            changePercent: {}
        };

        Object.keys(current).forEach(key => {
            if (typeof current[key] === 'number' && typeof previous[key] === 'number') {
                const change = current[key] - previous[key];
                const changePercent = previous[key] !== 0 ? (change / previous[key]) * 100 : 0;

                comparison.change[key] = Math.round(change * 100) / 100;
                comparison.changePercent[key] = Math.round(changePercent * 100) / 100;
            }
        });

        return comparison;
    }

    _calculateChange(current, previous) {
        if (previous === 0) return current > 0 ? 100 : 0;
        return Math.round(((current - previous) / previous) * 10000) / 100;
    }

    _filterByDateRange(sales, dateRange) {
        return sales.filter(sale => {
            const saleDate = new Date(sale.date);
            return saleDate >= dateRange.start && saleDate <= dateRange.end;
        });
    }

    _parsePeriod(period) {
        const now = new Date();
        let start;

        if (period === 'week') {
            start = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
        } else if (period === 'month') {
            start = new Date(now.getFullYear(), now.getMonth(), 1);
        } else if (period === 'quarter') {
            const currentQuarter = Math.floor(now.getMonth() / 3);
            start = new Date(now.getFullYear(), currentQuarter * 3, 1);
        } else if (period === 'year') {
            start = new Date(now.getFullYear(), 0, 1);
        } else {
            start = new Date(0);
        }

        return { start, end: now };
    }

    _generateSummary(currentSales, previousSales, currentCustomers, previousCustomers) {
        const revenueChange = this._calculateChange(currentSales.totalRevenue, previousSales.totalRevenue);
        const customerChange = this._calculateChange(currentCustomers.activeCustomers, previousCustomers.activeCustomers);

        let performance;
        if (revenueChange > 10) performance = 'excellent';
        else if (revenueChange > 0) performance = 'good';
        else if (revenueChange > -10) performance = 'declining';
        else performance = 'poor';

        return {
            performance: performance,
            revenueChange: revenueChange,
            customerChange: customerChange,
            message: this._getSummaryMessage(revenueChange, customerChange)
        };
    }

    _getSummaryMessage(revenueChange, customerChange) {
        if (revenueChange > 10 && customerChange > 5) {
            return 'Отличен растеж! Приходите и клиентската база нарастват значително.';
        } else if (revenueChange > 0) {
            return 'Положителен растеж. Бизнесът се развива в правилната посока.';
        } else if (revenueChange > -10) {
            return 'Леко намаление. Обърнете внимание на тенденциите.';
        } else {
            return 'Значително намаление. Необходими са спешни мерки.';
        }
    }

    _generateInsights(currentSales, previousSales, currentCustomers, previousCustomers, currentProducts, previousProducts) {
        const insights = [];

        // Revenue insights
        const revenueChange = this._calculateChange(currentSales.totalRevenue, previousSales.totalRevenue);
        if (revenueChange > 20) {
            insights.push({
                type: 'positive',
                metric: 'revenue',
                message: `Приходите са нараснали с ${Math.round(revenueChange)}% - забележително постижение!`
            });
        } else if (revenueChange < -15) {
            insights.push({
                type: 'warning',
                metric: 'revenue',
                message: `Приходите са намалели с ${Math.abs(Math.round(revenueChange))}% - необходими са коригиращи действия.`
            });
        }

        // Customer insights
        const customerChange = this._calculateChange(currentCustomers.activeCustomers, previousCustomers.activeCustomers);
        if (customerChange > 15) {
            insights.push({
                type: 'positive',
                metric: 'customers',
                message: `Клиентската база се е увеличила с ${Math.round(customerChange)}%.`
            });
        } else if (customerChange < 0) {
            insights.push({
                type: 'warning',
                metric: 'customers',
                message: 'Намаление на активните клиенти - фокусирайте се върху задържането.'
            });
        }

        // Transaction value insights
        const avgTransactionChange = this._calculateChange(currentSales.avgTransactionValue, previousSales.avgTransactionValue);
        if (avgTransactionChange > 10) {
            insights.push({
                type: 'positive',
                metric: 'avgTransaction',
                message: 'Средната стойност на покупка нараства - успешен upselling.'
            });
        }

        return insights;
    }

    _analyzeTrends(yearlyData) {
        if (yearlyData.length < 2) return 'insufficient_data';

        const revenues = yearlyData.map(y => y.sales.totalRevenue).reverse();
        let increasing = 0;
        let decreasing = 0;

        for (let i = 1; i < revenues.length; i++) {
            if (revenues[i] > revenues[i - 1]) increasing++;
            if (revenues[i] < revenues[i - 1]) decreasing++;
        }

        if (increasing > decreasing) return 'growing';
        if (decreasing > increasing) return 'declining';
        return 'stable';
    }

    _detectTrend(values) {
        if (values.length < 3) return 'insufficient_data';

        let increases = 0;
        let decreases = 0;

        for (let i = 1; i < values.length; i++) {
            if (values[i] > values[i - 1]) increases++;
            if (values[i] < values[i - 1]) decreases++;
        }

        if (increases > decreases * 1.5) return 'strong_growth';
        if (increases > decreases) return 'growth';
        if (decreases > increases * 1.5) return 'strong_decline';
        if (decreases > increases) return 'decline';
        return 'stable';
    }

    _compareWeekendVsWeekday(analysis) {
        const weekend = analysis.filter(d => d.day === 0 || d.day === 6);
        const weekday = analysis.filter(d => d.day >= 1 && d.day <= 5);

        const weekendRevenue = weekend.reduce((sum, d) => sum + d.avgRevenuePerDay, 0) / weekend.length;
        const weekdayRevenue = weekday.reduce((sum, d) => sum + d.avgRevenuePerDay, 0) / weekday.length;

        const difference = ((weekendRevenue - weekdayRevenue) / weekdayRevenue) * 100;

        return {
            weekendAvg: Math.round(weekendRevenue * 100) / 100,
            weekdayAvg: Math.round(weekdayRevenue * 100) / 100,
            difference: Math.round(difference * 100) / 100,
            better: weekendRevenue > weekdayRevenue ? 'weekend' : 'weekday'
        };
    }

    _categorizeByShift(hourlyAnalysis) {
        const morning = hourlyAnalysis.filter(h => h.hour >= 6 && h.hour < 12);
        const afternoon = hourlyAnalysis.filter(h => h.hour >= 12 && h.hour < 18);
        const evening = hourlyAnalysis.filter(h => h.hour >= 18 && h.hour < 22);

        return {
            morning: {
                revenue: Math.round(morning.reduce((sum, h) => sum + h.revenue, 0) * 100) / 100,
                transactions: morning.reduce((sum, h) => sum + h.transactions, 0)
            },
            afternoon: {
                revenue: Math.round(afternoon.reduce((sum, h) => sum + h.revenue, 0) * 100) / 100,
                transactions: afternoon.reduce((sum, h) => sum + h.transactions, 0)
            },
            evening: {
                revenue: Math.round(evening.reduce((sum, h) => sum + h.revenue, 0) * 100) / 100,
                transactions: evening.reduce((sum, h) => sum + h.transactions, 0)
            }
        };
    }

    _generateAlerts(comparison) {
        const alerts = [];

        // Revenue alert
        if (comparison.sales.changePercent.totalRevenue < -20) {
            alerts.push({
                severity: 'critical',
                type: 'revenue',
                message: `КРИТИЧНО: Приходите са спаднали с ${Math.abs(Math.round(comparison.sales.changePercent.totalRevenue))}%`
            });
        } else if (comparison.sales.changePercent.totalRevenue < -10) {
            alerts.push({
                severity: 'warning',
                type: 'revenue',
                message: `ВНИМАНИЕ: Приходите са намалели с ${Math.abs(Math.round(comparison.sales.changePercent.totalRevenue))}%`
            });
        }

        // Transaction alert
        if (comparison.sales.changePercent.transactionCount < -15) {
            alerts.push({
                severity: 'warning',
                type: 'transactions',
                message: 'Значително намаление на броя транзакции'
            });
        }

        // Customer alert
        if (comparison.customers.changePercent.activeCustomers < -10) {
            alerts.push({
                severity: 'warning',
                type: 'customers',
                message: 'Намаление на активните клиенти'
            });
        }

        // Positive alerts
        if (comparison.sales.changePercent.totalRevenue > 30) {
            alerts.push({
                severity: 'info',
                type: 'revenue',
                message: `ОТЛИЧНО: Приходите са нараснали с ${Math.round(comparison.sales.changePercent.totalRevenue)}%!`
            });
        }

        return alerts;
    }
}
