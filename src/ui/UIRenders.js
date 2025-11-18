/**
 * UI Rendering methods - extends UIManager
 * This file contains all render methods to keep UIManager.js manageable
 */
import { formatCurrency, formatDate, escapeHTML } from '../utils/helpers.js';

export const UIRenders = {
    /**
     * Render product search results
     */
    searchProducts() {
        const query = document.getElementById('barcodeInput').value.trim();
        const resultsDiv = document.getElementById('searchResults');

        if (!query) {
            resultsDiv.innerHTML = '';
            return;
        }

        const results = this.services.product.searchProducts(query);

        if (results.length === 0) {
            resultsDiv.innerHTML = '<div class="no-results">Няма намерени продукти</div>';
            return;
        }

        resultsDiv.innerHTML = results.map(product => {
            const status = this.services.product.getStockStatus(product);
            return `
                <div class="product-card" onclick="ui.addProductToCart(${product.id})">
                    <h3>${escapeHTML(product.name)}</h3>
                    <div class="product-info">
                        <span>Баркод: ${escapeHTML(product.barcode)}</span>
                        <span class="product-stock ${status.class}">${status.label}</span>
                    </div>
                    <div class="product-info">
                        <span>${escapeHTML(product.category)}</span>
                        <span class="product-price">${formatCurrency(product.price)}</span>
                    </div>
                </div>
            `;
        }).join('');
    },

    /**
     * Render shopping cart
     */
    renderCart() {
        const cart = this.services.cart.getCart();
        const cartItemsDiv = document.getElementById('cartItems');
        const totalItemsSpan = document.getElementById('totalItems');
        const totalPriceSpan = document.getElementById('totalPrice');

        if (cart.length === 0) {
            cartItemsDiv.innerHTML = '<div class="empty-cart">Количката е празна</div>';
            totalItemsSpan.textContent = '0';
            totalPriceSpan.textContent = formatCurrency(0);
            return;
        }

        const itemCount = this.services.cart.getItemCount();
        const total = this.services.cart.getTotal();

        cartItemsDiv.innerHTML = cart.map(item => `
            <div class="cart-item">
                <div class="cart-item-header">
                    <span class="cart-item-name">${escapeHTML(item.name)}</span>
                    <button class="remove-item" onclick="ui.removeFromCart(${item.id})">✕</button>
                </div>
                <div class="cart-item-details">
                    <div class="quantity-controls">
                        <button class="quantity-btn" onclick="ui.changeCartQuantity(${item.id}, -1)">-</button>
                        <span class="quantity">${item.quantity}</span>
                        <button class="quantity-btn" onclick="ui.changeCartQuantity(${item.id}, 1)">+</button>
                    </div>
                    <span>${formatCurrency(item.price)} × ${item.quantity}</span>
                    <span class="item-total">${formatCurrency(item.price * item.quantity)}</span>
                </div>
            </div>
        `).join('');

        totalItemsSpan.textContent = itemCount;
        totalPriceSpan.textContent = formatCurrency(total);
    },

    /**
     * Render inventory list
     */
    renderInventory() {
        const inventoryList = document.getElementById('inventoryList');
        const searchQuery = document.getElementById('inventorySearch').value;
        const stockFilter = document.getElementById('stockFilter').value;
        const categoryFilter = document.getElementById('categoryFilter').value;

        // Apply filters
        let filtered = this.services.product.searchProducts(searchQuery);

        if (stockFilter !== 'all') {
            filtered = this.services.product.filterByStock(stockFilter);
        }

        if (categoryFilter !== 'all') {
            filtered = this.services.product.filterByCategory(categoryFilter);
        }

        if (filtered.length === 0) {
            inventoryList.innerHTML = '<div class="no-results">Няма намерени продукти</div>';
            return;
        }

        inventoryList.innerHTML = filtered.map(product => {
            const status = this.services.product.getStockStatus(product);
            return `
                <div class="inventory-item">
                    <div>
                        <div class="inventory-item-name">${escapeHTML(product.name)}</div>
                        <div class="inventory-item-barcode">Баркод: ${escapeHTML(product.barcode)}</div>
                        <div style="color: #666; font-size: 14px; margin-top: 5px;">${escapeHTML(product.category)}</div>
                    </div>
                    <div class="inventory-item-price">${formatCurrency(product.price)}</div>
                    <div class="inventory-item-stock">
                        <span class="product-stock ${status.class}">${product.stock} бр.</span>
                    </div>
                    <div class="inventory-actions">
                        <button class="btn btn-primary btn-small" onclick="ui.showProductBarcode(${product.id})" title="Баркод/QR">📱</button>
                        <button class="btn btn-primary btn-small" onclick="ui.openEditProductModal(${product.id})">✏️</button>
                        <button class="btn btn-danger btn-small" onclick="ui.deleteProduct(${product.id})">🗑️</button>
                    </div>
                </div>
            `;
        }).join('');
    },

    /**
     * Render customers list
     */
    renderCustomers() {
        const customersList = document.getElementById('customersList');
        const searchQuery = document.getElementById('customerSearch').value;

        const customers = this.services.customer.searchCustomers(searchQuery);

        if (customers.length === 0) {
            customersList.innerHTML = '<div class="no-results">Няма намерени клиенти</div>';
            return;
        }

        customersList.innerHTML = customers.map(customer => `
            <div class="customer-item">
                <div class="customer-info">
                    <h3>${escapeHTML(customer.name)}</h3>
                    <div class="customer-contact">
                        📞 ${escapeHTML(customer.phone)}
                        ${customer.email ? `<br>📧 ${escapeHTML(customer.email)}` : ''}
                    </div>
                </div>
                <div class="customer-stats">
                    <div class="customer-stat-label">Общо изразходвано</div>
                    <div class="customer-stat-value">${formatCurrency(customer.totalSpent || 0)}</div>
                </div>
                <div class="loyalty-badge">
                    <div class="loyalty-points">${customer.points}</div>
                    <div class="loyalty-label">точки</div>
                </div>
                <div class="customer-actions">
                    <button class="btn btn-primary btn-small" onclick="ui.openEditCustomerModal(${customer.id})">✏️</button>
                    <button class="btn btn-danger btn-small" onclick="ui.deleteCustomer(${customer.id})">🗑️</button>
                </div>
            </div>
        `).join('');
    },

    /**
     * Render sales history
     */
    renderSalesHistory() {
        const salesList = document.getElementById('salesList');
        const fromDate = document.getElementById('salesFromDate').value;
        const toDate = document.getElementById('salesToDate').value;
        const methodFilter = document.getElementById('salesMethodFilter').value;

        // Apply filters
        let sales = this.services.sales.filterByDateRange(fromDate, toDate);
        sales = this.services.sales.filterByPaymentMethod(methodFilter);
        sales = [...sales].reverse(); // Show newest first

        if (sales.length === 0) {
            salesList.innerHTML = '<div class="no-results">Няма намерени продажби</div>';
            return;
        }

        salesList.innerHTML = sales.map(sale => `
            <div class="sale-item" onclick="ui.showSaleDetails(${sale.id})">
                <div class="sale-header">
                    <span class="sale-id">#${sale.id}</span>
                    <span class="sale-date">${formatDate(sale.date)}</span>
                </div>
                <div class="sale-details">
                    <div class="sale-detail">
                        <span class="sale-detail-label">Клиент</span>
                        <span class="sale-detail-value">${escapeHTML(sale.customerName)}</span>
                    </div>
                    <div class="sale-detail">
                        <span class="sale-detail-label">Метод</span>
                        <span class="sale-detail-value">${sale.paymentMethod === 'cash' ? 'В брой' : 'Карта'}</span>
                    </div>
                    <div class="sale-detail">
                        <span class="sale-detail-label">Обща сума</span>
                        <span class="sale-total">${formatCurrency(sale.total)}</span>
                    </div>
                </div>
            </div>
        `).join('');
    },

    /**
     * Render customer select dropdown
     */
    renderCustomerSelect() {
        const select = document.getElementById('customerSelect');
        const customers = this.services.customer.getCustomersForSelect();

        select.innerHTML = '<option value="">Без клиент</option>' +
            customers.map(c => `<option value="${c.id}">${escapeHTML(c.label)}</option>`).join('');
    },

    /**
     * Update category filters
     */
    updateCategoryFilters() {
        const categories = this.services.product.getCategories();
        const select = document.getElementById('categoryFilter');

        select.innerHTML = '<option value="all">Всички категории</option>' +
            categories.map(cat => `<option value="${escapeHTML(cat)}">${escapeHTML(cat)}</option>`).join('');
    }
};
