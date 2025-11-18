/**
 * Report Automation & Scheduler - v6.0
 * Automated report generation and scheduling
 */
import { ValidationService } from './ValidationService.js';
import { StorageService } from './StorageService.js';

export class ReportSchedulerService {
    constructor(financialReportingService, productPerformanceService, comparativeAnalysisService) {
        this.financialReportingService = financialReportingService;
        this.productPerformanceService = productPerformanceService;
        this.comparativeAnalysisService = comparativeAnalysisService;

        this.scheduledReports = StorageService.get('scheduledReports', []);
        this.reportHistory = StorageService.get('reportHistory', []);
        this.reportTemplates = this._getDefaultTemplates();
    }

    /**
     * Create a scheduled report
     * @param {Object} scheduleData - Schedule configuration
     * @returns {Object} Result
     */
    createSchedule(scheduleData) {
        const validation = this._validateSchedule(scheduleData);
        if (!validation.valid) {
            return {
                success: false,
                errors: validation.errors
            };
        }

        const schedule = {
            id: Date.now() + Math.random(),
            name: ValidationService.sanitizeString(scheduleData.name),
            reportType: scheduleData.reportType,
            frequency: scheduleData.frequency, // 'daily', 'weekly', 'monthly', 'quarterly'
            dayOfWeek: scheduleData.dayOfWeek || null, // For weekly reports (0-6)
            dayOfMonth: scheduleData.dayOfMonth || 1, // For monthly reports (1-31)
            time: scheduleData.time || '08:00', // HH:MM format
            enabled: scheduleData.enabled !== false,

            // Report parameters
            parameters: {
                period: scheduleData.period || 'month',
                format: scheduleData.format || 'json', // 'json', 'csv', 'pdf'
                includeCharts: scheduleData.includeCharts !== false,
                ...scheduleData.parameters
            },

            // Delivery options
            delivery: {
                method: scheduleData.deliveryMethod || 'download', // 'download', 'email', 'storage'
                email: scheduleData.email || null,
                recipients: scheduleData.recipients || []
            },

            // Metadata
            createdAt: new Date().toISOString(),
            lastRun: null,
            nextRun: this._calculateNextRun(scheduleData.frequency, scheduleData.dayOfWeek, scheduleData.dayOfMonth, scheduleData.time),
            runCount: 0
        };

        this.scheduledReports.push(schedule);
        this._saveSchedules();

        return {
            success: true,
            schedule: schedule
        };
    }

    /**
     * Update a scheduled report
     * @param {number} scheduleId - Schedule ID
     * @param {Object} updates - Updates to apply
     * @returns {Object} Result
     */
    updateSchedule(scheduleId, updates) {
        const index = this.scheduledReports.findIndex(s => s.id === scheduleId);

        if (index === -1) {
            return {
                success: false,
                errors: ['Графикът не е намерен']
            };
        }

        const schedule = this.scheduledReports[index];

        // Update fields
        if (updates.name) schedule.name = ValidationService.sanitizeString(updates.name);
        if (updates.frequency) schedule.frequency = updates.frequency;
        if (updates.dayOfWeek !== undefined) schedule.dayOfWeek = updates.dayOfWeek;
        if (updates.dayOfMonth !== undefined) schedule.dayOfMonth = updates.dayOfMonth;
        if (updates.time) schedule.time = updates.time;
        if (updates.enabled !== undefined) schedule.enabled = updates.enabled;
        if (updates.parameters) schedule.parameters = { ...schedule.parameters, ...updates.parameters };
        if (updates.delivery) schedule.delivery = { ...schedule.delivery, ...updates.delivery };

        // Recalculate next run
        schedule.nextRun = this._calculateNextRun(schedule.frequency, schedule.dayOfWeek, schedule.dayOfMonth, schedule.time);

        this._saveSchedules();

        return {
            success: true,
            schedule: schedule
        };
    }

