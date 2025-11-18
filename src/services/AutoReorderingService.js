/**
 * Automated Reordering System - v5.0
 * Automatic purchase order generation and supplier management
 */
import { ValidationService } from './ValidationService.js';
import { StorageService } from './StorageService.js';

export class AutoReorderingService {
    constructor(aiInventoryService, supplierService, productService, authService) {
        this.aiInventoryService = aiInventoryService;
        this.supplierService = supplierService;
        this.productService = productService;
        this.authService = authService;

        this.autoReorderSettings = StorageService.get('autoReorderSettings', {
            enabled: false,
            approvalRequired: true,
            batchOptimization: true,
            freeShippingThreshold: 500, // Minimum order value for free shipping
            preferredSuppliers: [],
            checkFrequencyHours: 24,
            notifyOnOrder: true
        });

        this.pendingOrders = StorageService.get('autoPendingOrders', []);
        this.orderHistory = StorageService.get('autoOrderHistory', []);
        this.lastCheckTime = StorageService.get('autoReorderLastCheck', null);
    }

    /**
     * Enable/disable auto reordering
     * @param {boolean} enabled - Enable state
     * @param {Object} settings - Settings
     * @returns {Object} Result
     */
    setEnabled(enabled, settings = {}) {
        this.autoReorderSettings.enabled = enabled;

        if (settings) {
            this.autoReorderSettings = { ...this.autoReorderSettings, ...settings };
        }

        this._saveSettings();

        if (enabled) {
            // Start auto-check interval
            this._startAutoCheck();
        }

        return {
            success: true,
            autoReordering: {
                enabled: this.autoReorderSettings.enabled,
                settings: this.autoReorderSettings
            }
        };
    }

    /**
     * Run reorder check manually
     * @param {Object} options - Check options
     * @returns {Object} Recommendations
     */
    checkReorderNeeds(options = {}) {
        const optimization = this.aiInventoryService.optimizeAllProducts(options);

        if (!optimization.success) {
            return optimization;
        }

        // Filter products that need ordering
        const productsToOrder = optimization.optimization.products.filter(p =>
            p.orderQuantity > 0 && (p.urgency === 'critical' || p.urgency === 'high')
        );

        // Group by supplier
        const ordersBySupplier = this._groupBySupplier(productsToOrder);

        // Apply batch optimization
        if (this.autoReorderSettings.batchOptimization) {
            this._optimizeBatches(ordersBySupplier);
        }

        this.lastCheckTime = new Date().toISOString();
        StorageService.set('autoReorderLastCheck', this.lastCheckTime);

        return {
            success: true,
            check: {
                timestamp: this.lastCheckTime,
                productsNeedingReorder: productsToOrder.length,
                ordersBySupplier: ordersBySupplier,
                totalOrderValue: productsToOrder.reduce((sum, p) => sum + p.orderValue, 0),
                recommendations: productsToOrder
            }
        };
    }

    /**
     * Create automatic purchase orders
     * @param {boolean} forceCreate - Skip approval requirement
     * @returns {Object} Created orders
     */
    createAutomaticOrders(forceCreate = false) {
        const check = this.checkReorderNeeds();

        if (!check.success) {
            return check;
        }

        const orders = [];

        Object.keys(check.check.ordersBySupplier).forEach(supplierId => {
            const supplierGroup = check.check.ordersBySupplier[supplierId];

            const order = {
                id: Date.now() + Math.random(),
                supplierId: parseInt(supplierId),
                supplierName: supplierGroup.supplierName,
                items: supplierGroup.items.map(item => ({
                    productId: item.productId,
                    productName: item.productName,
                    quantity: item.orderQuantity,
                    unitPrice: item.unitPrice,
                    totalPrice: item.orderQuantity * item.unitPrice
                })),
                totalValue: supplierGroup.totalValue,
                status: this.autoReorderSettings.approvalRequired && !forceCreate ? 'pending_approval' : 'sent',
                createdBy: 'AutoReorder System',
                createdAt: new Date().toISOString(),
                automatic: true
            };

            if (this.autoReorderSettings.approvalRequired && !forceCreate) {
                this.pendingOrders.push(order);
                this._savePendingOrders();
            } else {
                // Create order through SupplierService
                const result = this.supplierService.createOrder({
                    supplierId: order.supplierId,
                    items: order.items,
                    notes: 'Автоматична поръчка от AI система'
                });

                if (result.success) {
                    order.supplierOrderId = result.order.id;
                    this.orderHistory.push(order);
                    this._saveOrderHistory();
                }
            }

            orders.push(order);
        });

        return {
            success: true,
            orders: {
                created: orders.length,
                pendingApproval: orders.filter(o => o.status === 'pending_approval').length,
                sent: orders.filter(o => o.status === 'sent').length,
                orders: orders
            }
        };
    }

