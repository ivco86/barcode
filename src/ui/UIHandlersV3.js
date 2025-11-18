/**
 * UI Handlers for v3.0 Features
 * Shift Management, Refunds, Promotions, Audit Log
 */
import { showSuccess, showErrors, showError, formatCurrency, downloadCSV, formatDate } from '../utils/helpers.js';

export const UIHandlersV3 = {
    /**
     * SHIFT MANAGEMENT
     */

    /**
     * Check and display current shift status
     */
    updateShiftStatus() {
        const shiftBanner = document.getElementById('shiftStatusBanner');
        if (!shiftBanner) return;

        const shift = this.services.shift.getCurrentShift();

        if (shift) {
            const startTime = new Date(shift.startTime).toLocaleTimeString('bg-BG');
            shiftBanner.innerHTML = `
                <div class="shift-status-active">
                    ✅ Смяна отворена от ${startTime} | Начално салдо: ${formatCurrency(shift.startingCash)} | Касиер: ${shift.userName}
                    <button class="btn btn-danger btn-small" onclick="ui.openCloseShiftModal()">Затвори Смяна</button>
                </div>
            `;
            shiftBanner.style.display = 'block';
        } else {
            shiftBanner.innerHTML = `
                <div class="shift-status-closed">
                    ⚠️ Няма отворена смяна
                    <button class="btn btn-success btn-small" onclick="ui.openOpenShiftModal()">Отвори Смяна</button>
                </div>
            `;
            shiftBanner.style.display = 'block';
        }
    },

    /**
     * Open shift modal
     */
    openOpenShiftModal() {
        document.getElementById('openShiftForm').reset();
        document.getElementById('openShiftModal').style.display = 'block';
        document.getElementById('startingCash').focus();
    },

    /**
     * Handle open shift
     */
    handleOpenShift() {
        const startingCash = parseFloat(document.getElementById('startingCash').value) || 0;

        const result = this.services.shift.openShift(startingCash);

        if (result.success) {
            document.getElementById('openShiftModal').style.display = 'none';
            this.updateShiftStatus();
            this.services.audit.log('open_shift', 'shift', result.shift.id, {
                startingCash: startingCash
            });
            showSuccess('Смяната е отворена успешно!');
        } else {
            showErrors(result.errors);
        }
    },

    /**
     * Open close shift modal
     */
    openCloseShiftModal() {
        const shift = this.services.shift.getCurrentShift();
        if (!shift) {
            showError('Няма отворена смяна!');
            return;
        }

        // Calculate expected cash from current shift sales
        const shiftSales = this.services.sales.getAllSales().filter(sale => {
            const saleTime = new Date(sale.date);
            const shiftStart = new Date(shift.startTime);
            return saleTime >= shiftStart && sale.userId === shift.userId;
        });

        const cashSales = shiftSales.filter(s => s.paymentMethod === 'cash');
        const totalCashSales = cashSales.reduce((sum, s) => sum + s.total, 0);
        const expectedCash = shift.startingCash + totalCashSales;

        document.getElementById('closeShiftExpected').textContent = formatCurrency(expectedCash);
        document.getElementById('closeShiftForm').reset();
        document.getElementById('closeShiftModal').style.display = 'block';
        document.getElementById('endingCash').focus();
    },

    /**
     * Handle close shift
     */
    handleCloseShift() {
        const endingCash = parseFloat(document.getElementById('endingCash').value) || 0;
        const notes = document.getElementById('shiftNotes').value;

        const result = this.services.shift.closeShift(endingCash, notes);

        if (result.success) {
            document.getElementById('closeShiftModal').style.display = 'none';
            this.updateShiftStatus();
            this.services.audit.log('close_shift', 'shift', result.shift.id, {
                endingCash: endingCash,
                cashDifference: result.shift.statistics.cashDifference
            });
            this.showShiftReport(result.shift);
        } else {
            showErrors(result.errors);
        }
    },

    /**
     * Show shift report
     */
    showShiftReport(shift) {
        const modal = document.getElementById('shiftReportModal');
        const content = document.getElementById('shiftReportContent');

        const stats = shift.statistics;
        const diff = stats.cashDifference;
        const diffClass = diff > 0 ? 'positive' : diff < 0 ? 'negative' : 'neutral';

        content.innerHTML = `
            <div class="shift-report">
                <h3>📊 Отчет за Смяна #${shift.id}</h3>
                <div class="shift-report-info">
                    <div><strong>Касиер:</strong> ${shift.userName}</div>
                    <div><strong>Начало:</strong> ${formatDate(shift.startTime)}</div>
                    <div><strong>Край:</strong> ${formatDate(shift.endTime)}</div>
                </div>

                <h4>💰 Парични Средства</h4>
                <table class="report-table">
                    <tr>
                        <td>Начално салдо:</td>
                        <td>${formatCurrency(shift.startingCash)}</td>
                    </tr>
                    <tr>
                        <td>Продажби (кеш):</td>
                        <td>+${formatCurrency(stats.cashAmount)}</td>
                    </tr>
                    <tr>
                        <td>Очаквано крайно салдо:</td>
                        <td><strong>${formatCurrency(stats.expectedCash)}</strong></td>
                    </tr>
                    <tr>
                        <td>Действително крайно салдо:</td>
                        <td><strong>${formatCurrency(stats.actualCash)}</strong></td>
                    </tr>
                    <tr class="${diffClass}">
                        <td><strong>Разлика:</strong></td>
                        <td><strong>${formatCurrency(diff)}</strong></td>
                    </tr>
                </table>

                <h4>📊 Статистика Продажби</h4>
                <table class="report-table">
                    <tr>
                        <td>Общо продажби:</td>
                        <td>${stats.totalSales}</td>
                    </tr>
                    <tr>
                        <td>Продажби кеш:</td>
                        <td>${stats.cashSales} (${formatCurrency(stats.cashAmount)})</td>
                    </tr>
                    <tr>
                        <td>Продажби карта:</td>
                        <td>${stats.cardSales} (${formatCurrency(stats.cardAmount)})</td>
                    </tr>
                    <tr>
                        <td><strong>Обща сума:</strong></td>
                        <td><strong>${formatCurrency(stats.totalAmount)}</strong></td>
                    </tr>
                </table>

                ${shift.notes ? `<div class="shift-notes"><strong>Забележки:</strong> ${shift.notes}</div>` : ''}
            </div>
        `;

        modal.style.display = 'block';
    },

    /**
     * REFUNDS MANAGEMENT
     */

    /**
     * Open refund modal for a sale
     */
    openRefundModal(saleId) {
        const canRefund = this.services.refund.canRefund(saleId);

        if (!canRefund.canRefund) {
            showError(canRefund.reason);
            return;
        }

        const sale = this.services.sales.getSaleById(saleId);
        document.getElementById('refundSaleId').value = saleId;
        document.getElementById('refundSaleInfo').innerHTML = `
            <div><strong>Продажба #${sale.id}</strong></div>
            <div>Дата: ${formatDate(sale.date)}</div>
            <div>Клиент: ${sale.customerName}</div>
            <div>Обща сума: ${formatCurrency(sale.total)}</div>
        `;

        // Populate refund items
        const itemsHtml = canRefund.availableItems.map(item => `
            <div class="refund-item">
                <input type="checkbox" id="refund_${item.productId}"
                       data-product-id="${item.productId}"
                       data-max="${item.availableToRefund}">
                <label for="refund_${item.productId}">
                    ${item.name} (${item.quantity} бр.)
                </label>
                <input type="number" class="refund-quantity"
                       data-product-id="${item.productId}"
                       min="1" max="${item.availableToRefund}"
                       value="${item.availableToRefund}">
                <span>× ${formatCurrency(item.price)}</span>
            </div>
        `).join('');

        document.getElementById('refundItems').innerHTML = itemsHtml;
        document.getElementById('refundModal').style.display = 'block';
    },

    /**
     * Handle process refund
     */
    handleProcessRefund() {
        const saleId = parseInt(document.getElementById('refundSaleId').value);
        const refundType = document.querySelector('input[name="refundType"]:checked').value;
        const reason = document.getElementById('refundReason').value;

        let result;

        if (refundType === 'full') {
            result = this.services.refund.processFullRefund(saleId, reason);
        } else {
            // Partial refund - collect selected items
            const checkboxes = document.querySelectorAll('#refundItems input[type="checkbox"]:checked');
            const itemsToRefund = [];

            checkboxes.forEach(cb => {
                const productId = parseInt(cb.dataset.productId);
                const quantityInput = document.querySelector(`.refund-quantity[data-product-id="${productId}"]`);
                const quantity = parseInt(quantityInput.value);

                itemsToRefund.push({ productId, quantity });
            });

            if (itemsToRefund.length === 0) {
                showError('Изберете поне един артикул за връщане!');
                return;
            }

            result = this.services.refund.processPartialRefund(saleId, itemsToRefund, reason);
        }

        if (result.success) {
            document.getElementById('refundModal').style.display = 'none';
            this.services.audit.log('refund', 'sale', saleId, {
                type: refundType,
                amount: result.refund.totalRefunded
            });
            showSuccess(`Връщането е обработено успешно! Сума: ${formatCurrency(result.refund.totalRefunded)}`);
            this.renderInventory(); // Update inventory display
        } else {
            showErrors(result.errors);
        }
    },

    /**
     * PROMOTIONS MANAGEMENT
     */

    /**
     * Open add promotion modal
     */
    openAddPromotionModal() {
        document.getElementById('addPromotionForm').reset();
        document.getElementById('addPromotionModal').style.display = 'block';
    },

    /**
     * Handle add promotion
     */
    handleAddPromotion() {
        const formData = {
            name: document.getElementById('promotionName').value,
            description: document.getElementById('promotionDescription').value,
            type: document.getElementById('promotionType').value,
            value: parseFloat(document.getElementById('promotionValue').value),
            startDate: document.getElementById('promotionStartDate').value || null,
            endDate: document.getElementById('promotionEndDate').value || null
        };

        const result = this.services.promotion.createPromotion(formData);

        if (result.success) {
            document.getElementById('addPromotionModal').style.display = 'none';
            this.services.audit.log('create', 'promotion', result.promotion.id, formData);
            showSuccess('Промоцията е създадена успешно!');
            this.renderPromotions();
        } else {
            showErrors(result.errors);
        }
    },

    /**
     * Toggle promotion active status
     */
    togglePromotion(promotionId) {
        const promotion = this.services.promotion.getPromotionById(promotionId);

        const result = this.services.promotion.updatePromotion(promotionId, {
            active: !promotion.active
        });

        if (result.success) {
            this.services.audit.log('update', 'promotion', promotionId, {
                active: !promotion.active
            });
            this.renderPromotions();
        }
    },

    /**
     * Delete promotion
     */
    deletePromotion(promotionId) {
        if (!confirm('Сигурни ли сте, че искате да изтриете тази промоция?')) {
            return;
        }

        const result = this.services.promotion.deletePromotion(promotionId);

        if (result.success) {
            this.services.audit.log('delete', 'promotion', promotionId);
            showSuccess('Промоцията е изтрита!');
            this.renderPromotions();
        }
    },

    /**
     * Render promotions list
     */
    renderPromotions() {
        const list = document.getElementById('promotionsList');
        if (!list) return;

        const promotions = this.services.promotion.getAllPromotions();

        if (promotions.length === 0) {
            list.innerHTML = '<div class="no-results">Няма създадени промоции</div>';
            return;
        }

        list.innerHTML = promotions.map(promo => {
            const isActive = promo.active &&
                (!promo.startDate || new Date(promo.startDate) <= new Date()) &&
                (!promo.endDate || new Date(promo.endDate) >= new Date());

            let typeLabel = '';
            if (promo.type === 'percentage') typeLabel = `${promo.value}% отстъпка`;
            else if (promo.type === 'fixed') typeLabel = `${formatCurrency(promo.value)} отстъпка`;
            else if (promo.type === 'buyXgetY') typeLabel = `Вземи ${promo.buyQuantity} плати ${promo.getQuantity}`;

            return `
                <div class="promotion-item ${isActive ? 'active' : 'inactive'}">
                    <div class="promotion-info">
                        <h4>${promo.name}</h4>
                        <div>${promo.description}</div>
                        <div class="promotion-type">${typeLabel}</div>
                        ${promo.startDate || promo.endDate ? `
                            <div class="promotion-dates">
                                ${promo.startDate ? `От: ${new Date(promo.startDate).toLocaleDateString('bg-BG')}` : ''}
                                ${promo.endDate ? `До: ${new Date(promo.endDate).toLocaleDateString('bg-BG')}` : ''}
                            </div>
                        ` : ''}
                    </div>
                    <div class="promotion-actions">
                        <button class="btn ${promo.active ? 'btn-warning' : 'btn-success'} btn-small"
                                onclick="ui.togglePromotion(${promo.id})">
                            ${promo.active ? 'Деактивирай' : 'Активирай'}
                        </button>
                        <button class="btn btn-danger btn-small" onclick="ui.deletePromotion(${promo.id})">
                            🗑️
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    },

    /**
     * AUDIT LOG VIEWER
     */

    /**
     * Render audit log
     */
    renderAuditLog() {
        const list = document.getElementById('auditLogList');
        if (!list) return;

        const logs = this.services.audit.getAllLogs().slice(0, 100); // Last 100

        if (logs.length === 0) {
            list.innerHTML = '<div class="no-results">Няма записи</div>';
            return;
        }

        const actionLabels = {
            'create': '➕ Създаден',
            'update': '✏️ Променен',
            'delete': '🗑️ Изтрит',
            'sale': '💰 Продажба',
            'refund': '↩️ Връщане',
            'open_shift': '🔓 Отваряне смяна',
            'close_shift': '🔒 Затваряне смяна'
        };

        list.innerHTML = logs.map(log => `
            <div class="audit-log-item">
                <div class="audit-timestamp">${formatDate(log.timestamp)}</div>
                <div class="audit-user">${log.userName}</div>
                <div class="audit-action">${actionLabels[log.action] || log.action}</div>
                <div class="audit-entity">${log.entity} #${log.entityId}</div>
                <div class="audit-details">${JSON.stringify(log.details)}</div>
            </div>
        `).join('');
    },

    /**
     * Export audit log
     */
    exportAuditLog() {
        const { headers, rows } = this.services.audit.exportToCSV();
        downloadCSV('AuditLog', headers, rows);
    }
};
