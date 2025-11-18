/**
 * Multi-Store Management Service - v4.0
 * Cloud synchronization and multi-location management
 */
import { ValidationService } from './ValidationService.js';
import { StorageService } from './StorageService.js';

export class MultiStoreService {
    constructor(productService, salesService, authService) {
        this.productService = productService;
        this.salesService = salesService;
        this.authService = authService;

        this.stores = StorageService.get('stores', []);
        this.currentStoreId = StorageService.get('currentStoreId', null);
        this.syncQueue = StorageService.get('syncQueue', []);
        this.lastSyncTimestamp = StorageService.get('lastSyncTimestamp', null);
    }

    /**
     * Register new store location
     * @param {Object} storeData - Store information
     * @returns {Object} Result with store info
     */
    registerStore(storeData) {
        const validation = this._validateStoreData(storeData);
        if (!validation.isValid) {
            return { success: false, errors: validation.errors };
        }

        const store = {
            id: Date.now(),
            name: ValidationService.sanitizeString(storeData.name),
            address: ValidationService.sanitizeString(storeData.address || ''),
            city: ValidationService.sanitizeString(storeData.city || ''),
            country: ValidationService.sanitizeString(storeData.country || 'Bulgaria'),
            phone: ValidationService.sanitizeString(storeData.phone || ''),
            email: ValidationService.sanitizeString(storeData.email || ''),
            timezone: storeData.timezone || 'Europe/Sofia',
            currency: storeData.currency || 'BGN',
            taxRate: storeData.taxRate || 20,
            status: 'active',
            createdAt: new Date().toISOString(),
            settings: storeData.settings || {}
        };

        this.stores.push(store);
        this._saveStores();

        // Set as current store if it's the first one
        if (!this.currentStoreId) {
            this.setCurrentStore(store.id);
        }

        return {
            success: true,
            store: store
        };
    }

    /**
     * Get all stores
     * @returns {Object} Stores list
     */
    getAllStores() {
        return {
            success: true,
            stores: this.stores,
            totalStores: this.stores.length,
            currentStoreId: this.currentStoreId
        };
    }

    /**
     * Get store by ID
     * @param {number} storeId - Store ID
     * @returns {Object} Store info
     */
    getStoreById(storeId) {
        const store = this.stores.find(s => s.id === storeId);

        if (!store) {
            return {
                success: false,
                errors: ['Магазинът не съществува']
            };
        }

        return {
            success: true,
            store: store
        };
    }

    /**
     * Update store information
     * @param {number} storeId - Store ID
     * @param {Object} updates - Store updates
     * @returns {Object} Result
     */
    updateStore(storeId, updates) {
        const store = this.stores.find(s => s.id === storeId);

        if (!store) {
            return {
                success: false,
                errors: ['Магазинът не съществува']
            };
        }

        // Update fields
        if (updates.name) store.name = ValidationService.sanitizeString(updates.name);
        if (updates.address) store.address = ValidationService.sanitizeString(updates.address);
        if (updates.city) store.city = ValidationService.sanitizeString(updates.city);
        if (updates.phone) store.phone = ValidationService.sanitizeString(updates.phone);
        if (updates.email) store.email = ValidationService.sanitizeString(updates.email);
        if (updates.status) store.status = updates.status;
        if (updates.settings) store.settings = { ...store.settings, ...updates.settings };

        store.updatedAt = new Date().toISOString();

        this._saveStores();

        return {
            success: true,
            store: store
        };
    }

    /**
     * Set current active store
     * @param {number} storeId - Store ID
     * @returns {Object} Result
     */
    setCurrentStore(storeId) {
        const store = this.stores.find(s => s.id === storeId);

        if (!store) {
            return {
                success: false,
                errors: ['Магазинът не съществува']
            };
        }

        this.currentStoreId = storeId;
        StorageService.set('currentStoreId', storeId);

        return {
            success: true,
            currentStore: store
        };
    }

    /**
     * Get current store
     * @returns {Object} Current store info
     */
    getCurrentStore() {
        if (!this.currentStoreId) {
            return {
                success: false,
                errors: ['Няма избран текущ магазин']
            };
        }

        return this.getStoreById(this.currentStoreId);
    }

