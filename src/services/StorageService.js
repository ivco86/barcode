/**
 * StorageService - Centralized localStorage management
 * Handles all data persistence with error handling and versioning
 */
export class StorageService {
    static KEYS = {
        PRODUCTS: 'posProducts',
        SALES: 'posSales',
        CUSTOMERS: 'posCustomers',
        USERS: 'posUsers',
        CATEGORIES: 'posCategories',
        CURRENT_USER: 'posCurrentUser',
        VERSION: 'posVersion'
    };

    static CURRENT_VERSION = '2.0';

    /**
     * Initialize storage (check version, migrate if needed)
     */
    static init() {
        const storedVersion = this.get(this.KEYS.VERSION);

        if (!storedVersion) {
            // First time initialization
            this.set(this.KEYS.VERSION, this.CURRENT_VERSION);
        } else if (storedVersion !== this.CURRENT_VERSION) {
            // Migration logic here if needed
            console.warn(`Version mismatch: ${storedVersion} -> ${this.CURRENT_VERSION}`);
            this.set(this.KEYS.VERSION, this.CURRENT_VERSION);
        }
    }

    /**
     * Get item from localStorage with error handling
     */
    static get(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            if (item === null) return defaultValue;

            return JSON.parse(item);
        } catch (error) {
            console.error(`Error reading from localStorage [${key}]:`, error);
            return defaultValue;
        }
    }

    /**
     * Set item in localStorage with error handling
     */
    static set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error(`Error writing to localStorage [${key}]:`, error);

            // Check if quota exceeded
            if (error.name === 'QuotaExceededError') {
                console.error('LocalStorage quota exceeded!');
                alert('Паметта е пълна! Моля, изчистете стари данни.');
            }

            return false;
        }
    }

    /**
     * Remove item from localStorage
     */
    static remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error(`Error removing from localStorage [${key}]:`, error);
            return false;
        }
    }

    /**
     * Clear all POS data (keep version)
     */
    static clearAll() {
        try {
            Object.values(this.KEYS).forEach(key => {
                if (key !== this.KEYS.VERSION) {
                    localStorage.removeItem(key);
                }
            });
            return true;
        } catch (error) {
            console.error('Error clearing localStorage:', error);
            return false;
        }
    }

    /**
     * Get storage usage info
     */
    static getStorageInfo() {
        let totalSize = 0;
        const details = {};

        Object.entries(this.KEYS).forEach(([name, key]) => {
            try {
                const item = localStorage.getItem(key);
                const size = item ? item.length : 0;
                details[name] = {
                    key,
                    size,
                    sizeKB: (size / 1024).toFixed(2)
                };
                totalSize += size;
            } catch (error) {
                details[name] = { error: error.message };
            }
        });

        return {
            totalSize,
            totalSizeKB: (totalSize / 1024).toFixed(2),
            totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
            details
        };
    }

    /**
     * Export all data as JSON
     */
    static exportAllData() {
        const data = {};

        Object.entries(this.KEYS).forEach(([name, key]) => {
            data[name] = this.get(key);
        });

        return data;
    }

    /**
     * Import data from JSON
     */
    static importAllData(data) {
        try {
            Object.entries(data).forEach(([name, value]) => {
                const key = this.KEYS[name];
                if (key) {
                    this.set(key, value);
                }
            });
            return true;
        } catch (error) {
            console.error('Error importing data:', error);
            return false;
        }
    }

    // Convenience methods for specific data types

    static getProducts() {
        return this.get(this.KEYS.PRODUCTS, []);
    }

    static setProducts(products) {
        return this.set(this.KEYS.PRODUCTS, products);
    }

    static getSales() {
        return this.get(this.KEYS.SALES, []);
    }

    static setSales(sales) {
        return this.set(this.KEYS.SALES, sales);
    }

    static getCustomers() {
        return this.get(this.KEYS.CUSTOMERS, []);
    }

    static setCustomers(customers) {
        return this.set(this.KEYS.CUSTOMERS, customers);
    }

    static getUsers() {
        const defaultUsers = [{
            id: 1,
            username: 'admin',
            password: 'admin',
            name: 'Администратор',
            role: 'admin'
        }];

        return this.get(this.KEYS.USERS, defaultUsers);
    }

    static setUsers(users) {
        return this.set(this.KEYS.USERS, users);
    }

    static getCategories() {
        return this.get(this.KEYS.CATEGORIES, []);
    }

    static setCategories(categories) {
        return this.set(this.KEYS.CATEGORIES, categories);
    }

    static getCurrentUser() {
        return this.get(this.KEYS.CURRENT_USER);
    }

    static setCurrentUser(user) {
        return this.set(this.KEYS.CURRENT_USER, user);
    }

    static clearCurrentUser() {
        return this.remove(this.KEYS.CURRENT_USER);
    }
}
