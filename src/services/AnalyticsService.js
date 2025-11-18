/**
 * Customer Behavior Analytics Service - v4.0
 * Advanced analytics: RFM, Market Basket, Cohort Analysis, Customer Segmentation
 */
import { ValidationService } from './ValidationService.js';
import { StorageService } from './StorageService.js';

export class AnalyticsService {
    constructor(salesService, customerService, productService) {
        this.salesService = salesService;
        this.customerService = customerService;
        this.productService = productService;
    }

    /**
     * RFM Analysis (Recency, Frequency, Monetary)
     * @returns {Object} RFM segments
     */
    getRFMAnalysis() {
        const customers = this.customerService.getAllCustomers();
        const sales = this.salesService.getAllSales();

        if (customers.length === 0 || sales.length === 0) {
            return {
                success: false,
                errors: ['Недостатъчно данни за RFM анализ']
            };
        }

        const now = new Date();
        const rfmData = [];

        customers.forEach(customer => {
            const customerSales = sales.filter(s => s.customerId === customer.id);

            if (customerSales.length === 0) {
                return; // Skip customers with no purchases
            }

            // Recency: Days since last purchase
            const lastPurchase = new Date(Math.max(...customerSales.map(s => new Date(s.date))));
            const recency = Math.floor((now - lastPurchase) / (1000 * 60 * 60 * 24));

            // Frequency: Number of purchases
            const frequency = customerSales.length;

            // Monetary: Total spent
            const monetary = customerSales.reduce((sum, s) => sum + s.total, 0);

            rfmData.push({
                customerId: customer.id,
                customerName: customer.name,
                recency: recency,
                frequency: frequency,
                monetary: monetary
            });
        });

        // Calculate RFM scores (1-5 scale)
        const recencyScores = this._calculateQuintiles(rfmData.map(d => d.recency), true); // Reverse: lower is better
        const frequencyScores = this._calculateQuintiles(rfmData.map(d => d.frequency), false);
        const monetaryScores = this._calculateQuintiles(rfmData.map(d => d.monetary), false);

        // Assign scores
        rfmData.forEach((data, index) => {
            data.recencyScore = recencyScores[index];
            data.frequencyScore = frequencyScores[index];
            data.monetaryScore = monetaryScores[index];
            data.rfmScore = `${data.recencyScore}${data.frequencyScore}${data.monetaryScore}`;
            data.segment = this._getRFMSegment(data.recencyScore, data.frequencyScore, data.monetaryScore);
        });

        // Group by segment
        const segments = {};
        rfmData.forEach(data => {
            if (!segments[data.segment]) {
                segments[data.segment] = [];
            }
            segments[data.segment].push(data);
        });

        return {
            success: true,
            rfm: {
                customers: rfmData,
                segments: segments,
                totalCustomers: rfmData.length,
                segmentCounts: Object.keys(segments).reduce((acc, key) => {
                    acc[key] = segments[key].length;
                    return acc;
                }, {})
            }
        };
    }

