/**
 * UnitService - Units of measurement management
 */
import { StorageService } from './StorageService.js';

export class UnitService {
    constructor() {
        this.units = this.getDefaultUnits();
        this.loadCustomUnits();
    }

    /**
     * Get default units
     */
    getDefaultUnits() {
        return [
            { id: 'pcs', name: 'Броя (бр.)', type: 'count', requiresInput: false },
            { id: 'kg', name: 'Килограм (кг)', type: 'weight', requiresInput: true },
            { id: 'g', name: 'Грам (г)', type: 'weight', requiresInput: true },
            { id: 'l', name: 'Литър (л)', type: 'volume', requiresInput: true },
            { id: 'ml', name: 'Милилитър (мл)', type: 'volume', requiresInput: true },
            { id: 'm', name: 'Метър (м)', type: 'length', requiresInput: true },
            { id: 'pack', name: 'Пакет', type: 'package', requiresInput: false },
            { id: 'box', name: 'Кутия', type: 'package', requiresInput: false }
        ];
    }

    /**
     * Load custom units
     */
    loadCustomUnits() {
        const custom = StorageService.get('posCustomUnits', []);
        this.units = [...this.units, ...custom];
    }

    /**
     * Get all units
     */
    getAllUnits() {
        return this.units;
    }

    /**
     * Get unit by ID
     */
    getUnitById(id) {
        return this.units.find(u => u.id === id);
    }

    /**
     * Calculate price with unit
     */
    calculatePrice(basePrice, unitId, quantity) {
        const unit = this.getUnitById(unitId);

        if (!unit) {
            return basePrice * quantity;
        }

        if (unit.requiresInput) {
            // For weight/volume units: price per unit × quantity
            return basePrice * quantity;
        } else {
            // For count/package units: price × quantity
            return basePrice * quantity;
        }
    }

    /**
     * Format quantity with unit
     */
    formatQuantity(quantity, unitId) {
        const unit = this.getUnitById(unitId);

        if (!unit) {
            return `${quantity} бр.`;
        }

        if (unit.requiresInput) {
            return `${quantity.toFixed(2)} ${unit.id}`;
        } else {
            return `${quantity} ${unit.name}`;
        }
    }
}
