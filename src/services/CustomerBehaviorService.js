/**
 * Customer Behavior Service - v8.0
 * Анализ на поведението на клиенти
 */
import { StorageService } from './StorageService.js';

export class CustomerBehaviorService {
    constructor(salesService, customerService, productService) {
        this.salesService = salesService;
        this.customerService = customerService;
        this.productService = productService;

        // Store visits tracking (simplified - no actual sensors)
        this.storeVisits = StorageService.get('storeVisits', []);

        // Behavioral patterns cache
        this.patternsCache = {};
    }

    /**
     * Analyze shopping patterns
     * @param {string} period - Period ('today', 'week', 'month')
     * @returns {Object} Shopping patterns
     */
    analyzeShoppingPatterns(period = 'week') {
        const dateRange = this._parsePeriod(period);
        const sales = this._filterByDateRange(this.salesService.getAllSales(), dateRange);

        if (sales.length === 0) {
            return {
                success: true,
                patterns: null,
                message: 'Няма данни за избрания период'
            };
        }

        // Peak hours analysis
        const hourlyDistribution = this._analyzeHourlyDistribution(sales);

        // Day of week analysis
        const dayOfWeekDistribution = this._analyzeDayOfWeekDistribution(sales);

        // Basket analysis
        const basketAnalysis = this._analyzeBasketComposition(sales);

        // Purchase frequency
        const frequencyAnalysis = this._analyzePurchaseFrequency(sales, dateRange);

        return {
            success: true,
            period: period,
            totalSales: sales.length,
            patterns: {
                hourlyDistribution: hourlyDistribution,
                dayOfWeekDistribution: dayOfWeekDistribution,
                basketAnalysis: basketAnalysis,
                frequencyAnalysis: frequencyAnalysis
            }
        };
    }

    /**
     * Basket composition analysis (какво купуват заедно)
     * @param {string} period - Period
     * @returns {Object} Basket analysis
     */
    analyzeBasketComposition(period = 'month') {
        const dateRange = this._parsePeriod(period);
        const sales = this._filterByDateRange(this.salesService.getAllSales(), dateRange);

        const baskets = sales.map(sale => ({
            items: sale.items.map(i => i.productName),
            itemCount: sale.items.length,
            total: sale.total
        }));

        // Average basket size
        const avgItems = baskets.reduce((sum, b) => sum + b.itemCount, 0) / baskets.length;
        const avgValue = baskets.reduce((sum, b) => sum + b.total, 0) / baskets.length;

        // Most common basket sizes
        const basketSizes = {};
        baskets.forEach(b => {
            basketSizes[b.itemCount] = (basketSizes[b.itemCount] || 0) + 1;
        });

        const sortedSizes = Object.keys(basketSizes)
            .map(size => ({
                itemCount: parseInt(size),
                frequency: basketSizes[size],
                percent: Math.round((basketSizes[size] / baskets.length) * 10000) / 100
            }))
            .sort((a, b) => b.frequency - a.frequency);

        // Product combinations (top pairs)
        const combinations = this._findTopCombinations(sales, 10);

        return {
            success: true,
            period: period,
            totalBaskets: baskets.length,
            avgItems: Math.round(avgItems * 100) / 100,
            avgValue: Math.round(avgValue * 100) / 100,
            basketSizeDistribution: sortedSizes,
            topCombinations: combinations
        };
    }

    /**
     * Peak hours heatmap
     * @param {string} period - Period
     * @returns {Object} Peak hours data
     */
    getPeakHours(period = 'month') {
        const dateRange = this._parsePeriod(period);
        const sales = this._filterByDateRange(this.salesService.getAllSales(), dateRange);

        // Create heatmap: day of week × hour of day
        const heatmap = {};

        for (let day = 0; day < 7; day++) {
            heatmap[day] = {};
            for (let hour = 0; hour < 24; hour++) {
                heatmap[day][hour] = {
                    sales: 0,
                    revenue: 0
                };
            }
        }

        sales.forEach(sale => {
            const date = new Date(sale.date);
            const day = date.getDay();
            const hour = date.getHours();

            heatmap[day][hour].sales++;
            heatmap[day][hour].revenue += sale.total;
        });

        // Find peaks
        let maxSales = 0;
        let peakHour = null;

        Object.keys(heatmap).forEach(day => {
            Object.keys(heatmap[day]).forEach(hour => {
                if (heatmap[day][hour].sales > maxSales) {
                    maxSales = heatmap[day][hour].sales;
                    peakHour = {
                        day: parseInt(day),
                        dayName: this._getDayName(parseInt(day)),
                        hour: parseInt(hour),
                        sales: maxSales,
                        revenue: Math.round(heatmap[day][hour].revenue * 100) / 100
                    };
                }
            });
        });

        return {
            success: true,
            period: period,
            heatmap: heatmap,
            peakHour: peakHour
        };
    }