    /**
     * Delete a scheduled report
     * @param {number} scheduleId - Schedule ID
     * @returns {Object} Result
     */
    deleteSchedule(scheduleId) {
        const index = this.scheduledReports.findIndex(s => s.id === scheduleId);

        if (index === -1) {
            return {
                success: false,
                errors: ['Графикът не е намерен']
            };
        }

        this.scheduledReports.splice(index, 1);
        this._saveSchedules();

        return {
            success: true,
            message: 'Графикът е изтрит успешно'
        };
    }

    /**
     * Get all scheduled reports
     * @returns {Object} Scheduled reports
     */
    getAllSchedules() {
        return {
            success: true,
            schedules: this.scheduledReports.map(s => ({
                ...s,
                status: this._getScheduleStatus(s)
            }))
        };
    }

    /**
     * Get schedule by ID
     * @param {number} scheduleId - Schedule ID
     * @returns {Object} Schedule
     */
    getSchedule(scheduleId) {
        const schedule = this.scheduledReports.find(s => s.id === scheduleId);

        if (!schedule) {
            return {
                success: false,
                errors: ['Графикът не е намерен']
            };
        }

        return {
            success: true,
            schedule: {
                ...schedule,
                status: this._getScheduleStatus(schedule)
            }
        };
    }

    /**
     * Run a scheduled report manually
     * @param {number} scheduleId - Schedule ID
     * @returns {Object} Generated report
     */
    runScheduleNow(scheduleId) {
        const schedule = this.scheduledReports.find(s => s.id === scheduleId);

        if (!schedule) {
            return {
                success: false,
                errors: ['Графикът не е намерен']
            };
        }

        return this._executeReport(schedule, true);
    }

    /**
     * Process all due reports (called by scheduler)
     * @returns {Object} Processing results
     */
    processDueReports() {
        const now = new Date();
        const dueReports = this.scheduledReports.filter(s =>
            s.enabled && s.nextRun && new Date(s.nextRun) <= now
        );

        const results = {
            processed: 0,
            succeeded: 0,
            failed: 0,
            reports: []
        };

        dueReports.forEach(schedule => {
            const result = this._executeReport(schedule);
            results.processed++;

            if (result.success) {
                results.succeeded++;
            } else {
                results.failed++;
            }

            results.reports.push({
                scheduleId: schedule.id,
                scheduleName: schedule.name,
                success: result.success,
                error: result.error
            });
        });

        return {
            success: true,
            processing: results
        };
    }

    /**
     * Get report history
     * @param {number} limit - Number of reports to return
     * @param {number} scheduleId - Optional: filter by schedule ID
     * @returns {Object} Report history
     */
    getReportHistory(limit = 50, scheduleId = null) {
        let history = this.reportHistory;

        if (scheduleId) {
            history = history.filter(r => r.scheduleId === scheduleId);
        }

        history = history
            .sort((a, b) => new Date(b.generatedAt) - new Date(a.generatedAt))
            .slice(0, limit);

        return {
            success: true,
            history: {
                reports: history,
                totalReports: this.reportHistory.length,
                successRate: this._calculateSuccessRate()
            }
        };
    }

    /**
     * Get available report templates
     * @returns {Object} Report templates
     */
    getTemplates() {
        return {
            success: true,
            templates: this.reportTemplates
        };
    }

    /**
     * Create custom report template
     * @param {Object} templateData - Template configuration
     * @returns {Object} Result
     */
    createTemplate(templateData) {
        const template = {
            id: 'custom_' + Date.now(),
            name: ValidationService.sanitizeString(templateData.name),
            description: ValidationService.sanitizeString(templateData.description || ''),
            reportType: 'custom',
            sections: templateData.sections || [],
            parameters: templateData.parameters || {},
            createdAt: new Date().toISOString(),
            custom: true
        };

        this.reportTemplates.push(template);
        StorageService.set('customReportTemplates', this.reportTemplates.filter(t => t.custom));

        return {
            success: true,
            template: template
        };
    }

