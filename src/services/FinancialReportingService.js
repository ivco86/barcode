/**
 * Financial Reporting Engine - v6.0
 * Professional financial statements and business reporting
 */
import { ValidationService } from './ValidationService.js';
import { StorageService } from './StorageService.js';

export class FinancialReportingService {
    constructor(salesService, productService, authService, refundService) {
        this.salesService = salesService;
        this.productService = productService;
        this.authService = authService;
        this.refundService = refundService;

        this.fiscalYearStart = StorageService.get('fiscalYearStart', { month: 1, day: 1 }); // Jan 1
        this.operatingExpenses = StorageService.get('operatingExpenses', []);
        this.fixedAssets = StorageService.get('fixedAssets', []);
        this.liabilities = StorageService.get('liabilities', []);
    }

    /**
     * Generate Profit & Loss Statement
     * @param {string} period - Period ('month', 'quarter', 'year') or custom date range
     * @param {Object} options - Additional options
     * @returns {Object} P&L statement
     */
    generateProfitLoss(period, options = {}) {
        const dateRange = this._parsePeriod(period);
        const sales = this._filterByDateRange(this.salesService.getAllSales(), dateRange);
        const refunds = this._getRefundsInPeriod(dateRange);

        // Revenue
        const grossSales = sales.reduce((sum, sale) => sum + sale.total, 0);
        const returns = refunds.reduce((sum, r) => sum + r.totalRefunded, 0);
        const netSales = grossSales - returns;

        // Cost of Goods Sold (COGS)
        const cogs = this._calculateCOGS(sales);

        // Gross Profit
        const grossProfit = netSales - cogs;
        const grossMargin = netSales > 0 ? (grossProfit / netSales) * 100 : 0;

        // Operating Expenses
        const operatingExpenses = this._getOperatingExpenses(dateRange);
        const totalOpex = operatingExpenses.reduce((sum, e) => sum + e.amount, 0);

        // Operating Income (EBIT)
        const operatingIncome = grossProfit - totalOpex;

        // Other Income/Expenses
        const otherIncome = this._getOtherIncome(dateRange);
        const otherExpenses = this._getOtherExpenses(dateRange);

        // Net Income (Profit)
        const netIncome = operatingIncome + otherIncome - otherExpenses;
        const netMargin = netSales > 0 ? (netIncome / netSales) * 100 : 0;

        return {
            success: true,
            profitLoss: {
                period: period,
                startDate: dateRange.start.toISOString().split('T')[0],
                endDate: dateRange.end.toISOString().split('T')[0],

                // Revenue Section
                revenue: {
                    grossSales: Math.round(grossSales * 100) / 100,
                    returns: Math.round(returns * 100) / 100,
                    netSales: Math.round(netSales * 100) / 100
                },

                // Cost Section
                costs: {
                    cogs: Math.round(cogs * 100) / 100,
                    cogsPercentage: netSales > 0 ? Math.round((cogs / netSales) * 100 * 10) / 10 : 0
                },

                // Gross Profit
                grossProfit: {
                    amount: Math.round(grossProfit * 100) / 100,
                    margin: Math.round(grossMargin * 10) / 10
                },

                // Operating Expenses
                operatingExpenses: {
                    breakdown: operatingExpenses,
                    total: Math.round(totalOpex * 100) / 100,
                    percentage: netSales > 0 ? Math.round((totalOpex / netSales) * 100 * 10) / 10 : 0
                },

                // Operating Income
                operatingIncome: {
                    amount: Math.round(operatingIncome * 100) / 100,
                    margin: netSales > 0 ? Math.round((operatingIncome / netSales) * 100 * 10) / 10 : 0
                },

                // Other Items
                otherItems: {
                    income: Math.round(otherIncome * 100) / 100,
                    expenses: Math.round(otherExpenses * 100) / 100
                },

                // Net Income
                netIncome: {
                    amount: Math.round(netIncome * 100) / 100,
                    margin: Math.round(netMargin * 10) / 10
                },

                // Summary Metrics
                metrics: {
                    salesCount: sales.length,
                    returnsCount: refunds.length,
                    avgSaleValue: sales.length > 0 ? Math.round((netSales / sales.length) * 100) / 100 : 0,
                    returnRate: grossSales > 0 ? Math.round((returns / grossSales) * 100 * 10) / 10 : 0
                }
            }
        };
    }

