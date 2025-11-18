/**
 * RefundService - Returns and refunds management
 */
import { StorageService } from './StorageService.js';
import { ValidationService } from './ValidationService.js';

export class RefundService {
    constructor(productService, salesService, authService) {
        this.productService = productService;
        this.salesService = salesService;
        this.authService = authService;
        this.refunds = [];
        this.loadRefunds();
    }

    /**
     * Load refunds from storage
     */
    loadRefunds() {
        this.refunds = StorageService.get('posRefunds', []);
    }

    /**
     * Save refunds to storage
     */
    saveRefunds() {
        StorageService.set('posRefunds', this.refunds);
    }

    /**
     * Get all refunds
     */
    getAllRefunds() {
        return this.refunds;
    }

    /**
     * Get refund by ID
     */
    getRefundById(id) {
        return this.refunds.find(r => r.id === id);
    }

    /**
     * Process full sale refund
     */
    processFullRefund(saleId, reason = '') {
        const sale = this.salesService.getSaleById(saleId);

        if (!sale) {
            return {
                success: false,
                errors: ['Продажбата не е намерена']
            };
        }

        // Check if already refunded
        if (this.refunds.some(r => r.saleId === saleId && r.type === 'full')) {
            return {
                success: false,
                errors: ['Тази продажба вече е върната']
            };
        }

        const currentUser = this.authService.getCurrentUser();

        // Create refund record
        const refund = {
            id: Date.now(),
            saleId: sale.id,
            type: 'full',
            date: new Date().toISOString(),
            items: sale.items.map(item => ({
                ...item,
                refundedQuantity: item.quantity
            })),
            totalRefunded: sale.total,
            reason: ValidationService.sanitizeString(reason),
            processedBy: currentUser.id,
            processedByName: currentUser.name,
            originalSale: {
                date: sale.date,
                total: sale.total,
                customerName: sale.customerName
            }
        };

        // Restore inventory
        sale.items.forEach(item => {
            this.productService.updateStock(item.productId, item.quantity);
        });

        // Reverse customer loyalty points if applicable
        if (sale.customerId) {
            const pointsToRemove = Math.floor(sale.total);
            // Note: CustomerService would need a method to remove points
        }

        this.refunds.push(refund);
        this.saveRefunds();

        return {
            success: true,
            refund: refund
        };
    }

    /**
     * Process partial refund
     */
    processPartialRefund(saleId, itemsToRefund, reason = '') {
        const sale = this.salesService.getSaleById(saleId);

        if (!sale) {
            return {
                success: false,
                errors: ['Продажбата не е намерена']
            };
        }

        // Validate items to refund
        const errors = [];
        let totalRefunded = 0;

        const refundItems = itemsToRefund.map(refundItem => {
            const saleItem = sale.items.find(si => si.productId === refundItem.productId);

            if (!saleItem) {
                errors.push(`Продукт ${refundItem.productId} не е в продажбата`);
                return null;
            }

            // Check already refunded quantity
            const alreadyRefunded = this.getRefundedQuantity(saleId, refundItem.productId);
            const availableToRefund = saleItem.quantity - alreadyRefunded;

            if (refundItem.quantity > availableToRefund) {
                errors.push(
                    `Максимум ${availableToRefund} бр. могат да бъдат върнати за ${saleItem.name}`
                );
                return null;
            }

            const refundAmount = saleItem.price * refundItem.quantity;
            totalRefunded += refundAmount;

            return {
                productId: saleItem.productId,
                name: saleItem.name,
                price: saleItem.price,
                quantity: saleItem.quantity,
                refundedQuantity: refundItem.quantity,
                refundAmount: refundAmount
            };
        }).filter(item => item !== null);

        if (errors.length > 0) {
            return {
                success: false,
                errors: errors
            };
        }

        const currentUser = this.authService.getCurrentUser();

        // Create partial refund record
        const refund = {
            id: Date.now(),
            saleId: sale.id,
            type: 'partial',
            date: new Date().toISOString(),
            items: refundItems,
            totalRefunded: totalRefunded,
            reason: ValidationService.sanitizeString(reason),
            processedBy: currentUser.id,
            processedByName: currentUser.name,
            originalSale: {
                date: sale.date,
                total: sale.total,
                customerName: sale.customerName
            }
        };

        // Restore inventory for refunded items
        refundItems.forEach(item => {
            this.productService.updateStock(item.productId, item.refundedQuantity);
        });

        this.refunds.push(refund);
        this.saveRefunds();

        return {
            success: true,
            refund: refund
        };
    }

    /**
     * Get refunded quantity for a product in a sale
     */
    getRefundedQuantity(saleId, productId) {
        const saleRefunds = this.refunds.filter(r => r.saleId === saleId);

        let totalRefunded = 0;
        saleRefunds.forEach(refund => {
            const item = refund.items.find(i => i.productId === productId);
            if (item) {
                totalRefunded += item.refundedQuantity;
            }
        });

        return totalRefunded;
    }

    /**
     * Check if sale can be refunded
     */
    canRefund(saleId) {
        const sale = this.salesService.getSaleById(saleId);

        if (!sale) {
            return {
                canRefund: false,
                reason: 'Продажбата не е намерена'
            };
        }

        // Check if fully refunded
        const fullRefund = this.refunds.find(r => r.saleId === saleId && r.type === 'full');
        if (fullRefund) {
            return {
                canRefund: false,
                reason: 'Продажбата е изцяло върната'
            };
        }

        // Check if any items left to refund
        const allItemsRefunded = sale.items.every(item => {
            const refunded = this.getRefundedQuantity(saleId, item.productId);
            return refunded >= item.quantity;
        });

        if (allItemsRefunded) {
            return {
                canRefund: false,
                reason: 'Всички артикули са върнати'
            };
        }

        return {
            canRefund: true,
            availableItems: sale.items.map(item => ({
                ...item,
                refundedQuantity: this.getRefundedQuantity(saleId, item.productId),
                availableToRefund: item.quantity - this.getRefundedQuantity(saleId, item.productId)
            }))
        };
    }

    /**
     * Get refund statistics
     */
    getRefundStats(period = 'all') {
        let filteredRefunds = this.refunds;

        // Filter by period
        if (period !== 'all') {
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
            }

            if (startDate) {
                filteredRefunds = this.refunds.filter(r => new Date(r.date) >= startDate);
            }
        }

        const totalRefunds = filteredRefunds.length;
        const totalAmount = filteredRefunds.reduce((sum, r) => sum + r.totalRefunded, 0);
        const fullRefunds = filteredRefunds.filter(r => r.type === 'full').length;
        const partialRefunds = filteredRefunds.filter(r => r.type === 'partial').length;

        return {
            totalRefunds,
            totalAmount,
            fullRefunds,
            partialRefunds,
            averageRefund: totalRefunds > 0 ? totalAmount / totalRefunds : 0
        };
    }

    /**
     * Export refunds to CSV
     */
    exportToCSV() {
        const headers = ['Номер', 'Дата', 'Тип', 'Продажба ID', 'Обща сума', 'Причина', 'Обработено от'];
        const rows = this.refunds.map(r => [
            r.id,
            new Date(r.date).toLocaleString('bg-BG'),
            r.type === 'full' ? 'Пълно' : 'Частично',
            r.saleId,
            r.totalRefunded.toFixed(2),
            r.reason || '-',
            r.processedByName
        ]);

        return { headers, rows };
    }
}