    /**
     * Customer journey tracking (от вход до покупка)
     * @param {string} period - Period
     * @returns {Object} Journey analysis
     */
    analyzeCustomerJourney(period = 'month') {
        const dateRange = this._parsePeriod(period);
        const sales = this._filterByDateRange(this.salesService.getAllSales(), dateRange);
        const visits = this._filterByDateRange(this.storeVisits, dateRange);

        // Conversion rate (ако имаме visits data)
        let conversionRate = null;
        if (visits.length > 0) {
            const purchasedVisits = visits.filter(v => v.purchased);
            conversionRate = (purchasedVisits.length / visits.length) * 100;
        }

        // Avg time from entry to purchase (simplified - using sale timestamps)
        const avgTimeToPurchase = this._calculateAvgTimeToPurchase(sales);

        // Bounce rate (visitors who left without purchase)
        let bounceRate = null;
        if (visits.length > 0) {
            const bouncedVisits = visits.filter(v => !v.purchased);
            bounceRate = (bouncedVisits.length / visits.length) * 100;
        }

        return {
            success: true,
            period: period,
            totalVisits: visits.length,
            totalSales: sales.length,
            conversionRate: conversionRate ? Math.round(conversionRate * 100) / 100 : null,
            bounceRate: bounceRate ? Math.round(bounceRate * 100) / 100 : null,
            avgTimeToPurchase: avgTimeToPurchase,
            message: visits.length === 0 ? 'Няма данни за посещения. Използвайте recordStoreVisit() за tracking.' : null
        };
    }

    /**
     * Dwell time analysis (колко време прекарват в магазина)
     * @param {string} period - Period
     * @returns {Object} Dwell time
     */
    analyzeDwellTime(period = 'month') {
        const dateRange = this._parsePeriod(period);
        const visits = this._filterByDateRange(this.storeVisits, dateRange);

        if (visits.length === 0) {
            return {
                success: true,
                dwellTime: null,
                message: 'Няма данни за посещения'
            };
        }

        const dwellTimes = visits.map(v => v.dwellTime || 0).filter(t => t > 0);

        if (dwellTimes.length === 0) {
            return {
                success: true,
                dwellTime: null,
                message: 'Няма данни за време в магазина'
            };
        }

        const avgDwellTime = dwellTimes.reduce((sum, t) => sum + t, 0) / dwellTimes.length;
        const minDwellTime = Math.min(...dwellTimes);
        const maxDwellTime = Math.max(...dwellTimes);

        return {
            success: true,
            period: period,
            avgDwellTime: Math.round(avgDwellTime),
            minDwellTime: minDwellTime,
            maxDwellTime: maxDwellTime,
            totalVisits: visits.length,
            message: `Средно време: ${Math.round(avgDwellTime / 60)} минути`
        };
    }

    /**
     * Record store visit (за tracking на conversion)
     * @param {Object} visitData - Visit data
     * @returns {Object} Result
     */
    recordStoreVisit(visitData) {
        const visit = {
            id: Date.now() + Math.random(),
            timestamp: new Date().toISOString(),
            customerId: visitData.customerId || null,
            purchased: visitData.purchased || false,
            dwellTime: visitData.dwellTime || null, // seconds
            saleId: visitData.saleId || null
        };

        this.storeVisits.push(visit);
        this._saveStoreVisits();

        return {
            success: true,
            visit: visit
        };
    }

    /**
     * Repeat customer analysis
     * @param {string} period - Period
     * @returns {Object} Repeat analysis
     */
    analyzeRepeatCustomers(period = 'month') {
        const dateRange = this._parsePeriod(period);
        const sales = this._filterByDateRange(this.salesService.getAllSales(), dateRange);

        const customerPurchases = {};

        sales.forEach(sale => {
            if (sale.customerId) {
                customerPurchases[sale.customerId] = (customerPurchases[sale.customerId] || 0) + 1;
            }
        });

        const customers = Object.keys(customerPurchases);
        const repeatCustomers = customers.filter(c => customerPurchases[c] > 1);
        const oneTimeCustomers = customers.filter(c => customerPurchases[c] === 1);

        const repeatRate = customers.length > 0
            ? (repeatCustomers.length / customers.length) * 100
            : 0;

        return {
            success: true,
            period: period,
            totalCustomers: customers.length,
            repeatCustomers: repeatCustomers.length,
            oneTimeCustomers: oneTimeCustomers.length,
            repeatRate: Math.round(repeatRate * 100) / 100,
            avgPurchasesPerCustomer: customers.length > 0
                ? Math.round((sales.length / customers.length) * 100) / 100
                : 0
        };
    }

