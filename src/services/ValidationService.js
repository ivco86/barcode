/**
 * ValidationService - Handles all input validation and edge cases
 * Fixes issues with negative quantities, prices, and other edge cases
 */
export class ValidationService {
    /**
     * Validate product data
     */
    static validateProduct(data) {
        const errors = [];

        // Barcode validation
        if (!data.barcode || typeof data.barcode !== 'string') {
            errors.push('Баркодът е задължителен');
        } else if (data.barcode.trim().length === 0) {
            errors.push('Баркодът не може да бъде празен');
        } else if (data.barcode.length > 50) {
            errors.push('Баркодът е твърде дълъг (max 50 символа)');
        }

        // Name validation
        if (!data.name || typeof data.name !== 'string') {
            errors.push('Името е задължително');
        } else if (data.name.trim().length === 0) {
            errors.push('Името не може да бъде празно');
        } else if (data.name.length > 100) {
            errors.push('Името е твърде дълго (max 100 символа)');
        }

        // Price validation
        if (data.price === undefined || data.price === null) {
            errors.push('Цената е задължителна');
        } else if (typeof data.price !== 'number' || isNaN(data.price)) {
            errors.push('Цената трябва да бъде число');
        } else if (data.price < 0) {
            errors.push('Цената не може да бъде отрицателна');
        } else if (data.price === 0) {
            errors.push('Цената не може да бъде нула');
        } else if (data.price > 1000000) {
            errors.push('Цената е твърде голяма');
        } else if (!Number.isFinite(data.price)) {
            errors.push('Цената трябва да бъде валидно число');
        }

        // Stock validation
        if (data.stock === undefined || data.stock === null) {
            errors.push('Количеството е задължително');
        } else if (typeof data.stock !== 'number' || isNaN(data.stock)) {
            errors.push('Количеството трябва да бъде число');
        } else if (data.stock < 0) {
            errors.push('Количеството не може да бъде отрицателно');
        } else if (!Number.isInteger(data.stock)) {
            errors.push('Количеството трябва да бъде цяло число');
        } else if (data.stock > 1000000) {
            errors.push('Количеството е твърде голямо');
        }

        // Category validation
        if (!data.category || typeof data.category !== 'string') {
            errors.push('Категорията е задължителна');
        } else if (data.category.trim().length === 0) {
            errors.push('Категорията не може да бъде празна');
        } else if (data.category.length > 50) {
            errors.push('Категорията е твърде дълга (max 50 символа)');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Validate quantity (for cart operations)
     */
    static validateQuantity(quantity) {
        const errors = [];

        if (quantity === undefined || quantity === null) {
            errors.push('Количеството е задължително');
        } else if (typeof quantity !== 'number' || isNaN(quantity)) {
            errors.push('Количеството трябва да бъде число');
        } else if (quantity < 0) {
            errors.push('Количеството не може да бъде отрицателно');
        } else if (quantity === 0) {
            errors.push('Количеството не може да бъде нула');
        } else if (!Number.isInteger(quantity)) {
            errors.push('Количеството трябва да бъде цяло число');
        } else if (quantity > 10000) {
            errors.push('Количеството е твърде голямо (max 10000)');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Validate stock availability
     */
    static validateStockAvailability(requestedQuantity, availableStock, currentCartQuantity = 0) {
        const errors = [];

        if (availableStock === 0) {
            errors.push('Продуктът е изчерпан');
            return { isValid: false, errors };
        }

        const totalRequired = currentCartQuantity + requestedQuantity;

        if (totalRequired > availableStock) {
            errors.push(`Недостатъчна наличност! Налични: ${availableStock}, В количка: ${currentCartQuantity}`);
        }

        return {
            isValid: errors.length === 0,
            errors,
            availableToAdd: availableStock - currentCartQuantity
        };
    }

    /**
     * Validate customer data
     */
    static validateCustomer(data) {
        const errors = [];

        // Name validation
        if (!data.name || typeof data.name !== 'string') {
            errors.push('Името е задължително');
        } else if (data.name.trim().length === 0) {
            errors.push('Името не може да бъде празно');
        } else if (data.name.length > 100) {
            errors.push('Името е твърде дълго (max 100 символа)');
        }

        // Phone validation
        if (!data.phone || typeof data.phone !== 'string') {
            errors.push('Телефонът е задължителен');
        } else if (data.phone.trim().length === 0) {
            errors.push('Телефонът не може да бъде празен');
        } else if (!/^[0-9+\-\s()]+$/.test(data.phone)) {
            errors.push('Телефонът съдържа невалидни символи');
        } else if (data.phone.replace(/[^0-9]/g, '').length < 6) {
            errors.push('Телефонът е твърде къс');
        }

        // Email validation (optional)
        if (data.email && data.email.trim().length > 0) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(data.email)) {
                errors.push('Невалиден email адрес');
            } else if (data.email.length > 100) {
                errors.push('Email адресът е твърде дълъг');
            }
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Validate user credentials
     */
    static validateCredentials(username, password) {
        const errors = [];

        if (!username || typeof username !== 'string') {
            errors.push('Потребителското име е задължително');
        } else if (username.trim().length === 0) {
            errors.push('Потребителското име не може да бъде празно');
        } else if (username.length < 3) {
            errors.push('Потребителското име трябва да е поне 3 символа');
        } else if (username.length > 50) {
            errors.push('Потребителското име е твърде дълго');
        }

        if (!password || typeof password !== 'string') {
            errors.push('Паролата е задължителна');
        } else if (password.length === 0) {
            errors.push('Паролата не може да бъде празна');
        } else if (password.length < 3) {
            errors.push('Паролата трябва да е поне 3 символа');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Sanitize string input (prevent XSS)
     */
    static sanitizeString(str) {
        if (typeof str !== 'string') return '';

        return str
            .trim()
            .replace(/[<>]/g, '') // Remove < and > to prevent basic XSS
            .substring(0, 1000); // Limit length
    }

    /**
     * Validate and sanitize barcode input
     */
    static sanitizeBarcode(barcode) {
        if (typeof barcode !== 'string') return '';

        return barcode
            .trim()
            .replace(/[^a-zA-Z0-9\-_]/g, '') // Only allow alphanumeric, dash, underscore
            .substring(0, 50);
    }

    /**
     * Parse and validate numeric input
     */
    static parseNumber(value, options = {}) {
        const {
            min = -Infinity,
            max = Infinity,
            integer = false,
            allowZero = true
        } = options;

        let num = parseFloat(value);

        if (isNaN(num) || !Number.isFinite(num)) {
            return { isValid: false, value: null, error: 'Невалидно число' };
        }

        if (integer && !Number.isInteger(num)) {
            num = Math.floor(num);
        }

        if (num < min) {
            return { isValid: false, value: null, error: `Числото трябва да е >= ${min}` };
        }

        if (num > max) {
            return { isValid: false, value: null, error: `Числото трябва да е <= ${max}` };
        }

        if (!allowZero && num === 0) {
            return { isValid: false, value: null, error: 'Числото не може да е нула' };
        }

        return { isValid: true, value: num, error: null };
    }

    /**
     * Validate date range
     */
    static validateDateRange(fromDate, toDate) {
        const errors = [];

        if (fromDate && toDate) {
            const from = new Date(fromDate);
            const to = new Date(toDate);

            if (isNaN(from.getTime())) {
                errors.push('Невалидна начална дата');
            }
            if (isNaN(to.getTime())) {
                errors.push('Невалидна крайна дата');
            }

            if (from > to) {
                errors.push('Началната дата не може да е след крайната');
            }
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }
}