    /**
     * Market Basket Analysis (product associations)
     * @param {number} minSupport - Minimum support (0-1)
     * @param {number} minConfidence - Minimum confidence (0-1)
     * @returns {Object} Product associations
     */
    getMarketBasketAnalysis(minSupport = 0.01, minConfidence = 0.5) {
        const sales = this.salesService.getAllSales();

        if (sales.length < 10) {
            return {
                success: false,
                errors: ['Недостатъчно данни за Market Basket анализ (минимум 10 продажби)']
            };
        }

        // Extract transactions (baskets)
        const transactions = sales.map(sale => sale.items.map(item => item.productId));
        const totalTransactions = transactions.length;

        // Calculate item frequencies
        const itemCounts = {};
        transactions.forEach(transaction => {
            transaction.forEach(itemId => {
                itemCounts[itemId] = (itemCounts[itemId] || 0) + 1;
            });
        });

        // Find frequent itemsets (products that appear together)
        const associations = [];

        Object.keys(itemCounts).forEach(itemA => {
            const itemACount = itemCounts[itemA];
            const itemASupport = itemACount / totalTransactions;

            if (itemASupport < minSupport) return;

            Object.keys(itemCounts).forEach(itemB => {
                if (itemA >= itemB) return; // Avoid duplicates and self-associations

                const itemBCount = itemCounts[itemB];

                // Count co-occurrences
                let coOccurrences = 0;
                transactions.forEach(transaction => {
                    if (transaction.includes(parseInt(itemA)) && transaction.includes(parseInt(itemB))) {
                        coOccurrences++;
                    }
                });

                const support = coOccurrences / totalTransactions;

                if (support < minSupport) return;

                // Calculate confidence: P(B|A) = support(A,B) / support(A)
                const confidenceAtoB = coOccurrences / itemACount;
                const confidenceBtoA = coOccurrences / itemBCount;

                if (confidenceAtoB >= minConfidence || confidenceBtoA >= minConfidence) {
                    const productA = this.productService.getProductById(parseInt(itemA));
                    const productB = this.productService.getProductById(parseInt(itemB));

                    associations.push({
                        productA: {
                            id: parseInt(itemA),
                            name: productA ? productA.name : 'Unknown'
                        },
                        productB: {
                            id: parseInt(itemB),
                            name: productB ? productB.name : 'Unknown'
                        },
                        support: Math.round(support * 1000) / 1000,
                        confidenceAtoB: Math.round(confidenceAtoB * 1000) / 1000,
                        confidenceBtoA: Math.round(confidenceBtoA * 1000) / 1000,
                        lift: Math.round((support / (itemASupport * (itemBCount / totalTransactions))) * 1000) / 1000
                    });
                }
            });
        });

        // Sort by lift (strongest associations first)
        associations.sort((a, b) => b.lift - a.lift);

        return {
            success: true,
            marketBasket: {
                associations: associations,
                totalAssociations: associations.length,
                minSupport: minSupport,
                minConfidence: minConfidence,
                totalTransactions: totalTransactions
            }
        };
    }

    /**
     * Customer Lifetime Value (CLV) calculation
     * @param {number} customerId - Customer ID (optional, calculates for all if not provided)
     * @returns {Object} CLV analysis
     */
    getCustomerLifetimeValue(customerId = null) {
        const customers = customerId ?
                         [this.customerService.getCustomerById(customerId)] :
                         this.customerService.getAllCustomers();

        if (!customers || customers.length === 0) {
            return {
                success: false,
                errors: ['Няма клиенти за анализ']
            };
        }

        const clvData = [];
        const sales = this.salesService.getAllSales();

        customers.forEach(customer => {
            if (!customer) return;

            const customerSales = sales.filter(s => s.customerId === customer.id);

            if (customerSales.length === 0) {
                return;
            }

            // Calculate metrics
            const totalRevenue = customerSales.reduce((sum, s) => sum + s.total, 0);
            const averageOrderValue = totalRevenue / customerSales.length;
            const purchaseFrequency = customerSales.length;

            // Calculate time span
            const firstPurchase = new Date(Math.min(...customerSales.map(s => new Date(s.date))));
            const lastPurchase = new Date(Math.max(...customerSales.map(s => new Date(s.date))));
            const customerLifetimeDays = Math.max(1, Math.floor((lastPurchase - firstPurchase) / (1000 * 60 * 60 * 24)));

            // Estimate future value (simple model: average order value × predicted future orders)
            const avgDaysBetweenPurchases = customerLifetimeDays / Math.max(1, purchaseFrequency - 1);
            const predictedFutureOrders = Math.floor(365 / avgDaysBetweenPurchases); // Next year
            const predictedLifetimeValue = totalRevenue + (averageOrderValue * predictedFutureOrders);

            clvData.push({
                customerId: customer.id,
                customerName: customer.name,
                totalRevenue: Math.round(totalRevenue * 100) / 100,
                averageOrderValue: Math.round(averageOrderValue * 100) / 100,
                purchaseFrequency: purchaseFrequency,
                customerLifetimeDays: customerLifetimeDays,
                avgDaysBetweenPurchases: Math.round(avgDaysBetweenPurchases),
                predictedLifetimeValue: Math.round(predictedLifetimeValue * 100) / 100
            });
        });

        // Sort by predicted lifetime value
        clvData.sort((a, b) => b.predictedLifetimeValue - a.predictedLifetimeValue);

        return {
            success: true,
            clv: {
                customers: clvData,
                totalCustomers: clvData.length,
                averageCLV: clvData.length > 0 ?
                           Math.round((clvData.reduce((sum, c) => sum + c.predictedLifetimeValue, 0) / clvData.length) * 100) / 100 : 0
            }
        };
    }