    /**
     * Generate report from template
     * @param {string} templateId - Template ID
     * @param {Object} parameters - Report parameters
     * @returns {Object} Generated report
     */
    generateFromTemplate(templateId, parameters = {}) {
        const template = this.reportTemplates.find(t => t.id === templateId);

        if (!template) {
            return {
                success: false,
                errors: ['Шаблонът не е намерен']
            };
        }

        const reportData = {
            reportType: template.reportType,
            ...template.parameters,
            ...parameters
        };

        return this._generateReport(reportData, template.name);
    }

    /**
     * Export report to various formats
     * @param {Object} reportData - Report data
     * @param {string} format - Export format ('json', 'csv', 'html')
     * @returns {Object} Exported report
     */
    exportReport(reportData, format = 'json') {
        if (format === 'json') {
            return {
                success: true,
                format: 'json',
                data: JSON.stringify(reportData, null, 2),
                filename: `report_${Date.now()}.json`
            };
        }

        if (format === 'csv') {
            const csv = this._convertToCSV(reportData);
            return {
                success: true,
                format: 'csv',
                data: csv,
                filename: `report_${Date.now()}.csv`
            };
        }

        if (format === 'html') {
            const html = this._convertToHTML(reportData);
            return {
                success: true,
                format: 'html',
                data: html,
                filename: `report_${Date.now()}.html`
            };
        }

        return {
            success: false,
            errors: ['Неподдържан формат']
        };
    }

    // ============ PRIVATE METHODS ============

    _validateSchedule(data) {
        const errors = [];

        if (!data.name || data.name.trim() === '') {
            errors.push('Името е задължително');
        }

        if (!data.reportType) {
            errors.push('Типът доклад е задължителен');
        }

        if (!['daily', 'weekly', 'monthly', 'quarterly'].includes(data.frequency)) {
            errors.push('Невалидна честота');
        }

        if (data.frequency === 'weekly' && (data.dayOfWeek < 0 || data.dayOfWeek > 6)) {
            errors.push('Невалиден ден от седмицата');
        }

        if (data.frequency === 'monthly' && (data.dayOfMonth < 1 || data.dayOfMonth > 31)) {
            errors.push('Невалиден ден от месеца');
        }

        return {
            valid: errors.length === 0,
            errors: errors
        };
    }

    _calculateNextRun(frequency, dayOfWeek, dayOfMonth, time) {
        const now = new Date();
        const [hours, minutes] = (time || '08:00').split(':').map(Number);

        let nextRun = new Date();
        nextRun.setHours(hours, minutes, 0, 0);

        if (frequency === 'daily') {
            // If time has passed today, schedule for tomorrow
            if (nextRun <= now) {
                nextRun.setDate(nextRun.getDate() + 1);
            }
        } else if (frequency === 'weekly') {
            // Schedule for next occurrence of specified day
            const targetDay = dayOfWeek || 1; // Default to Monday
            const currentDay = now.getDay();
            let daysUntilTarget = targetDay - currentDay;

            if (daysUntilTarget < 0 || (daysUntilTarget === 0 && nextRun <= now)) {
                daysUntilTarget += 7;
            }

            nextRun.setDate(nextRun.getDate() + daysUntilTarget);
        } else if (frequency === 'monthly') {
            // Schedule for specified day of month
            const targetDay = dayOfMonth || 1;
            nextRun.setDate(targetDay);

            // If date has passed this month, schedule for next month
            if (nextRun <= now) {
                nextRun.setMonth(nextRun.getMonth() + 1);
            }
        } else if (frequency === 'quarterly') {
            // Schedule for first day of next quarter
            const currentMonth = now.getMonth();
            const nextQuarterMonth = Math.ceil((currentMonth + 1) / 3) * 3;

            if (nextQuarterMonth >= 12) {
                nextRun.setFullYear(nextRun.getFullYear() + 1);
                nextRun.setMonth(0);
            } else {
                nextRun.setMonth(nextQuarterMonth);
            }
            nextRun.setDate(1);
        }

        return nextRun.toISOString();
    }

