/**
 * UIManager - Coordinates all UI operations
 * Separated from business logic for better maintainability
 */
import { UIHandlers } from './UIHandlers.js';
import { UIRenders } from './UIRenders.js';

export class UIManager {
    constructor(services) {
        this.services = services;
        this.currentView = 'pos';
        this.charts = { sales: null, payment: null };
        this.reportPeriod = 'day';

        // Extend with handlers and renders
        Object.assign(this, UIHandlers);
        Object.assign(this, UIRenders);
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
        document.getElementById('posView').style.display = view === 'pos' ? 'block' : 'none';
        document.getElementById('inventoryView').style.display = view === 'inventory' ? 'block' : 'none';
        document.getElementById('salesHistoryView').style.display = view === 'salesHistory' ? 'block' : 'none';
        document.getElementById('reportsView').style.display = view === 'reports' ? 'block' : 'none';
        document.getElementById('customersView').style.display = view === 'customers' ? 'block' : 'none';
        this.currentView = view;

        if (view === 'inventory') {
            this.renderInventory();
        } else if (view === 'salesHistory') {
            this.renderSalesHistory();
        } else if (view === 'customers') {
            this.renderCustomers();
        } else if (view === 'pos') {
            document.getElementById('quickBarcodeInput').focus();
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