    /**
     * Customer Segmentation based on behavior
     * @returns {Object} Customer segments
     */
    getCustomerSegmentation() {
        const customers = this.customerService.getAllCustomers();
        const sales = this.salesService.getAllSales();

        if (customers.length === 0) {
            return {
                success: false,
                errors: ['Няма клиенти за сегментация']
            };
        }

        const segments = {
            vip: { customers: [], criteria: 'Висока стойност + Висока честота' },
            loyal: { customers: [], criteria: 'Средна стойност + Висока честота' },
            potential: { customers: [], criteria: 'Висока стойност + Ниска честота' },
            occasional: { customers: [], criteria: 'Средна стойност + Средна честота' },
            atrisk: { customers: [], criteria: 'Не са купували скоро' },
            new: { customers: [], criteria: 'Само 1-2 покупки' }
        };

        const now = new Date();

        customers.forEach(customer => {
            const customerSales = sales.filter(s => s.customerId === customer.id);

            if (customerSales.length === 0) {
                return;
            }

            const totalSpent = customerSales.reduce((sum, s) => sum + s.total, 0);
            const purchaseCount = customerSales.length;
            const lastPurchase = new Date(Math.max(...customerSales.map(s => new Date(s.date))));
            const daysSinceLastPurchase = Math.floor((now - lastPurchase) / (1000 * 60 * 60 * 24));

            const customerData = {
                id: customer.id,
                name: customer.name,
                totalSpent: totalSpent,
                purchaseCount: purchaseCount,
                daysSinceLastPurchase: daysSinceLastPurchase
            };

            // Segmentation logic
            if (purchaseCount <= 2) {
                segments.new.customers.push(customerData);
            } else if (daysSinceLastPurchase > 90) {
                segments.atrisk.customers.push(customerData);
            } else if (totalSpent > 1000 && purchaseCount > 10) {
                segments.vip.customers.push(customerData);
            } else if (totalSpent > 500 && purchaseCount > 5) {
                segments.loyal.customers.push(customerData);
            } else if (totalSpent > 500) {
                segments.potential.customers.push(customerData);
            } else {
                segments.occasional.customers.push(customerData);
            }
        });

        return {
            success: true,
            segmentation: {
                segments: segments,
                totalCustomers: customers.length,
                segmentCounts: Object.keys(segments).reduce((acc, key) => {
                    acc[key] = segments[key].customers.length;
                    return acc;
                }, {})
            }
        };
    }

    /**
     * Cohort Analysis - Track customer retention over time
     * @param {string} period - 'month' or 'week'
     * @returns {Object} Cohort analysis
     */
    getCohortAnalysis(period = 'month') {
        const sales = this.salesService.getAllSales();

        if (sales.length < 10) {
            return {
                success: false,
                errors: ['Недостатъчно данни за cohort анализ']
            };
        }

        // Group customers by first purchase period
        const cohorts = {};

        sales.forEach(sale => {
            const saleDate = new Date(sale.date);
            const cohortKey = period === 'month' ?
                            `${saleDate.getFullYear()}-${String(saleDate.getMonth() + 1).padStart(2, '0')}` :
                            this._getWeekKey(saleDate);

            if (!cohorts[cohortKey]) {
                cohorts[cohortKey] = {
                    cohortPeriod: cohortKey,
                    customers: new Set(),
                    firstPurchases: {}
                };
            }

            // Track first purchase for each customer
            if (!cohorts[cohortKey].firstPurchases[sale.customerId]) {
                cohorts[cohortKey].firstPurchases[sale.customerId] = saleDate;
            }

            cohorts[cohortKey].customers.add(sale.customerId);
        });

        // Calculate retention
        const cohortData = [];

        Object.keys(cohorts).sort().forEach(cohortKey => {
            const cohort = cohorts[cohortKey];
            const cohortSize = Object.keys(cohort.firstPurchases).length;

            // Calculate retention for subsequent periods
            const retention = {};

            Object.keys(cohort.firstPurchases).forEach(customerId => {
                const firstPurchase = cohort.firstPurchases[customerId];

                // Check purchases in subsequent periods
                const subsequentSales = sales.filter(s => {
                    return s.customerId === parseInt(customerId) &&
                           new Date(s.date) > firstPurchase;
                });

                subsequentSales.forEach(sale => {
                    const saleDate = new Date(sale.date);
                    const periodsSinceStart = period === 'month' ?
                                             this._monthsDiff(firstPurchase, saleDate) :
                                             Math.floor((saleDate - firstPurchase) / (7 * 24 * 60 * 60 * 1000));

                    if (!retention[periodsSinceStart]) {
                        retention[periodsSinceStart] = new Set();
                    }
                    retention[periodsSinceStart].add(customerId);
                });
            });

            // Calculate retention percentages
            const retentionRates = {};
            Object.keys(retention).forEach(periodOffset => {
                retentionRates[periodOffset] = Math.round((retention[periodOffset].size / cohortSize) * 100);
            });

            cohortData.push({
                cohortPeriod: cohortKey,
                cohortSize: cohortSize,
                retentionRates: retentionRates
            });
        });

        return {
            success: true,
            cohort: {
                period: period,
                cohorts: cohortData,
                totalCohorts: cohortData.length
            }
        };
    }