    /**
     * Approve pending order
     * @param {number} orderId - Order ID
     * @returns {Object} Result
     */
    approvePendingOrder(orderId) {
        const orderIndex = this.pendingOrders.findIndex(o => o.id === orderId);

        if (orderIndex === -1) {
            return {
                success: false,
                errors: ['Поръчката не е намерена']
            };
        }

        const order = this.pendingOrders[orderIndex];

        // Create order through SupplierService
        const result = this.supplierService.createOrder({
            supplierId: order.supplierId,
            items: order.items,
            notes: 'Одобрена автоматична поръчка'
        });

        if (result.success) {
            order.status = 'sent';
            order.supplierOrderId = result.order.id;
            order.approvedAt = new Date().toISOString();
            order.approvedBy = this.authService.getCurrentUser()?.name || 'System';

            this.orderHistory.push(order);
            this.pendingOrders.splice(orderIndex, 1);

            this._savePendingOrders();
            this._saveOrderHistory();

            return {
                success: true,
                order: order
            };
        }

        return result;
    }

    /**
     * Reject pending order
     * @param {number} orderId - Order ID
     * @param {string} reason - Rejection reason
     * @returns {Object} Result
     */
    rejectPendingOrder(orderId, reason = '') {
        const orderIndex = this.pendingOrders.findIndex(o => o.id === orderId);

        if (orderIndex === -1) {
            return {
                success: false,
                errors: ['Поръчката не е намерена']
            };
        }

        const order = this.pendingOrders[orderIndex];
        order.status = 'rejected';
        order.rejectedAt = new Date().toISOString();
        order.rejectedBy = this.authService.getCurrentUser()?.name || 'System';
        order.rejectionReason = ValidationService.sanitizeString(reason);

        this.orderHistory.push(order);
        this.pendingOrders.splice(orderIndex, 1);

        this._savePendingOrders();
        this._saveOrderHistory();

        return {
            success: true,
            order: order
        };
    }

    /**
     * Get pending orders waiting for approval
     * @returns {Object} Pending orders
     */
    getPendingOrders() {
        return {
            success: true,
            orders: {
                pending: this.pendingOrders,
                totalPending: this.pendingOrders.length,
                totalValue: this.pendingOrders.reduce((sum, o) => sum + o.totalValue, 0)
            }
        };
    }

    /**
     * Get order history
     * @param {number} limit - Number of orders to return
     * @returns {Object} Order history
     */
    getOrderHistory(limit = 50) {
        const history = this.orderHistory
                           .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                           .slice(0, limit);

        return {
            success: true,
            history: {
                orders: history,
                totalOrders: this.orderHistory.length,
                totalValue: history.reduce((sum, o) => sum + o.totalValue, 0)
            }
        };
    }

