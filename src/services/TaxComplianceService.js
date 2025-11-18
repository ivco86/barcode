/**
 * Tax Compliance & VAT Reports - v6.0
 * Bulgarian tax compliance (НАП) and VAT/ДДС reporting
 */
import { ValidationService } from './ValidationService.js';
import { StorageService } from './StorageService.js';

export class TaxComplianceService {
    constructor(salesService, productService, supplierService) {
        this.salesService = salesService;
        this.productService = productService;
        this.supplierService = supplierService;

        this.vatRates = StorageService.get('vatRates', {
            standard: 20, // Standard VAT rate in Bulgaria
            reduced: 9,   // Reduced rate for certain goods
            zero: 0       // Zero rate for exports, etc.
        });

        this.taxSettings = StorageService.get('taxSettings', {
            companyName: '',
            taxId: '',      // ЕИК/БУЛСТАТ
            vatNumber: '',  // ДДС номер
            address: '',
            vatRegistered: true,
            fiscalYearStart: '01-01' // MM-DD format
        });

        this.taxDeclarations = StorageService.get('taxDeclarations', []);
    }

    /**
     * Generate VAT (ДДС) report for period
     * @param {string} period - Period ('month', 'quarter')
     * @param {Object} dateRange - Optional custom date range
     * @returns {Object} VAT report
     */
    generateVATReport(period = 'month', dateRange = null) {
        const range = dateRange || this._parsePeriod(period);
        const sales = this._filterByDateRange(this.salesService.getAllSales(), range);

        // Output VAT (collected from customers)
        const outputVAT = this._calculateOutputVAT(sales);

        // Input VAT (paid to suppliers) - simplified, would come from purchase records
        const inputVAT = this._calculateInputVAT(range);

        // Net VAT payable/receivable
        const netVAT = outputVAT.totalVAT - inputVAT.totalVAT;

        return {
            success: true,
            vatReport: {
                period: {
                    type: period,
                    start: range.start.toISOString().split('T')[0],
                    end: range.end.toISOString().split('T')[0]
                },

                company: this.taxSettings,

                outputVAT: {
                    ...outputVAT,
                    totalVAT: Math.round(outputVAT.totalVAT * 100) / 100
                },

                inputVAT: {
                    ...inputVAT,
                    totalVAT: Math.round(inputVAT.totalVAT * 100) / 100
                },

                summary: {
                    netVATPayable: Math.round(netVAT * 100) / 100,
                    status: netVAT > 0 ? 'payable' : 'receivable',
                    dueDate: this._calculateVATDueDate(range.end)
                },

                compliance: this._checkCompliance(outputVAT, inputVAT)
            }
        };
    }

    /**
     * Generate sales journal (Дневник продажби)
     * @param {string} period - Period
     * @returns {Object} Sales journal
     */
    generateSalesJournal(period = 'month') {
        const range = this._parsePeriod(period);
        const sales = this._filterByDateRange(this.salesService.getAllSales(), range);

        const journal = sales.map((sale, index) => {
            const vatAmount = this._calculateSaleVAT(sale);
            const netAmount = sale.total - vatAmount;

            return {
                lineNumber: index + 1,
                date: new Date(sale.date).toISOString().split('T')[0],
                documentNumber: sale.id,
                customerName: this._getCustomerName(sale.customerId),
                customerTaxId: this._getCustomerTaxId(sale.customerId),
                netAmount: Math.round(netAmount * 100) / 100,
                vatRate: this._getSaleVATRate(sale),
                vatAmount: Math.round(vatAmount * 100) / 100,
                totalAmount: Math.round(sale.total * 100) / 100,
                paymentMethod: sale.paymentMethod || 'cash'
            };
        });

        // Calculate totals
        const totals = {
            netAmount: journal.reduce((sum, entry) => sum + entry.netAmount, 0),
            vatAmount: journal.reduce((sum, entry) => sum + entry.vatAmount, 0),
            totalAmount: journal.reduce((sum, entry) => sum + entry.totalAmount, 0),
            transactionCount: journal.length
        };

        return {
            success: true,
            salesJournal: {
                period: {
                    start: range.start.toISOString().split('T')[0],
                    end: range.end.toISOString().split('T')[0]
                },
                company: this.taxSettings,
                entries: journal,
                totals: {
                    netAmount: Math.round(totals.netAmount * 100) / 100,
                    vatAmount: Math.round(totals.vatAmount * 100) / 100,
                    totalAmount: Math.round(totals.totalAmount * 100) / 100,
                    transactionCount: totals.transactionCount
                }
            }
        };
    }