    /**
     * Product Performance Analysis
     * @param {number} topN - Number of top products to return
     * @returns {Object} Product performance metrics
     */
    getProductPerformance(topN = 10) {
        const sales = this.salesService.getAllSales();
        const products = this.productService.getAllProducts();

        if (sales.length === 0) {
            return {
                success: false,
                errors: ['Няма данни за продажби']
            };
        }

        const productMetrics = {};

        // Initialize metrics
        products.forEach(product => {
            productMetrics[product.id] = {
                productId: product.id,
                productName: product.name,
                quantitySold: 0,
                revenue: 0,
                salesCount: 0,
                averagePrice: 0,
                returnsCount: 0
            };
        });

        // Calculate metrics from sales
        sales.forEach(sale => {
            sale.items.forEach(item => {
                if (productMetrics[item.productId]) {
                    productMetrics[item.productId].quantitySold += item.quantity;
                    productMetrics[item.productId].revenue += item.price * item.quantity;
                    productMetrics[item.productId].salesCount++;
                }
            });
        });

        // Calculate averages
        Object.values(productMetrics).forEach(metrics => {
            if (metrics.salesCount > 0) {
                metrics.averagePrice = Math.round((metrics.revenue / metrics.quantitySold) * 100) / 100;
            }
        });

        // Convert to array and sort
        const metricsArray = Object.values(productMetrics)
                                  .filter(m => m.quantitySold > 0)
                                  .sort((a, b) => b.revenue - a.revenue);

        return {
            success: true,
            productPerformance: {
                topProducts: metricsArray.slice(0, topN),
                totalProducts: metricsArray.length,
                totalRevenue: metricsArray.reduce((sum, m) => sum + m.revenue, 0),
                totalQuantitySold: metricsArray.reduce((sum, m) => sum + m.quantitySold, 0)
            }
        };
    }

    // ============ PRIVATE METHODS ============

    _calculateQuintiles(values, reverse = false) {
        const sorted = [...values].sort((a, b) => reverse ? b - a : a - b);
        const quintileSize = Math.ceil(sorted.length / 5);

        return values.map(value => {
            const index = sorted.indexOf(value);
            return Math.min(5, Math.floor(index / quintileSize) + 1);
        });
    }

    _getRFMSegment(r, f, m) {
        const score = parseInt(`${r}${f}${m}`);

        if (r >= 4 && f >= 4 && m >= 4) return 'Champions';
        if (r >= 3 && f >= 3 && m >= 3) return 'Loyal Customers';
        if (r >= 4 && f <= 2) return 'New Customers';
        if (r >= 3 && f >= 3) return 'Potential Loyalists';
        if (r <= 2 && f >= 3 && m >= 3) return 'At Risk';
        if (r <= 2 && f <= 2 && m >= 3) return 'Cant Lose Them';
        if (r >= 3 && f <= 2 && m <= 2) return 'Promising';
        if (r <= 2) return 'Hibernating';

        return 'Others';
    }

    _getWeekKey(date) {
        const year = date.getFullYear();
        const week = this._getWeekNumber(date);
        return `${year}-W${String(week).padStart(2, '0')}`;
    }

    _getWeekNumber(date) {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    }

    _monthsDiff(date1, date2) {
        const d1 = new Date(date1);
        const d2 = new Date(date2);
        return (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
    }
}
