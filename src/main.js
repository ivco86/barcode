/**
 * Main Application Entry Point - v5.0
 * ES6 Modular POS System with Enterprise AI Features
 */

// Import Core Services
import { StorageService } from './services/StorageService.js';
import { AuthService } from './services/AuthService.js';
import { ProductService } from './services/ProductService.js';
import { CartService } from './services/CartService.js';
import { CustomerService } from './services/CustomerService.js';
import { SalesService } from './services/SalesService.js';

// Import Advanced Services (v3.0)
import { RefundService } from './services/RefundService.js';
import { ShiftService } from './services/ShiftService.js';
import { PromotionService } from './services/PromotionService.js';
import { UnitService } from './services/UnitService.js';
import { SupplierService } from './services/SupplierService.js';
import { AuditService } from './services/AuditService.js';

// Import Innovative Services (v4.0)
import { ForecastService } from './services/ForecastService.js';
import { ImageRecognitionService } from './services/ImageRecognitionService.js';
import { ChatbotService } from './services/ChatbotService.js';
import { GamificationService } from './services/GamificationService.js';
import { MobileAppService } from './services/MobileAppService.js';
import { VoiceService } from './services/VoiceService.js';
import { MultiStoreService } from './services/MultiStoreService.js';
import { DynamicPricingService } from './services/DynamicPricingService.js';
import { AnalyticsService } from './services/AnalyticsService.js';
import { BlockchainService } from './services/BlockchainService.js';

// Import Enterprise Services (v5.0)
import { AIInventoryService } from './services/AIInventoryService.js';
import { EmployeePerformanceService } from './services/EmployeePerformanceService.js';
import { AutoReorderingService } from './services/AutoReorderingService.js';
import { MarketingAutomationService } from './services/MarketingAutomationService.js';

// Import UI
import { UIManager } from './ui/UIManager.js';

/**
 * POS Application Class
 */
class POSApplication {
    constructor() {
        // Initialize storage
        StorageService.init();

        // Initialize core services
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

        // Advanced services (v3.0)
        this.services.refund = new RefundService(
            this.services.product,
            this.services.sales,
            this.services.auth
        );

        this.services.shift = new ShiftService(
            this.services.sales,
            this.services.auth
        );

        this.services.promotion = new PromotionService(this.services.product);
        this.services.unit = new UnitService();
        this.services.supplier = new SupplierService(this.services.product);
        this.services.audit = new AuditService(this.services.auth);

        // Innovative services (v4.0)
        this.services.forecast = new ForecastService(
            this.services.sales,
            this.services.product
        );

        this.services.imageRecognition = new ImageRecognitionService(this.services.product);

        this.services.chatbot = new ChatbotService(
            this.services.product,
            this.services.sales,
            this.services.customer
        );

        this.services.gamification = new GamificationService(
            this.services.sales,
            this.services.auth
        );

        this.services.mobileApp = new MobileAppService(
            this.services.product,
            this.services.cart,
            this.services.sales
        );

        this.services.voice = new VoiceService(
            this.services.product,
            this.services.cart,
            this.services.sales
        );

        this.services.multiStore = new MultiStoreService(
            this.services.product,
            this.services.sales,
            this.services.auth
        );

        this.services.dynamicPricing = new DynamicPricingService(
            this.services.product,
            this.services.sales
        );

        this.services.analytics = new AnalyticsService(
            this.services.sales,
            this.services.customer,
            this.services.product
        );

        this.services.blockchain = new BlockchainService(this.services.sales);

        // Enterprise services (v5.0)
        this.services.aiInventory = new AIInventoryService(
            this.services.product,
            this.services.sales,
            this.services.forecast
        );

        this.services.employeePerformance = new EmployeePerformanceService(
            this.services.sales,
            this.services.auth,
            this.services.gamification
        );

        this.services.autoReordering = new AutoReorderingService(
            this.services.aiInventory,
            this.services.supplier,
            this.services.product,
            this.services.auth
        );

        this.services.marketingAutomation = new MarketingAutomationService(
            this.services.customer,
            this.services.sales,
            this.services.analytics
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
