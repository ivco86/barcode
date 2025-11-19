/**
 * UIManager - Coordinates all UI operations
 * Separated from business logic for better maintainability
 */
import { UIHandlers } from './UIHandlers.js';
import { UIRenders } from './UIRenders.js';
import { UIHandlersV3 } from './UIHandlersV3.js';
import { UIHandlersV9 } from './UIHandlersV9.js';

export class UIManager {
    constructor(services) {
        this.services = services;
        this.currentView = 'pos';
        this.charts = { sales: null, payment: null };
        this.reportPeriod = 'day';

        // Extend with handlers and renders
        Object.assign(this, UIHandlers);
        Object.assign(this, UIRenders);
        Object.assign(this, UIHandlersV3); // v3.0 features
        Object.assign(this, UIHandlersV9); // v9.0 & v9.1 Revenue Boost features
    }

    /**
     * Initialize UI after login
     */
    init() {
        this.setupEventListeners();
        this.setupKeyboardShortcuts();
        this.render();
    }

    /**
     * Render all UI components
     */
    render() {
        this.renderInventory();
        this.renderCart();
        this.renderCustomerSelect();
        this.updateCategoryFilters();
        this.checkLowStock();
        this.updateUserDisplay();
    }

    /**
     * Setup all event listeners
     */
    setupEventListeners() {
        // Navigation
        document.getElementById('posBtn').addEventListener('click', () => this.showView('pos'));
        document.getElementById('inventoryBtn').addEventListener('click', () => this.showView('inventory'));
        document.getElementById('salesHistoryBtn').addEventListener('click', () => this.showView('salesHistory'));
        document.getElementById('reportsBtn').addEventListener('click', () => {
            this.showView('reports');
            this.generateReports();
        });
        document.getElementById('customersBtn').addEventListener('click', () => this.showView('customers'));

        // v9.0 & v9.1 Navigation
        document.getElementById('giftCardsBtn').addEventListener('click', () => this.showView('giftCards'));
        document.getElementById('bundlesBtn').addEventListener('click', () => this.showView('bundles'));
        document.getElementById('flashSalesBtn').addEventListener('click', () => this.showView('flashSales'));
        document.getElementById('campaignsBtn').addEventListener('click', () => this.showView('campaigns'));

        document.getElementById('addProductBtn').addEventListener('click', () => this.openAddProductModal());
        document.getElementById('logoutBtn').addEventListener('click', () => this.handleLogout());

        // Quick Scan
        document.getElementById('quickBarcodeInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.handleQuickScan();
            }
        });
        document.getElementById('quickQuantity').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                document.getElementById('quickBarcodeInput').focus();
            }
        });
        document.getElementById('quickAddBtn').addEventListener('click', () => this.handleQuickScan());

        // Search
        document.getElementById('searchBtn').addEventListener('click', () => this.searchProducts());
        document.getElementById('barcodeInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.searchProducts();
        });
        document.getElementById('barcodeInput').addEventListener('input', () => this.searchProducts());

        // Inventory
        document.getElementById('inventorySearch').addEventListener('input', () => this.renderInventory());
        document.getElementById('stockFilter').addEventListener('change', () => this.renderInventory());
        document.getElementById('categoryFilter').addEventListener('change', () => this.renderInventory());
        document.getElementById('exportInventoryBtn').addEventListener('click', () => this.exportInventoryCSV());
        document.getElementById('categoryManagerBtn').addEventListener('click', () => this.openCategoryManager());

        // Cart
        document.getElementById('clearCartBtn').addEventListener('click', () => this.handleClearCart());
        document.getElementById('checkoutBtn').addEventListener('click', () => this.openCheckoutModal());
        document.getElementById('customerSelect').addEventListener('change', (e) => this.handleCustomerSelect(e));
        document.getElementById('addCustomerQuick').addEventListener('click', () => this.openAddCustomerModal());

        // Forms
        document.getElementById('addProductForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAddProduct();
        });
        document.getElementById('editProductForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleUpdateProduct();
        });
        document.getElementById('addCustomerForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAddCustomer();
        });
        document.getElementById('editCustomerForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleUpdateCustomer();
        });

        // Customers
        document.getElementById('addCustomerBtn').addEventListener('click', () => this.openAddCustomerModal());
        document.getElementById('customerSearch').addEventListener('input', () => this.renderCustomers());
        document.getElementById('exportCustomersBtn').addEventListener('click', () => this.exportCustomersCSV());

        // Sales History
        document.getElementById('filterSalesBtn').addEventListener('click', () => this.renderSalesHistory());
        document.getElementById('exportSalesBtn').addEventListener('click', () => this.exportSalesCSV());

        // Reports
        document.querySelectorAll('.period-btn').forEach(btn => {
            btn.addEventListener('click', () => this.handlePeriodChange(btn));
        });

        // Categories
        document.getElementById('addCategoryBtn').addEventListener('click', () => this.handleAddCategory());

        // Receipt Printing
        document.getElementById('printReceiptBtn').addEventListener('click', () => this.printReceipt());
        document.getElementById('printSaleReceiptBtn').addEventListener('click', () => this.printReceipt());
        document.getElementById('printBarcodeBtn').addEventListener('click', () => this.printBarcode());

        // Modal close buttons
        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', (e) => {
                e.target.closest('.modal').style.display = 'none';
            });
        });

        document.querySelectorAll('.cancel-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.target.closest('.modal').style.display = 'none';
            });
        });

        // Close modal on outside click
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.style.display = 'none';
            }
        });

        // Payment buttons
        document.querySelectorAll('.payment-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.handlePayment(btn.dataset.method);
            });
        });

        // v9.0 & v9.1 Feature Buttons
        this.setupV9EventListeners();
    }

    /**
     * Setup v9.0 & v9.1 event listeners
     */
    setupV9EventListeners() {
        // Gift Cards
        const createGiftCardBtn = document.getElementById('createGiftCardBtn');
        if (createGiftCardBtn) {
            createGiftCardBtn.addEventListener('click', () => this.openCreateGiftCardModal());
        }

        const createVoucherBtn = document.getElementById('createVoucherBtn');
        if (createVoucherBtn) {
            createVoucherBtn.addEventListener('click', () => this.openCreateVoucherModal());
        }

        const checkCodeBtn = document.getElementById('checkCodeBtn');
        if (checkCodeBtn) {
            checkCodeBtn.addEventListener('click', () => this.openCheckCodeModal());
        }

        const createGiftCardForm = document.getElementById('createGiftCardForm');
        if (createGiftCardForm) {
            createGiftCardForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleCreateGiftCard();
            });
        }

        const createVoucherForm = document.getElementById('createVoucherForm');
        if (createVoucherForm) {
            createVoucherForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleCreateVoucher();
            });
        }

        const checkCodeForm = document.getElementById('checkCodeForm');
        if (checkCodeForm) {
            checkCodeForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleCheckCode();
            });
        }

        // Bundles
        const createBundleBtn = document.getElementById('createBundleBtn');
        if (createBundleBtn) {
            createBundleBtn.addEventListener('click', () => this.openCreateBundleModal());
        }

        const createBundleForm = document.getElementById('createBundleForm');
        if (createBundleForm) {
            createBundleForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleCreateBundle();
            });
        }

        // Flash Sales
        const createFlashSaleBtn = document.getElementById('createFlashSaleBtn');
        if (createFlashSaleBtn) {
            createFlashSaleBtn.addEventListener('click', () => this.openCreateFlashSaleModal());
        }

        const createHappyHourBtn = document.getElementById('createHappyHourBtn');
        if (createHappyHourBtn) {
            createHappyHourBtn.addEventListener('click', () => this.openCreateHappyHourModal());
        }

        const createFlashSaleForm = document.getElementById('createFlashSaleForm');
        if (createFlashSaleForm) {
            createFlashSaleForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleCreateFlashSale();
            });
        }

        const createHappyHourForm = document.getElementById('createHappyHourForm');
        if (createHappyHourForm) {
            createHappyHourForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleCreateHappyHour();
            });
        }

        // Tab buttons - handle dynamically since they're in multiple views
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const viewId = btn.closest('.main-view').id;
                const tabName = btn.dataset.tab;
                this.switchTab(viewId, tabName);

                // Render content for the active tab
                this.renderActiveTab(viewId, tabName);
            });
        });
    }

    /**
     * Render content for active tab
     */
    renderActiveTab(viewId, tabName) {
        // Gift Cards tabs
        if (viewId === 'giftCardsView') {
            if (tabName === 'activeCards') this.renderGiftCards();
            else if (tabName === 'vouchers') this.renderVouchers();
            else if (tabName === 'giftCardReports') this.renderGiftCardReports();
        }

        // Bundles tabs
        if (viewId === 'bundlesView') {
            if (tabName === 'activeBundles') this.renderBundles();
            else if (tabName === 'bundleRecommendations') this.renderBundleRecommendations();
            else if (tabName === 'bundleReports') this.renderBundleReports();
        }

        // Flash Sales tabs
        if (viewId === 'flashSalesView') {
            if (tabName === 'activeFlashSales') this.renderFlashSales();
            else if (tabName === 'scheduledSales') this.renderScheduledSales();
            else if (tabName === 'happyHours') this.renderHappyHours();
        }

        // Campaigns tabs
        if (viewId === 'campaignsView') {
            if (tabName === 'activeCampaigns') this.renderActiveCampaigns();
            else if (tabName === 'campaignTemplates') this.renderCampaignTemplates();
            else if (tabName === 'campaignReports') this.renderCampaignReports();
        }
    }

    /**
     * Setup keyboard shortcuts
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Don't trigger if typing in input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                if (e.key === 'Escape') {
                    e.target.blur();
                }
                return;
            }

            switch(e.key) {
                case 'F1':
                    e.preventDefault();
                    this.showView('inventory');
                    break;
                case 'F2':
                    e.preventDefault();
                    this.openAddProductModal();
                    break;
                case 'F5':
                    e.preventDefault();
                    this.showView('reports');
                    this.generateReports();
                    break;
                case 'F9':
                    e.preventDefault();
                    if (this.currentView === 'pos') {
                        this.openCheckoutModal();
                    }
                    break;
                case 'Escape':
                    e.preventDefault();
                    document.querySelectorAll('.modal').forEach(modal => {
                        modal.style.display = 'none';
                    });
                    break;
            }
        });
    }

    /**
     * Update user display in header
     */
    updateUserDisplay() {
        const user = this.services.auth.getCurrentUser();
        const userDisplay = document.getElementById('currentUserDisplay');
        if (userDisplay && user) {
            userDisplay.textContent = `👤 ${user.name} (${user.role === 'admin' ? 'Админ' : 'Касиер'})`;
        }
    }

    /**
     * Handle logout
     */
    handleLogout() {
        if (confirm('Сигурни ли сте, че искате да излезете?')) {
            this.services.auth.logout();
            location.reload();
        }
    }

    /**
     * Show specific view
     */
    showView(view) {
        // Hide all views
        document.getElementById('posView').style.display = view === 'pos' ? 'block' : 'none';
        document.getElementById('inventoryView').style.display = view === 'inventory' ? 'block' : 'none';
        document.getElementById('salesHistoryView').style.display = view === 'salesHistory' ? 'block' : 'none';
        document.getElementById('reportsView').style.display = view === 'reports' ? 'block' : 'none';
        document.getElementById('customersView').style.display = view === 'customers' ? 'block' : 'none';

        // v9.0 & v9.1 views
        const giftCardsView = document.getElementById('giftCardsView');
        if (giftCardsView) giftCardsView.style.display = view === 'giftCards' ? 'block' : 'none';

        const bundlesView = document.getElementById('bundlesView');
        if (bundlesView) bundlesView.style.display = view === 'bundles' ? 'block' : 'none';

        const flashSalesView = document.getElementById('flashSalesView');
        if (flashSalesView) flashSalesView.style.display = view === 'flashSales' ? 'block' : 'none';

        const campaignsView = document.getElementById('campaignsView');
        if (campaignsView) campaignsView.style.display = view === 'campaigns' ? 'block' : 'none';

        this.currentView = view;

        // Render view content
        if (view === 'inventory') {
            this.renderInventory();
        } else if (view === 'salesHistory') {
            this.renderSalesHistory();
        } else if (view === 'customers') {
            this.renderCustomers();
        } else if (view === 'pos') {
            document.getElementById('quickBarcodeInput').focus();
        } else if (view === 'giftCards') {
            this.renderGiftCards();
            this.renderVouchers();
            this.renderGiftCardReports();
        } else if (view === 'bundles') {
            this.renderBundles();
            this.renderBundleRecommendations();
            this.renderBundleReports();
        } else if (view === 'flashSales') {
            this.renderFlashSales();
            this.renderScheduledSales();
            this.renderHappyHours();
        } else if (view === 'campaigns') {
            this.renderActiveCampaigns();
            this.renderCampaignTemplates();
            this.renderCampaignReports();
        }
    }

    /**
     * Check and display low stock alerts
     */
    checkLowStock() {
        const lowStock = this.services.product.getLowStockProducts();
        const outOfStock = this.services.product.getOutOfStockProducts();
        const banner = document.getElementById('lowStockBanner');

        if (lowStock.length > 0 || outOfStock.length > 0) {
            let message = '<h3>⚠️ Предупреждение за наличности</h3><div class="low-stock-items">';

            outOfStock.forEach(p => {
                message += `<div class="low-stock-item">❌ ${p.name} - ИЗЧЕРПАН</div>`;
            });

            lowStock.forEach(p => {
                message += `<div class="low-stock-item">⚠️ ${p.name} - ${p.stock} бр.</div>`;
            });

            message += '</div>';
            banner.innerHTML = message;
            banner.style.display = 'block';
        } else {
            banner.style.display = 'none';
        }
    }

    // Import other UI methods from separate files to keep this manageable
    // For now, I'll include key methods inline but in production this would be split further
}