    /**
     * Transfer inventory between stores
     * @param {number} fromStoreId - Source store ID
     * @param {number} toStoreId - Destination store ID
     * @param {Array} items - Items to transfer [{productId, quantity}]
     * @returns {Object} Transfer result
     */
    transferInventory(fromStoreId, toStoreId, items) {
        const fromStore = this.stores.find(s => s.id === fromStoreId);
        const toStore = this.stores.find(s => s.id === toStoreId);

        if (!fromStore || !toStore) {
            return {
                success: false,
                errors: ['Невалиден магазин']
            };
        }

        const transfer = {
            id: Date.now(),
            fromStoreId: fromStoreId,
            toStoreId: toStoreId,
            items: items,
            status: 'pending',
            createdAt: new Date().toISOString(),
            createdBy: this.authService.getCurrentUser()?.id
        };

        // Validate items and stock
        const errors = [];
        items.forEach(item => {
            const product = this.productService.getProductById(item.productId);
            if (!product) {
                errors.push(`Продукт ${item.productId} не съществува`);
            } else if (product.stock < item.quantity) {
                errors.push(`Недостатъчна наличност за ${product.name}`);
            }
        });

        if (errors.length > 0) {
            return {
                success: false,
                errors: errors
            };
        }

        // Queue transfer for sync
        this._queueOperation('transfer_inventory', transfer);

        return {
            success: true,
            transfer: transfer,
            message: 'Трансферът е в опашка за синхронизация'
        };
    }

    /**
     * Get consolidated inventory across all stores
     * @returns {Object} Consolidated inventory
     */
    getConsolidatedInventory() {
        // In a real multi-store system, this would aggregate from multiple databases
        // For now, we'll return current store inventory with metadata

        const products = this.productService.getAllProducts();
        const currentStore = this.getCurrentStore();

        const inventory = products.map(product => ({
            productId: product.id,
            name: product.name,
            barcode: product.barcode,
            stores: [{
                storeId: currentStore.success ? currentStore.store.id : null,
                storeName: currentStore.success ? currentStore.store.name : 'Unknown',
                stock: product.stock,
                price: product.price
            }],
            totalStock: product.stock,
            averagePrice: product.price
        }));

        return {
            success: true,
            inventory: inventory,
            totalProducts: inventory.length,
            stores: this.stores.length
        };
    }

    /**
     * Get sales comparison across stores
     * @param {string} period - Time period ('today', 'week', 'month')
     * @returns {Object} Sales comparison
     */
    getSalesComparison(period = 'today') {
        const allSales = this.salesService.getAllSales();

        // Filter by period
        let startDate;
        const now = new Date();

        if (period === 'today') {
            startDate = new Date(now.toISOString().split('T')[0]);
        } else if (period === 'week') {
            startDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
        } else if (period === 'month') {
            startDate = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
        }

        const periodSales = allSales.filter(s => new Date(s.date) >= startDate);

        // Group by store (in single-store mode, all sales are for current store)
        const currentStore = this.getCurrentStore();
        const storeId = currentStore.success ? currentStore.store.id : 0;

        const storeStats = {
            storeId: storeId,
            storeName: currentStore.success ? currentStore.store.name : 'Main Store',
            salesCount: periodSales.length,
            revenue: periodSales.reduce((sum, s) => sum + s.total, 0),
            averageSale: periodSales.length > 0 ?
                        periodSales.reduce((sum, s) => sum + s.total, 0) / periodSales.length : 0
        };

        return {
            success: true,
            comparison: {
                period: period,
                stores: [storeStats],
                bestStore: storeStats,
                totalRevenue: storeStats.revenue,
                totalSales: storeStats.salesCount
            }
        };
    }

    /**
     * Synchronize data with cloud/other stores
     * @returns {Promise<Object>} Sync result
     */
    async syncData() {
        if (this.syncQueue.length === 0) {
            return {
                success: true,
                sync: {
                    operations: 0,
                    message: 'Няма операции за синхронизация'
                }
            };
        }

        // In a real implementation, this would send data to a backend API
        // For now, we'll simulate sync

        const operations = [...this.syncQueue];
        let synced = 0;
        const errors = [];

        for (const operation of operations) {
            try {
                // Simulate API call
                await this._simulateAPICall(operation);
                synced++;
            } catch (error) {
                errors.push(`Грешка при ${operation.type}: ${error.message}`);
            }
        }

        // Remove synced operations
        this.syncQueue = this.syncQueue.slice(synced);
        this.lastSyncTimestamp = new Date().toISOString();

        this._saveSyncQueue();
        StorageService.set('lastSyncTimestamp', this.lastSyncTimestamp);

        return {
            success: errors.length === 0,
            sync: {
                synced: synced,
                failed: errors.length,
                remaining: this.syncQueue.length,
                lastSync: this.lastSyncTimestamp
            },
            errors: errors.length > 0 ? errors : undefined
        };
    }

