/**
 * PromotionService - Promotions and discounts management
 */
import { StorageService } from './StorageService.js';
import { ValidationService } from './ValidationService.js';

export class PromotionService {
    constructor(productService) {
        this.productService = productService;
        this.promotions = [];
        this.loadPromotions();
    }

    /**
     * Load promotions from storage
     */
    loadPromotions() {
        this.promotions = StorageService.get('posPromotions', []);
    }

    /**
     * Save promotions to storage
     */
    savePromotions() {
        StorageService.set('posPromotions', this.promotions);
    }

    /**
     * Get all promotions
     */
    getAllPromotions() {
        return this.promotions;
    }

    /**
     * Get active promotions
     */
    getActivePromotions() {
        const now = new Date();

        return this.promotions.filter(promo => {
            if (!promo.active) return false;

            if (promo.startDate && new Date(promo.startDate) > now) return false;
            if (promo.endDate && new Date(promo.endDate) < now) return false;

            return true;
        });
    }

    /**
     * Get promotion by ID
     */
    getPromotionById(id) {
        return this.promotions.find(p => p.id === id);
    }

    /**
     * Create promotion
     */
    createPromotion(promotionData) {
        const errors = [];

        // Validate name
        if (!promotionData.name || !promotionData.name.trim()) {
            errors.push('Името е задължително');
        }

        // Validate type
        if (!['percentage', 'fixed', 'buyXgetY', 'combo'].includes(promotionData.type)) {
            errors.push('Невалиден тип промоция');
        }

        // Validate discount for percentage/fixed types
        if (promotionData.type === 'percentage') {
            if (promotionData.value <= 0 || promotionData.value > 100) {
                errors.push('Процентът трябва да е между 0 и 100');
            }
        } else if (promotionData.type === 'fixed') {
            if (promotionData.value <= 0) {
                errors.push('Отстъпката трябва да е положителна');
            }
        }

        // Validate dates
        if (promotionData.startDate && promotionData.endDate) {
            const start = new Date(promotionData.startDate);
            const end = new Date(promotionData.endDate);

            if (start > end) {
                errors.push('Началната дата не може да е след крайната');
            }
        }

        if (errors.length > 0) {
            return {
                success: false,
                errors: errors
            };
        }

        const promotion = {
            id: Date.now(),
            name: ValidationService.sanitizeString(promotionData.name),
            description: ValidationService.sanitizeString(promotionData.description || ''),
            type: promotionData.type,
            value: promotionData.value || 0,
            productIds: promotionData.productIds || [],
            categoryFilter: promotionData.categoryFilter || null,
            startDate: promotionData.startDate || null,
            endDate: promotionData.endDate || null,
            active: true,
            createdAt: new Date().toISOString(),
            // For buyXgetY promotions
            buyQuantity: promotionData.buyQuantity || null,
            getQuantity: promotionData.getQuantity || null,
            // For combo promotions
            comboItems: promotionData.comboItems || []
        };

        this.promotions.push(promotion);
        this.savePromotions();

        return {
            success: true,
            promotion: promotion
        };
    }

    /**
     * Update promotion
     */
    updatePromotion(promotionId, updates) {
        const promotion = this.getPromotionById(promotionId);

        if (!promotion) {
            return {
                success: false,
                errors: ['Промоцията не е намерена']
            };
        }

        // Update fields
        if (updates.name) {
            promotion.name = ValidationService.sanitizeString(updates.name);
        }

        if (updates.description !== undefined) {
            promotion.description = ValidationService.sanitizeString(updates.description);
        }

        if (updates.value !== undefined) {
            promotion.value = updates.value;
        }

        if (updates.productIds !== undefined) {
            promotion.productIds = updates.productIds;
        }

        if (updates.active !== undefined) {
            promotion.active = updates.active;
        }

        if (updates.startDate !== undefined) {
            promotion.startDate = updates.startDate;
        }

        if (updates.endDate !== undefined) {
            promotion.endDate = updates.endDate;
        }

        this.savePromotions();

        return {
            success: true,
            promotion: promotion
        };
    }

    /**
     * Delete promotion
     */
    deletePromotion(promotionId) {
        const index = this.promotions.findIndex(p => p.id === promotionId);

        if (index === -1) {
            return {
                success: false,
                errors: ['Промоцията не е намерена']
            };
        }

        this.promotions.splice(index, 1);
        this.savePromotions();

        return {
            success: true
        };
    }

    /**
     * Calculate discount for product
     */
    calculateProductDiscount(productId, price) {
        const activePromotions = this.getActivePromotions();
        let maxDiscount = 0;
        let appliedPromotion = null;

        for (const promo of activePromotions) {
            // Skip if promotion doesn't apply to this product
            if (promo.productIds.length > 0 && !promo.productIds.includes(productId)) {
                continue;
            }

            // Check category filter
            if (promo.categoryFilter) {
                const product = this.productService.getProductById(productId);
                if (product && product.category !== promo.categoryFilter) {
                    continue;
                }
            }

            let discount = 0;

            if (promo.type === 'percentage') {
                discount = price * (promo.value / 100);
            } else if (promo.type === 'fixed') {
                discount = Math.min(promo.value, price); // Don't exceed price
            }

            if (discount > maxDiscount) {
                maxDiscount = discount;
                appliedPromotion = promo;
            }
        }

        return {
            discount: maxDiscount,
            promotion: appliedPromotion
        };
    }

    /**
     * Apply promotions to cart
     */
    applyPromotionsToCart(cart) {
        const cartWithPromotions = cart.map(item => {
            const { discount, promotion } = this.calculateProductDiscount(item.id, item.price);

            return {
                ...item,
                originalPrice: item.price,
                discount: discount,
                finalPrice: item.price - discount,
                promotion: promotion ? {
                    id: promotion.id,
                    name: promotion.name
                } : null
            };
        });

        const totalDiscount = cartWithPromotions.reduce((sum, item) =>
            sum + (item.discount * item.quantity), 0
        );

        return {
            cart: cartWithPromotions,
            totalDiscount: totalDiscount
        };
    }

    /**
     * Check for buy X get Y promotions
     */
    checkBuyXGetY(cart) {
        const activePromotions = this.getActivePromotions().filter(p => p.type === 'buyXgetY');
        const freeItems = [];

        for (const promo of activePromotions) {
            for (const item of cart) {
                if (promo.productIds.includes(item.id)) {
                    const sets = Math.floor(item.quantity / promo.buyQuantity);
                    if (sets > 0) {
                        const freeQuantity = sets * promo.getQuantity;
                        freeItems.push({
                            productId: item.id,
                            name: item.name,
                            freeQuantity: freeQuantity,
                            promotion: promo.name
                        });
                    }
                }
            }
        }

        return freeItems;
    }

    /**
     * Get promotion statistics
     */
    getPromotionStats() {
        const total = this.promotions.length;
        const active = this.getActivePromotions().length;
        const inactive = total - active;

        const byType = {
            percentage: this.promotions.filter(p => p.type === 'percentage').length,
            fixed: this.promotions.filter(p => p.type === 'fixed').length,
            buyXgetY: this.promotions.filter(p => p.type === 'buyXgetY').length,
            combo: this.promotions.filter(p => p.type === 'combo').length
        };

        return {
            total,
            active,
            inactive,
            byType
        };
    }
}
