/**
 * UI Event Handlers - extends UIManager
 */
import { showSuccess, showErrors, showError, formatCurrency, downloadCSV } from '../utils/helpers.js';

export const UIHandlers = {
    /**
     * Handle quick barcode scan
     */
    handleQuickScan() {
        const barcodeInput = document.getElementById('quickBarcodeInput');
        const quantityInput = document.getElementById('quickQuantity');

        const barcode = barcodeInput.value.trim();
        const quantity = parseInt(quantityInput.value) || 1;

        const result = this.services.cart.quickAddByBarcode(barcode, quantity);

        if (result.success) {
            this.renderCart();
            const item = result.item;
            this.showQuickFeedback(
                `✓ Добавен: ${item.name} × ${quantity} = ${formatCurrency(item.price * quantity)}`,
                'success'
            );
            barcodeInput.value = '';
            quantityInput.value = '1';
        } else {
            this.showQuickFeedback(result.errors[0], 'error');
        }

        barcodeInput.focus();
    },

    /**
     * Show quick scan feedback
     */
    showQuickFeedback(message, type) {
        const feedbackDiv = document.getElementById('quickScanFeedback');
        feedbackDiv.innerHTML = message;
        feedbackDiv.className = `quick-scan-feedback feedback-${type}`;

        setTimeout(() => {
            feedbackDiv.innerHTML = '';
            feedbackDiv.className = 'quick-scan-feedback';
        }, 3000);
    },

    /**
     * Handle customer select
     */
    handleCustomerSelect(e) {
        const customerId = parseInt(e.target.value) || null;
        const customer = customerId ? this.services.customer.getCustomerById(customerId) : null;
        this.services.cart.setCustomer(customer);
    },

    /**
     * Handle clear cart
     */
    handleClearCart() {
        if (this.services.cart.getCart().length === 0) return;

        if (confirm('Сигурни ли сте, че искате да изчистите количката?')) {
            this.services.cart.clearCart();
            document.getElementById('customerSelect').value = '';
            this.renderCart();
        }
    },

    /**
     * Handle checkout modal
     */
    openCheckoutModal() {
        const validation = this.services.cart.validateCart();

        if (!validation.isValid) {
            showErrors(validation.errors);
            return;
        }

        const summary = this.services.cart.getCheckoutSummary();
        const modal = document.getElementById('checkoutModal');
        const itemsDiv = document.getElementById('checkoutItems');
        const totalSpan = document.getElementById('checkoutTotal');

        itemsDiv.innerHTML = summary.items.map(item => `
            <div class="checkout-item">
                <span>${item.name} × ${item.quantity}</span>
                <span>${formatCurrency(item.price * item.quantity)}</span>
            </div>
        `).join('');

        if (summary.discount > 0) {
            itemsDiv.innerHTML += `
                <div class="checkout-item">
                    <span>Подобща:</span>
                    <span>${formatCurrency(summary.subtotal)}</span>
                </div>
                <div class="checkout-item" style="color: #28a745;">
                    <span>Отстъпка (${summary.discountReason}):</span>
                    <span>-${formatCurrency(summary.discount)}</span>
                </div>
            `;
        }

        totalSpan.textContent = formatCurrency(summary.total);
        document.getElementById('paymentResult').innerHTML = '';
        document.querySelector('.payment-methods').style.display = 'block';
        modal.style.display = 'block';
    },

    /**
     * Handle payment
     */
    handlePayment(method) {
        const summary = this.services.cart.getCheckoutSummary();

        const checkoutData = {
            cart: summary.items,
            paymentMethod: method,
            customerId: summary.customer ? summary.customer.id : null,
            subtotal: summary.subtotal,
            discount: summary.discount,
            total: summary.total
        };

        const result = this.services.sales.processCheckout(checkoutData);

        if (!result.success) {
            showErrors(result.errors);
            return;
        }

        const methodNames = { 'cash': 'В брой', 'card': 'Карта' };

        let resultHTML = `
            <div class="success-message">
                ✓ Плащането е успешно!<br>
                Метод: ${methodNames[method]}<br>
                ${summary.discount > 0 ? `Отстъпка: ${formatCurrency(summary.discount)}<br>` : ''}
                Сума: ${formatCurrency(summary.total)}
                ${result.pointsEarned > 0 ? `<br>Спечелени точки: ${result.pointsEarned}` : ''}
            </div>
            <button class="btn btn-primary" onclick="ui.showReceipt(${result.sale.id})">🧾 Касова Бележка</button>
            <button class="btn btn-success" onclick="ui.finishCheckout()">Завърши</button>
        `;

        document.getElementById('paymentResult').innerHTML = resultHTML;
        document.querySelector('.payment-methods').style.display = 'none';
        this.checkLowStock();
    },

    /**
     * Show receipt
     */
    showReceipt(saleId) {
        const sale = this.services.sales.getSaleById(saleId);
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
                        <span>${formatCurrency(item.total)}</span>
                    </div>
                `).join('')}
            </div>
            ${sale.discount > 0 ? `
                <div class="receipt-item">
                    <span>Подобща:</span>
                    <span>${formatCurrency(sale.subtotal)}</span>
                </div>
                <div class="receipt-item">
                    <span>Отстъпка:</span>
                    <span>-${formatCurrency(sale.discount)}</span>
                </div>
            ` : ''}
            <div class="receipt-total">
                <span>ОБЩО:</span>
                <span>${formatCurrency(sale.total)}</span>
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
    },

    /**
     * Finish checkout
     */
    finishCheckout() {
        this.services.cart.clearCart();
        document.getElementById('customerSelect').value = '';
        this.renderCart();
        this.renderInventory();
        document.getElementById('checkoutModal').style.display = 'none';
        document.querySelector('.payment-methods').style.display = 'block';
        document.getElementById('quickBarcodeInput').focus();
    },

    /**
     * Print receipt
     */
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
    },

    /**
     * Print barcode
     */
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
    },

    /**
     * Handle add product form
     */
    handleAddProduct() {
        const productData = {
            barcode: document.getElementById('productBarcode').value.trim(),
            name: document.getElementById('productName').value.trim(),
            price: parseFloat(document.getElementById('productPrice').value),
            stock: parseInt(document.getElementById('productStock').value),
            category: document.getElementById('productCategory').value.trim() || 'Общи'
        };

        const result = this.services.product.addProduct(productData);

        if (result.success) {
            this.renderInventory();
            this.updateCategoryFilters();
            document.getElementById('addProductModal').style.display = 'none';
            showSuccess('Продуктът е добавен успешно!');
        } else {
            showErrors(result.errors);
        }
    },

    /**
     * Handle update product form
     */
    handleUpdateProduct() {
        const id = parseInt(document.getElementById('editProductId').value);
        const updates = {
            barcode: document.getElementById('editProductBarcode').value.trim(),
            name: document.getElementById('editProductName').value.trim(),
            price: parseFloat(document.getElementById('editProductPrice').value),
            stock: parseInt(document.getElementById('editProductStock').value),
            category: document.getElementById('editProductCategory').value.trim() || 'Общи'
        };

        const result = this.services.product.updateProduct(id, updates);

        if (result.success) {
            this.renderInventory();
            this.updateCategoryFilters();
            document.getElementById('editProductModal').style.display = 'none';
            showSuccess('Продуктът е обновен успешно!');
        } else {
            showErrors(result.errors);
        }
    },

    /**
     * Handle add customer form
     */
    handleAddCustomer() {
        const customerData = {
            name: document.getElementById('customerName').value.trim(),
            phone: document.getElementById('customerPhone').value.trim(),
            email: document.getElementById('customerEmail').value.trim()
        };

        const result = this.services.customer.addCustomer(customerData);

        if (result.success) {
            this.renderCustomers();
            this.renderCustomerSelect();
            document.getElementById('addCustomerModal').style.display = 'none';
            showSuccess('Клиентът е добавен успешно!');
        } else {
            showErrors(result.errors);
        }
    },

    /**
     * Handle update customer form
     */
    handleUpdateCustomer() {
        const id = parseInt(document.getElementById('editCustomerId').value);
        const updates = {
            name: document.getElementById('editCustomerName').value.trim(),
            phone: document.getElementById('editCustomerPhone').value.trim(),
            email: document.getElementById('editCustomerEmail').value.trim()
        };

        const result = this.services.customer.updateCustomer(id, updates);

        if (result.success) {
            this.renderCustomers();
            this.renderCustomerSelect();
            document.getElementById('editCustomerModal').style.display = 'none';
            showSuccess('Клиентът е обновен успешно!');
        } else {
            showErrors(result.errors);
        }
    },

    /**
     * Open add product modal
     */
    openAddProductModal() {
        document.getElementById('addProductForm').reset();
        document.getElementById('addProductModal').style.display = 'block';
    },

    /**
     * Open add customer modal
     */
    openAddCustomerModal() {
        document.getElementById('addCustomerForm').reset();
        document.getElementById('addCustomerModal').style.display = 'block';
    },

    /**
     * Open category manager
     */
    openCategoryManager() {
        this.renderCategoryList();
        document.getElementById('categoryModal').style.display = 'block';
    },

    /**
     * Render category list
     */
    renderCategoryList() {
        const categories = this.services.product.getCategories();
        const list = document.getElementById('categoryList');

        if (categories.length === 0) {
            list.innerHTML = '<div class="no-results">Няма категории</div>';
            return;
        }

        list.innerHTML = categories.map(cat => {
            const products = this.services.product.filterByCategory(cat);
            return `
                <div class="category-item">
                    <div>
                        <span class="category-name">${cat}</span>
                        <span class="category-count">${products.length} продукта</span>
                    </div>
                </div>
            `;
        }).join('');
    },

    /**
     * Handle add category
     */
    handleAddCategory() {
        const name = document.getElementById('newCategoryName').value.trim();
        if (!name) {
            showError('Моля, въведете име на категория!');
            return;
        }

        const exists = this.services.product.getCategories().includes(name);
        if (exists) {
            showError('Тази категория вече съществува!');
            return;
        }

        showSuccess('Категорията ще бъде създадена при добавяне на продукт с нея.');
        document.getElementById('newCategoryName').value = '';
    },

    /**
     * Handle period change in reports
     */
    handlePeriodChange(btn) {
        this.reportPeriod = btn.dataset.period;
        document.querySelectorAll('.period-btn').forEach(b => {
            b.classList.remove('btn-primary');
            b.classList.add('btn-secondary');
        });
        btn.classList.remove('btn-secondary');
        btn.classList.add('btn-primary');
        this.generateReports();
    },

    /**
     * Generate reports
     */
    generateReports() {
        const period = this.reportPeriod || 'day';
        const stats = this.services.sales.getSalesStats(period);

        document.getElementById('statTotalSales').textContent = formatCurrency(stats.totalSales);
        document.getElementById('statSalesCount').textContent = stats.salesCount;
        document.getElementById('statAvgSale').textContent = formatCurrency(stats.averageSale);
        document.getElementById('statTopProduct').textContent = stats.topProduct
            ? `${stats.topProduct.name} (${stats.topProduct.quantity})`
            : '-';

        this.generateSalesChart(period);
        this.generatePaymentMethodChart(period);
    },

    /**
     * Generate sales chart
     */
    generateSalesChart(period) {
        const ctx = document.getElementById('salesChart');
        if (!ctx) return;

        const chartData = this.services.sales.getSalesChartData(period);

        if (this.charts.sales) {
            this.charts.sales.destroy();
        }

        this.charts.sales = new Chart(ctx, {
            type: 'line',
            data: {
                labels: chartData.labels,
                datasets: [{
                    label: 'Продажби (лв)',
                    data: chartData.data,
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
    },

    /**
     * Generate payment method chart
     */
    generatePaymentMethodChart(period) {
        const ctx = document.getElementById('paymentMethodChart');
        if (!ctx) return;

        const chartData = this.services.sales.getPaymentMethodChartData(period);

        if (this.charts.payment) {
            this.charts.payment.destroy();
        }

        this.charts.payment = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: chartData.labels,
                datasets: [{
                    data: chartData.data,
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
    },

    /**
     * Export inventory CSV
     */
    exportInventoryCSV() {
        const headers = ['Баркод', 'Име', 'Цена', 'Наличност', 'Категория'];
        const products = this.services.product.getAllProducts();
        const rows = products.map(p => [
            p.barcode,
            p.name,
            p.price.toFixed(2),
            p.stock,
            p.category
        ]);

        downloadCSV('Инвентар', headers, rows);
    },

    /**
     * Export sales CSV
     */
    exportSalesCSV() {
        const { headers, rows } = this.services.sales.exportToCSV();
        downloadCSV('Продажби', headers, rows);
    },

    /**
     * Export customers CSV
     */
    exportCustomersCSV() {
        const headers = ['Име', 'Телефон', 'Email', 'Точки', 'Общо изразходвано'];
        const customers = this.services.customer.getAllCustomers();
        const rows = customers.map(c => [
            c.name,
            c.phone,
            c.email || '',
            c.points,
            (c.totalSpent || 0).toFixed(2)
        ]);

        downloadCSV('Клиенти', headers, rows);
    }
};