    _getScheduleStatus(schedule) {
        if (!schedule.enabled) return 'disabled';

        const now = new Date();
        const nextRun = new Date(schedule.nextRun);

        if (nextRun <= now) return 'due';
        if (schedule.lastRun === null) return 'pending';
        return 'active';
    }

    _executeReport(schedule, manual = false) {
        try {
            const reportData = {
                reportType: schedule.reportType,
                ...schedule.parameters
            };

            const report = this._generateReport(reportData, schedule.name);

            if (!report.success) {
                return report;
            }

            // Create history entry
            const historyEntry = {
                id: Date.now() + Math.random(),
                scheduleId: schedule.id,
                scheduleName: schedule.name,
                reportType: schedule.reportType,
                generatedAt: new Date().toISOString(),
                manual: manual,
                success: true,
                format: schedule.parameters.format,
                reportData: report.report
            };

            this.reportHistory.push(historyEntry);
            this._saveHistory();

            // Update schedule
            if (!manual) {
                schedule.lastRun = new Date().toISOString();
                schedule.runCount++;
                schedule.nextRun = this._calculateNextRun(
                    schedule.frequency,
                    schedule.dayOfWeek,
                    schedule.dayOfMonth,
                    schedule.time
                );
                this._saveSchedules();
            }

            // Handle delivery
            if (schedule.delivery.method === 'download') {
                // Export to specified format
                const exported = this.exportReport(report.report, schedule.parameters.format);
                historyEntry.exportedData = exported.data;
            }

            return {
                success: true,
                report: report.report,
                historyId: historyEntry.id
            };

        } catch (error) {
            // Create error history entry
            const errorEntry = {
                id: Date.now() + Math.random(),
                scheduleId: schedule.id,
                scheduleName: schedule.name,
                reportType: schedule.reportType,
                generatedAt: new Date().toISOString(),
                manual: manual,
                success: false,
                error: error.message
            };

            this.reportHistory.push(errorEntry);
            this._saveHistory();

            return {
                success: false,
                error: error.message
            };
        }
    }

    _generateReport(reportData, reportName) {
        const reportType = reportData.reportType;

        try {
            let report;

            if (reportType === 'profit_loss') {
                report = this.financialReportingService.generateProfitLoss(reportData.period || 'month', reportData);
            } else if (reportType === 'balance_sheet') {
                report = this.financialReportingService.generateBalanceSheet(new Date());
            } else if (reportType === 'cash_flow') {
                report = this.financialReportingService.generateCashFlow(reportData.period || 'month');
            } else if (reportType === 'comparative_analysis') {
                report = this.comparativeAnalysisService.comparePeriods(reportData.period || 'month');
            } else if (reportType === 'executive_dashboard') {
                report = this.comparativeAnalysisService.getExecutiveDashboard(reportData.period || 'month');
            } else if (reportType === 'abc_analysis') {
                report = this.productPerformanceService.performABCAnalysis(reportData.period || 'month', reportData.metric || 'revenue');
            } else if (reportType === 'product_scorecard') {
                if (!reportData.productId) {
                    return {
                        success: false,
                        errors: ['ProductId е задължителен за Product Scorecard']
                    };
                }
                report = this.productPerformanceService.getProductScorecard(reportData.productId, reportData.period || 'month');
            } else {
                return {
                    success: false,
                    errors: ['Неподдържан тип доклад']
                };
            }

            if (!report.success) {
                return report;
            }

            // Wrap report with metadata
            const wrappedReport = {
                metadata: {
                    reportName: reportName,
                    reportType: reportType,
                    generatedAt: new Date().toISOString(),
                    period: reportData.period
                },
                data: report
            };

            return {
                success: true,
                report: wrappedReport
            };

        } catch (error) {
            return {
                success: false,
                errors: [error.message]
            };
        }
    }