    /**
     * Generate Balance Sheet
     * @param {Date} asOfDate - As of date
     * @returns {Object} Balance sheet
     */
    generateBalanceSheet(asOfDate = new Date()) {
        const date = new Date(asOfDate);

        // Assets
        const currentAssets = this._getCurrentAssets(date);
        const fixedAssets = this._getFixedAssets(date);
        const totalAssets = currentAssets.total + fixedAssets.total;

        // Liabilities
        const currentLiabilities = this._getCurrentLiabilities(date);
        const longTermLiabilities = this._getLongTermLiabilities(date);
        const totalLiabilities = currentLiabilities.total + longTermLiabilities.total;

        // Equity
        const retainedEarnings = this._getRetainedEarnings(date);
        const currentPeriodIncome = this._getCurrentPeriodIncome(date);
        const totalEquity = retainedEarnings + currentPeriodIncome;

        return {
            success: true,
            balanceSheet: {
                asOfDate: date.toISOString().split('T')[0],

                // Assets
                assets: {
                    current: currentAssets,
                    fixed: fixedAssets,
                    total: Math.round(totalAssets * 100) / 100
                },

                // Liabilities
                liabilities: {
                    current: currentLiabilities,
                    longTerm: longTermLiabilities,
                    total: Math.round(totalLiabilities * 100) / 100
                },

                // Equity
                equity: {
                    retainedEarnings: Math.round(retainedEarnings * 100) / 100,
                    currentPeriodIncome: Math.round(currentPeriodIncome * 100) / 100,
                    total: Math.round(totalEquity * 100) / 100
                },

                // Accounting Equation Check
                balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
                difference: Math.round((totalAssets - (totalLiabilities + totalEquity)) * 100) / 100
            }
        };
    }

    /**
     * Generate Cash Flow Statement
     * @param {string} period - Period
     * @returns {Object} Cash flow statement
     */
    generateCashFlow(period) {
        const dateRange = this._parsePeriod(period);
        const sales = this._filterByDateRange(this.salesService.getAllSales(), dateRange);

        // Operating Activities
        const cashFromSales = sales
            .filter(s => s.paymentMethod === 'cash' || s.paymentMethod === 'multiple')
            .reduce((sum, s) => {
                if (s.paymentMethod === 'multiple' && s.payments) {
                    return sum + s.payments.filter(p => p.method === 'cash').reduce((s, p) => s + p.amount, 0);
                }
                return sum + (s.paymentMethod === 'cash' ? s.total : 0);
            }, 0);

        const operatingExpensesCash = this._getOperatingExpenses(dateRange)
            .reduce((sum, e) => sum + e.amount, 0);

        const netCashFromOperations = cashFromSales - operatingExpensesCash;

        // Investing Activities
        const fixedAssetPurchases = this._getFixedAssetPurchases(dateRange);
        const netCashFromInvesting = -fixedAssetPurchases;

        // Financing Activities
        const loansReceived = this._getLoansReceived(dateRange);
        const loanRepayments = this._getLoanRepayments(dateRange);
        const netCashFromFinancing = loansReceived - loanRepayments;

        // Net Change in Cash
        const netCashChange = netCashFromOperations + netCashFromInvesting + netCashFromFinancing;

        return {
            success: true,
            cashFlow: {
                period: period,
                startDate: dateRange.start.toISOString().split('T')[0],
                endDate: dateRange.end.toISOString().split('T')[0],

                operating: {
                    cashFromSales: Math.round(cashFromSales * 100) / 100,
                    operatingExpenses: Math.round(operatingExpensesCash * 100) / 100,
                    netCash: Math.round(netCashFromOperations * 100) / 100
                },

                investing: {
                    fixedAssetPurchases: Math.round(fixedAssetPurchases * 100) / 100,
                    netCash: Math.round(netCashFromInvesting * 100) / 100
                },

                financing: {
                    loansReceived: Math.round(loansReceived * 100) / 100,
                    loanRepayments: Math.round(loanRepayments * 100) / 100,
                    netCash: Math.round(netCashFromFinancing * 100) / 100
                },

                netCashChange: Math.round(netCashChange * 100) / 100,
                cashFlowRating: this._getCashFlowRating(netCashFromOperations)
            }
        };
    }

    /**
     * Calculate EBITDA
     * @param {string} period - Period
     * @returns {Object} EBITDA calculation
     */
    calculateEBITDA(period) {
        const pl = this.generateProfitLoss(period);

        if (!pl.success) return pl;

        const operatingIncome = pl.profitLoss.operatingIncome.amount;
        const depreciation = this._getDepreciation(this._parsePeriod(period));
        const amortization = 0; // Simplified

        const ebitda = operatingIncome + depreciation + amortization;
        const ebitdaMargin = pl.profitLoss.revenue.netSales > 0 ?
                            (ebitda / pl.profitLoss.revenue.netSales) * 100 : 0;

        return {
            success: true,
            ebitda: {
                period: period,
                operatingIncome: operatingIncome,
                depreciation: Math.round(depreciation * 100) / 100,
                amortization: amortization,
                ebitda: Math.round(ebitda * 100) / 100,
                ebitdaMargin: Math.round(ebitdaMargin * 10) / 10,
                revenue: pl.profitLoss.revenue.netSales
            }
        };
    }

