// POS System Application
class POSSystem {
    constructor() {
        this.products = [];
        this.cart = [];
        this.currentView = 'pos';
        this.init();
    }

    init() {
        this.loadProducts();
        this.loadSampleData();
        this.setupEventListeners();
        this.renderInventory();
        this.renderCart();
    }

    // Local Storage Management
    loadProducts() {
        const stored = localStorage.getItem('posProducts');
        if (stored) {
            this.products = JSON.parse(stored);
        }
    }

    saveProducts() {
        localStorage.setItem('posProducts', JSON.stringify(this.products));
    }

    loadSampleData() {
        if (this.products.length === 0) {
            this.products = [
                {
                    id: 1,
                    barcode: '1234567890',
                    name: 'Хляб бял',
                    price: 1.50,
                    stock: 50,
                    category: 'Храни'
                },
                {
                    id: 2,
                    barcode: '2345678901',
                    name: 'Мляко 1л',
                    price: 2.80,
                    stock: 30,
                    category: 'Напитки'
                },
                {
                    id: 3,
                    barcode: '3456789012',
                    name: 'Кафе 200г',
                    price: 8.50,
                    stock: 15,
                    category: 'Напитки'
                },
                {
                    id: 4,
                    barcode: '4567890123',
                    name: 'Масло 500г',
                    price: 4.20,
                    stock: 25,
                    category: 'Храни'
                },
                {
                    id: 5,
                    barcode: '5678901234',
                    name: 'Сирене 400г',
                    price: 6.50,
                    stock: 8,
                    category: 'Млечни'
                },
                {
                    id: 6,
                    barcode: '6789012345',
                    name: 'Шоколад Милка',
                    price: 3.20,
                    stock: 0,
                    category: 'Сладкиши'
                },
                {
                    id: 7,
                    barcode: '7890123456',
                    name: 'Вода минерална 1.5л',
                    price: 1.20,
                    stock: 100,
                    category: 'Напитки'
                },
                {
                    id: 8,
                    barcode: '8901234567',
                    name: 'Ориз 1кг',
                    price: 3.50,
                    stock: 40,
                    category: 'Храни'
                }
            ];
            this.saveProducts();
        }
    }

    // Event Listeners
    setupEventListeners() {
        // Navigation
        document.getElementById('inventoryBtn').addEventListener('click', () => this.showView('inventory'));
        document.getElementById('backToPosBtn').addEventListener('click', () => this.showView('pos'));
        document.getElementById('addProductBtn').addEventListener('click', () => this.openAddProductModal());

        // Search
        document.getElementById('searchBtn').addEventListener('click', () => this.searchProducts());
        document.getElementById('barcodeInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.searchProducts();
        });
        document.getElementById('barcodeInput').addEventListener('input', () => this.searchProducts());

        // Inventory search and filter
        document.getElementById('inventorySearch').addEventListener('input', () => this.renderInventory());
        document.getElementById('stockFilter').addEventListener('change', () => this.renderInventory());

        // Cart actions
        document.getElementById('clearCartBtn').addEventListener('click', () => this.clearCart());
        document.getElementById('checkoutBtn').addEventListener('click', () => this.openCheckoutModal());

        // Add Product Form
        document.getElementById('addProductForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addProduct();
        });

        // Edit Product Form
        document.getElementById('editProductForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.updateProduct();
        });

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
        this.currentView = view;

        if (view === 'inventory') {
            this.renderInventory();
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
        const methodNames = {
            'cash': 'В брой',
            'card': 'Карта'
        };

        // Update inventory
        this.cart.forEach(cartItem => {
            const product = this.products.find(p => p.id === cartItem.id);
            if (product) {
                product.stock -= cartItem.quantity;
            }
        });

        this.saveProducts();

        const totalPrice = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        document.getElementById('paymentResult').innerHTML = `
            <div class="success-message">
                ✓ Плащането е успешно!<br>
                Метод: ${methodNames[method]}<br>
                Сума: ${totalPrice.toFixed(2)} лв
            </div>
            <button class="btn btn-primary" onclick="posSystem.finishCheckout()">Завърши</button>
        `;

        // Hide payment buttons
        document.querySelector('.payment-methods').style.display = 'none';
    }

    finishCheckout() {
        this.cart = [];
        this.renderCart();
        document.getElementById('checkoutModal').style.display = 'none';
        document.querySelector('.payment-methods').style.display = 'block';
        this.renderInventory();
        alert('Транзакцията е завършена успешно!');
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

        // Check if barcode already exists
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

        // Check if barcode is taken by another product
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
        alert('Продуктът е изтрит успешно!');
    }

    // Inventory Display
    renderInventory() {
        const inventoryList = document.getElementById('inventoryList');
        const searchQuery = document.getElementById('inventorySearch').value.toLowerCase();
        const stockFilter = document.getElementById('stockFilter').value;

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
                    <button class="btn btn-primary btn-small" onclick="posSystem.openEditProductModal(${product.id})">
                        ✏️ Редактирай
                    </button>
                    <button class="btn btn-danger btn-small" onclick="posSystem.deleteProduct(${product.id})">
                        🗑️ Изтрий
                    </button>
                </div>
            </div>
        `).join('');
    }
}

// Initialize the POS System
const posSystem = new POSSystem();