    /**
     * Generate purchase journal (Дневник покупки)
     * @param {string} period - Period
     * @returns {Object} Purchase journal
     */
    generatePurchaseJournal(period = 'month') {
        const range = this._parsePeriod(period);

        // Get supplier orders from period
        const allSuppliers = this.supplierService.getAllSuppliers();
        const purchases = [];

        if (allSuppliers.success) {
            allSuppliers.suppliers.forEach(supplier => {
                const orders = supplier.orders || [];
                const periodOrders = orders.filter(order => {
                    const orderDate = new Date(order.date);
                    return orderDate >= range.start && orderDate <= range.end;
                });

                periodOrders.forEach(order => {
                    const total = order.items.reduce((sum, item) => sum + item.totalPrice, 0);
                    const vatAmount = total * (this.vatRates.standard / (100 + this.vatRates.standard));
                    const netAmount = total - vatAmount;

                    purchases.push({
                        date: new Date(order.date).toISOString().split('T')[0],
                        documentNumber: order.id,
                        supplierName: supplier.name,
                        supplierTaxId: supplier.taxId || '',
                        netAmount: Math.round(netAmount * 100) / 100,
                        vatRate: this.vatRates.standard,
                        vatAmount: Math.round(vatAmount * 100) / 100,
                        totalAmount: Math.round(total * 100) / 100
                    });
                });
            });
        }

        const journal = purchases.map((purchase, index) => ({
            lineNumber: index + 1,
            ...purchase
        }));

        const totals = {
            netAmount: journal.reduce((sum, entry) => sum + entry.netAmount, 0),
            vatAmount: journal.reduce((sum, entry) => sum + entry.vatAmount, 0),
            totalAmount: journal.reduce((sum, entry) => sum + entry.totalAmount, 0),
            transactionCount: journal.length
        };

        return {
            success: true,
            purchaseJournal: {
                period: {
                    start: range.start.toISOString().split('T')[0],
                    end: range.end.toISOString().split('T')[0]
                },
                company: this.taxSettings,
                entries: journal,
                totals: {
                    netAmount: Math.round(totals.netAmount * 100) / 100,
                    vatAmount: Math.round(totals.vatAmount * 100) / 100,
                    totalAmount: Math.round(totals.totalAmount * 100) / 100,
                    transactionCount: totals.transactionCount
                }
            }
        };
    }

    /**
     * Prepare VAT declaration (Справка-декларация за ДДС)
     * @param {string} period - Period ('month', 'quarter')
     * @returns {Object} VAT declaration
     */
    prepareVATDeclaration(period = 'month') {
        const vatReport = this.generateVATReport(period);
        const salesJournal = this.generateSalesJournal(period);
        const purchaseJournal = this.generatePurchaseJournal(period);

        if (!vatReport.success) {
            return vatReport;
        }

        // Build declaration according to НАП format
        const declaration = {
            declarationType: 'VAT',
            period: vatReport.vatReport.period,
            company: this.taxSettings,

            // Section 1: Sales and output VAT
            section1: {
                domesticSales: {
                    taxableBase: salesJournal.salesJournal.totals.netAmount,
                    vatAmount: salesJournal.salesJournal.totals.vatAmount
                },
                exportSales: {
                    taxableBase: 0,
                    vatAmount: 0
                },
                totalOutput: salesJournal.salesJournal.totals.vatAmount
            },

            // Section 2: Purchases and input VAT
            section2: {
                domesticPurchases: {
                    taxableBase: purchaseJournal.purchaseJournal.totals.netAmount,
                    vatAmount: purchaseJournal.purchaseJournal.totals.vatAmount
                },
                importPurchases: {
                    taxableBase: 0,
                    vatAmount: 0
                },
                totalInput: purchaseJournal.purchaseJournal.totals.vatAmount
            },

            // Section 3: Calculation
            section3: {
                outputVAT: salesJournal.salesJournal.totals.vatAmount,
                inputVAT: purchaseJournal.purchaseJournal.totals.vatAmount,
                netVAT: salesJournal.salesJournal.totals.vatAmount - purchaseJournal.purchaseJournal.totals.vatAmount,
                vatToPay: Math.max(0, salesJournal.salesJournal.totals.vatAmount - purchaseJournal.purchaseJournal.totals.vatAmount),
                vatToReceive: Math.max(0, purchaseJournal.purchaseJournal.totals.vatAmount - salesJournal.salesJournal.totals.vatAmount)
            },

            // Metadata
            preparedAt: new Date().toISOString(),
            preparedBy: 'POS System',
            status: 'draft'
        };

        return {
            success: true,
            declaration: declaration
        };
    }

