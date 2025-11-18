/**
 * AuditService - Audit log and action history
 */
import { StorageService } from './StorageService.js';

export class AuditService {
    constructor(authService) {
        this.authService = authService;
        this.logs = [];
        this.loadLogs();
    }

    loadLogs() {
        this.logs = StorageService.get('posAuditLogs', []);
    }

    saveLogs() {
        // Keep only last 1000 logs to prevent storage overflow
        if (this.logs.length > 1000) {
            this.logs = this.logs.slice(-1000);
        }
        StorageService.set('posAuditLogs', this.logs);
    }

    /**
     * Log an action
     */
    log(action, entity, entityId, details = {}) {
        const user = this.authService.getCurrentUser();

        const logEntry = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            userId: user ? user.id : null,
            userName: user ? user.name : 'System',
            action: action, // 'create', 'update', 'delete', 'sale', 'refund', etc.
            entity: entity, // 'product', 'customer', 'sale', etc.
            entityId: entityId,
            details: details
        };

        this.logs.push(logEntry);
        this.saveLogs();

        return logEntry;
    }

    /**
     * Get all logs
     */
    getAllLogs() {
        return [...this.logs].reverse(); // Newest first
    }

    /**
     * Get logs by user
     */
    getLogsByUser(userId) {
        return this.logs.filter(log => log.userId === userId).reverse();
    }

    /**
     * Get logs by entity
     */
    getLogsByEntity(entity, entityId = null) {
        let filtered = this.logs.filter(log => log.entity === entity);

        if (entityId) {
            filtered = filtered.filter(log => log.entityId === entityId);
        }

        return filtered.reverse();
    }

    /**
     * Get logs by date range
     */
    getLogsByDateRange(fromDate, toDate) {
        const from = fromDate ? new Date(fromDate) : null;
        const to = toDate ? new Date(toDate + 'T23:59:59') : null;

        return this.logs.filter(log => {
            const logDate = new Date(log.timestamp);

            if (from && logDate < from) return false;
            if (to && logDate > to) return false;

            return true;
        }).reverse();
    }

    /**
     * Get logs by action type
     */
    getLogsByAction(action) {
        return this.logs.filter(log => log.action === action).reverse();
    }

    /**
     * Export logs to CSV
     */
    exportToCSV() {
        const headers = ['ID', 'Дата/Час', 'Потребител', 'Действие', 'Обект', 'ID', 'Детайли'];

        const rows = this.logs.map(log => [
            log.id,
            new Date(log.timestamp).toLocaleString('bg-BG'),
            log.userName,
            log.action,
            log.entity,
            log.entityId,
            JSON.stringify(log.details)
        ]);

        return { headers, rows };
    }

    /**
     * Clear old logs (older than X days)
     */
    clearOldLogs(days = 90) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.setDate() - days);

        const before = this.logs.length;
        this.logs = this.logs.filter(log => new Date(log.timestamp) > cutoffDate);
        const after = this.logs.length;

        this.saveLogs();

        return {
            success: true,
            deleted: before - after
        };
    }
}
