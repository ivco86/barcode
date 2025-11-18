/**
 * SupplierService - Supplier and orders management
 */
import { StorageService } from './StorageService.js';
import { ValidationService } from './ValidationService.js';

export class SupplierService {
    constructor(productService) {
        this.productService = productService;
        this.suppliers = [];
        this.orders = [];
        this.loadSuppliers();
        this.loadOrders();
    }

    loadSuppliers() {
        this.suppliers = StorageService.get('posSuppliers', []);
    }

    saveSuppliers() {
        StorageService.set('posSuppliers', this.suppliers);
    }

    loadOrders() {
        this.orders = StorageService.get('posSupplierOrders', []);
    }

    saveOrders() {
        StorageService.set('posSupplierOrders', this.orders);
    }

    /**
     * Add supplier
     */
    addSupplier(supplierData) {
        const validation = ValidationService.validateCustomer(supplierData);
        if (!validation.isValid) {
            return { success: false, errors: validation.errors };
        }

        const supplier = {
            id: Date.now(),
            name: ValidationService.sanitizeString(supplierData.name),
            phone: ValidationService.sanitizeString(supplierData.phone),
            email: ValidationService.sanitizeString(supplierData.email || ''),
            address: ValidationService.sanitizeString(supplierData.address || ''),
            createdAt: new Date().toISOString()
        };

        this.suppliers.push(supplier);
        this.saveSuppliers();

        return { success: true, supplier };
    }

    /**
     * Create purchase order
     */
    createOrder(orderData) {
        const order = {
            id: Date.now(),
            supplierId: orderData.supplierId,
            orderDate: new Date().toISOString(),
            expectedDate: orderData.expectedDate || null,
            status: 'pending',
            items: orderData.items.map(item => ({
                productId: item.productId,
                quantity: item.quantity,
                costPrice: item.costPrice || 0
            })),
            totalCost: orderData.items.reduce((sum, item) =>
                sum + (item.quantity * (item.costPrice || 0)), 0
            ),
            notes: ValidationService.sanitizeString(orderData.notes || '')
        };

        this.orders.push(order);
        this.saveOrders();

        return { success: true, order };
    }

    /**
     * Receive order (update inventory)
     */
    receiveOrder(orderId) {
        const order = this.orders.find(o => o.id === orderId);

        if (!order) {
            return { success: false, errors: ['Поръчката не е намерена'] };
        }

        if (order.status === 'received') {
            return { success: false, errors: ['Поръчката вече е получена'] };
        }

        // Update inventory
        order.items.forEach(item => {
            this.productService.updateStock(item.productId, item.quantity);
        });

        order.status = 'received';
        order.receivedDate = new Date().toISOString();
        this.saveOrders();

        return { success: true, order };
    }

    getAllSuppliers() {
        return this.suppliers;
    }

    getAllOrders() {
        return this.orders;
    }

    getOrderById(id) {
        return this.orders.find(o => o.id === id);
    }
}
