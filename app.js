// POS System Application - Enhanced Version
class POSSystem {
    constructor() {
        this.products = [];
        this.cart = [];
        this.sales = [];
        this.customers = [];
        this.users = [];
        this.categories = [];
        this.currentUser = null;
        this.currentView = 'pos';
        this.currentCustomer = null;
        this.reportPeriod = 'day';
        this.charts = { sales: null, payment: null };
        this.init();
    }

    init() {
        this.loadAllData();
        this.loadSampleData();
        this.checkLogin();
    }

    initAfterLogin() {
        this.setupEventListeners();
        this.setupKeyboardShortcuts();
        this.renderInventory();
        this.renderCart();
        this.renderCustomerSelect();
        this.updateCategoryFilters();
        this.checkLowStock();
    }

    // Local Storage Management
    loadAllData() {
        this.loadProducts();
        this.loadSales();
        this.loadCustomers();
        this.loadUsers();
        this.loadCategories();
    }

    loadProducts() {
        const stored = localStorage.getItem('posProducts');
        if (stored) {
            this.products = JSON.parse(stored);
        }
    }

    saveProducts() {
        localStorage.setItem('posProducts', JSON.stringify(this.products));
    }

    loadSales() {
        const stored = localStorage.getItem('posSales');
        if (stored) {
            this.sales = JSON.parse(stored);
        }
    }

    saveSales() {
        localStorage.setItem('posSales', JSON.stringify(this.sales));
    }

    loadCustomers() {
        const stored = localStorage.getItem('posCustomers');
        if (stored) {
            this.customers = JSON.parse(stored);
        }
    }

    saveCustomers() {
        localStorage.setItem('posCustomers', JSON.stringify(this.customers));
    }

    loadUsers() {
        const stored = localStorage.getItem('posUsers');
        if (stored) {
            this.users = JSON.parse(stored);
        } else {
            // Create default admin user
            this.users = [{
                id: 1,
                username: 'admin',
                password: 'admin',
                name: 'Администратор',
                role: 'admin'
            }];
            this.saveUsers();
        }
    }

    saveUsers() {
        localStorage.setItem('posUsers', JSON.stringify(this.users));
    }

    loadCategories() {
        const stored = localStorage.getItem('posCategories');
        if (stored) {
            this.categories = JSON.parse(stored);
        }
    }

    saveCategories() {
        localStorage.setItem('posCategories', JSON.stringify(this.categories));
    }

    // Login System
    checkLogin() {
        const stored = localStorage.getItem('posCurrentUser');
        if (stored) {
            this.currentUser = JSON.parse(stored);
            this.updateUserDisplay();
            this.initAfterLogin();
        } else {
            this.showLoginModal();
        }
    }

    showLoginModal() {
        const modal = document.getElementById('loginModal');
        modal.style.display = 'block';
        document.getElementById('loginUsername').focus();
    }

    updateUserDisplay() {
        const userDisplay = document.getElementById('currentUserDisplay');
        if (userDisplay && this.currentUser) {
            userDisplay.textContent = `👤 ${this.currentUser.name} (${this.currentUser.role === 'admin' ? 'Админ' : 'Касиер'})`;
        }
    }

    handleLogin(e) {
        e.preventDefault();
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;
        const errorDiv = document.getElementById('loginError');

        const user = this.users.find(u => u.username === username && u.password === password);

        if (user) {
            this.currentUser = user;
            localStorage.setItem('posCurrentUser', JSON.stringify(user));
            document.getElementById('loginModal').style.display = 'none';
            this.updateUserDisplay();
            this.initAfterLogin();
            errorDiv.style.display = 'none';
        } else {
            errorDiv.textContent = 'Грешно потребителско име или парола!';
            errorDiv.style.display = 'block';
        }
    }

    logout() {
        if (confirm('Сигурни ли сте, че искате да излезете?')) {
            localStorage.removeItem('posCurrentUser');
            location.reload();
        }
    }

    loadSampleData() {
        if (this.products.length === 0) {
            this.products = [
                { id: 1, barcode: '1', name: 'Хляб бял', price: 1.50, stock: 50, category: 'Храни' },
                { id: 2, barcode: '2', name: 'Мляко 1л', price: 2.80, stock: 30, category: 'Напитки' },
                { id: 3, barcode: '3', name: 'Кафе 200г', price: 8.50, stock: 15, category: 'Напитки' },
                { id: 4, barcode: '4', name: 'Масло 500г', price: 4.20, stock: 25, category: 'Храни' },
                { id: 5, barcode: '5', name: 'Сирене 400г', price: 6.50, stock: 8, category: 'Млечни' },
                { id: 6, barcode: '6', name: 'Шоколад Милка', price: 3.20, stock: 0, category: 'Сладкиши' },
                { id: 7, barcode: '7', name: 'Вода минерална 1.5л', price: 1.20, stock: 100, category: 'Напитки' },
                { id: 8, barcode: '8', name: 'Ориз 1кг', price: 3.50, stock: 40, category: 'Храни' }
            ];
            this.saveProducts();
        }
    }