    /**
     * Get sync status
     * @returns {Object} Sync status
     */
    getSyncStatus() {
        return {
            success: true,
            status: {
                queueLength: this.syncQueue.length,
                lastSync: this.lastSyncTimestamp,
                hasUnsyncedData: this.syncQueue.length > 0,
                currentStore: this.currentStoreId
            }
        };
    }

    /**
     * Enable auto-sync
     * @param {number} intervalMinutes - Sync interval in minutes
     * @returns {Object} Result with interval ID
     */
    enableAutoSync(intervalMinutes = 5) {
        if (this.autoSyncInterval) {
            clearInterval(this.autoSyncInterval);
        }

        this.autoSyncInterval = setInterval(() => {
            this.syncData();
        }, intervalMinutes * 60 * 1000);

        return {
            success: true,
            autoSync: {
                enabled: true,
                intervalMinutes: intervalMinutes,
                intervalId: this.autoSyncInterval
            }
        };
    }

    /**
     * Disable auto-sync
     * @returns {Object} Result
     */
    disableAutoSync() {
        if (this.autoSyncInterval) {
            clearInterval(this.autoSyncInterval);
            this.autoSyncInterval = null;
        }

        return {
            success: true,
            autoSync: {
                enabled: false
            }
        };
    }

    /**
     * Get store performance metrics
     * @param {number} storeId - Store ID
     * @param {string} period - Time period
     * @returns {Object} Performance metrics
     */
    getStorePerformance(storeId, period = 'month') {
        const store = this.stores.find(s => s.id === storeId);

        if (!store) {
            return {
                success: false,
                errors: ['Магазинът не съществува']
            };
        }

        const allSales = this.salesService.getAllSales();

        // Filter sales by period
        let startDate;
        const now = new Date();

        if (period === 'week') {
            startDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
        } else if (period === 'month') {
            startDate = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
        } else if (period === 'year') {
            startDate = new Date(now.getTime() - (365 * 24 * 60 * 60 * 1000));
        }

        const periodSales = allSales.filter(s => new Date(s.date) >= startDate);

        // Calculate metrics
        const revenue = periodSales.reduce((sum, s) => sum + s.total, 0);
        const salesCount = periodSales.length;
        const averageSale = salesCount > 0 ? revenue / salesCount : 0;

        // Calculate daily average
        const daysDiff = Math.max(1, Math.floor((now - startDate) / (1000 * 60 * 60 * 24)));
        const avgDailySales = salesCount / daysDiff;
        const avgDailyRevenue = revenue / daysDiff;

        return {
            success: true,
            performance: {
                storeId: storeId,
                storeName: store.name,
                period: period,
                revenue: Math.round(revenue * 100) / 100,
                salesCount: salesCount,
                averageSale: Math.round(averageSale * 100) / 100,
                avgDailySales: Math.round(avgDailySales * 100) / 100,
                avgDailyRevenue: Math.round(avgDailyRevenue * 100) / 100
            }
        };
    }

    // ============ PRIVATE METHODS ============

    _validateStoreData(data) {
        const errors = [];

        const nameValidation = ValidationService.validateString(data.name, 'Име на магазин', 2, 100);
        if (!nameValidation.isValid) {
            errors.push(...nameValidation.errors);
        }

        // Check for duplicate names
        if (this.stores.some(s => s.name.toLowerCase() === data.name.toLowerCase())) {
            errors.push('Магазин с това име вече съществува');
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    _queueOperation(type, data) {
        this.syncQueue.push({
            id: Date.now(),
            type: type,
            data: data,
            timestamp: new Date().toISOString(),
            attempts: 0
        });

        this._saveSyncQueue();
    }

    async _simulateAPICall(operation) {
        // Simulate network delay
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                // Simulate 95% success rate
                if (Math.random() > 0.05) {
                    resolve({ success: true });
                } else {
                    reject(new Error('Network error'));
                }
            }, 500);
        });
    }

    _saveStores() {
        StorageService.set('stores', this.stores);
    }

    _saveSyncQueue() {
        StorageService.set('syncQueue', this.syncQueue);
    }
}