    _getDefaultTemplates() {
        const defaultTemplates = [
            {
                id: 'monthly_financial',
                name: 'Месечен финансов доклад',
                description: 'Пълен финансов преглед за месеца',
                reportType: 'profit_loss',
                parameters: { period: 'month' },
                custom: false
            },
            {
                id: 'weekly_sales',
                name: 'Седмичен доклад продажби',
                description: 'Преглед на продажбите за седмицата',
                reportType: 'comparative_analysis',
                parameters: { period: 'week' },
                custom: false
            },
            {
                id: 'quarterly_executive',
                name: 'Тримесечен управленски доклад',
                description: 'Управленско табло за тримесечието',
                reportType: 'executive_dashboard',
                parameters: { period: 'quarter' },
                custom: false
            },
            {
                id: 'monthly_abc',
                name: 'Месечен ABC анализ',
                description: 'Класификация на продуктите по приходи',
                reportType: 'abc_analysis',
                parameters: { period: 'month', metric: 'revenue' },
                custom: false
            }
        ];

        // Load custom templates
        const customTemplates = StorageService.get('customReportTemplates', []);

        return [...defaultTemplates, ...customTemplates];
    }

    _calculateSuccessRate() {
        if (this.reportHistory.length === 0) return 100;

        const successful = this.reportHistory.filter(r => r.success).length;
        return Math.round((successful / this.reportHistory.length) * 10000) / 100;
    }

    _convertToCSV(reportData) {
        // Simple CSV conversion
        const lines = [];
        lines.push('# Report: ' + (reportData.metadata?.reportName || 'Report'));
        lines.push('# Generated: ' + (reportData.metadata?.generatedAt || new Date().toISOString()));
        lines.push('');

        // Flatten data
        const flatData = this._flattenObject(reportData.data);

        lines.push('Metric,Value');
        Object.keys(flatData).forEach(key => {
            const value = flatData[key];
            if (typeof value === 'number' || typeof value === 'string') {
                lines.push(`"${key}","${value}"`);
            }
        });

        return lines.join('\n');
    }

    _convertToHTML(reportData) {
        const html = `
<!DOCTYPE html>
<html lang="bg">
<head>
    <meta charset="UTF-8">
    <title>${reportData.metadata?.reportName || 'Report'}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { color: #2c3e50; }
        table { border-collapse: collapse; width: 100%; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        th { background-color: #3498db; color: white; }
        tr:nth-child(even) { background-color: #f2f2f2; }
        .metadata { color: #7f8c8d; margin-bottom: 20px; }
    </style>
</head>
<body>
    <h1>${reportData.metadata?.reportName || 'Report'}</h1>
    <div class="metadata">
        <p>Generated: ${reportData.metadata?.generatedAt || new Date().toISOString()}</p>
        <p>Period: ${reportData.metadata?.period || 'N/A'}</p>
    </div>
    <pre>${JSON.stringify(reportData.data, null, 2)}</pre>
</body>
</html>
        `;

        return html.trim();
    }

    _flattenObject(obj, prefix = '') {
        const flattened = {};

        Object.keys(obj).forEach(key => {
            const value = obj[key];
            const newKey = prefix ? `${prefix}.${key}` : key;

            if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
                Object.assign(flattened, this._flattenObject(value, newKey));
            } else {
                flattened[newKey] = value;
            }
        });

        return flattened;
    }

    _saveSchedules() {
        StorageService.set('scheduledReports', this.scheduledReports);
    }

    _saveHistory() {
        // Keep only last 100 reports in history
        if (this.reportHistory.length > 100) {
            this.reportHistory = this.reportHistory.slice(-100);
        }
        StorageService.set('reportHistory', this.reportHistory);
    }
}
