/**
 * SalesService - Sales, checkout and reporting
 */
import { StorageService } from './StorageService.js';

export class SalesService {
    constructor(productService, customerService, authService) {
        this.productService = productService;
        this.customerService = customerService;
        this.authService = authService;
        this.sales = [];
        this.loadSales();
    }

    /**
     * Load sales from storage
     */
    loadSales() {
        this.sales = StorageService.getSales();
    }

    /**
     * Save sales to storage
     */
    saveSales() {
        StorageService.setSales(this.sales);
    }

    /**
     * Get all sales
     */
    getAllSales() {
        return this.sales;
    }

    /**
     * Get sale by ID
     */
    getSaleById(id) {
        return this.sales.find(s => s.id === id);
    }

    /**
     * Process checkout with multiple payment methods
     */
    processCheckoutWithMultiplePayments(checkoutData) {
        const {
            cart,
            payments, // Array of {method: 'cash'|'card', amount: number}
            customerId = null,
            subtotal,
            discount = 0,
            total
        } = checkoutData;

        // Validate payments total
        const paymentsTotal = payments.reduce((sum, p) => sum + p.amount, 0);
        if (Math.abs(paymentsTotal - total) > 0.01) {
            return {
                success: false,
                errors: ['Сумата на плащанията не съответства на общата сума']
            };
        }

        // Use existing checkout logic but store multiple payments
        const result = this.processCheckout({
            ...checkoutData,
            paymentMethod: 'multiple' // Mark as multiple
        });

        if (result.success) {
            // Add payments array to sale
            result.sale.payments = payments;
        }

        return result;
    }

    /**
     * Process checkout and create sale
     */
    processCheckout(checkoutData) {
        const {
            cart,
            paymentMethod,
            customerId = null,
            subtotal,
            discount = 0,
            total
        } = checkoutData;

        // Validate cart
        if (!cart || cart.length === 0) {
            return {
                success: false,
                errors: ['Количката е празна!']
            };
        }

        // Validate payment method
        if (!['cash', 'card'].includes(paymentMethod)) {
            return {
                success: false,
                errors: ['Невалиден метод на плащане!']
            };
        }

        // Get current user
        const currentUser = this.authService.getCurrentUser();
        if (!currentUser) {
            return {
                success: false,
                errors: ['Не сте влезли в системата!']
            };
        }

        // Get customer if specified
        let customer = null;
        let customerName = 'Гост';
        if (customerId) {
            customer = this.customerService.getCustomerById(customerId);
            if (customer) {
                customerName = customer.name;
            }
        }

        // Verify stock availability for all items
        const stockErrors = [];
        for (const item of cart) {
            const product = this.productService.getProductById(item.id);
            if (!product) {
                stockErrors.push(`Продуктът "${item.name}" не е намерен`);
            } else if (product.stock < item.quantity) {
                stockErrors.push(
                    `Недостатъчна наличност за "${item.name}". ` +
                    `Налични: ${product.stock}, Поискани: ${item.quantity}`
                );
            }
        }

        if (stockErrors.length > 0) {
            return {
                success: false,
                errors: stockErrors
            };
        }

        // Create sale record
        const sale = {
            id: Date.now(),
            date: new Date().toISOString(),
            items: cart.map(item => ({
                productId: item.id,
                name: item.name,
                barcode: item.barcode || '',
                price: item.price,
                quantity: item.quantity,
                total: item.price * item.quantity
            })),
            subtotal,
            discount,
            total,
            paymentMethod,
            customerId: customerId,
            customerName: customerName,
            userId: currentUser.id,
            userName: currentUser.name
        };

        // Update inventory (reduce stock)
        for (const item of cart) {
            const result = this.productService.updateStock(item.id, -item.quantity);
            if (!result.success) {
                return {
                    success: false,
                    errors: [`Грешка при обновяване на инвентар: ${result.errors.join(', ')}`]
                };
            }
        }

        // Update customer loyalty if applicable
        let pointsEarned = 0;
        if (customer) {
            const loyaltyResult = this.customerService.updateAfterPurchase(
                customerId,
                total
            );

            if (loyaltyResult.success) {
                pointsEarned = loyaltyResult.pointsEarned;
            }
        }

        // Save sale
        this.sales.push(sale);
        this.saveSales();

        return {
            success: true,
            sale: sale,
            pointsEarned: pointsEarned
        };
    }