    // Keyboard Shortcuts
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
                    // Close all modals
                    document.querySelectorAll('.modal').forEach(modal => {
                        modal.style.display = 'none';
                    });
                    break;
            }
        });
    }

    // Event Listeners
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
        document.getElementById('logoutBtn').addEventListener('click', () => this.logout());

        // Quick Scan
        document.getElementById('quickBarcodeInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.quickAddToCart();
            }
        });
        document.getElementById('quickQuantity').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                document.getElementById('quickBarcodeInput').focus();
            }
        });
        document.getElementById('quickAddBtn').addEventListener('click', () => this.quickAddToCart());

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
        document.getElementById('clearCartBtn').addEventListener('click', () => this.clearCart());
        document.getElementById('checkoutBtn').addEventListener('click', () => this.openCheckoutModal());
        document.getElementById('customerSelect').addEventListener('change', (e) => {
            this.currentCustomer = this.customers.find(c => c.id == e.target.value) || null;
        });
        document.getElementById('addCustomerQuick').addEventListener('click', () => this.openAddCustomerModal());

        // Forms
        document.getElementById('loginForm').addEventListener('submit', (e) => this.handleLogin(e));
        document.getElementById('addProductForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addProduct();
        });
        document.getElementById('editProductForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.updateProduct();
        });
        document.getElementById('addCustomerForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addCustomer();
        });
        document.getElementById('editCustomerForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.updateCustomer();
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
            btn.addEventListener('click', () => {
                this.reportPeriod = btn.dataset.period;
                document.querySelectorAll('.period-btn').forEach(b => {
                    b.classList.remove('btn-primary');
                    b.classList.add('btn-secondary');
                });
                btn.classList.remove('btn-secondary');
                btn.classList.add('btn-primary');
                this.generateReports();
            });
        });

        // Categories
        document.getElementById('addCategoryBtn').addEventListener('click', () => this.addCategory());

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
                this.processPayment(btn.dataset.method);
            });
        });
    }

    // View Management
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

    // Low Stock Alerts
    checkLowStock() {
        const lowStockProducts = this.products.filter(p => p.stock > 0 && p.stock < 10);
        const outOfStockProducts = this.products.filter(p => p.stock === 0);
        const banner = document.getElementById('lowStockBanner');

        if (lowStockProducts.length > 0 || outOfStockProducts.length > 0) {
            let message = '<h3>⚠️ Предупреждение за наличности</h3><div class="low-stock-items">';

            if (outOfStockProducts.length > 0) {
                outOfStockProducts.forEach(p => {
                    message += `<div class="low-stock-item">❌ ${p.name} - ИЗЧЕРПАН</div>`;
                });
            }

            if (lowStockProducts.length > 0) {
                lowStockProducts.forEach(p => {
                    message += `<div class="low-stock-item">⚠️ ${p.name} - ${p.stock} бр.</div>`;
                });
            }

            message += '</div>';
            banner.innerHTML = message;
            banner.style.display = 'block';
        } else {
            banner.style.display = 'none';
        }
    }

    // Product Search
    searchProducts() {
        const query = document.getElementById('barcodeInput').value.trim().toLowerCase();
        const resultsDiv = document.getElementById('searchResults');

        if (!query) {
            resultsDiv.innerHTML = '';
            return;
        }

        const results = this.products.filter(p =>
            p.barcode.includes(query) ||
            p.name.toLowerCase().includes(query) ||
            p.category.toLowerCase().includes(query)
        );

        if (results.length === 0) {
            resultsDiv.innerHTML = '<div class="no-results">Няма намерени продукти</div>';
            return;
        }

        resultsDiv.innerHTML = results.map(product => `
            <div class="product-card" onclick="posSystem.addToCart(${product.id})">
                <h3>${product.name}</h3>
                <div class="product-info">
                    <span>Баркод: ${product.barcode}</span>
                    <span class="product-stock ${this.getStockClass(product.stock)}">
                        ${this.getStockLabel(product.stock)}
                    </span>
                </div>
                <div class="product-info">
                    <span>${product.category}</span>
                    <span class="product-price">${product.price.toFixed(2)} лв</span>
                </div>
            </div>
        `).join('');
    }

    getStockClass(stock) {
        if (stock === 0) return 'stock-out';
        if (stock < 10) return 'stock-low';
        return 'stock-ok';
    }

    getStockLabel(stock) {
        if (stock === 0) return 'Изчерпан';
        if (stock < 10) return `Нисък запас: ${stock}`;
        return `В наличност: ${stock}`;
    }

    // Quick Barcode Add to Cart
    quickAddToCart() {
        const barcodeInput = document.getElementById('quickBarcodeInput');
        const quantityInput = document.getElementById('quickQuantity');
        const feedbackDiv = document.getElementById('quickScanFeedback');

        const barcode = barcodeInput.value.trim();
        const quantity = parseInt(quantityInput.value) || 1;

        if (!barcode) {
            this.showQuickFeedback('Моля, въведете баркод!', 'error');
            return;
        }

        const product = this.products.find(p => p.barcode === barcode);

        if (!product) {
            this.showQuickFeedback(`❌ Продукт с баркод "${barcode}" не е намерен!`, 'error');
            barcodeInput.value = '';
            barcodeInput.focus();
            return;
        }

        if (product.stock === 0) {
            this.showQuickFeedback(`⚠️ "${product.name}" е изчерпан!`, 'warning');
            barcodeInput.value = '';
            barcodeInput.focus();
            return;
        }

        const cartItem = this.cart.find(item => item.id === product.id);
        const currentCartQuantity = cartItem ? cartItem.quantity : 0;
        const newTotalQuantity = currentCartQuantity + quantity;

        if (newTotalQuantity > product.stock) {
            this.showQuickFeedback(
                `⚠️ Недостатъчна наличност! В наличност: ${product.stock}, В количка: ${currentCartQuantity}`,
                'warning'
            );
            barcodeInput.value = '';
            barcodeInput.focus();
            return;
        }

        if (cartItem) {
            cartItem.quantity += quantity;
        } else {
            this.cart.push({
                id: product.id,
                name: product.name,
                price: product.price,
                quantity: quantity,
                maxStock: product.stock
            });
        }

        this.renderCart();

        const totalPrice = product.price * quantity;
        this.showQuickFeedback(
            `✓ Добавен: ${product.name} × ${quantity} = ${totalPrice.toFixed(2)} лв`,
            'success'
        );

        barcodeInput.value = '';
        quantityInput.value = '1';
        barcodeInput.focus();

        setTimeout(() => {
            feedbackDiv.innerHTML = '';
            feedbackDiv.className = 'quick-scan-feedback';
        }, 3000);
    }

    showQuickFeedback(message, type) {
        const feedbackDiv = document.getElementById('quickScanFeedback');
        feedbackDiv.innerHTML = message;
        feedbackDiv.className = `quick-scan-feedback feedback-${type}`;
    }

    // Cart Management
    addToCart(productId) {
        const product = this.products.find(p => p.id === productId);

        if (!product) {
            alert('Продуктът не е намерен!');
            return;
        }

        if (product.stock === 0) {
            alert('Продуктът е изчерпан!');
            return;
        }

        const cartItem = this.cart.find(item => item.id === productId);

        if (cartItem) {
            if (cartItem.quantity >= product.stock) {
                alert('Недостатъчна наличност!');
                return;
            }
            cartItem.quantity++;
        } else {
            this.cart.push({
                id: product.id,
                name: product.name,
                price: product.price,
                quantity: 1,
                maxStock: product.stock
            });
        }

        this.renderCart();
        document.getElementById('barcodeInput').value = '';
        document.getElementById('searchResults').innerHTML = '';
        document.getElementById('barcodeInput').focus();
    }

    removeFromCart(productId) {
        this.cart = this.cart.filter(item => item.id !== productId);
        this.renderCart();
    }

    updateCartQuantity(productId, delta) {
        const cartItem = this.cart.find(item => item.id === productId);

        if (!cartItem) return;

        const newQuantity = cartItem.quantity + delta;

        if (newQuantity <= 0) {
            this.removeFromCart(productId);
            return;
        }

        if (newQuantity > cartItem.maxStock) {
            alert('Недостатъчна наличност!');
            return;
        }

        cartItem.quantity = newQuantity;
        this.renderCart();
    }

    clearCart() {
        if (this.cart.length === 0) return;

        if (confirm('Сигурни ли сте, че искате да изчистите количката?')) {
            this.cart = [];
            this.currentCustomer = null;
            document.getElementById('customerSelect').value = '';
            this.renderCart();
        }
    }

    renderCart() {
        const cartItemsDiv = document.getElementById('cartItems');
        const totalItemsSpan = document.getElementById('totalItems');
        const totalPriceSpan = document.getElementById('totalPrice');

        if (this.cart.length === 0) {
            cartItemsDiv.innerHTML = '<div class="empty-cart">Количката е празна</div>';
            totalItemsSpan.textContent = '0';
            totalPriceSpan.textContent = '0.00 лв';
            return;
        }

        const totalItems = this.cart.reduce((sum, item) => sum + item.quantity, 0);
        const totalPrice = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        cartItemsDiv.innerHTML = this.cart.map(item => `
            <div class="cart-item">
                <div class="cart-item-header">
                    <span class="cart-item-name">${item.name}</span>
                    <button class="remove-item" onclick="posSystem.removeFromCart(${item.id})">✕</button>
                </div>
                <div class="cart-item-details">
                    <div class="quantity-controls">
                        <button class="quantity-btn" onclick="posSystem.updateCartQuantity(${item.id}, -1)">-</button>
                        <span class="quantity">${item.quantity}</span>
                        <button class="quantity-btn" onclick="posSystem.updateCartQuantity(${item.id}, 1)">+</button>
                    </div>
                    <span>${item.price.toFixed(2)} лв × ${item.quantity}</span>
                    <span class="item-total">${(item.price * item.quantity).toFixed(2)} лв</span>
                </div>
            </div>
        `).join('');

        totalItemsSpan.textContent = totalItems;
        totalPriceSpan.textContent = totalPrice.toFixed(2) + ' лв';
    }

    // Checkout
    openCheckoutModal() {
        if (this.cart.length === 0) {
            alert('Количката е празна!');
            return;
        }

        const modal = document.getElementById('checkoutModal');
        const itemsDiv = document.getElementById('checkoutItems');
        const totalSpan = document.getElementById('checkoutTotal');

        const totalPrice = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        itemsDiv.innerHTML = this.cart.map(item => `
            <div class="checkout-item">
                <span>${item.name} × ${item.quantity}</span>
                <span>${(item.price * item.quantity).toFixed(2)} лв</span>
            </div>
        `).join('');

        totalSpan.textContent = totalPrice.toFixed(2) + ' лв';
        document.getElementById('paymentResult').innerHTML = '';
        modal.style.display = 'block';
    }

    processPayment(method) {
        const methodNames = { 'cash': 'В брой', 'card': 'Карта' };
        const totalPrice = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        // Calculate loyalty points (1 point per lev spent)
        const pointsEarned = Math.floor(totalPrice);
        let discount = 0;

        // Apply customer loyalty discount if applicable
        if (this.currentCustomer && this.currentCustomer.points >= 100) {
            discount = totalPrice * 0.05; // 5% discount for 100+ points
        }

        const finalTotal = totalPrice - discount;

        // Create sale record
        const sale = {
            id: Date.now(),
            date: new Date().toISOString(),
            items: this.cart.map(item => ({
                productId: item.id,
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                total: item.price * item.quantity
            })),
            subtotal: totalPrice,
            discount: discount,
            total: finalTotal,
            paymentMethod: method,
            customerId: this.currentCustomer ? this.currentCustomer.id : null,
            customerName: this.currentCustomer ? this.currentCustomer.name : 'Гост',
            userId: this.currentUser.id,
            userName: this.currentUser.name
        };

        // Update inventory
        this.cart.forEach(cartItem => {
            const product = this.products.find(p => p.id === cartItem.id);
            if (product) {
                product.stock -= cartItem.quantity;
            }
        });

        // Update customer loyalty
        if (this.currentCustomer) {
            this.currentCustomer.points += pointsEarned;
            this.currentCustomer.totalSpent = (this.currentCustomer.totalSpent || 0) + finalTotal;
            this.saveCustomers();
        }

        this.saveProducts();
        this.sales.push(sale);
        this.saveSales();

        let resultHTML = `
            <div class="success-message">
                ✓ Плащането е успешно!<br>
                Метод: ${methodNames[method]}<br>
                ${discount > 0 ? `Отстъпка: ${discount.toFixed(2)} лв<br>` : ''}
                Сума: ${finalTotal.toFixed(2)} лв
                ${this.currentCustomer ? `<br>Спечелени точки: ${pointsEarned}` : ''}
            </div>
            <button class="btn btn-primary" onclick="posSystem.showReceipt(${sale.id})">🧾 Касова Бележка</button>
            <button class="btn btn-success" onclick="posSystem.finishCheckout()">Завърши</button>
        `;

        document.getElementById('paymentResult').innerHTML = resultHTML;
        document.querySelector('.payment-methods').style.display = 'none';
        this.checkLowStock();
    }

    showReceipt(saleId) {
        const sale = this.sales.find(s => s.id === saleId);
        if (!sale) return;

        const modal = document.getElementById('receiptModal');
        const content = document.getElementById('receiptContent');

        content.innerHTML = `
            <div class="receipt-header">
                <h2>POS СИСТЕМА</h2>
                <div>Касова Бележка</div>
            </div>
            <div class="receipt-info">
                <div>Номер: #${sale.id}</div>
                <div>Дата: ${new Date(sale.date).toLocaleString('bg-BG')}</div>
                <div>Касиер: ${sale.userName}</div>
                ${sale.customerName !== 'Гост' ? `<div>Клиент: ${sale.customerName}</div>` : ''}
            </div>
            <div class="receipt-items">
                ${sale.items.map(item => `
                    <div class="receipt-item">
                        <span>${item.name} × ${item.quantity}</span>
                        <span>${item.total.toFixed(2)} лв</span>
                    </div>
                `).join('')}
            </div>
            ${sale.discount > 0 ? `
                <div class="receipt-item">
                    <span>Подобща:</span>
                    <span>${sale.subtotal.toFixed(2)} лв</span>
                </div>
                <div class="receipt-item">
                    <span>Отстъпка:</span>
                    <span>-${sale.discount.toFixed(2)} лв</span>
                </div>
            ` : ''}
            <div class="receipt-total">
                <span>ОБЩО:</span>
                <span>${sale.total.toFixed(2)} лв</span>
            </div>
            <div class="receipt-info">
                <div>Метод: ${sale.paymentMethod === 'cash' ? 'В брой' : 'Карта'}</div>
            </div>
            <div class="receipt-footer">
                Благодарим Ви!<br>
                Очакваме Ви отново!
            </div>
        `;

        modal.style.display = 'block';
    }

    printReceipt() {
        const content = document.getElementById('receiptContent').innerHTML;
        const printWindow = window.open('', '', 'height=600,width=400');
        printWindow.document.write('<html><head><title>Касова Бележка</title>');
        printWindow.document.write('<style>');
        printWindow.document.write('body { font-family: "Courier New", monospace; padding: 20px; }');
        printWindow.document.write('.receipt-header { text-align: center; border-bottom: 2px dashed #333; padding-bottom: 15px; margin-bottom: 15px; }');
        printWindow.document.write('.receipt-info { margin-bottom: 15px; font-size: 12px; }');
        printWindow.document.write('.receipt-items { border-bottom: 2px dashed #333; padding-bottom: 15px; margin-bottom: 15px; }');
        printWindow.document.write('.receipt-item { display: flex; justify-content: space-between; margin-bottom: 8px; }');
        printWindow.document.write('.receipt-total { font-size: 18px; font-weight: bold; display: flex; justify-content: space-between; margin-bottom: 15px; }');
        printWindow.document.write('.receipt-footer { text-align: center; font-size: 12px; border-top: 2px dashed #333; padding-top: 15px; }');
        printWindow.document.write('</style></head><body>');
        printWindow.document.write(content);
        printWindow.document.write('</body></html>');
        printWindow.document.close();
        printWindow.print();
    }

    finishCheckout() {
        this.cart = [];
        this.currentCustomer = null;
        document.getElementById('customerSelect').value = '';
        this.renderCart();
        document.getElementById('checkoutModal').style.display = 'none';
        document.querySelector('.payment-methods').style.display = 'block';
        this.renderInventory();
        document.getElementById('quickBarcodeInput').focus();
    }

    // Customer Management
    renderCustomerSelect() {
        const select = document.getElementById('customerSelect');
        select.innerHTML = '<option value="">Без клиент</option>' +
            this.customers.map(c => `<option value="${c.id}">${c.name} (${c.points} т.)</option>`).join('');
    }

    openAddCustomerModal() {
        document.getElementById('addCustomerForm').reset();
        document.getElementById('addCustomerModal').style.display = 'block';
    }

    addCustomer() {
        const name = document.getElementById('customerName').value.trim();
        const phone = document.getElementById('customerPhone').value.trim();
        const email = document.getElementById('customerEmail').value.trim();

        const newCustomer = {
            id: Date.now(),
            name,
            phone,
            email,
            points: 0,
            totalSpent: 0,
            createdAt: new Date().toISOString()
        };

        this.customers.push(newCustomer);
        this.saveCustomers();
        this.renderCustomers();
        this.renderCustomerSelect();

        document.getElementById('addCustomerModal').style.display = 'none';
        alert('Клиентът е добавен успешно!');
    }

    openEditCustomerModal(customerId) {
        const customer = this.customers.find(c => c.id === customerId);
        if (!customer) return;

        document.getElementById('editCustomerId').value = customer.id;
        document.getElementById('editCustomerName').value = customer.name;
        document.getElementById('editCustomerPhone').value = customer.phone;
        document.getElementById('editCustomerEmail').value = customer.email || '';
        document.getElementById('editCustomerPoints').textContent = customer.points;
        document.getElementById('editCustomerSpent').textContent = (customer.totalSpent || 0).toFixed(2);

        document.getElementById('editCustomerModal').style.display = 'block';
    }

    updateCustomer() {
        const id = parseInt(document.getElementById('editCustomerId').value);
        const name = document.getElementById('editCustomerName').value.trim();
        const phone = document.getElementById('editCustomerPhone').value.trim();
        const email = document.getElementById('editCustomerEmail').value.trim();

        const customer = this.customers.find(c => c.id === id);
        if (!customer) return;

        customer.name = name;
        customer.phone = phone;
        customer.email = email;

        this.saveCustomers();
        this.renderCustomers();
        this.renderCustomerSelect();

        document.getElementById('editCustomerModal').style.display = 'none';
        alert('Клиентът е обновен успешно!');
    }

    deleteCustomer(customerId) {
        if (!confirm('Сигурни ли сте, че искате да изтриете този клиент?')) {
            return;
        }

        this.customers = this.customers.filter(c => c.id !== customerId);
        this.saveCustomers();
        this.renderCustomers();
        this.renderCustomerSelect();
        alert('Клиентът е изтрит успешно!');
    }

    renderCustomers() {
        const customersList = document.getElementById('customersList');
        const searchQuery = document.getElementById('customerSearch').value.toLowerCase();

        let filtered = this.customers.filter(c =>
            c.name.toLowerCase().includes(searchQuery) ||
            c.phone.includes(searchQuery) ||
            (c.email && c.email.toLowerCase().includes(searchQuery))
        );

        if (filtered.length === 0) {
            customersList.innerHTML = '<div class="no-results">Няма намерени клиенти</div>';
            return;
        }

        customersList.innerHTML = filtered.map(customer => `
            <div class="customer-item">
                <div class="customer-info">
                    <h3>${customer.name}</h3>
                    <div class="customer-contact">
                        📞 ${customer.phone}
                        ${customer.email ? `<br>📧 ${customer.email}` : ''}
                    </div>
                </div>
                <div class="customer-stats">
                    <div class="customer-stat-label">Общо изразходвано</div>
                    <div class="customer-stat-value">${(customer.totalSpent || 0).toFixed(2)} лв</div>
                </div>
                <div class="loyalty-badge">
                    <div class="loyalty-points">${customer.points}</div>
                    <div class="loyalty-label">точки</div>
                </div>
                <div class="customer-actions">
                    <button class="btn btn-primary btn-small" onclick="posSystem.openEditCustomerModal(${customer.id})">
                        ✏️
                    </button>
                    <button class="btn btn-danger btn-small" onclick="posSystem.deleteCustomer(${customer.id})">
                        🗑️
                    </button>
                </div>
            </div>
        `).join('');
    }

    // Sales History
    renderSalesHistory() {
        const salesList = document.getElementById('salesList');
        const fromDate = document.getElementById('salesFromDate').value;
        const toDate = document.getElementById('salesToDate').value;
        const methodFilter = document.getElementById('salesMethodFilter').value;

        let filtered = [...this.sales].reverse();

        if (fromDate) {
            filtered = filtered.filter(s => new Date(s.date) >= new Date(fromDate));
        }
        if (toDate) {
            filtered = filtered.filter(s => new Date(s.date) <= new Date(toDate + 'T23:59:59'));
        }
        if (methodFilter !== 'all') {
            filtered = filtered.filter(s => s.paymentMethod === methodFilter);
        }

        if (filtered.length === 0) {
            salesList.innerHTML = '<div class="no-results">Няма намерени продажби</div>';
            return;
        }

        salesList.innerHTML = filtered.map(sale => `
            <div class="sale-item" onclick="posSystem.showSaleDetails(${sale.id})">
                <div class="sale-header">
                    <span class="sale-id">#${sale.id}</span>
                    <span class="sale-date">${new Date(sale.date).toLocaleString('bg-BG')}</span>
                </div>
                <div class="sale-details">
                    <div class="sale-detail">
                        <span class="sale-detail-label">Клиент</span>
                        <span class="sale-detail-value">${sale.customerName}</span>
                    </div>
                    <div class="sale-detail">
                        <span class="sale-detail-label">Метод</span>
                        <span class="sale-detail-value">${sale.paymentMethod === 'cash' ? 'В брой' : 'Карта'}</span>
                    </div>
                    <div class="sale-detail">
                        <span class="sale-detail-label">Обща сума</span>
                        <span class="sale-total">${sale.total.toFixed(2)} лв</span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    showSaleDetails(saleId) {
        const sale = this.sales.find(s => s.id === saleId);
        if (!sale) return;

        const modal = document.getElementById('saleDetailsModal');
        const content = document.getElementById('saleDetailsContent');

        content.innerHTML = `
            <div class="sale-details-header">
                <h3>Продажба #${sale.id}</h3>
                <div>Дата: ${new Date(sale.date).toLocaleString('bg-BG')}</div>
                <div>Касиер: ${sale.userName}</div>
                <div>Клиент: ${sale.customerName}</div>
            </div>
            <div class="sale-details-items">
                <h4>Продукти:</h4>
                ${sale.items.map(item => `
                    <div class="sale-details-item">
                        <span>${item.name} × ${item.quantity}</span>
                        <span>${item.total.toFixed(2)} лв</span>
                    </div>
                `).join('')}
            </div>
            ${sale.discount > 0 ? `
                <div class="sale-details-item">
                    <span><strong>Подобща:</strong></span>
                    <span><strong>${sale.subtotal.toFixed(2)} лв</strong></span>
                </div>
                <div class="sale-details-item">
                    <span><strong>Отстъпка:</strong></span>
                    <span><strong>-${sale.discount.toFixed(2)} лв</strong></span>
                </div>
            ` : ''}
            <div class="sale-details-item">
                <span><strong>ОБЩО:</strong></span>
                <span><strong style="color: #28a745; font-size: 20px;">${sale.total.toFixed(2)} лв</strong></span>
            </div>
            <div class="sale-details-item">
                <span><strong>Метод на плащане:</strong></span>
                <span>${sale.paymentMethod === 'cash' ? 'В брой' : 'Карта'}</span>
            </div>
        `;

        document.getElementById('printSaleReceiptBtn').onclick = () => this.showReceipt(saleId);
        modal.style.display = 'block';
    }

    // Reports & Statistics
    generateReports() {
        const period = this.reportPeriod;
        let filteredSales = this.filterSalesByPeriod(period);

        // Calculate stats
        const totalSales = filteredSales.reduce((sum, s) => sum + s.total, 0);
        const salesCount = filteredSales.length;
        const avgSale = salesCount > 0 ? totalSales / salesCount : 0;

        // Find top product
        const productSales = {};
        filteredSales.forEach(sale => {
            sale.items.forEach(item => {
                productSales[item.name] = (productSales[item.name] || 0) + item.quantity;
            });
        });
        const topProduct = Object.entries(productSales).sort((a, b) => b[1] - a[1])[0];

        // Update stats display
        document.getElementById('statTotalSales').textContent = totalSales.toFixed(2) + ' лв';
        document.getElementById('statSalesCount').textContent = salesCount;
        document.getElementById('statAvgSale').textContent = avgSale.toFixed(2) + ' лв';
        document.getElementById('statTopProduct').textContent = topProduct ? `${topProduct[0]} (${topProduct[1]})` : '-';

        // Generate charts
        this.generateSalesChart(filteredSales);
        this.generatePaymentMethodChart(filteredSales);
    }

    filterSalesByPeriod(period) {
        const now = new Date();
        let startDate;

        switch(period) {
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
                return this.sales;
            default:
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        }

        return this.sales.filter(s => new Date(s.date) >= startDate);
    }

    generateSalesChart(sales) {
        const ctx = document.getElementById('salesChart');
        if (!ctx) return;

        // Prepare data by date
        const salesByDate = {};
        sales.forEach(sale => {
            const date = new Date(sale.date).toLocaleDateString('bg-BG');
            salesByDate[date] = (salesByDate[date] || 0) + sale.total;
        });

        const labels = Object.keys(salesByDate).slice(-7); // Last 7 days
        const data = labels.map(label => salesByDate[label]);

        if (this.charts.sales) {
            this.charts.sales.destroy();
        }

        this.charts.sales = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Продажби (лв)',
                    data: data,
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: true }
                },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    }

    generatePaymentMethodChart(sales) {
        const ctx = document.getElementById('paymentMethodChart');
        if (!ctx) return;

        const cashSales = sales.filter(s => s.paymentMethod === 'cash').reduce((sum, s) => sum + s.total, 0);
        const cardSales = sales.filter(s => s.paymentMethod === 'card').reduce((sum, s) => sum + s.total, 0);

        if (this.charts.payment) {
            this.charts.payment.destroy();
        }

        this.charts.payment = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['В брой', 'Карта'],
                datasets: [{
                    data: [cashSales, cardSales],
                    backgroundColor: ['#28a745', '#667eea']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });
    }

    // Product Management
    openAddProductModal() {
        document.getElementById('addProductForm').reset();
        document.getElementById('addProductModal').style.display = 'block';
    }

    addProduct() {
        const barcode = document.getElementById('productBarcode').value.trim();
        const name = document.getElementById('productName').value.trim();
        const price = parseFloat(document.getElementById('productPrice').value);
        const stock = parseInt(document.getElementById('productStock').value);
        const category = document.getElementById('productCategory').value.trim() || 'Общи';

        if (this.products.find(p => p.barcode === barcode)) {
            alert('Продукт с този баркод вече съществува!');
            return;
        }

        const newProduct = {
            id: Date.now(),
            barcode,
            name,
            price,
            stock,
            category
        };

        this.products.push(newProduct);
        this.saveProducts();
        this.renderInventory();
        this.updateCategoryFilters();

        document.getElementById('addProductModal').style.display = 'none';
        alert('Продуктът е добавен успешно!');
    }

    openEditProductModal(productId) {
        const product = this.products.find(p => p.id === productId);
        if (!product) return;

        document.getElementById('editProductId').value = product.id;
        document.getElementById('editProductBarcode').value = product.barcode;
        document.getElementById('editProductName').value = product.name;
        document.getElementById('editProductPrice').value = product.price;
        document.getElementById('editProductStock').value = product.stock;
        document.getElementById('editProductCategory').value = product.category;

        document.getElementById('editProductModal').style.display = 'block';
    }

    updateProduct() {
        const id = parseInt(document.getElementById('editProductId').value);
        const barcode = document.getElementById('editProductBarcode').value.trim();
        const name = document.getElementById('editProductName').value.trim();
        const price = parseFloat(document.getElementById('editProductPrice').value);
        const stock = parseInt(document.getElementById('editProductStock').value);
        const category = document.getElementById('editProductCategory').value.trim() || 'Общи';

        const product = this.products.find(p => p.id === id);
        if (!product) return;

        const existingProduct = this.products.find(p => p.barcode === barcode && p.id !== id);
        if (existingProduct) {
            alert('Друг продукт вече използва този баркод!');
            return;
        }

        product.barcode = barcode;
        product.name = name;
        product.price = price;
        product.stock = stock;
        product.category = category;

        this.saveProducts();
        this.renderInventory();
        this.updateCategoryFilters();

        document.getElementById('editProductModal').style.display = 'none';
        alert('Продуктът е обновен успешно!');
    }

    deleteProduct(productId) {
        if (!confirm('Сигурни ли сте, че искате да изтриете този продукт?')) {
            return;
        }

        this.products = this.products.filter(p => p.id !== productId);
        this.saveProducts();
        this.renderInventory();
        this.updateCategoryFilters();
        alert('Продуктът е изтрит успешно!');
    }

    showProductBarcode(productId) {
        const product = this.products.find(p => p.id === productId);
        if (!product) return;

        document.getElementById('barcodeProductName').textContent = product.name;

        // Generate barcode
        JsBarcode("#barcodeImage", product.barcode, {
            format: "CODE128",
            displayValue: true,
            fontSize: 16,
            height: 60
        });

        // Generate QR code
        const qrcodeDiv = document.getElementById('qrcodeImage');
        qrcodeDiv.innerHTML = ''; // Clear previous QR code
        new QRCode(qrcodeDiv, {
            text: `${product.name}\nБаркод: ${product.barcode}\nЦена: ${product.price} лв`,
            width: 200,
            height: 200,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });

        document.getElementById('barcodeModal').style.display = 'block';
    }

    printBarcode() {
        const content = document.querySelector('.barcode-content').innerHTML;
        const printWindow = window.open('', '', 'height=600,width=600');
        printWindow.document.write('<html><head><title>Баркод</title>');
        printWindow.document.write('<style>body { text-align: center; padding: 20px; }</style>');
        printWindow.document.write('</head><body>');
        printWindow.document.write(content);
        printWindow.document.write('</body></html>');
        printWindow.document.close();
        printWindow.print();
    }

    // Inventory Display
    renderInventory() {
        const inventoryList = document.getElementById('inventoryList');
        const searchQuery = document.getElementById('inventorySearch').value.toLowerCase();
        const stockFilter = document.getElementById('stockFilter').value;
        const categoryFilter = document.getElementById('categoryFilter').value;

        let filtered = this.products.filter(p =>
            p.name.toLowerCase().includes(searchQuery) ||
            p.barcode.includes(searchQuery) ||
            p.category.toLowerCase().includes(searchQuery)
        );

        // Apply stock filter
        if (stockFilter === 'low') {
            filtered = filtered.filter(p => p.stock > 0 && p.stock < 10);
        } else if (stockFilter === 'out') {
            filtered = filtered.filter(p => p.stock === 0);
        }

        // Apply category filter
        if (categoryFilter !== 'all') {
            filtered = filtered.filter(p => p.category === categoryFilter);
        }

        if (filtered.length === 0) {
            inventoryList.innerHTML = '<div class="no-results">Няма намерени продукти</div>';
            return;
        }

        inventoryList.innerHTML = filtered.map(product => `
            <div class="inventory-item">
                <div>
                    <div class="inventory-item-name">${product.name}</div>
                    <div class="inventory-item-barcode">Баркод: ${product.barcode}</div>
                    <div style="color: #666; font-size: 14px; margin-top: 5px;">${product.category}</div>
                </div>
                <div class="inventory-item-price">${product.price.toFixed(2)} лв</div>
                <div class="inventory-item-stock">
                    <span class="product-stock ${this.getStockClass(product.stock)}">
                        ${product.stock} бр.
                    </span>
                </div>
                <div class="inventory-actions">
                    <button class="btn btn-primary btn-small" onclick="posSystem.showProductBarcode(${product.id})" title="Баркод/QR">
                        📱
                    </button>
                    <button class="btn btn-primary btn-small" onclick="posSystem.openEditProductModal(${product.id})">
                        ✏️
                    </button>
                    <button class="btn btn-danger btn-small" onclick="posSystem.deleteProduct(${product.id})">
                        🗑️
                    </button>
                </div>
            </div>
        `).join('');
    }

    // Category Management
    updateCategoryFilters() {
        const categories = [...new Set(this.products.map(p => p.category))].sort();
        const select = document.getElementById('categoryFilter');
        select.innerHTML = '<option value="all">Всички категории</option>' +
            categories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
    }

    openCategoryManager() {
        this.renderCategoryList();
        document.getElementById('categoryModal').style.display = 'block';
    }

    renderCategoryList() {
        const categories = [...new Set(this.products.map(p => p.category))].sort();
        const list = document.getElementById('categoryList');

        if (categories.length === 0) {
            list.innerHTML = '<div class="no-results">Няма категории</div>';
            return;
        }

        list.innerHTML = categories.map(cat => {
            const count = this.products.filter(p => p.category === cat).length;
            return `
                <div class="category-item">
                    <div>
                        <span class="category-name">${cat}</span>
                        <span class="category-count">${count} продукта</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    addCategory() {
        const name = document.getElementById('newCategoryName').value.trim();
        if (!name) {
            alert('Моля, въведете име на категория!');
            return;
        }

        const exists = this.products.some(p => p.category === name);
        if (exists) {
            alert('Тази категория вече съществува!');
            return;
        }

        // Category is created when a product uses it
        alert('Категорията ще бъде създадена при добавяне на продукт с нея.');
        document.getElementById('newCategoryName').value = '';
    }

    // CSV Export Functions
    exportInventoryCSV() {
        const headers = ['Баркод', 'Име', 'Цена', 'Наличност', 'Категория'];
        const rows = this.products.map(p => [
            p.barcode,
            p.name,
            p.price.toFixed(2),
            p.stock,
            p.category
        ]);

        this.downloadCSV('Инвентар', headers, rows);
    }

    exportSalesCSV() {
        const headers = ['Номер', 'Дата', 'Клиент', 'Обща сума', 'Метод', 'Касиер'];
        const rows = this.sales.map(s => [
            s.id,
            new Date(s.date).toLocaleString('bg-BG'),
            s.customerName,
            s.total.toFixed(2),
            s.paymentMethod === 'cash' ? 'В брой' : 'Карта',
            s.userName
        ]);

        this.downloadCSV('Продажби', headers, rows);
    }

    exportCustomersCSV() {
        const headers = ['Име', 'Телефон', 'Email', 'Точки', 'Общо изразходвано'];
        const rows = this.customers.map(c => [
            c.name,
            c.phone,
            c.email || '',
            c.points,
            (c.totalSpent || 0).toFixed(2)
        ]);

        this.downloadCSV('Клиенти', headers, rows);
    }

    downloadCSV(filename, headers, rows) {
        let csv = headers.join(',') + '\n';
        rows.forEach(row => {
            csv += row.map(cell => `"${cell}"`).join(',') + '\n';
        });

        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    }
}

// Initialize the POS System
const posSystem = new POSSystem();
