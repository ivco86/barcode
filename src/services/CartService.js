/**
 * CartService - Shopping cart management
 */
import { ValidationService } from './ValidationService.js';

export class CartService {
    constructor(productService) {
        this.productService = productService;
        this.cart = [];
        this.currentCustomer = null;
    }

    /**
     * Get all cart items
     */
    getCart() {
        return this.cart;
    }

    /**
     * Get cart item count
     */
    getItemCount() {
        return this.cart.reduce((sum, item) => sum + item.quantity, 0);
    }

    /**
     * Get cart total
     */
    getTotal() {
        return this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    }

    /**
     * Set current customer
     */
    setCustomer(customer) {
        this.currentCustomer = customer;
    }

    /**
     * Get current customer
     */
    getCustomer() {
        return this.currentCustomer;
    }

    /**
     * Add product to cart
     */
    addToCart(productId, quantity = 1) {
        // Validate quantity
        const quantityValidation = ValidationService.validateQuantity(quantity);
        if (!quantityValidation.isValid) {
            return {
                success: false,
                errors: quantityValidation.errors
            };
        }

        // Get product
        const product = this.productService.getProductById(productId);
        if (!product) {
            return {
                success: false,
                errors: ['Продуктът не е намерен']
            };
        }

        // Check if already in cart
        const cartItem = this.cart.find(item => item.id === productId);
        const currentCartQuantity = cartItem ? cartItem.quantity : 0;

        // Validate stock availability
        const stockValidation = ValidationService.validateStockAvailability(
            quantity,
            product.stock,
            currentCartQuantity
        );

        if (!stockValidation.isValid) {
            return {
                success: false,
                errors: stockValidation.errors
            };
        }

        // Add to cart
        if (cartItem) {
            cartItem.quantity += quantity;
        } else {
            this.cart.push({
                id: product.id,
                name: product.name,
                barcode: product.barcode,
                price: product.price,
                quantity: quantity,
                maxStock: product.stock
            });
        }

        return {
            success: true,
            item: cartItem || this.cart[this.cart.length - 1],
            total: this.getTotal()
        };
    }

    /**
     * Update cart item quantity
     */
    updateQuantity(productId, newQuantity) {
        const cartItem = this.cart.find(item => item.id === productId);

        if (!cartItem) {
            return {
                success: false,
                errors: ['Продуктът не е в количката']
            };
        }

        // If quantity is 0 or negative, remove item
        if (newQuantity <= 0) {
            return this.removeFromCart(productId);
        }

        // Validate new quantity
        const quantityValidation = ValidationService.validateQuantity(newQuantity);
        if (!quantityValidation.isValid) {
            return {
                success: false,
                errors: quantityValidation.errors
            };
        }

        // Check stock
        const product = this.productService.getProductById(productId);
        if (!product) {
            return {
                success: false,
                errors: ['Продуктът не е намерен']
            };
        }

        if (newQuantity > product.stock) {
            return {
                success: false,
                errors: [`Недостатъчна наличност! Максимум: ${product.stock}`]
            };
        }

        cartItem.quantity = newQuantity;

        return {
            success: true,
            item: cartItem,
            total: this.getTotal()
        };
    }

    /**
     * Change cart item quantity by delta
     */
    changeQuantity(productId, delta) {
        const cartItem = this.cart.find(item => item.id === productId);

        if (!cartItem) {
            return {
                success: false,
                errors: ['Продуктът не е в количката']
            };
        }

        const newQuantity = cartItem.quantity + delta;
        return this.updateQuantity(productId, newQuantity);
    }

    /**
     * Remove product from cart
     */
    removeFromCart(productId) {
        const index = this.cart.findIndex(item => item.id === productId);

        if (index === -1) {
            return {
                success: false,
                errors: ['Продуктът не е в количката']
            };
        }

        this.cart.splice(index, 1);

        return {
            success: true,
            total: this.getTotal()
        };
    }

    /**
     * Clear entire cart
     */
    clearCart() {
        this.cart = [];
        this.currentCustomer = null;

        return {
            success: true
        };
    }

    /**
     * Quick add by barcode (used for scanner)
     */
    quickAddByBarcode(barcode, quantity = 1) {
        // Sanitize barcode
        const cleanBarcode = ValidationService.sanitizeBarcode(barcode);

        if (!cleanBarcode) {
            return {
                success: false,
                errors: ['Моля, въведете баркод!']
            };
        }

        // Find product
        const product = this.productService.getProductByBarcode(cleanBarcode);

        if (!product) {
            return {
                success: false,
                errors: [`❌ Продукт с баркод "${cleanBarcode}" не е намерен!`]
            };
        }

        // Add to cart
        return this.addToCart(product.id, quantity);
    }

    /**
     * Validate cart before checkout
     */
    validateCart() {
        const errors = [];

        if (this.cart.length === 0) {
            errors.push('Количката е празна!');
            return { isValid: false, errors };
        }

        // Check each item still has stock
        for (const item of this.cart) {
            const product = this.productService.getProductById(item.id);

            if (!product) {
                errors.push(`Продуктът "${item.name}" вече не съществува`);
                continue;
            }

            if (product.stock < item.quantity) {
                errors.push(
                    `Недостатъчна наличност за "${item.name}". ` +
                    `Поискани: ${item.quantity}, Налични: ${product.stock}`
                );
            }
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Get cart summary for checkout
     */
    getCheckoutSummary() {
        const subtotal = this.getTotal();
        let discount = 0;
        let discountReason = null;

        // Apply customer loyalty discount if applicable
        if (this.currentCustomer && this.currentCustomer.points >= 100) {
            discount = subtotal * 0.05; // 5% discount
            discountReason = 'Лоялност (100+ точки)';
        }

        const total = subtotal - discount;
        const pointsToEarn = Math.floor(total); // 1 point per lev

        return {
            items: this.cart,
            itemCount: this.getItemCount(),
            subtotal,
            discount,
            discountReason,
            total,
            pointsToEarn,
            customer: this.currentCustomer
        };
    }

    /**
     * Get cart state (for saving/restoring)
     */
    getState() {
        return {
            cart: this.cart,
            customer: this.currentCustomer
        };
    }

    /**
     * Restore cart state
     */
    restoreState(state) {
        if (state.cart) {
            this.cart = state.cart;
        }
        if (state.customer) {
            this.currentCustomer = state.customer;
        }
    }
}
