/**
 * UI Handlers for v9.0 & v9.1 Revenue Boost Features
 * Gift Cards, Upsell Engine, Bundle Optimizer, Flash Sales, Loss Leaders, Seasonal Campaigns
 */
import { showSuccess, showErrors, showError, formatCurrency, downloadCSV, formatDate } from '../utils/helpers.js';

export const UIHandlersV9 = {
    /**
     * GIFT CARDS & VOUCHERS (v9.0)
     */

    /**
     * Render active gift cards
     */
    renderGiftCards() {
        const container = document.getElementById('activeCardsTab');
        if (!container) return;

        const cards = this.services.giftCard.getAllGiftCards()
            .filter(c => c.status !== 'depleted' && c.status !== 'expired');

        if (cards.length === 0) {
            container.innerHTML = '<div class="empty-state">📭 Няма активни gift cards</div>';
            return;
        }

        container.innerHTML = `
            <div class="cards-list">
                ${cards.map(card => {
                    const statusBadge = this.getCardStatusBadge(card.status);
                    return `
                        <div class="card-item">
                            <div class="card-header">
                                <h3>🎁 ${card.recipientName || 'Gift Card'}</h3>
                                <span class="badge badge-${card.status}">${statusBadge}</span>
                            </div>
                            <div class="card-details">
                                <div><strong>Код:</strong> ${card.code}</div>
                                <div><strong>Баланс:</strong> ${formatCurrency(card.balance)} / ${formatCurrency(card.initialBalance)}</div>
                                ${card.recipientEmail ? `<div><strong>Email:</strong> ${card.recipientEmail}</div>` : ''}
                                ${card.message ? `<div class="card-message">"${card.message}"</div>` : ''}
                                <div><strong>Създадена:</strong> ${formatDate(card.createdAt)}</div>
                                ${card.expiresAt ? `<div><strong>Изтича:</strong> ${formatDate(card.expiresAt)}</div>` : ''}
                            </div>
                            <div class="card-actions">
                                <button class="btn btn-sm" onclick="ui.viewCardHistory('${card.code}')">📜 История</button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    },

    /**
     * Render vouchers
     */
    renderVouchers() {
        const container = document.getElementById('vouchersTab');
        if (!container) return;

        const vouchers = this.services.giftCard.getAllVouchers()
            .filter(v => v.status === 'active');

        if (vouchers.length === 0) {
            container.innerHTML = '<div class="empty-state">📭 Няма активни ваучери</div>';
            return;
        }

        container.innerHTML = `
            <div class="cards-list">
                ${vouchers.map(voucher => `
                    <div class="card-item voucher-item">
                        <div class="card-header">
                            <h3>🎟️ ${voucher.code}</h3>
                            <span class="badge badge-active">Активен</span>
                        </div>
                        <div class="card-details">
                            <div><strong>Тип:</strong> ${voucher.discountType === 'percentage' ?
                                `${voucher.discountValue}% отстъпка` :
                                `${formatCurrency(voucher.discountValue)} отстъпка`}</div>
                            ${voucher.minPurchase ? `<div><strong>Мин. покупка:</strong> ${formatCurrency(voucher.minPurchase)}</div>` : ''}
                            <div><strong>Използвания:</strong> ${voucher.usedCount} / ${voucher.maxUses || '∞'}</div>
                            ${voucher.validFrom ? `<div><strong>Валиден от:</strong> ${formatDate(voucher.validFrom)}</div>` : ''}
                            ${voucher.validUntil ? `<div><strong>Валиден до:</strong> ${formatDate(voucher.validUntil)}</div>` : ''}
                        </div>
                        <div class="card-actions">
                            <button class="btn btn-sm btn-danger" onclick="ui.deactivateVoucher('${voucher.code}')">Деактивирай</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    },

    /**
     * Render gift card reports
     */
    renderGiftCardReports() {
        const container = document.getElementById('giftCardReportsTab');
        if (!container) return;

        const analytics = this.services.giftCard.getAnalytics();

        container.innerHTML = `
            <div class="reports-grid">
                <div class="report-card">
                    <h3>📊 Обща статистика</h3>
                    <div class="stat-row">
                        <span>Активни карти:</span>
                        <strong>${analytics.activeCards}</strong>
                    </div>
                    <div class="stat-row">
                        <span>Общ баланс:</span>
                        <strong>${formatCurrency(analytics.totalBalance)}</strong>
                    </div>
                    <div class="stat-row">
                        <span>Общо продадени:</span>
                        <strong>${formatCurrency(analytics.totalSold)}</strong>
                    </div>
                    <div class="stat-row">
                        <span>Общо използвани:</span>
                        <strong>${formatCurrency(analytics.totalRedeemed)}</strong>
                    </div>
                    <div class="stat-row">
                        <span>Коефициент на използване:</span>
                        <strong>${analytics.redemptionRate}%</strong>
                    </div>
                </div>

                <div class="report-card">
                    <h3>🎟️ Ваучери</h3>
                    <div class="stat-row">
                        <span>Активни ваучери:</span>
                        <strong>${analytics.activeVouchers}</strong>
                    </div>
                    <div class="stat-row">
                        <span>Общо използвания:</span>
                        <strong>${analytics.totalVoucherUses}</strong>
                    </div>
                    <div class="stat-row">
                        <span>Обща отстъпка:</span>
                        <strong>${formatCurrency(analytics.totalVoucherDiscount)}</strong>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Open create gift card modal
     */
    openCreateGiftCardModal() {
        document.getElementById('createGiftCardForm').reset();
        document.getElementById('createGiftCardModal').style.display = 'block';
        document.getElementById('giftCardAmount').focus();
    },

    /**
     * Handle create gift card
     */
    handleCreateGiftCard() {
        const amount = parseFloat(document.getElementById('giftCardAmount').value);
        const recipientName = document.getElementById('giftCardRecipient').value;
        const recipientEmail = document.getElementById('giftCardEmail').value;
        const message = document.getElementById('giftCardMessage').value;
        const expiresInDays = parseInt(document.getElementById('giftCardExpiry').value) || null;

        const cardData = {
            initialBalance: amount,
            recipientName: recipientName || undefined,
            recipientEmail: recipientEmail || undefined,
            message: message || undefined,
            expiresInDays: expiresInDays
        };

        const result = this.services.giftCard.createGiftCard(cardData);

        if (result.success) {
            document.getElementById('createGiftCardModal').style.display = 'none';
            showSuccess(`Gift Card създадена успешно! Код: ${result.giftCard.code}`);
            this.renderGiftCards();
        } else {
            showErrors(result.errors);
        }
    },

    /**
     * Open create voucher modal
     */
    openCreateVoucherModal() {
        document.getElementById('createVoucherForm').reset();
        document.getElementById('createVoucherModal').style.display = 'block';
        document.getElementById('voucherCode').focus();
    },

    /**
     * Handle create voucher
     */
    handleCreateVoucher() {
        const code = document.getElementById('voucherCode').value;
        const discountType = document.getElementById('voucherType').value;
        const discountValue = parseFloat(document.getElementById('voucherValue').value);
        const minPurchase = parseFloat(document.getElementById('voucherMinPurchase').value) || undefined;
        const maxUses = parseInt(document.getElementById('voucherMaxUses').value) || undefined;
        const validUntil = document.getElementById('voucherValidUntil').value || undefined;

        const voucherData = {
            code,
            discountType,
            discountValue,
            minPurchase,
            maxUses,
            validUntil
        };

        const result = this.services.giftCard.createVoucher(voucherData);

        if (result.success) {
            document.getElementById('createVoucherModal').style.display = 'none';
            showSuccess(`Ваучер ${code} създаден успешно!`);
            this.renderVouchers();
        } else {
            showErrors(result.errors);
        }
    },

    /**
     * Open check code modal
     */
    openCheckCodeModal() {
        document.getElementById('checkCodeForm').reset();
        document.getElementById('checkCodeResult').innerHTML = '';
        document.getElementById('checkCodeModal').style.display = 'block';
        document.getElementById('checkCodeInput').focus();
    },

    /**
     * Handle check code
     */
    handleCheckCode() {
        const code = document.getElementById('checkCodeInput').value.trim();
        if (!code) return;

        const result = this.services.giftCard.checkCode(code);
        const resultDiv = document.getElementById('checkCodeResult');

        if (result.valid) {
            if (result.type === 'giftCard') {
                const card = result.data;
                resultDiv.innerHTML = `
                    <div class="check-result success">
                        <h3>✅ Gift Card валидна</h3>
                        <div><strong>Баланс:</strong> ${formatCurrency(card.balance)}</div>
                        ${card.recipientName ? `<div><strong>За:</strong> ${card.recipientName}</div>` : ''}
                        ${card.expiresAt ? `<div><strong>Изтича:</strong> ${formatDate(card.expiresAt)}</div>` : ''}
                    </div>
                `;
            } else {
                const voucher = result.data;
                const discount = voucher.discountType === 'percentage' ?
                    `${voucher.discountValue}%` :
                    formatCurrency(voucher.discountValue);
                resultDiv.innerHTML = `
                    <div class="check-result success">
                        <h3>✅ Ваучер валиден</h3>
                        <div><strong>Отстъпка:</strong> ${discount}</div>
                        ${voucher.minPurchase ? `<div><strong>Минимална покупка:</strong> ${formatCurrency(voucher.minPurchase)}</div>` : ''}
                        <div><strong>Използвания:</strong> ${voucher.usedCount} / ${voucher.maxUses || '∞'}</div>
                        ${voucher.validUntil ? `<div><strong>Валиден до:</strong> ${formatDate(voucher.validUntil)}</div>` : ''}
                    </div>
                `;
            }
        } else {
            resultDiv.innerHTML = `
                <div class="check-result error">
                    <h3>❌ Невалиден код</h3>
                    <div>${result.reason}</div>
                </div>
            `;
        }
    },

    /**
     * Get card status badge text
     */
    getCardStatusBadge(status) {
        const badges = {
            'active': 'Активна',
            'depleted': 'Изчерпана',
            'expired': 'Изтекла'
        };
        return badges[status] || status;
    },

    /**
     * View card history
     */
    viewCardHistory(code) {
        const card = this.services.giftCard.getGiftCardByCode(code);
        if (!card) return;

        const modal = document.getElementById('cardHistoryModal');
        const content = document.getElementById('cardHistoryContent');

        content.innerHTML = `
            <h3>📜 История на Gift Card ${code}</h3>
            <div class="card-info-box">
                <div><strong>Начален баланс:</strong> ${formatCurrency(card.initialBalance)}</div>
                <div><strong>Текущ баланс:</strong> ${formatCurrency(card.balance)}</div>
                <div><strong>Създадена:</strong> ${formatDate(card.createdAt)}</div>
            </div>
            <h4>Транзакции:</h4>
            <div class="transactions-list">
                ${card.transactions.length > 0 ? card.transactions.map(t => `
                    <div class="transaction-item">
                        <div>${formatDate(t.date)}</div>
                        <div><strong>Продажба #${t.saleId}</strong></div>
                        <div class="amount-used">-${formatCurrency(t.amount)}</div>
                    </div>
                `).join('') : '<div class="empty-state">Няма транзакции</div>'}
            </div>
        `;

        modal.style.display = 'block';
    },

    /**
     * Deactivate voucher
     */
    deactivateVoucher(code) {
        if (!confirm(`Сигурни ли сте, че искате да деактивирате ваучер ${code}?`)) {
            return;
        }

        const result = this.services.giftCard.deactivateVoucher(code);
        if (result.success) {
            showSuccess('Ваучерът е деактивиран!');
            this.renderVouchers();
        } else {
            showErrors(result.errors);
        }
    },

    /**
     * BUNDLE OPTIMIZER (v9.0)
     */

    /**
     * Render bundles
     */
    renderBundles() {
        const container = document.getElementById('activeBundlesTab');
        if (!container) return;

        const bundles = this.services.bundleOptimizer.getAllBundles()
            .filter(b => b.active);

        if (bundles.length === 0) {
            container.innerHTML = '<div class="empty-state">📭 Няма активни bundles</div>';
            return;
        }

        container.innerHTML = `
            <div class="bundles-list">
                ${bundles.map(bundle => {
                    const products = bundle.products.map(p => p.name).join(', ');
                    const savings = bundle.originalPrice - bundle.bundlePrice;
                    const savingsPercent = ((savings / bundle.originalPrice) * 100).toFixed(0);

                    return `
                        <div class="bundle-item">
                            <div class="bundle-header">
                                <h3>📦 ${bundle.name}</h3>
                                <span class="badge badge-success">${savingsPercent}% спестяване</span>
                            </div>
                            <div class="bundle-details">
                                <div class="bundle-description">${bundle.description || ''}</div>
                                <div class="bundle-products"><strong>Продукти:</strong> ${products}</div>
                                <div class="bundle-pricing">
                                    <span class="original-price">${formatCurrency(bundle.originalPrice)}</span>
                                    <span class="bundle-price">${formatCurrency(bundle.bundlePrice)}</span>
                                    <span class="savings">Спестявате ${formatCurrency(savings)}</span>
                                </div>
                                ${bundle.validUntil ? `<div><strong>Валиден до:</strong> ${formatDate(bundle.validUntil)}</div>` : ''}
                            </div>
                            <div class="bundle-actions">
                                <button class="btn btn-sm" onclick="ui.viewBundlePerformance(${bundle.id})">📊 Статистика</button>
                                <button class="btn btn-sm btn-warning" onclick="ui.toggleBundle(${bundle.id})">Деактивирай</button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    },

    /**
     * Render AI bundle recommendations
     */
    renderBundleRecommendations() {
        const container = document.getElementById('bundleRecommendationsTab');
        if (!container) return;

        const recommendations = this.services.bundleOptimizer.discoverBundleOpportunities(5);

        if (recommendations.length === 0) {
            container.innerHTML = '<div class="empty-state">🤖 Недостатъчно данни за AI препоръки. Необходими са поне 50 продажби.</div>';
            return;
        }

        container.innerHTML = `
            <div class="recommendations-intro">
                <h3>🤖 AI откри ${recommendations.length} възможности за bundles</h3>
                <p>Базирано на анализ на ${this.services.sales.getAllSales().length} продажби</p>
            </div>
            <div class="bundles-list">
                ${recommendations.map((rec, index) => {
                    const products = rec.products.map(p => p.name).join(' + ');
                    return `
                        <div class="bundle-item recommendation">
                            <div class="bundle-header">
                                <h3>💡 Препоръка #${index + 1}</h3>
                                <span class="badge badge-info">${rec.coOccurrenceRate}% съвместни покупки</span>
                            </div>
                            <div class="bundle-details">
                                <div class="bundle-products"><strong>Продукти:</strong> ${products}</div>
                                <div class="bundle-pricing">
                                    <span>Обща цена:</span>
                                    <span class="original-price">${formatCurrency(rec.totalPrice)}</span>
                                </div>
                                <div class="recommendation-stats">
                                    <div>📈 Очаквана печалба: <strong>+${formatCurrency(rec.estimatedRevenue)}/месец</strong></div>
                                    <div>🎯 Препоръчан discount: <strong>${rec.recommendedDiscount}%</strong></div>
                                    <div>💰 Bundle цена: <strong>${formatCurrency(rec.recommendedBundlePrice)}</strong></div>
                                </div>
                            </div>
                            <div class="bundle-actions">
                                <button class="btn btn-success" onclick="ui.createBundleFromRecommendation(${index})">✨ Създай Bundle</button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;

        // Store recommendations for later use
        this.bundleRecommendations = recommendations;
    },

    /**
     * Render bundle reports
     */
    renderBundleReports() {
        const container = document.getElementById('bundleReportsTab');
        if (!container) return;

        const bundles = this.services.bundleOptimizer.getAllBundles();

        container.innerHTML = `
            <div class="reports-grid">
                ${bundles.map(bundle => {
                    const perf = this.services.bundleOptimizer.getBundlePerformance(bundle.id);
                    return `
                        <div class="report-card">
                            <h3>📦 ${bundle.name}</h3>
                            <div class="stat-row">
                                <span>Продажби:</span>
                                <strong>${perf.sales}</strong>
                            </div>
                            <div class="stat-row">
                                <span>Приходи:</span>
                                <strong>${formatCurrency(perf.revenue)}</strong>
                            </div>
                            <div class="stat-row">
                                <span>Conversion Rate:</span>
                                <strong>${perf.conversionRate}%</strong>
                            </div>
                            <div class="stat-row ${perf.incrementalRevenue > 0 ? 'positive' : 'neutral'}">
                                <span>Допълнителни приходи:</span>
                                <strong>${formatCurrency(perf.incrementalRevenue)}</strong>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    },

    /**
     * Open create bundle modal
     */
    openCreateBundleModal() {
        document.getElementById('createBundleForm').reset();

        // Populate product checkboxes
        const products = this.services.product.getAllProducts();
        const container = document.getElementById('bundleProductsSelect');
        container.innerHTML = products.map(p => `
            <div class="product-checkbox">
                <input type="checkbox" id="bundle_product_${p.id}" value="${p.id}">
                <label for="bundle_product_${p.id}">${p.name} - ${formatCurrency(p.price)}</label>
            </div>
        `).join('');

        document.getElementById('createBundleModal').style.display = 'block';
    },

    /**
     * Handle create bundle
     */
    handleCreateBundle() {
        const name = document.getElementById('bundleName').value;
        const description = document.getElementById('bundleDescription').value;
        const discountPercent = parseFloat(document.getElementById('bundleDiscount').value);
        const validUntil = document.getElementById('bundleValidUntil').value || undefined;

        // Get selected products
        const checkboxes = document.querySelectorAll('#bundleProductsSelect input[type="checkbox"]:checked');
        const productIds = Array.from(checkboxes).map(cb => parseInt(cb.value));

        if (productIds.length < 2) {
            showError('Изберете поне 2 продукта за bundle!');
            return;
        }

        const bundleData = {
            name,
            description,
            productIds,
            discountPercent,
            validUntil
        };

        const result = this.services.bundleOptimizer.createBundle(bundleData);

        if (result.success) {
            document.getElementById('createBundleModal').style.display = 'none';
            showSuccess(`Bundle "${name}" създаден успешно!`);
            this.renderBundles();
        } else {
            showErrors(result.errors);
        }
    },

    /**
     * Create bundle from AI recommendation
     */
    createBundleFromRecommendation(index) {
        if (!this.bundleRecommendations || !this.bundleRecommendations[index]) {
            showError('Препоръката не е налична');
            return;
        }

        const rec = this.bundleRecommendations[index];
        const productNames = rec.products.map(p => p.name).join(' + ');

        const bundleData = {
            name: `Bundle: ${productNames}`,
            description: `AI-препоръчан bundle с ${rec.coOccurrenceRate}% съвместни покупки`,
            productIds: rec.products.map(p => p.id),
            discountPercent: rec.recommendedDiscount
        };

        const result = this.services.bundleOptimizer.createBundle(bundleData);

        if (result.success) {
            showSuccess('Bundle създаден от AI препоръка!');
            this.renderBundles();
            this.switchTab('bundlesView', 'activeBundles');
        } else {
            showErrors(result.errors);
        }
    },

    /**
     * Toggle bundle active status
     */
    toggleBundle(bundleId) {
        const bundle = this.services.bundleOptimizer.getBundleById(bundleId);
        const result = this.services.bundleOptimizer.updateBundle(bundleId, { active: !bundle.active });

        if (result.success) {
            showSuccess(`Bundle ${bundle.active ? 'деактивиран' : 'активиран'}!`);
            this.renderBundles();
        }
    },

    /**
     * View bundle performance
     */
    viewBundlePerformance(bundleId) {
        const bundle = this.services.bundleOptimizer.getBundleById(bundleId);
        const perf = this.services.bundleOptimizer.getBundlePerformance(bundleId);

        const modal = document.getElementById('bundlePerformanceModal');
        const content = document.getElementById('bundlePerformanceContent');

        content.innerHTML = `
            <h3>📊 Статистика за Bundle: ${bundle.name}</h3>
            <div class="performance-grid">
                <div class="stat-card">
                    <div class="stat-label">Продажби</div>
                    <div class="stat-value">${perf.sales}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Приходи</div>
                    <div class="stat-value">${formatCurrency(perf.revenue)}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Conversion Rate</div>
                    <div class="stat-value">${perf.conversionRate}%</div>
                </div>
                <div class="stat-card ${perf.incrementalRevenue > 0 ? 'positive' : ''}">
                    <div class="stat-label">Допълнителни приходи</div>
                    <div class="stat-value">${formatCurrency(perf.incrementalRevenue)}</div>
                </div>
            </div>
            ${perf.recommendations.length > 0 ? `
                <h4>💡 Препоръки за подобрение:</h4>
                <ul class="recommendations-list">
                    ${perf.recommendations.map(r => `<li>${r}</li>`).join('')}
                </ul>
            ` : ''}
        `;

        modal.style.display = 'block';
    },

    /**
     * FLASH SALES & HAPPY HOURS (v9.1)
     */

    /**
     * Render active flash sales
     */
    renderFlashSales() {
        const container = document.getElementById('activeFlashSalesTab');
        if (!container) return;

        // Update active sales status first
        this.services.flashSales._updateActiveSales();

        const sales = this.services.flashSales.getActiveSales();

        if (sales.length === 0) {
            container.innerHTML = '<div class="empty-state">⚡ Няма активни flash sales</div>';
            return;
        }

        container.innerHTML = `
            <div class="flash-sales-list">
                ${sales.map(sale => {
                    const product = this.services.product.getProductById(sale.productId);
                    const timeLeft = this.getTimeLeft(sale.endTime);
                    const stockLeft = sale.maxQuantity ? sale.maxQuantity - sale.soldQuantity : null;

                    return `
                        <div class="flash-sale-item">
                            <div class="flash-sale-header">
                                <h3>⚡ ${product.name}</h3>
                                <span class="badge badge-active">LIVE</span>
                            </div>
                            <div class="flash-sale-details">
                                <div class="price-comparison">
                                    <span class="original-price">${formatCurrency(product.price)}</span>
                                    <span class="sale-price">${formatCurrency(sale.salePrice)}</span>
                                    <span class="discount-badge">-${sale.discountPercent}%</span>
                                </div>
                                ${sale.showCountdown ? `
                                    <div class="countdown">⏰ Остават: ${timeLeft}</div>
                                ` : ''}
                                ${stockLeft !== null && sale.showStockLeft ? `
                                    <div class="stock-indicator ${stockLeft < 10 ? 'low' : ''}">
                                        📦 Остават само ${stockLeft} бр!
                                    </div>
                                ` : ''}
                                <div class="sale-stats">
                                    <div>Продадени: ${sale.soldQuantity}</div>
                                    ${sale.maxPerCustomer ? `<div>Макс. на клиент: ${sale.maxPerCustomer}</div>` : ''}
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;

        // Update countdowns every second
        if (sales.length > 0) {
            setTimeout(() => this.renderFlashSales(), 1000);
        }
    },

    /**
     * Render scheduled flash sales
     */
    renderScheduledSales() {
        const container = document.getElementById('scheduledSalesTab');
        if (!container) return;

        const sales = this.services.flashSales.getScheduledSales();

        if (sales.length === 0) {
            container.innerHTML = '<div class="empty-state">📅 Няма планирани flash sales</div>';
            return;
        }

        container.innerHTML = `
            <div class="flash-sales-list">
                ${sales.map(sale => {
                    const product = this.services.product.getProductById(sale.productId);
                    const startsIn = this.getTimeLeft(sale.startTime);

                    return `
                        <div class="flash-sale-item scheduled">
                            <div class="flash-sale-header">
                                <h3>⏳ ${product.name}</h3>
                                <span class="badge badge-scheduled">Планирана</span>
                            </div>
                            <div class="flash-sale-details">
                                <div class="price-comparison">
                                    <span class="original-price">${formatCurrency(product.price)}</span>
                                    <span class="sale-price">${formatCurrency(sale.salePrice)}</span>
                                    <span class="discount-badge">-${sale.discountPercent}%</span>
                                </div>
                                <div><strong>Започва след:</strong> ${startsIn}</div>
                                <div><strong>Продължителност:</strong> ${this.formatDuration(sale.startTime, sale.endTime)}</div>
                            </div>
                            <div class="flash-sale-actions">
                                <button class="btn btn-sm btn-danger" onclick="ui.cancelFlashSale(${sale.id})">❌ Отмени</button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    },

    /**
     * Render happy hours
     */
    renderHappyHours() {
        const container = document.getElementById('happyHoursTab');
        if (!container) return;

        const happyHours = this.services.flashSales.getActiveHappyHours();

        if (happyHours.length === 0) {
            container.innerHTML = '<div class="empty-state">🎉 Няма активни Happy Hours</div>';
            return;
        }

        container.innerHTML = `
            <div class="happy-hours-list">
                ${happyHours.map(hh => {
                    const product = this.services.product.getProductById(hh.productId);
                    const daysText = this.getDaysText(hh.daysOfWeek);

                    return `
                        <div class="happy-hour-item">
                            <div class="happy-hour-header">
                                <h3>🎉 ${product.name}</h3>
                                <span class="badge badge-success">Активен</span>
                            </div>
                            <div class="happy-hour-details">
                                <div class="price-comparison">
                                    <span class="original-price">${formatCurrency(product.price)}</span>
                                    <span class="sale-price">${formatCurrency(hh.happyHourPrice)}</span>
                                </div>
                                <div><strong>Часове:</strong> ${hh.startHour}:00 - ${hh.endHour}:00</div>
                                <div><strong>Дни:</strong> ${daysText}</div>
                            </div>
                            <div class="happy-hour-actions">
                                <button class="btn btn-sm btn-danger" onclick="ui.deleteHappyHour(${hh.id})">🗑️ Изтрий</button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    },

    /**
     * Open create flash sale modal
     */
    openCreateFlashSaleModal() {
        document.getElementById('createFlashSaleForm').reset();

        // Populate product select
        const products = this.services.product.getAllProducts();
        const select = document.getElementById('flashSaleProduct');
        select.innerHTML = '<option value="">Изберете продукт...</option>' +
            products.map(p => `<option value="${p.id}">${p.name} - ${formatCurrency(p.price)}</option>`).join('');

        document.getElementById('createFlashSaleModal').style.display = 'block';
    },

    /**
     * Handle create flash sale
     */
    handleCreateFlashSale() {
        const productId = parseInt(document.getElementById('flashSaleProduct').value);
        const discountPercent = parseFloat(document.getElementById('flashSaleDiscount').value);
        const startTime = document.getElementById('flashSaleStart').value;
        const durationHours = parseInt(document.getElementById('flashSaleDuration').value);
        const maxQuantity = parseInt(document.getElementById('flashSaleMaxQty').value) || undefined;
        const maxPerCustomer = parseInt(document.getElementById('flashSaleMaxPerCustomer').value) || undefined;
        const showCountdown = document.getElementById('flashSaleShowCountdown').checked;
        const showStockLeft = document.getElementById('flashSaleShowStock').checked;

        if (!productId) {
            showError('Изберете продукт!');
            return;
        }

        const saleData = {
            productId,
            discountPercent,
            startTime,
            durationHours,
            maxQuantity,
            maxPerCustomer,
            showCountdown,
            showStockLeft
        };

        const result = this.services.flashSales.createFlashSale(saleData);

        if (result.success) {
            document.getElementById('createFlashSaleModal').style.display = 'none';
            showSuccess('Flash Sale създадена успешно!');
            this.renderScheduledSales();
        } else {
            showErrors(result.errors);
        }
    },

    /**
     * Open create happy hour modal
     */
    openCreateHappyHourModal() {
        document.getElementById('createHappyHourForm').reset();

        // Populate product select
        const products = this.services.product.getAllProducts();
        const select = document.getElementById('happyHourProduct');
        select.innerHTML = '<option value="">Изберете продукт...</option>' +
            products.map(p => `<option value="${p.id}">${p.name} - ${formatCurrency(p.price)}</option>`).join('');

        document.getElementById('createHappyHourModal').style.display = 'block';
    },

    /**
     * Handle create happy hour
     */
    handleCreateHappyHour() {
        const productId = parseInt(document.getElementById('happyHourProduct').value);
        const discountPercent = parseFloat(document.getElementById('happyHourDiscount').value);
        const startHour = parseInt(document.getElementById('happyHourStart').value);
        const endHour = parseInt(document.getElementById('happyHourEnd').value);

        // Get selected days
        const daysCheckboxes = document.querySelectorAll('.days-selector input[type="checkbox"]:checked');
        const daysOfWeek = Array.from(daysCheckboxes).map(cb => parseInt(cb.value));

        if (!productId) {
            showError('Изберете продукт!');
            return;
        }

        if (daysOfWeek.length === 0) {
            showError('Изберете поне един ден!');
            return;
        }

        const happyHourData = {
            productId,
            discountPercent,
            startHour,
            endHour,
            daysOfWeek
        };

        const result = this.services.flashSales.createHappyHour(happyHourData);

        if (result.success) {
            document.getElementById('createHappyHourModal').style.display = 'none';
            showSuccess('Happy Hour създаден успешно!');
            this.renderHappyHours();
        } else {
            showErrors(result.errors);
        }
    },

    /**
     * Cancel flash sale
     */
    cancelFlashSale(saleId) {
        if (!confirm('Сигурни ли сте, че искате да отмените тази flash sale?')) {
            return;
        }

        const result = this.services.flashSales.cancelSale(saleId);
        if (result.success) {
            showSuccess('Flash Sale отменена!');
            this.renderScheduledSales();
        }
    },

    /**
     * Delete happy hour
     */
    deleteHappyHour(happyHourId) {
        if (!confirm('Сигурни ли сте, че искате да изтриете този Happy Hour?')) {
            return;
        }

        const result = this.services.flashSales.deleteHappyHour(happyHourId);
        if (result.success) {
            showSuccess('Happy Hour изтрит!');
            this.renderHappyHours();
        }
    },

    /**
     * SEASONAL CAMPAIGNS (v9.1)
     */

    /**
     * Render active campaigns
     */
    renderActiveCampaigns() {
        const container = document.getElementById('activeCampaignsTab');
        if (!container) return;

        const campaigns = this.services.seasonalCampaign.getActiveCampaigns();

        if (campaigns.length === 0) {
            container.innerHTML = '<div class="empty-state">🎄 Няма активни кампании</div>';
            return;
        }

        container.innerHTML = `
            <div class="campaigns-list">
                ${campaigns.map(campaign => {
                    const template = this.services.seasonalCampaign.templates.find(t => t.id === campaign.templateId);
                    const icon = template ? template.icon : '🎉';

                    return `
                        <div class="campaign-item">
                            <div class="campaign-header">
                                <h3>${icon} ${campaign.name}</h3>
                                <span class="badge badge-active">Активна</span>
                            </div>
                            <div class="campaign-details">
                                <div><strong>Период:</strong> ${formatDate(campaign.startDate)} - ${formatDate(campaign.endDate)}</div>
                                ${campaign.description ? `<div class="campaign-description">${campaign.description}</div>` : ''}
                                <div class="campaign-stats">
                                    ${campaign.performance ? `
                                        <div>💰 Приходи: ${formatCurrency(campaign.performance.revenue)}</div>
                                        <div>📦 Продажби: ${campaign.performance.sales}</div>
                                        <div>🛒 Средна кошница: ${formatCurrency(campaign.performance.avgBasket)}</div>
                                    ` : ''}
                                </div>
                            </div>
                            <div class="campaign-actions">
                                <button class="btn btn-sm" onclick="ui.viewCampaignDetails(${campaign.id})">📊 Детайли</button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    },

    /**
     * Render campaign templates
     */
    renderCampaignTemplates() {
        const container = document.getElementById('campaignTemplatesTab');
        if (!container) return;

        const templates = this.services.seasonalCampaign.templates;

        container.innerHTML = `
            <div class="templates-intro">
                <h3>🎨 ${templates.length} готови шаблона за български празници</h3>
                <p>Създайте кампания с 1 клик!</p>
            </div>
            <div class="campaigns-list">
                ${templates.map(template => `
                    <div class="campaign-item template">
                        <div class="campaign-header">
                            <h3>${template.icon} ${template.name}</h3>
                            <span class="badge badge-info">${template.month}/${template.day}</span>
                        </div>
                        <div class="campaign-details">
                            <div><strong>Продължителност:</strong> ${template.durationDays} дни</div>
                            <div><strong>Препоръчан discount:</strong> ${template.recommendedDiscount}%</div>
                            ${template.bundleIdeas ? `
                                <div><strong>Bundle идеи:</strong> ${template.bundleIdeas.join(', ')}</div>
                            ` : ''}
                        </div>
                        <div class="campaign-actions">
                            <button class="btn btn-success btn-sm" onclick="ui.createCampaignFromTemplate('${template.id}')">
                                ✨ Създай за ${new Date().getFullYear()}
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
            <div class="bulk-actions">
                <button class="btn btn-primary" onclick="ui.createAllYearlyCampaigns()">
                    🎯 Създай ВСИЧКИ за ${new Date().getFullYear()}
                </button>
            </div>
        `;
    },

    /**
     * Render campaign reports
     */
    renderCampaignReports() {
        const container = document.getElementById('campaignReportsTab');
        if (!container) return;

        const campaigns = this.services.seasonalCampaign.getAllCampaigns();
        const currentYear = new Date().getFullYear();

        container.innerHTML = `
            <div class="reports-grid">
                ${campaigns.map(campaign => {
                    const perf = campaign.performance || { revenue: 0, sales: 0, avgBasket: 0 };

                    return `
                        <div class="report-card">
                            <h3>${campaign.name}</h3>
                            <div class="stat-row">
                                <span>Приходи:</span>
                                <strong>${formatCurrency(perf.revenue)}</strong>
                            </div>
                            <div class="stat-row">
                                <span>Продажби:</span>
                                <strong>${perf.sales}</strong>
                            </div>
                            <div class="stat-row">
                                <span>Средна кошница:</span>
                                <strong>${formatCurrency(perf.avgBasket)}</strong>
                            </div>
                            ${campaign.yearOverYear ? `
                                <div class="stat-row ${campaign.yearOverYear.growth > 0 ? 'positive' : 'negative'}">
                                    <span>Ръст спрямо миналата година:</span>
                                    <strong>${campaign.yearOverYear.growth > 0 ? '+' : ''}${campaign.yearOverYear.growth}%</strong>
                                </div>
                            ` : ''}
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    },

    /**
     * Create campaign from template
     */
    createCampaignFromTemplate(templateId) {
        const year = new Date().getFullYear();
        const result = this.services.seasonalCampaign.createFromTemplate(templateId, year);

        if (result.success) {
            showSuccess(`Кампания "${result.campaign.name}" създадена успешно!`);
            this.renderActiveCampaigns();
            this.switchTab('campaignsView', 'activeCampaigns');
        } else {
            showErrors(result.errors);
        }
    },

    /**
     * Create all yearly campaigns
     */
    createAllYearlyCampaigns() {
        const year = new Date().getFullYear();

        if (!confirm(`Искате ли да създадете ВСИЧКИ 10 кампании за ${year} година?`)) {
            return;
        }

        const result = this.services.seasonalCampaign.autoCreateYearlyCampaigns(year);

        if (result.success) {
            showSuccess(`${result.campaigns.length} кампании създадени успешно за ${year}!`);
            this.renderActiveCampaigns();
            this.switchTab('campaignsView', 'activeCampaigns');
        } else {
            showErrors(result.errors);
        }
    },

    /**
     * View campaign details
     */
    viewCampaignDetails(campaignId) {
        const campaign = this.services.seasonalCampaign.getCampaignById(campaignId);
        if (!campaign) return;

        const modal = document.getElementById('campaignDetailsModal');
        const content = document.getElementById('campaignDetailsContent');

        const perf = campaign.performance || { revenue: 0, sales: 0, avgBasket: 0, customersReached: 0 };

        content.innerHTML = `
            <h3>${campaign.name}</h3>
            <div class="campaign-info-box">
                <div><strong>Период:</strong> ${formatDate(campaign.startDate)} - ${formatDate(campaign.endDate)}</div>
                ${campaign.description ? `<div><strong>Описание:</strong> ${campaign.description}</div>` : ''}
            </div>
            <h4>📊 Статистика</h4>
            <div class="performance-grid">
                <div class="stat-card">
                    <div class="stat-label">Приходи</div>
                    <div class="stat-value">${formatCurrency(perf.revenue)}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Продажби</div>
                    <div class="stat-value">${perf.sales}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Средна кошница</div>
                    <div class="stat-value">${formatCurrency(perf.avgBasket)}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Клиенти</div>
                    <div class="stat-value">${perf.customersReached}</div>
                </div>
            </div>
        `;

        modal.style.display = 'block';
    },

    /**
     * HELPER FUNCTIONS
     */

    /**
     * Get time left until date
     */
    getTimeLeft(endTime) {
        const now = new Date();
        const end = new Date(endTime);
        const diff = end - now;

        if (diff <= 0) return 'Изтекла';

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        if (hours > 24) {
            const days = Math.floor(hours / 24);
            return `${days} дни`;
        }

        return `${hours}ч ${minutes}м ${seconds}с`;
    },

    /**
     * Format duration between two dates
     */
    formatDuration(start, end) {
        const diff = new Date(end) - new Date(start);
        const hours = Math.floor(diff / (1000 * 60 * 60));

        if (hours >= 24) {
            const days = Math.floor(hours / 24);
            return `${days} дни`;
        }

        return `${hours} часа`;
    },

    /**
     * Get days of week text
     */
    getDaysText(daysArray) {
        const dayNames = ['Нед', 'Пон', 'Вто', 'Сря', 'Чет', 'Пет', 'Съб'];
        return daysArray.map(d => dayNames[d]).join(', ');
    },

    /**
     * Switch tab
     */
    switchTab(viewId, tabName) {
        // Remove active class from all tabs in this view
        const view = document.getElementById(viewId);
        if (!view) return;

        const tabs = view.querySelectorAll('.tab-btn');
        tabs.forEach(tab => tab.classList.remove('active'));

        // Add active to clicked tab
        const activeTab = view.querySelector(`[data-tab="${tabName}"]`);
        if (activeTab) {
            activeTab.classList.add('active');
        }

        // Hide all tab contents in this view
        const tabContents = view.querySelectorAll('.tab-content');
        tabContents.forEach(content => content.style.display = 'none');

        // Show active tab content
        const activeContent = document.getElementById(`${tabName}Tab`);
        if (activeContent) {
            activeContent.style.display = 'block';
        }
    }
};