    /**
     * Calculate Break-even Analysis
     * @param {string} period - Period for data
     * @returns {Object} Break-even analysis
     */
    calculateBreakEven(period) {
        const pl = this.generateProfitLoss(period);

        if (!pl.success) return pl;

        const totalRevenue = pl.profitLoss.revenue.netSales;
        const variableCosts = pl.profitLoss.costs.cogs;
        const fixedCosts = pl.profitLoss.operatingExpenses.total;
        const salesCount = pl.profitLoss.metrics.salesCount;

        const avgSalePrice = salesCount > 0 ? totalRevenue / salesCount : 0;
        const avgVariableCost = salesCount > 0 ? variableCosts / salesCount : 0;
        const contributionMargin = avgSalePrice - avgVariableCost;
        const contributionMarginRatio = avgSalePrice > 0 ? (contributionMargin / avgSalePrice) * 100 : 0;

        const breakEvenUnits = contributionMargin > 0 ? Math.ceil(fixedCosts / contributionMargin) : 0;
        const breakEvenRevenue = breakEvenUnits * avgSalePrice;

        const currentMarginOfSafety = totalRevenue > 0 ?
                                     ((totalRevenue - breakEvenRevenue) / totalRevenue) * 100 : 0;

        return {
            success: true,
            breakEven: {
                period: period,
                fixedCosts: Math.round(fixedCosts * 100) / 100,
                avgVariableCostPerUnit: Math.round(avgVariableCost * 100) / 100,
                avgSalePrice: Math.round(avgSalePrice * 100) / 100,
                contributionMargin: Math.round(contributionMargin * 100) / 100,
                contributionMarginRatio: Math.round(contributionMarginRatio * 10) / 10,
                breakEvenUnits: breakEvenUnits,
                breakEvenRevenue: Math.round(breakEvenRevenue * 100) / 100,
                currentSalesUnits: salesCount,
                currentRevenue: Math.round(totalRevenue * 100) / 100,
                marginOfSafety: Math.round(currentMarginOfSafety * 10) / 10,
                status: salesCount >= breakEvenUnits ? 'Profitable' : 'Loss'
            }
        };
    }

    /**
     * Add operating expense
     * @param {Object} expenseData - Expense data
     * @returns {Object} Result
     */
    addOperatingExpense(expenseData) {
        const expense = {
            id: Date.now(),
            date: expenseData.date || new Date().toISOString(),
            category: ValidationService.sanitizeString(expenseData.category),
            description: ValidationService.sanitizeString(expenseData.description || ''),
            amount: expenseData.amount,
            recurring: expenseData.recurring || false,
            createdBy: this.authService.getCurrentUser()?.name || 'System'
        };

        this.operatingExpenses.push(expense);
        this._saveOperatingExpenses();

        return {
            success: true,
            expense: expense
        };
    }

    /**
     * Export report to format
     * @param {string} reportType - Report type
     * @param {string} period - Period
     * @param {string} format - Format ('json', 'csv', 'excel')
     * @returns {Object} Exported report
     */
    exportReport(reportType, period, format = 'json') {
        let report;

        switch (reportType) {
            case 'profitLoss':
                report = this.generateProfitLoss(period);
                break;
            case 'balanceSheet':
                report = this.generateBalanceSheet();
                break;
            case 'cashFlow':
                report = this.generateCashFlow(period);
                break;
            case 'ebitda':
                report = this.calculateEBITDA(period);
                break;
            default:
                return { success: false, errors: ['Невалиден тип отчет'] };
        }

        if (!report.success) return report;

        if (format === 'csv') {
            return {
                success: true,
                export: {
                    format: 'csv',
                    data: this._convertToCSV(report)
                }
            };
        }

        return {
            success: true,
            export: {
                format: format,
                data: report
            }
        };
    }

    // ============ PRIVATE METHODS ============

    _parsePeriod(period) {
        const now = new Date();
        let start, end;

        if (typeof period === 'string') {
            if (period === 'month') {
                start = new Date(now.getFullYear(), now.getMonth(), 1);
                end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            } else if (period === 'quarter') {
                const quarter = Math.floor(now.getMonth() / 3);
                start = new Date(now.getFullYear(), quarter * 3, 1);
                end = new Date(now.getFullYear(), (quarter + 1) * 3, 0);
            } else if (period === 'year') {
                start = new Date(now.getFullYear(), 0, 1);
                end = new Date(now.getFullYear(), 11, 31);
            } else if (period.includes('Q')) {
                // e.g., "2025-Q1"
                const [year, q] = period.split('-Q');
                const quarter = parseInt(q) - 1;
                start = new Date(parseInt(year), quarter * 3, 1);
                end = new Date(parseInt(year), (quarter + 1) * 3, 0);
            }
        } else if (typeof period === 'object') {
            start = new Date(period.start);
            end = new Date(period.end);
        }

        return { start, end };
    }