    /**
     * Generate annual tax summary
     * @param {number} year - Tax year
     * @returns {Object} Annual summary
     */
    generateAnnualTaxSummary(year) {
        const fiscalStart = new Date(year, 0, 1);
        const fiscalEnd = new Date(year, 11, 31, 23, 59, 59, 999);
        const dateRange = { start: fiscalStart, end: fiscalEnd };

        const sales = this._filterByDateRange(this.salesService.getAllSales(), dateRange);

        // Calculate monthly breakdown
        const monthlyData = [];
        for (let month = 0; month < 12; month++) {
            const monthStart = new Date(year, month, 1);
            const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);
            const monthRange = { start: monthStart, end: monthEnd };

            const vatReport = this.generateVATReport('month', monthRange);

            monthlyData.push({
                month: month + 1,
                monthName: monthStart.toLocaleString('bg-BG', { month: 'long' }),
                outputVAT: vatReport.vatReport.outputVAT.totalVAT,
                inputVAT: vatReport.vatReport.inputVAT.totalVAT,
                netVAT: vatReport.vatReport.summary.netVATPayable
            });
        }

        // Annual totals
        const annualTotals = {
            totalRevenue: sales.reduce((sum, s) => sum + s.total, 0),
            totalOutputVAT: monthlyData.reduce((sum, m) => sum + m.outputVAT, 0),
            totalInputVAT: monthlyData.reduce((sum, m) => sum + m.inputVAT, 0),
            netVATPaid: monthlyData.reduce((sum, m) => sum + m.netVAT, 0),
            transactionCount: sales.length
        };