    /**
     * Get auto-reordering statistics
     * @param {string} period - Period ('week', 'month', 'quarter')
     * @returns {Object} Statistics
     */
    getStatistics(period = 'month') {
        let startDate;
        const now = new Date();

        if (period === 'week') {
            startDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
        } else if (period === 'month') {
            startDate = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
        } else if (period === 'quarter') {
            startDate = new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000));
        }

        const periodOrders = this.orderHistory.filter(o =>
            new Date(o.createdAt) >= startDate
        );

        const sent = periodOrders.filter(o => o.status === 'sent');
        const rejected = periodOrders.filter(o => o.status === 'rejected');

        return {
            success: true,
            statistics: {
                period: period,
                totalOrders: periodOrders.length,
                sentOrders: sent.length,
                rejectedOrders: rejected.length,
                approvalRate: periodOrders.length > 0 ?
                              Math.round((sent.length / periodOrders.length) * 100) : 0,
                totalValue: sent.reduce((sum, o) => sum + o.totalValue, 0),
                avgOrderValue: sent.length > 0 ?
                              Math.round((sent.reduce((sum, o) => sum + o.totalValue, 0) / sent.length) * 100) / 100 : 0,
                timesSaved: periodOrders.length * 15 // Estimate 15 minutes per manual order
            }
        };
    }

    /**
     * Update settings
     * @param {Object} settings - New settings
     * @returns {Object} Result
     */
    updateSettings(settings) {
        this.autoReorderSettings = { ...this.autoReorderSettings, ...settings };
        this._saveSettings();

        if (this.autoReorderSettings.enabled) {
            this._startAutoCheck();
        }

        return {
            success: true,
            settings: this.autoReorderSettings
        };
    }

    // ============ PRIVATE METHODS ============

    _groupBySupplier(products) {
        const groups = {};

        products.forEach(product => {
            const productData = this.productService.getProductById(product.productId);

            if (!productData) return;

            // Find preferred supplier for this product
            const supplierId = this._getPreferredSupplier(product.productId);

            if (!supplierId) return;

            if (!groups[supplierId]) {
                const supplier = this.supplierService.getSupplierById(supplierId);
                groups[supplierId] = {
                    supplierId: supplierId,
                    supplierName: supplier ? supplier.name : 'Unknown',
                    items: [],
                    totalValue: 0
                };
            }

            groups[supplierId].items.push({
                productId: product.productId,
                productName: product.productName,
                orderQuantity: product.orderQuantity,
                unitPrice: productData.price,
                urgency: product.urgency
            });

            groups[supplierId].totalValue += product.orderValue;
        });

        return groups;
    }

    _getPreferredSupplier(productId) {
        // Get suppliers that have this product
        const allSuppliers = this.supplierService.getAllSuppliers();

        if (!allSuppliers.success || allSuppliers.suppliers.length === 0) {
            return null;
        }

        // Filter preferred suppliers if set
        const preferred = allSuppliers.suppliers.filter(s =>
            this.autoReorderSettings.preferredSuppliers.includes(s.id)
        );

        const candidates = preferred.length > 0 ? preferred : allSuppliers.suppliers;

        // Return first supplier (in real system, would check product catalog and prices)
        return candidates.length > 0 ? candidates[0].id : null;
    }

    _optimizeBatches(ordersBySupplier) {
        const threshold = this.autoReorderSettings.freeShippingThreshold;

        Object.keys(ordersBySupplier).forEach(supplierId => {
            const group = ordersBySupplier[supplierId];

            // If order value is close to threshold, add small items to reach it
            if (group.totalValue > threshold * 0.85 && group.totalValue < threshold) {
                // Would add logic to find small items to add
                // For now, just mark it
                group.optimizationNote = `Близо до праг за безплатна доставка (${threshold} лв)`;
            }
        });
    }

    _startAutoCheck() {
        // Clear existing interval
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
        }

        // Set new interval
        const intervalMs = this.autoReorderSettings.checkFrequencyHours * 60 * 60 * 1000;

        this.checkInterval = setInterval(() => {
            if (this.autoReorderSettings.enabled) {
                this.createAutomaticOrders();
            }
        }, intervalMs);
    }

    _saveSettings() {
        StorageService.set('autoReorderSettings', this.autoReorderSettings);
    }

    _savePendingOrders() {
        StorageService.set('autoPendingOrders', this.pendingOrders);
    }

    _saveOrderHistory() {
        StorageService.set('autoOrderHistory', this.orderHistory);
    }
}
