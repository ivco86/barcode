/**
 * ShiftService - Work shift management
 */
import { StorageService } from './StorageService.js';
import { ValidationService } from './ValidationService.js';

export class ShiftService {
    constructor(salesService, authService) {
        this.salesService = salesService;
        this.authService = authService;
        this.shifts = [];
        this.currentShift = null;
        this.loadShifts();
        this.loadCurrentShift();
    }

    /**
     * Load shifts from storage
     */
    loadShifts() {
        this.shifts = StorageService.get('posShifts', []);
    }

    /**
     * Save shifts to storage
     */
    saveShifts() {
        StorageService.set('posShifts', this.shifts);
    }

    /**
     * Load current shift
     */
    loadCurrentShift() {
        this.currentShift = StorageService.get('posCurrentShift');
    }

    /**
     * Save current shift
     */
    saveCurrentShift() {
        StorageService.set('posCurrentShift', this.currentShift);
    }

    /**
     * Check if shift is open
     */
    isShiftOpen() {
        return this.currentShift !== null;
    }

    /**
     * Get current shift
     */
    getCurrentShift() {
        return this.currentShift;
    }

    /**
     * Open new shift
     */
    openShift(startingCash) {
        if (this.isShiftOpen()) {
            return {
                success: false,
                errors: ['Вече има отворена смяна']
            };
        }

        // Validate starting cash
        const validation = ValidationService.parseNumber(startingCash, {
            min: 0,
            allowZero: true
        });

        if (!validation.isValid) {
            return {
                success: false,
                errors: [validation.error]
            };
        }

        const currentUser = this.authService.getCurrentUser();

        this.currentShift = {
            id: Date.now(),
            userId: currentUser.id,
            userName: currentUser.name,
            startTime: new Date().toISOString(),
            startingCash: validation.value,
            status: 'open'
        };

        this.saveCurrentShift();

        return {
            success: true,
            shift: this.currentShift
        };
    }

    /**
     * Close current shift
     */
    closeShift(endingCash, notes = '') {
        if (!this.isShiftOpen()) {
            return {
                success: false,
                errors: ['Няма отворена смяна']
            };
        }

        // Validate ending cash
        const validation = ValidationService.parseNumber(endingCash, {
            min: 0,
            allowZero: true
        });

        if (!validation.isValid) {
            return {
                success: false,
                errors: [validation.error]
            };
        }

        // Calculate shift statistics
        const shiftSales = this.salesService.getAllSales().filter(sale => {
            const saleTime = new Date(sale.date);
            const shiftStart = new Date(this.currentShift.startTime);
            return saleTime >= shiftStart && sale.userId === this.currentShift.userId;
        });

        const cashSales = shiftSales.filter(s => s.paymentMethod === 'cash');
        const cardSales = shiftSales.filter(s => s.paymentMethod === 'card');

        const totalCashSales = cashSales.reduce((sum, s) => sum + s.total, 0);
        const totalCardSales = cardSales.reduce((sum, s) => sum + s.total, 0);
        const totalSales = totalCashSales + totalCardSales;

        const expectedCash = this.currentShift.startingCash + totalCashSales;
        const cashDifference = validation.value - expectedCash;

        // Close the shift
        const closedShift = {
            ...this.currentShift,
            endTime: new Date().toISOString(),
            endingCash: validation.value,
            notes: ValidationService.sanitizeString(notes),
            status: 'closed',
            statistics: {
                totalSales: shiftSales.length,
                totalAmount: totalSales,
                cashSales: cashSales.length,
                cashAmount: totalCashSales,
                cardSales: cardSales.length,
                cardAmount: totalCardSales,
                expectedCash: expectedCash,
                actualCash: validation.value,
                cashDifference: cashDifference
            }
        };

        this.shifts.push(closedShift);
        this.saveShifts();

        // Clear current shift
        this.currentShift = null;
        StorageService.remove('posCurrentShift');

        return {
            success: true,
            shift: closedShift
        };
    }

    /**
     * Get all shifts
     */
    getAllShifts() {
        return this.shifts;
    }

    /**
     * Get shift by ID
     */
    getShiftById(id) {
        return this.shifts.find(s => s.id === id);
    }

    /**
     * Get shifts by user
     */
    getShiftsByUser(userId) {
        return this.shifts.filter(s => s.userId === userId);
    }

    /**
     * Get shift statistics
     */
    getShiftStats(period = 'all') {
        let filteredShifts = this.shifts;

        // Filter by period
        if (period !== 'all') {
            const now = new Date();
            let startDate;

            switch (period) {
                case 'day':
                    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    break;
                case 'week':
                    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    break;
                case 'month':
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                    break;
            }

            if (startDate) {
                filteredShifts = this.shifts.filter(s => new Date(s.startTime) >= startDate);
            }
        }

        const totalShifts = filteredShifts.length;
        const totalSales = filteredShifts.reduce((sum, s) => sum + (s.statistics?.totalAmount || 0), 0);
        const totalCashDifferences = filteredShifts.reduce((sum, s) => sum + Math.abs(s.statistics?.cashDifference || 0), 0);
        const shiftsWithDiscrepancies = filteredShifts.filter(s =>
            Math.abs(s.statistics?.cashDifference || 0) > 0.01
        ).length;

        return {
            totalShifts,
            totalSales,
            averageSalesPerShift: totalShifts > 0 ? totalSales / totalShifts : 0,
            totalCashDiscrepancies: totalCashDifferences,
            shiftsWithDiscrepancies
        };
    }

    /**
     * Export shifts to CSV
     */
    exportToCSV() {
        const headers = [
            'ID', 'Касиер', 'Начало', 'Край', 'Начално салдо',
            'Крайно салдо', 'Очаквано', 'Разлика', 'Продажби бр.', 'Обща сума'
        ];

        const rows = this.shifts.map(s => [
            s.id,
            s.userName,
            new Date(s.startTime).toLocaleString('bg-BG'),
            s.endTime ? new Date(s.endTime).toLocaleString('bg-BG') : '-',
            s.startingCash.toFixed(2),
            (s.endingCash || 0).toFixed(2),
            (s.statistics?.expectedCash || 0).toFixed(2),
            (s.statistics?.cashDifference || 0).toFixed(2),
            s.statistics?.totalSales || 0,
            (s.statistics?.totalAmount || 0).toFixed(2)
        ]);

        return { headers, rows };
    }
}
