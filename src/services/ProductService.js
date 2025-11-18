/**
 * ProductService - Product and inventory management
 */
import { StorageService } from './StorageService.js';
import { ValidationService } from './ValidationService.js';

export class ProductService {
    constructor() {
        this.products = [];
        this.loadProducts();
        this.loadSampleDataIfNeeded();
    }

    /**
     * Load products from storage
     */
    loadProducts() {
        this.products = StorageService.getProducts();
    }

    /**
     * Save products to storage
     */
    saveProducts() {
        StorageService.setProducts(this.products);
    }

    /**
     * Load sample data if no products exist
     */
    loadSampleDataIfNeeded() {
        if (this.products.length === 0) {
            this.products = [
                { id: 1, barcode: '1', name: 'Хляб бял', price: 1.50, stock: 50, category: 'Храни' },
                { id: 2, barcode: '2', name: 'Мляко 1л', price: 2.80, stock: 30, category: 'Напитки' },
                { id: 3, barcode: '3', name: 'Кафе 200г', price: 8.50, stock: 15, category: 'Напитки' },
                { id: 4, barcode: '4', name: 'Масло 500г', price: 4.20, stock: 25, category: 'Храни' },
                { id: 5, barcode: '5', name: 'Сирене 400г', price: 6.50, stock: 8, category: 'Млечни' },
                { id: 6, barcode: '6', name: 'Шоколад Милка', price: 3.20, stock: 0, category: 'Сладкиши' },
                { id: 7, barcode: '7', name: 'Вода минерална 1.5л', price: 1.20, stock: 100, category: 'Напитки' },
                { id: 8, barcode: '8', name: 'Ориз 1кг', price: 3.50, stock: 40, category: 'Храни' }
            ];
            this.saveProducts();
        }
    }

    /**
     * Get all products
     */
    getAllProducts() {
        return this.products;
    }

    /**
     * Get product by ID
     */
    getProductById(id) {
        return this.products.find(p => p.id === id);
    }

    /**
     * Get product by barcode
     */
    getProductByBarcode(barcode) {
        const cleanBarcode = ValidationService.sanitizeBarcode(barcode);
        return this.products.find(p => p.barcode === cleanBarcode);
    }

    /**
     * Search products
     */
    searchProducts(query) {
        if (!query || typeof query !== 'string') {
            return this.products;
        }

        const searchTerm = query.toLowerCase().trim();

        return this.products.filter(p =>
            p.barcode.toLowerCase().includes(searchTerm) ||
            p.name.toLowerCase().includes(searchTerm) ||
            p.category.toLowerCase().includes(searchTerm)
        );
    }

    /**
     * Filter products by category
     */
    filterByCategory(category) {
        if (!category || category === 'all') {
            return this.products;
        }

        return this.products.filter(p => p.category === category);
    }

    /**
     * Filter products by stock status
     */
    filterByStock(filter) {
        switch (filter) {
            case 'low':
                return this.products.filter(p => p.stock > 0 && p.stock < 10);
            case 'out':
                return this.products.filter(p => p.stock === 0);
            case 'all':
            default:
                return this.products;
        }
    }

    /**
     * Add new product
     */
    addProduct(productData) {
        // Validate product data
        const validation = ValidationService.validateProduct(productData);
        if (!validation.isValid) {
            return {
                success: false,
                errors: validation.errors
            };
        }

        // Sanitize inputs
        const cleanBarcode = ValidationService.sanitizeBarcode(productData.barcode);
        const cleanName = ValidationService.sanitizeString(productData.name);
        const cleanCategory = ValidationService.sanitizeString(productData.category);

        // Check for duplicate barcode
        if (this.products.some(p => p.barcode === cleanBarcode)) {
            return {
                success: false,
                errors: ['Продукт с този баркод вече съществува!']
            };
        }

        // Create new product
        const newProduct = {
            id: Date.now(),
            barcode: cleanBarcode,
            name: cleanName,
            price: productData.price,
            stock: productData.stock,
            category: cleanCategory
        };

        this.products.push(newProduct);
        this.saveProducts();

        return {
            success: true,
            product: newProduct
        };
    }

