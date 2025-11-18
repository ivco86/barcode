/**
 * Utility helper functions
 */

/**
 * Format currency for display
 */
export function formatCurrency(amount) {
    return amount.toFixed(2) + ' лв';
}

/**
 * Format date for display
 */
export function formatDate(dateString) {
    return new Date(dateString).toLocaleString('bg-BG');
}

/**
 * Format date only (no time)
 */
export function formatDateOnly(dateString) {
    return new Date(dateString).toLocaleDateString('bg-BG');
}

/**
 * Download CSV file
 */
export function downloadCSV(filename, headers, rows) {
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

/**
 * Show success message
 */
export function showSuccess(message) {
    // Simple alert for now, can be enhanced with toast notifications
    alert('✓ ' + message);
}

/**
 * Show error message
 */
export function showError(message) {
    alert('✗ ' + message);
}

/**
 * Show errors from array
 */
export function showErrors(errors) {
    if (Array.isArray(errors) && errors.length > 0) {
        alert('✗ ' + errors.join('\n'));
    }
}

/**
 * Confirm action
 */
export function confirm(message) {
    return window.confirm(message);
}

/**
 * Escape HTML to prevent XSS
 */
export function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Generate unique ID
 */
export function generateId() {
    return Date.now();
}

/**
 * Debounce function
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