    /**
     * Filter sales by date range
     */
    filterByDateRange(fromDate, toDate) {
        let filtered = this.sales;

        if (fromDate) {
            const from = new Date(fromDate);
            filtered = filtered.filter(s => new Date(s.date) >= from);
        }

        if (toDate) {
            const to = new Date(toDate + 'T23:59:59');
            filtered = filtered.filter(s => new Date(s.date) <= to);
        }

        return filtered;
    }

    /**
     * Filter sales by payment method
     */
    filterByPaymentMethod(method) {
        if (!method || method === 'all') {
            return this.sales;
        }

        return this.sales.filter(s => s.paymentMethod === method);
    }

    /**
     * Filter sales by period (day, week, month, all)
     */
    filterByPeriod(period) {
        const now = new Date();
        let startDate;

        switch (period) {
            case 'day':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                break;
            case 'week':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case 'month':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
            case 'all':
            default:
                return this.sales;
        }

        return this.sales.filter(s => new Date(s.date) >= startDate);
    }

    /**
     * Get sales statistics
     */
    getSalesStats(period = 'all') {
        const sales = this.filterByPeriod(period);

        if (sales.length === 0) {
            return {
                totalSales: 0,
                salesCount: 0,
                averageSale: 0,
                topProduct: null,
                cashTotal: 0,
                cardTotal: 0
            };
        }

        const totalSales = sales.reduce((sum, s) => sum + s.total, 0);
        const salesCount = sales.length;
        const averageSale = totalSales / salesCount;

        // Calculate product sales
        const productSales = {};
        sales.forEach(sale => {
            sale.items.forEach(item => {
                if (!productSales[item.name]) {
                    productSales[item.name] = 0;
                }
                productSales[item.name] += item.quantity;
            });
        });

        // Find top product
        const topProductEntry = Object.entries(productSales)
            .sort((a, b) => b[1] - a[1])[0];

        const topProduct = topProductEntry
            ? { name: topProductEntry[0], quantity: topProductEntry[1] }
            : null;

        // Calculate totals by payment method
        const cashTotal = sales
            .filter(s => s.paymentMethod === 'cash')
            .reduce((sum, s) => sum + s.total, 0);

        const cardTotal = sales
            .filter(s => s.paymentMethod === 'card')
            .reduce((sum, s) => sum + s.total, 0);

        return {
            totalSales,
            salesCount,
            averageSale,
            topProduct,
            cashTotal,
            cardTotal
        };
    }

    /**
     * Get sales data for chart (by date)
     */
    getSalesChartData(period = 'week') {
        const sales = this.filterByPeriod(period);

        // Group sales by date
        const salesByDate = {};
        sales.forEach(sale => {
            const date = new Date(sale.date).toLocaleDateString('bg-BG');
            salesByDate[date] = (salesByDate[date] || 0) + sale.total;
        });

        // Get last N days
        const days = period === 'day' ? 1 : period === 'week' ? 7 : 30;
        const labels = [];
        const data = [];

        for (let i = days - 1; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toLocaleDateString('bg-BG');

            labels.push(dateStr);
            data.push(salesByDate[dateStr] || 0);
        }

        return { labels, data };
    }

    /**
     * Get payment method distribution for chart
     */
    getPaymentMethodChartData(period = 'all') {
        const sales = this.filterByPeriod(period);

        const cashSales = sales
            .filter(s => s.paymentMethod === 'cash')
            .reduce((sum, s) => sum + s.total, 0);

        const cardSales = sales
            .filter(s => s.paymentMethod === 'card')
            .reduce((sum, s) => sum + s.total, 0);

        return {
            labels: ['В брой', 'Карта'],
            data: [cashSales, cardSales]
        };
    }

    /**
     * Export sales to CSV format
     */
    exportToCSV() {
        const headers = ['Номер', 'Дата', 'Клиент', 'Обща сума', 'Метод', 'Касиер'];
        const rows = this.sales.map(s => [
            s.id,
            new Date(s.date).toLocaleString('bg-BG'),
            s.customerName,
            s.total.toFixed(2),
            s.paymentMethod === 'cash' ? 'В брой' : 'Карта',
            s.userName
        ]);

        return { headers, rows };
    }

    /**
     * Get recent sales
     */
    getRecentSales(limit = 10) {
        return [...this.sales]
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, limit);
    }
}
