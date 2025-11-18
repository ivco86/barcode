/**
 * CustomerService - Customer and loyalty management
 */
import { StorageService } from './StorageService.js';
import { ValidationService } from './ValidationService.js';

export class CustomerService {
    constructor() {
        this.customers = [];
        this.loadCustomers();
    }

    /**
     * Load customers from storage
     */
    loadCustomers() {
        this.customers = StorageService.getCustomers();
    }

    /**
     * Save customers to storage
     */
    saveCustomers() {
        StorageService.setCustomers(this.customers);
    }

    /**
     * Get all customers
     */
    getAllCustomers() {
        return this.customers;
    }

    /**
     * Get customer by ID
     */
    getCustomerById(id) {
        return this.customers.find(c => c.id === id);
    }

    /**
     * Search customers
     */
    searchCustomers(query) {
        if (!query || typeof query !== 'string') {
            return this.customers;
        }

        const searchTerm = query.toLowerCase().trim();

        return this.customers.filter(c =>
            c.name.toLowerCase().includes(searchTerm) ||
            c.phone.includes(searchTerm) ||
            (c.email && c.email.toLowerCase().includes(searchTerm))
        );
    }

    /**
     * Add new customer
     */
    addCustomer(customerData) {
        // Validate customer data
        const validation = ValidationService.validateCustomer(customerData);
        if (!validation.isValid) {
            return {
                success: false,
                errors: validation.errors
            };
        }

        // Sanitize inputs
        const cleanName = ValidationService.sanitizeString(customerData.name);
        const cleanPhone = ValidationService.sanitizeString(customerData.phone);
        const cleanEmail = customerData.email ?
            ValidationService.sanitizeString(customerData.email) : '';

        // Check for duplicate phone
        if (this.customers.some(c => c.phone === cleanPhone)) {
            return {
                success: false,
                errors: ['Клиент с този телефонен номер вече съществува!']
            };
        }

        // Create new customer
        const newCustomer = {
            id: Date.now(),
            name: cleanName,
            phone: cleanPhone,
            email: cleanEmail,
            points: 0,
            totalSpent: 0,
            createdAt: new Date().toISOString()
        };

        this.customers.push(newCustomer);
        this.saveCustomers();

        return {
            success: true,
            customer: newCustomer
        };
    }

    /**
     * Update customer
     */
    updateCustomer(customerId, updates) {
        const customer = this.getCustomerById(customerId);

        if (!customer) {
            return {
                success: false,
                errors: ['Клиентът не е намерен']
            };
        }

        // Create updated data
        const updatedData = {
            name: updates.name !== undefined ? updates.name : customer.name,
            phone: updates.phone !== undefined ? updates.phone : customer.phone,
            email: updates.email !== undefined ? updates.email : customer.email
        };

        // Validate
        const validation = ValidationService.validateCustomer(updatedData);
        if (!validation.isValid) {
            return {
                success: false,
                errors: validation.errors
            };
        }

        // Check for phone conflicts
        const cleanPhone = ValidationService.sanitizeString(updatedData.phone);
        const phoneConflict = this.customers.find(c =>
            c.phone === cleanPhone && c.id !== customerId
        );

        if (phoneConflict) {
            return {
                success: false,
                errors: ['Друг клиент вече използва този телефонен номер!']
            };
        }

        // Update customer
        customer.name = ValidationService.sanitizeString(updatedData.name);
        customer.phone = cleanPhone;
        customer.email = updatedData.email ?
            ValidationService.sanitizeString(updatedData.email) : '';

        this.saveCustomers();

        return {
            success: true,
            customer: customer
        };
    }

    /**
     * Delete customer
     */
    deleteCustomer(customerId) {
        const index = this.customers.findIndex(c => c.id === customerId);

        if (index === -1) {
            return {
                success: false,
                errors: ['Клиентът не е намерен']
            };
        }

        this.customers.splice(index, 1);
        this.saveCustomers();

        return {
            success: true
        };
    }

    /**
     * Add loyalty points to customer
     */
    addPoints(customerId, points) {
        const customer = this.getCustomerById(customerId);

        if (!customer) {
            return {
                success: false,
                errors: ['Клиентът не е намерен']
            };
        }

        if (typeof points !== 'number' || points < 0) {
            return {
                success: false,
                errors: ['Невалидно количество точки']
            };
        }

        customer.points += points;
        this.saveCustomers();

        return {
            success: true,
            newPoints: customer.points
        };
    }

    /**
     * Add to customer's total spent
     */
    addSpent(customerId, amount) {
        const customer = this.getCustomerById(customerId);

        if (!customer) {
            return {
                success: false,
                errors: ['Клиентът не е намерен']
            };
        }

        if (typeof amount !== 'number' || amount < 0) {
            return {
                success: false,
                errors: ['Невалидна сума']
            };
        }

        customer.totalSpent = (customer.totalSpent || 0) + amount;
        this.saveCustomers();

        return {
            success: true,
            totalSpent: customer.totalSpent
        };
    }

    /**
     * Update customer after purchase
     */
    updateAfterPurchase(customerId, purchaseAmount) {
        const customer = this.getCustomerById(customerId);

        if (!customer) {
            return {
                success: false,
                errors: ['Клиентът не е намерен']
            };
        }

        // Add points (1 point per lev)
        const pointsEarned = Math.floor(purchaseAmount);
        customer.points += pointsEarned;

        // Add to total spent
        customer.totalSpent = (customer.totalSpent || 0) + purchaseAmount;

        this.saveCustomers();

        return {
            success: true,
            customer: customer,
            pointsEarned: pointsEarned
        };
    }

    /**
     * Check if customer qualifies for loyalty discount
     */
    hasLoyaltyDiscount(customerId) {
        const customer = this.getCustomerById(customerId);
        return customer && customer.points >= 100;
    }

    /**
     * Calculate loyalty discount
     */
    calculateDiscount(customerId, subtotal) {
        if (!this.hasLoyaltyDiscount(customerId)) {
            return 0;
        }

        // 5% discount for 100+ points
        return subtotal * 0.05;
    }

    /**
     * Get customer statistics
     */
    getCustomerStats(customerId) {
        const customer = this.getCustomerById(customerId);

        if (!customer) {
            return null;
        }

        return {
            id: customer.id,
            name: customer.name,
            phone: customer.phone,
            email: customer.email,
            points: customer.points,
            totalSpent: customer.totalSpent || 0,
            hasDiscount: customer.points >= 100,
            memberSince: customer.createdAt
        };
    }

    /**
     * Get top customers by spending
     */
    getTopCustomers(limit = 10) {
        return [...this.customers]
            .sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0))
            .slice(0, limit);
    }

    /**
     * Get customers for select dropdown
     */
    getCustomersForSelect() {
        return this.customers.map(c => ({
            id: c.id,
            label: `${c.name} (${c.points} т.)`,
            points: c.points
        }));
    }
}
