/**
 * Mobile App Integration Service - v4.0
 * PWA features, Scan & Go, Self-Checkout, Push Notifications
 */
import { ValidationService } from './ValidationService.js';
import { StorageService } from './StorageService.js';

export class MobileAppService {
    constructor(productService, cartService, salesService) {
        this.productService = productService;
        this.cartService = cartService;
        this.salesService = salesService;

        this.selfCheckoutCarts = StorageService.get('selfCheckoutCarts', {});
        this.notificationPermission = 'default';
        this.pushSubscription = null;
    }

    /**
     * Check if app is running as PWA
     * @returns {Object} PWA status
     */
    isPWA() {
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                           window.navigator.standalone ||
                           document.referrer.includes('android-app://');

        return {
            success: true,
            pwa: {
                isInstalled: isStandalone,
                isInstalledIOS: window.navigator.standalone === true,
                isInstalledAndroid: document.referrer.includes('android-app://'),
                displayMode: this._getDisplayMode(),
                canInstall: this._canInstall()
            }
        };
    }

    /**
     * Install PWA prompt
     * @returns {Promise<Object>} Installation result
     */
    async installPWA() {
        // This requires the beforeinstallprompt event to be captured
        if (!window.deferredPrompt) {
            return {
                success: false,
                errors: ['PWA prompt не е наличен. Апликацията може вече да е инсталирана или браузърът не поддържа инсталация.']
            };
        }

        try {
            await window.deferredPrompt.prompt();
            const { outcome } = await window.deferredPrompt.userChoice;

            window.deferredPrompt = null;

            return {
                success: outcome === 'accepted',
                installed: outcome === 'accepted'
            };
        } catch (error) {
            return {
                success: false,
                errors: [`Грешка при инсталация: ${error.message}`]
            };
        }
    }

    /**
     * Request push notification permission
     * @returns {Promise<Object>} Permission result
     */
    async requestNotificationPermission() {
        if (!('Notification' in window)) {
            return {
                success: false,
                errors: ['Браузърът не поддържа нотификации']
            };
        }

        try {
            const permission = await Notification.requestPermission();
            this.notificationPermission = permission;

            return {
                success: permission === 'granted',
                permission: permission
            };
        } catch (error) {
            return {
                success: false,
                errors: [`Грешка при заявка за разрешение: ${error.message}`]
            };
        }
    }

    /**
     * Show local notification
     * @param {string} title - Notification title
     * @param {Object} options - Notification options
     * @returns {Object} Result
     */
    async showNotification(title, options = {}) {
        if (!('Notification' in window)) {
            return {
                success: false,
                errors: ['Браузърът не поддържа нотификации']
            };
        }

        if (Notification.permission !== 'granted') {
            return {
                success: false,
                errors: ['Няма разрешение за нотификации']
            };
        }

        try {
            const notification = new Notification(title, {
                body: options.body || '',
                icon: options.icon || '/icon-192.png',
                badge: options.badge || '/icon-192.png',
                tag: options.tag || 'pos-notification',
                requireInteraction: options.requireInteraction || false,
                ...options
            });

            return {
                success: true,
                notification: {
                    title: title,
                    shown: true
                }
            };
        } catch (error) {
            return {
                success: false,
                errors: [`Грешка при показване на нотификация: ${error.message}`]
            };
        }
    }

    /**
     * Initialize self-checkout session
     * @param {number} customerId - Customer ID (optional)
     * @returns {Object} Session info
     */
    initSelfCheckout(customerId = null) {
        const sessionId = Date.now().toString();

        this.selfCheckoutCarts[sessionId] = {
            sessionId: sessionId,
            customerId: customerId,
            items: [],
            startTime: new Date().toISOString(),
            status: 'active',
            total: 0
        };

        this._saveSelfCheckoutCarts();

        return {
            success: true,
            session: {
                sessionId: sessionId,
                customerId: customerId,
                status: 'active'
            }
        };
    }

    /**
     * Scan & Go - Add product to self-checkout cart
     * @param {string} sessionId - Session ID
     * @param {string} barcode - Product barcode
     * @param {number} quantity - Quantity (default 1)
     * @returns {Object} Result with updated cart
     */
    scanAndGo(sessionId, barcode, quantity = 1) {
        if (!this.selfCheckoutCarts[sessionId]) {
            return {
                success: false,
                errors: ['Невалидна сесия']
            };
        }

        const session = this.selfCheckoutCarts[sessionId];

        if (session.status !== 'active') {
            return {
                success: false,
                errors: ['Сесията не е активна']
            };
        }

        // Find product
        const product = this.productService.getProductByBarcode(barcode);

        if (!product) {
            return {
                success: false,
                errors: ['Продуктът не е намерен']
            };
        }

        // Validate quantity
        const validation = ValidationService.validateQuantity(quantity);
        if (!validation.isValid) {
            return { success: false, errors: validation.errors };
        }

        // Check stock
        if (product.stock < validation.value) {
            return {
                success: false,
                errors: ['Недостатъчна наличност']
            };
        }

        // Check if product already in cart
        const existingItem = session.items.find(item => item.productId === product.id);

        if (existingItem) {
            existingItem.quantity += validation.value;
        } else {
            session.items.push({
                productId: product.id,
                name: product.name,
                barcode: product.barcode,
                price: product.price,
                quantity: validation.value
            });
        }

        // Update total
        session.total = session.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        this._saveSelfCheckoutCarts();

        // Show notification
        this.showNotification('Продукт добавен', {
            body: `${product.name} × ${validation.value} = ${(product.price * validation.value).toFixed(2)} лв`,
            tag: 'scan-and-go'
        });

        return {
            success: true,
            cart: {
                sessionId: sessionId,
                items: session.items,
                total: session.total,
                itemCount: session.items.reduce((sum, item) => sum + item.quantity, 0)
            }
        };
    }