    /**
     * Purchase timing analysis (кога купуват specific products)
     * @param {number} productId - Product ID
     * @returns {Object} Timing analysis
     */
    analyzePurchaseTiming(productId) {
        const allSales = this.salesService.getAllSales();
        const productSales = allSales.filter(sale =>
            sale.items.some(item => item.productId === productId)
        );

        if (productSales.length === 0) {
            return {
                success: true,
                timing: null,
                message: 'Няма продажби на този продукт'
            };
        }

        // Hour distribution
        const hourDist = {};
        for (let i = 0; i < 24; i++) hourDist[i] = 0;

        // Day of week distribution
        const dayDist = {};
        for (let i = 0; i < 7; i++) dayDist[i] = 0;

        productSales.forEach(sale => {
            const date = new Date(sale.date);
            hourDist[date.getHours()]++;
            dayDist[date.getDay()]++;
        });

        const peakHour = Object.keys(hourDist).reduce((max, hour) =>
            hourDist[hour] > hourDist[max] ? hour : max, '0'
        );

        const peakDay = Object.keys(dayDist).reduce((max, day) =>
            dayDist[day] > dayDist[max] ? day : max, '0'
        );

        return {
            success: true,
            productId: productId,
            totalSales: productSales.length,
            peakHour: {
                hour: parseInt(peakHour),
                label: `${peakHour}:00`,
                sales: hourDist[peakHour]
            },
            peakDay: {
                day: parseInt(peakDay),
                dayName: this._getDayName(parseInt(peakDay)),
                sales: dayDist[peakDay]
            },
            hourDistribution: hourDist,
            dayDistribution: dayDist
        };
    }

    /**
     * Customer segmentation by behavior
     * @returns {Object} Segments
     */
    segmentCustomersByBehavior() {
        const allSales = this.salesService.getAllSales();
        const customerStats = {};

        allSales.forEach(sale => {
            if (!sale.customerId) return;

            if (!customerStats[sale.customerId]) {
                customerStats[sale.customerId] = {
                    customerId: sale.customerId,
                    purchases: 0,
                    totalSpent: 0,
                    avgBasketSize: 0,
                    lastPurchase: null
                };
            }

            const stats = customerStats[sale.customerId];
            stats.purchases++;
            stats.totalSpent += sale.total;
            stats.avgBasketSize = (stats.avgBasketSize * (stats.purchases - 1) + sale.items.length) / stats.purchases;

            const saleDate = new Date(sale.date);
            if (!stats.lastPurchase || saleDate > new Date(stats.lastPurchase)) {
                stats.lastPurchase = sale.date;
            }
        });

        // Segment customers
        const segments = {
            high_value: [], // High spending, frequent
            loyal: [], // Frequent purchases, moderate spending
            occasional: [], // Infrequent, low spending
            at_risk: [] // Haven't purchased recently
        };

        Object.values(customerStats).forEach(customer => {
            const avgPurchaseValue = customer.totalSpent / customer.purchases;
            const daysSinceLastPurchase = (new Date() - new Date(customer.lastPurchase)) / (1000 * 60 * 60 * 24);

            if (avgPurchaseValue > 50 && customer.purchases >= 5) {
                segments.high_value.push(customer);
            } else if (customer.purchases >= 10) {
                segments.loyal.push(customer);
            } else if (daysSinceLastPurchase > 60) {
                segments.at_risk.push(customer);
            } else {
                segments.occasional.push(customer);
            }
        });

        return {
            success: true,
            totalCustomers: Object.keys(customerStats).length,
            segments: {
                high_value: {
                    count: segments.high_value.length,
                    customers: segments.high_value
                },
                loyal: {
                    count: segments.loyal.length,
                    customers: segments.loyal
                },
                occasional: {
                    count: segments.occasional.length,
                    customers: segments.occasional
                },
                at_risk: {
                    count: segments.at_risk.length,
                    customers: segments.at_risk
                }
            }
        };
    }

    // ============ PRIVATE METHODS ============

    _parsePeriod(period) {
        const now = new Date();
        let start;

        if (period === 'today') {
            start = new Date(now.setHours(0, 0, 0, 0));
        } else if (period === 'week') {
            start = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
        } else if (period === 'month') {
            start = new Date(now.getFullYear(), now.getMonth(), 1);
        } else if (period === 'quarter') {
            const quarter = Math.floor(now.getMonth() / 3);
            start = new Date(now.getFullYear(), quarter * 3, 1);
        } else {
            start = new Date(0);
        }

        return { start, end: new Date() };
    }