        return {
            success: true,
            annualSummary: {
                year: year,
                company: this.taxSettings,
                monthlyBreakdown: monthlyData,
                annualTotals: {
                    totalRevenue: Math.round(annualTotals.totalRevenue * 100) / 100,
                    totalOutputVAT: Math.round(annualTotals.totalOutputVAT * 100) / 100,
                    totalInputVAT: Math.round(annualTotals.totalInputVAT * 100) / 100,
                    netVATPaid: Math.round(annualTotals.netVATPaid * 100) / 100,
                    transactionCount: annualTotals.transactionCount
                },
                compliance: {
                    declarationsFiled: this.taxDeclarations.filter(d =>
                        new Date(d.period.start).getFullYear() === year
                    ).length,
                    expectedDeclarations: 12, // Monthly VAT in Bulgaria
                    complianceRate: Math.round((this.taxDeclarations.filter(d =>
                        new Date(d.period.start).getFullYear() === year
                    ).length / 12) * 10000) / 100
                }
            }
        };
    }

    /**
     * Save VAT declaration
     * @param {Object} declaration - Declaration to save
     * @returns {Object} Result
     */
    saveDeclaration(declaration) {
        const saved = {
            id: Date.now() + Math.random(),
            ...declaration,
            savedAt: new Date().toISOString()
        };

        this.taxDeclarations.push(saved);
        this._saveDeclarations();

        return {
            success: true,
            declaration: saved
        };
    }

    /**
     * Get all tax declarations
     * @param {number} year - Optional: filter by year
     * @returns {Object} Declarations
     */
    getDeclarations(year = null) {
        let declarations = this.taxDeclarations;

        if (year) {
            declarations = declarations.filter(d =>
                new Date(d.period.start).getFullYear() === year
            );
        }

        return {
            success: true,
            declarations: declarations.sort((a, b) =>
                new Date(b.period.start) - new Date(a.period.start)
            )
        };
    }

    /**
     * Export declaration to XML (НАП format)
     * @param {number} declarationId - Declaration ID
     * @returns {Object} XML export
     */
    exportDeclarationToXML(declarationId) {
        const declaration = this.taxDeclarations.find(d => d.id === declarationId);

        if (!declaration) {
            return {
                success: false,
                errors: ['Декларацията не е намерена']
            };
        }

        // Simplified XML format (real НАП format is more complex)
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<VATDeclaration>
    <Header>
        <CompanyName>${this._escapeXML(this.taxSettings.companyName)}</CompanyName>
        <TaxID>${this._escapeXML(this.taxSettings.taxId)}</TaxID>
        <VATNumber>${this._escapeXML(this.taxSettings.vatNumber)}</VATNumber>
        <PeriodStart>${declaration.period.start}</PeriodStart>
        <PeriodEnd>${declaration.period.end}</PeriodEnd>
    </Header>
    <Section1_OutputVAT>
        <DomesticSales>
            <TaxableBase>${declaration.section1.domesticSales.taxableBase}</TaxableBase>
            <VATAmount>${declaration.section1.domesticSales.vatAmount}</VATAmount>
        </DomesticSales>
        <TotalOutput>${declaration.section1.totalOutput}</TotalOutput>
    </Section1_OutputVAT>
    <Section2_InputVAT>
        <DomesticPurchases>
            <TaxableBase>${declaration.section2.domesticPurchases.taxableBase}</TaxableBase>
            <VATAmount>${declaration.section2.domesticPurchases.vatAmount}</VATAmount>
        </DomesticPurchases>
        <TotalInput>${declaration.section2.totalInput}</TotalInput>
    </Section2_InputVAT>
    <Section3_Calculation>
        <OutputVAT>${declaration.section3.outputVAT}</OutputVAT>
        <InputVAT>${declaration.section3.inputVAT}</InputVAT>
        <NetVAT>${declaration.section3.netVAT}</NetVAT>
        <VATToPay>${declaration.section3.vatToPay}</VATToPay>
        <VATToReceive>${declaration.section3.vatToReceive}</VATToReceive>
    </Section3_Calculation>
    <Footer>
        <PreparedAt>${declaration.preparedAt}</PreparedAt>
        <PreparedBy>${this._escapeXML(declaration.preparedBy)}</PreparedBy>
    </Footer>
</VATDeclaration>`;

        return {
            success: true,
            format: 'xml',
            data: xml,
            filename: `VAT_Declaration_${declaration.period.start}_${declaration.period.end}.xml`
        };
    }

    /**
     * Update tax settings
     * @param {Object} settings - Tax settings
     * @returns {Object} Result
     */
    updateTaxSettings(settings) {
        this.taxSettings = { ...this.taxSettings, ...settings };
        StorageService.set('taxSettings', this.taxSettings);

        return {
            success: true,
            settings: this.taxSettings
        };
    }

    /**
     * Get tax settings
     * @returns {Object} Tax settings
     */
    getTaxSettings() {
        return {
            success: true,
            settings: this.taxSettings
        };
    }

    // ============ PRIVATE METHODS ============

    _calculateOutputVAT(sales) {
        const byRate = {
            standard: { taxableBase: 0, vatAmount: 0, transactionCount: 0 },
            reduced: { taxableBase: 0, vatAmount: 0, transactionCount: 0 },
            zero: { taxableBase: 0, vatAmount: 0, transactionCount: 0 }
        };

        let totalVAT = 0;

        sales.forEach(sale => {
            const vatAmount = this._calculateSaleVAT(sale);
            const netAmount = sale.total - vatAmount;
            const rate = this._getSaleVATRate(sale);

            let rateCategory = 'standard';
            if (rate === this.vatRates.reduced) rateCategory = 'reduced';
            if (rate === this.vatRates.zero) rateCategory = 'zero';

            byRate[rateCategory].taxableBase += netAmount;
            byRate[rateCategory].vatAmount += vatAmount;
            byRate[rateCategory].transactionCount++;

            totalVAT += vatAmount;
        });

        return {
            byRate: {
                standard: {
                    rate: this.vatRates.standard,
                    taxableBase: Math.round(byRate.standard.taxableBase * 100) / 100,
                    vatAmount: Math.round(byRate.standard.vatAmount * 100) / 100,
                    transactionCount: byRate.standard.transactionCount
                },
                reduced: {
                    rate: this.vatRates.reduced,
                    taxableBase: Math.round(byRate.reduced.taxableBase * 100) / 100,
                    vatAmount: Math.round(byRate.reduced.vatAmount * 100) / 100,
                    transactionCount: byRate.reduced.transactionCount
                },
                zero: {
                    rate: this.vatRates.zero,
                    taxableBase: Math.round(byRate.zero.taxableBase * 100) / 100,
                    vatAmount: Math.round(byRate.zero.vatAmount * 100) / 100,
                    transactionCount: byRate.zero.transactionCount
                }
            },
            totalVAT: totalVAT,
            totalTransactions: sales.length
        };
    }

    _calculateInputVAT(dateRange) {
        // Simplified - would get from actual purchase records
        const purchaseJournal = this.generatePurchaseJournal('month');

        return {
            byRate: {
                standard: {
                    rate: this.vatRates.standard,
                    taxableBase: purchaseJournal.purchaseJournal.totals.netAmount,
                    vatAmount: purchaseJournal.purchaseJournal.totals.vatAmount,
                    transactionCount: purchaseJournal.purchaseJournal.totals.transactionCount
                }
            },
            totalVAT: purchaseJournal.purchaseJournal.totals.vatAmount,
            totalTransactions: purchaseJournal.purchaseJournal.totals.transactionCount
        };
    }

    _calculateSaleVAT(sale) {
        // VAT is included in total price
        const vatRate = this._getSaleVATRate(sale);
        const vatAmount = sale.total * (vatRate / (100 + vatRate));
        return vatAmount;
    }

    _getSaleVATRate(sale) {
        // Default to standard rate - in real system, would check product VAT categories
        return this.vatRates.standard;
    }

    _getCustomerName(customerId) {
        if (!customerId) return 'Неизвестен клиент';

        const customer = this.customerService?.getCustomerById(customerId);
        return customer ? customer.name : 'Неизвестен клиент';
    }

    _getCustomerTaxId(customerId) {
        if (!customerId) return '';

        const customer = this.customerService?.getCustomerById(customerId);
        return customer?.taxId || '';
    }

    _calculateVATDueDate(periodEnd) {
        // VAT is due on the 14th of the month following the tax period
        const dueDate = new Date(periodEnd);
        dueDate.setMonth(dueDate.getMonth() + 1);
        dueDate.setDate(14);
        return dueDate.toISOString().split('T')[0];
    }

    _checkCompliance(outputVAT, inputVAT) {
        const issues = [];

        if (!this.taxSettings.vatRegistered) {
            issues.push({
                type: 'warning',
                message: 'Фирмата не е регистрирана по ДДС'
            });
        }

        if (!this.taxSettings.vatNumber) {
            issues.push({
                type: 'error',
                message: 'Липсва ДДС номер'
            });
        }

        if (!this.taxSettings.taxId) {
            issues.push({
                type: 'error',
                message: 'Липсва ЕИК/БУЛСТАТ'
            });
        }

        if (outputVAT.totalTransactions === 0) {
            issues.push({
                type: 'info',
                message: 'Няма продажби за периода'
            });
        }

        return {
            compliant: issues.filter(i => i.type === 'error').length === 0,
            issues: issues
        };
    }

    _parsePeriod(period) {
        const now = new Date();
        let start, end;

        if (period === 'month') {
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        } else if (period === 'quarter') {
            const currentQuarter = Math.floor(now.getMonth() / 3);
            start = new Date(now.getFullYear(), currentQuarter * 3, 1);
            end = new Date(now.getFullYear(), (currentQuarter + 1) * 3, 0, 23, 59, 59, 999);
        } else if (period === 'year') {
            start = new Date(now.getFullYear(), 0, 1);
            end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
        } else {
            start = new Date(0);
            end = now;
        }

        return { start, end };
    }

    _filterByDateRange(sales, dateRange) {
        return sales.filter(sale => {
            const saleDate = new Date(sale.date);
            return saleDate >= dateRange.start && saleDate <= dateRange.end;
        });
    }

    _escapeXML(text) {
        if (!text) return '';
        return text.toString()
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    _saveDeclarations() {
        StorageService.set('taxDeclarations', this.taxDeclarations);
    }
}