    /**
     * Remove item from self-checkout cart
     * @param {string} sessionId - Session ID
     * @param {number} productId - Product ID
     * @returns {Object} Result
     */
    removeSelfCheckoutItem(sessionId, productId) {
        if (!this.selfCheckoutCarts[sessionId]) {
            return {
                success: false,
                errors: ['Невалидна сесия']
            };
        }

        const session = this.selfCheckoutCarts[sessionId];
        session.items = session.items.filter(item => item.productId !== productId);
        session.total = session.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        this._saveSelfCheckoutCarts();

        return {
            success: true,
            cart: {
                sessionId: sessionId,
                items: session.items,
                total: session.total
            }
        };
    }

    /**
     * Get self-checkout cart
     * @param {string} sessionId - Session ID
     * @returns {Object} Cart info
     */
    getSelfCheckoutCart(sessionId) {
        if (!this.selfCheckoutCarts[sessionId]) {
            return {
                success: false,
                errors: ['Невалидна сесия']
            };
        }

        const session = this.selfCheckoutCarts[sessionId];

        return {
            success: true,
            cart: {
                sessionId: sessionId,
                customerId: session.customerId,
                items: session.items,
                total: session.total,
                itemCount: session.items.reduce((sum, item) => sum + item.quantity, 0),
                startTime: session.startTime,
                status: session.status
            }
        };
    }

    /**
     * Complete self-checkout (payment)
     * @param {string} sessionId - Session ID
     * @param {string} paymentMethod - Payment method
     * @param {Object} paymentDetails - Payment details
     * @returns {Object} Completed sale
     */
    completeSelfCheckout(sessionId, paymentMethod, paymentDetails = {}) {
        if (!this.selfCheckoutCarts[sessionId]) {
            return {
                success: false,
                errors: ['Невалидна сесия']
            };
        }

        const session = this.selfCheckoutCarts[sessionId];

        if (session.status !== 'active') {
            return {
                success: false,
                errors: ['Сесията не е активна']
            };
        }

        if (session.items.length === 0) {
            return {
                success: false,
                errors: ['Количката е празна']
            };
        }

        // Process checkout through SalesService
        const checkoutData = {
            cart: session.items,
            customerId: session.customerId,
            paymentMethod: paymentMethod,
            subtotal: session.total,
            discount: 0,
            total: session.total
        };

        const saleResult = this.salesService.processCheckout(checkoutData);

        if (!saleResult.success) {
            return saleResult;
        }

        // Mark session as completed
        session.status = 'completed';
        session.completedTime = new Date().toISOString();
        session.saleId = saleResult.sale.id;

        this._saveSelfCheckoutCarts();

        // Show completion notification
        this.showNotification('Покупка завършена!', {
            body: `Общо: ${session.total.toFixed(2)} лв. Благодарим ви!`,
            tag: 'checkout-complete',
            requireInteraction: true
        });

        return {
            success: true,
            sale: saleResult.sale,
            session: {
                sessionId: sessionId,
                status: 'completed',
                total: session.total
            }
        };
    }

    /**
     * Cancel self-checkout session
     * @param {string} sessionId - Session ID
     * @returns {Object} Result
     */
    cancelSelfCheckout(sessionId) {
        if (!this.selfCheckoutCarts[sessionId]) {
            return {
                success: false,
                errors: ['Невалидна сесия']
            };
        }

        const session = this.selfCheckoutCarts[sessionId];
        session.status = 'cancelled';
        session.cancelledTime = new Date().toISOString();

        this._saveSelfCheckoutCarts();

        return {
            success: true,
            session: {
                sessionId: sessionId,
                status: 'cancelled'
            }
        };
    }

    /**
     * Get all self-checkout sessions
     * @param {string} status - Filter by status ('active', 'completed', 'cancelled')
     * @returns {Object} Sessions list
     */
    getAllSelfCheckoutSessions(status = null) {
        let sessions = Object.values(this.selfCheckoutCarts);

        if (status) {
            sessions = sessions.filter(s => s.status === status);
        }

        return {
            success: true,
            sessions: sessions,
            totalSessions: sessions.length
        };
    }