    _filterByDateRange(items, dateRange) {
        return items.filter(item => {
            const itemDate = new Date(item.date || item.timestamp);
            return itemDate >= dateRange.start && itemDate <= dateRange.end;
        });
    }

    _analyzeHourlyDistribution(sales) {
        const hours = {};
        for (let i = 0; i < 24; i++) hours[i] = { sales: 0, revenue: 0 };

        sales.forEach(sale => {
            const hour = new Date(sale.date).getHours();
            hours[hour].sales++;
            hours[hour].revenue += sale.total;
        });

        // Find peak hour
        const peakHour = Object.keys(hours).reduce((max, hour) =>
            hours[hour].sales > hours[max].sales ? hour : max, '0'
        );

        const peakHourData = {
            hour: parseInt(peakHour),
            hourLabel: `${peakHour}:00`,
            sales: hours[peakHour].sales,
            revenue: Math.round(hours[peakHour].revenue * 100) / 100,
            percent: Math.round((hours[peakHour].sales / sales.length) * 10000) / 100
        };

        return {
            distribution: hours,
            peakHour: peakHourData
        };
    }

    _analyzeDayOfWeekDistribution(sales) {
        const days = {};
        for (let i = 0; i < 7; i++) days[i] = { sales: 0, revenue: 0 };

        sales.forEach(sale => {
            const day = new Date(sale.date).getDay();
            days[day].sales++;
            days[day].revenue += sale.total;
        });

        // Find peak day
        const peakDay = Object.keys(days).reduce((max, day) =>
            days[day].sales > days[max].sales ? day : max, '0'
        );

        const peakDayData = {
            day: parseInt(peakDay),
            dayName: this._getDayName(parseInt(peakDay)),
            sales: days[peakDay].sales,
            revenue: Math.round(days[peakDay].revenue * 100) / 100,
            percent: Math.round((days[peakDay].sales / sales.length) * 10000) / 100
        };

        return {
            distribution: days,
            peakDay: peakDayData
        };
    }

    _analyzeBasketComposition(sales) {
        const avgItems = sales.reduce((sum, s) => sum + s.items.length, 0) / sales.length;
        const avgValue = sales.reduce((sum, s) => sum + s.total, 0) / sales.length;

        return {
            avgItems: Math.round(avgItems * 100) / 100,
            avgValue: Math.round(avgValue * 100) / 100
        };
    }

    _analyzePurchaseFrequency(sales, dateRange) {
        const customerPurchases = {};

        sales.forEach(sale => {
            if (sale.customerId) {
                customerPurchases[sale.customerId] = (customerPurchases[sale.customerId] || 0) + 1;
            }
        });

        const frequencies = Object.values(customerPurchases);
        const avgFrequency = frequencies.length > 0
            ? frequencies.reduce((sum, f) => sum + f, 0) / frequencies.length
            : 0;

        return {
            uniqueCustomers: frequencies.length,
            avgPurchasesPerCustomer: Math.round(avgFrequency * 100) / 100
        };
    }

    _findTopCombinations(sales, limit = 10) {
        const combinations = {};

        sales.forEach(sale => {
            if (sale.items.length < 2) return;

            // Find all pairs
            for (let i = 0; i < sale.items.length; i++) {
                for (let j = i + 1; j < sale.items.length; j++) {
                    const product1 = sale.items[i].productName;
                    const product2 = sale.items[j].productName;

                    // Alphabetically sort to avoid duplicates
                    const pair = [product1, product2].sort().join(' + ');

                    combinations[pair] = (combinations[pair] || 0) + 1;
                }
            }
        });

        return Object.keys(combinations)
            .map(pair => ({
                combination: pair,
                frequency: combinations[pair]
            }))
            .sort((a, b) => b.frequency - a.frequency)
            .slice(0, limit);
    }

    _calculateAvgTimeToPurchase(sales) {
        // Simplified - using time of day as proxy
        const times = sales.map(s => new Date(s.date).getHours() * 60 + new Date(s.date).getMinutes());

        if (times.length === 0) return null;

        const avg = times.reduce((sum, t) => sum + t, 0) / times.length;
        return Math.round(avg); // minutes from midnight
    }

    _getDayName(day) {
        const days = ['Неделя', 'Понеделник', 'Вторник', 'Сряда', 'Четвъртък', 'Петък', 'Събота'];
        return days[day];
    }

    _saveStoreVisits() {
        // Keep only last 1000 visits
        if (this.storeVisits.length > 1000) {
            this.storeVisits = this.storeVisits.slice(-1000);
        }
        StorageService.set('storeVisits', this.storeVisits);
    }
}