    /**
     * Update product
     */
    updateProduct(productId, updates) {
        const product = this.getProductById(productId);

        if (!product) {
            return {
                success: false,
                errors: ['Продуктът не е намерен']
            };
        }

        // Create updated product data
        const updatedData = {
            barcode: updates.barcode !== undefined ? updates.barcode : product.barcode,
            name: updates.name !== undefined ? updates.name : product.name,
            price: updates.price !== undefined ? updates.price : product.price,
            stock: updates.stock !== undefined ? updates.stock : product.stock,
            category: updates.category !== undefined ? updates.category : product.category
        };

        // Validate
        const validation = ValidationService.validateProduct(updatedData);
        if (!validation.isValid) {
            return {
                success: false,
                errors: validation.errors
            };
        }

        // Check for barcode conflicts
        const cleanBarcode = ValidationService.sanitizeBarcode(updatedData.barcode);
        const barcodeConflict = this.products.find(p =>
            p.barcode === cleanBarcode && p.id !== productId
        );

        if (barcodeConflict) {
            return {
                success: false,
                errors: ['Друг продукт вече използва този баркод!']
            };
        }

        // Update product
        product.barcode = cleanBarcode;
        product.name = ValidationService.sanitizeString(updatedData.name);
        product.price = updatedData.price;
        product.stock = updatedData.stock;
        product.category = ValidationService.sanitizeString(updatedData.category);

        this.saveProducts();

        return {
            success: true,
            product: product
        };
    }

    /**
     * Delete product
     */
    deleteProduct(productId) {
        const index = this.products.findIndex(p => p.id === productId);

        if (index === -1) {
            return {
                success: false,
                errors: ['Продуктът не е намерен']
            };
        }

        this.products.splice(index, 1);
        this.saveProducts();

        return {
            success: true
        };
    }

    /**
     * Update stock (used after sales)
     */
    updateStock(productId, quantityChange) {
        const product = this.getProductById(productId);

        if (!product) {
            return {
                success: false,
                errors: ['Продуктът не е намерен']
            };
        }

        const newStock = product.stock + quantityChange;

        // Validate new stock level
        if (newStock < 0) {
            return {
                success: false,
                errors: ['Недостатъчна наличност']
            };
        }

        product.stock = newStock;
        this.saveProducts();

        return {
            success: true,
            newStock: newStock
        };
    }

    /**
     * Get all categories
     */
    getCategories() {
        const categories = [...new Set(this.products.map(p => p.category))];
        return categories.sort();
    }

    /**
     * Get low stock products
     */
    getLowStockProducts() {
        return this.products.filter(p => p.stock > 0 && p.stock < 10);
    }

    /**
     * Get out of stock products
     */
    getOutOfStockProducts() {
        return this.products.filter(p => p.stock === 0);
    }

    /**
     * Get stock status for display
     */
    getStockStatus(product) {
        if (product.stock === 0) {
            return {
                label: 'Изчерпан',
                class: 'stock-out',
                severity: 'critical'
            };
        } else if (product.stock < 10) {
            return {
                label: `Нисък запас: ${product.stock}`,
                class: 'stock-low',
                severity: 'warning'
            };
        } else {
            return {
                label: `В наличност: ${product.stock}`,
                class: 'stock-ok',
                severity: 'normal'
            };
        }
    }

    /**
     * Check if product is available for purchase
     */
    isAvailable(productId, requestedQuantity = 1) {
        const product = this.getProductById(productId);

        if (!product) {
            return {
                available: false,
                reason: 'Продуктът не е намерен'
            };
        }

        if (product.stock === 0) {
            return {
                available: false,
                reason: 'Продуктът е изчерпан'
            };
        }

        if (product.stock < requestedQuantity) {
            return {
                available: false,
                reason: `Недостатъчна наличност (налични: ${product.stock})`
            };
        }

        return {
            available: true,
            product: product
        };
    }
}