    _filterByDateRange(items, dateRange) {
        return items.filter(item => {
            const itemDate = new Date(item.date);
            return itemDate >= dateRange.start && itemDate <= dateRange.end;
        });
    }

    _calculateCOGS(sales) {
        // Simplified COGS: 60% of sales (in real system, track actual product costs)
        const totalSales = sales.reduce((sum, sale) => sum + sale.total, 0);
        return totalSales * 0.60;
    }

    _getRefundsInPeriod(dateRange) {
        if (!this.refundService) return [];

        const allRefunds = this.refundService.getAllRefunds();
        if (!allRefunds.success) return [];

        return this._filterByDateRange(allRefunds.refunds, dateRange);
    }

    _getOperatingExpenses(dateRange) {
        const expenses = this._filterByDateRange(this.operatingExpenses, dateRange);

        // Group by category
        const grouped = expenses.reduce((acc, exp) => {
            const existing = acc.find(e => e.category === exp.category);
            if (existing) {
                existing.amount += exp.amount;
            } else {
                acc.push({
                    category: exp.category,
                    amount: exp.amount
                });
            }
            return acc;
        }, []);

        return grouped;
    }

    _getOtherIncome(dateRange) {
        // Placeholder - would track non-operating income
        return 0;
    }

    _getOtherExpenses(dateRange) {
        // Placeholder - would track interest, taxes, etc.
        return 0;
    }

    _getCurrentAssets(date) {
        const sales = this.salesService.getAllSales();
        const products = this.productService.getAllProducts();

        // Cash (from sales)
        const cash = sales.reduce((sum, s) => sum + s.total, 0) * 0.3; // Simplified

        // Inventory
        const inventory = products.reduce((sum, p) => sum + (p.stock * p.price), 0);

        return {
            cash: Math.round(cash * 100) / 100,
            inventory: Math.round(inventory * 100) / 100,
            total: Math.round((cash + inventory) * 100) / 100
        };
    }

    _getFixedAssets(date) {
        const assets = this.fixedAssets.filter(a => new Date(a.purchaseDate) <= date);
        const totalValue = assets.reduce((sum, a) => sum + a.currentValue, 0);

        return {
            items: assets,
            total: Math.round(totalValue * 100) / 100
        };
    }

    _getCurrentLiabilities(date) {
        const current = this.liabilities.filter(l =>
            l.type === 'current' && new Date(l.date) <= date
        );

        return {
            items: current,
            total: current.reduce((sum, l) => sum + l.amount, 0)
        };
    }

    _getLongTermLiabilities(date) {
        const longTerm = this.liabilities.filter(l =>
            l.type === 'long-term' && new Date(l.date) <= date
        );

        return {
            items: longTerm,
            total: longTerm.reduce((sum, l) => sum + l.amount, 0)
        };
    }

    _getRetainedEarnings(date) {
        // Simplified - would calculate cumulative profits
        return 10000;
    }

    _getCurrentPeriodIncome(date) {
        const yearStart = new Date(date.getFullYear(), 0, 1);
        const pl = this.generateProfitLoss({ start: yearStart, end: date });

        return pl.success ? pl.profitLoss.netIncome.amount : 0;
    }

    _getDepreciation(dateRange) {
        // Simplified depreciation calculation
        return this.fixedAssets.reduce((sum, asset) => {
            const monthlyDepreciation = asset.purchasePrice / (asset.usefulLifeYears * 12);
            return sum + monthlyDepreciation;
        }, 0);
    }

    _getFixedAssetPurchases(dateRange) {
        const purchases = this._filterByDateRange(this.fixedAssets.map(a => ({
            date: a.purchaseDate,
            amount: a.purchasePrice
        })), dateRange);

        return purchases.reduce((sum, p) => sum + p.amount, 0);
    }

    _getLoansReceived(dateRange) {
        return 0; // Placeholder
    }

    _getLoanRepayments(dateRange) {
        return 0; // Placeholder
    }

    _getCashFlowRating(netCashFromOperations) {
        if (netCashFromOperations > 10000) return 'Excellent';
        if (netCashFromOperations > 5000) return 'Good';
        if (netCashFromOperations > 0) return 'Fair';
        return 'Poor';
    }

    _convertToCSV(report) {
        // Simplified CSV conversion
        return JSON.stringify(report, null, 2);
    }

    _saveOperatingExpenses() {
        StorageService.set('operatingExpenses', this.operatingExpenses);
    }
}