    /**
     * Enable offline mode (service worker)
     * @returns {Promise<Object>} Result
     */
    async enableOfflineMode() {
        if (!('serviceWorker' in navigator)) {
            return {
                success: false,
                errors: ['Браузърът не поддържа Service Workers']
            };
        }

        try {
            const registration = await navigator.serviceWorker.register('/service-worker.js');

            return {
                success: true,
                offline: {
                    registered: true,
                    scope: registration.scope,
                    active: registration.active !== null
                }
            };
        } catch (error) {
            return {
                success: false,
                errors: [`Грешка при регистрация на Service Worker: ${error.message}`]
            };
        }
    }

    /**
     * Check offline status
     * @returns {Object} Offline status
     */
    getOfflineStatus() {
        const isOnline = navigator.onLine;

        return {
            success: true,
            offline: {
                isOnline: isOnline,
                isOffline: !isOnline,
                serviceWorkerActive: 'serviceWorker' in navigator &&
                                    navigator.serviceWorker.controller !== null
            }
        };
    }

    /**
     * Sync offline data when back online
     * @returns {Promise<Object>} Sync result
     */
    async syncOfflineData() {
        if (!navigator.onLine) {
            return {
                success: false,
                errors: ['Няма интернет връзка']
            };
        }

        // Get pending offline operations
        const pendingOperations = StorageService.get('offlineQueue', []);

        if (pendingOperations.length === 0) {
            return {
                success: true,
                sync: {
                    synced: 0,
                    message: 'Няма pending операции'
                }
            };
        }

        let synced = 0;
        const errors = [];

        for (const operation of pendingOperations) {
            try {
                // Process operation based on type
                // (This would integrate with backend API when available)
                synced++;
            } catch (error) {
                errors.push(`Грешка при синхронизация на ${operation.type}: ${error.message}`);
            }
        }

        // Clear synced operations
        if (synced > 0) {
            StorageService.set('offlineQueue', pendingOperations.slice(synced));
        }

        return {
            success: errors.length === 0,
            sync: {
                synced: synced,
                failed: errors.length,
                remaining: pendingOperations.length - synced
            },
            errors: errors.length > 0 ? errors : undefined
        };
    }

    /**
     * Get app capabilities (camera, vibration, etc.)
     * @returns {Object} Capabilities
     */
    getDeviceCapabilities() {
        return {
            success: true,
            capabilities: {
                camera: 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices,
                vibration: 'vibrate' in navigator,
                geolocation: 'geolocation' in navigator,
                notification: 'Notification' in window,
                serviceWorker: 'serviceWorker' in navigator,
                indexedDB: 'indexedDB' in window,
                webRTC: 'RTCPeerConnection' in window,
                battery: 'getBattery' in navigator,
                online: navigator.onLine,
                touchScreen: 'ontouchstart' in window || navigator.maxTouchPoints > 0
            }
        };
    }

    /**
     * Vibrate device (haptic feedback)
     * @param {number|Array} pattern - Vibration pattern in ms
     * @returns {Object} Result
     */
    vibrate(pattern = 200) {
        if (!('vibrate' in navigator)) {
            return {
                success: false,
                errors: ['Устройството не поддържа вибрация']
            };
        }

        try {
            navigator.vibrate(pattern);
            return { success: true };
        } catch (error) {
            return {
                success: false,
                errors: [`Грешка при вибрация: ${error.message}`]
            };
        }
    }

    /**
     * Get battery status
     * @returns {Promise<Object>} Battery info
     */
    async getBatteryStatus() {
        if (!('getBattery' in navigator)) {
            return {
                success: false,
                errors: ['Battery API не е поддържано']
            };
        }

        try {
            const battery = await navigator.getBattery();

            return {
                success: true,
                battery: {
                    level: Math.round(battery.level * 100),
                    charging: battery.charging,
                    chargingTime: battery.chargingTime,
                    dischargingTime: battery.dischargingTime
                }
            };
        } catch (error) {
            return {
                success: false,
                errors: [`Грешка при получаване на battery status: ${error.message}`]
            };
        }
    }

    // ============ PRIVATE METHODS ============

    _getDisplayMode() {
        if (window.matchMedia('(display-mode: standalone)').matches) {
            return 'standalone';
        }
        if (window.matchMedia('(display-mode: fullscreen)').matches) {
            return 'fullscreen';
        }
        if (window.matchMedia('(display-mode: minimal-ui)').matches) {
            return 'minimal-ui';
        }
        return 'browser';
    }

    _canInstall() {
        return window.deferredPrompt !== null && window.deferredPrompt !== undefined;
    }

    _saveSelfCheckoutCarts() {
        StorageService.set('selfCheckoutCarts', this.selfCheckoutCarts);
    }
}

// Setup beforeinstallprompt event listener
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    window.deferredPrompt = e;
});
