/**
 * Main Application Entry Point - Simplified
 * ES6 Modular POS System
 */

// Import Services
import { StorageService } from './services/StorageService.js';
import { AuthService } from './services/AuthService.js';
import { ProductService } from './services/ProductService.js';
import { CartService } from './services/CartService.js';
import { CustomerService } from './services/CustomerService.js';
import { SalesService } from './services/SalesService.js';

// Import UI
import { UIManager } from './ui/UIManager.js';

/**
 * POS Application Class
 */
class POSApplication {
    constructor() {
        // Initialize storage
        StorageService.init();

        // Initialize services
        this.services = {
            auth: new AuthService(),
            product: new ProductService(),
            customer: new CustomerService()
        };

        // Cart service depends on product service
        this.services.cart = new CartService(this.services.product);

        // Sales service depends on product, customer, and auth services
        this.services.sales = new SalesService(
            this.services.product,
            this.services.customer,
            this.services.auth
        );

        // Initialize UI
        this.ui = null;

        // Setup login listener
        this.setupLoginListener();

        // Check if user is already logged in
        this.checkLogin();
    }

    /**
     * Setup login form listener
     */
    setupLoginListener() {
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });
    }

    /**
     * Handle login
     */
    handleLogin() {
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;
        const errorDiv = document.getElementById('loginError');

        const result = this.services.auth.login(username, password);

        if (result.success) {
            document.getElementById('loginModal').style.display = 'none';
            errorDiv.style.display = 'none';
            this.initAfterLogin();
        } else {
            errorDiv.textContent = result.error;
            errorDiv.style.display = 'block';
        }
    }

    /**
     * Check if user is logged in
     */
    checkLogin() {
        if (this.services.auth.checkLogin()) {
            this.initAfterLogin();
        } else {
            this.showLoginModal();
        }
    }

    /**
     * Show login modal
     */
    showLoginModal() {
        const modal = document.getElementById('loginModal');
        modal.style.display = 'block';
        document.getElementById('loginUsername').focus();
    }

    /**
     * Initialize application after login
     */
    initAfterLogin() {
        // Create UI manager
        this.ui = new UIManager(this.services);

        // Expose UI to global scope for HTML onclick handlers
        window.ui = this.ui;

        // Initialize UI
        this.ui.init();
    }
}

// Initialize application when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.posApp = new POSApplication();
    });
} else {
    window.posApp = new POSApplication();
}
