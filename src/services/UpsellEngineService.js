import { StorageService } from './StorageService.js';
import { ValidationService } from './ValidationService.js';

/**
 * UpsellEngineService - AI препоръки за увеличаване на оборота
 *
 * Функционалност:
 * - Smart upsell suggestions (по-скъпи алтернативи)
 * - Cross-sell recommendations (свързани продукти)
 * - "Купи X, вземи Y" автоматични оферти
 * - Персонализирани препоръки по клиент
 * - Real-time suggestions на касата
 * - Learning от успешни upsells
 * - A/B testing на strategies
 *
 * v9.0 - Revenue Boost Suite
 */
export class UpsellEngineService {
    constructor(productService, salesService, customerService) {
        this.productService = productService;
        this.salesService = salesService;
        this.customerService = customerService;

        this.upsellRules = StorageService.load('upsellRules') || [];
        this.crossSellRules = StorageService.load('crossSellRules') || [];
        this.upsellAttempts = StorageService.load('upsellAttempts') || [];
        this.upsellSuccesses = StorageService.load('upsellSuccesses') || [];

        // Initialize default rules if empty
        if (this.upsellRules.length === 0) {
            this._initializeDefaultRules();
        }
    }

    /**
     * Инициализиране на default upsell правила
     */
    _initializeDefaultRules() {
        // Price-based upsell (premium alternatives)
        this.upsellRules.push({
            id: 1,
            name: 'Premium Alternative',
            type: 'price_based',
            trigger: 'product_added',
            condition: {
                minPrice: 5,
                maxPrice: 100
            },
            action: {
                suggestType: 'higher_price',
                priceMultiplier: 1.5,
                maxSuggestions: 3,
                sameCategory: true
            },
            message: 'Искате ли Premium варианта?',
            active: true,
            priority: 1
        });

        // Quantity-based (buy more, save more)
        this.upsellRules.push({
            id: 2,
            name: 'Buy More Save More',
            type: 'quantity_based',
            trigger: 'product_added',
            condition: {
                minQuantity: 1,
                maxQuantity: 3
            },
            action: {
                suggestQuantity: [2, 3, 5],
                discount: 10, // 10% discount for bulk
                discountType: 'percentage'
            },
            message: 'Купете {quantity} бройки и спестете {discount}%!',
            active: true,
            priority: 2
        });

        // Size upsell (bigger package)
        this.upsellRules.push({
            id: 3,
            name: 'Size Upgrade',
            type: 'size_based',
            trigger: 'product_added',
            condition: {
                hasVariants: true
            },
            action: {
                suggestLargerSize: true,
                message: 'За само {priceDiff} лв повече получавате {percentMore}% повече!'
            },
            active: true,
            priority: 3
        });

        this._save();
    }

    /**
     * Получаване на upsell suggestions за продукт
     *
     * @param {number} productId - ID на добавен продукт
     * @param {number} quantity - количество
     * @param {number} customerId - optional customer ID
     * @param {Array} currentCart - текущи продукти в кошницата
     */
    getUpsellSuggestions(productId, quantity = 1, customerId = null, currentCart = []) {
        const product = this.productService.getProduct(productId);
        if (!product) return [];

        const suggestions = [];

        // 1. Premium Alternative Suggestions
        const premiumSuggestions = this._getPremiumAlternatives(product, currentCart);
        suggestions.push(...premiumSuggestions);

        // 2. Quantity-Based Suggestions
        if (quantity < 5) {
            const quantitySuggestions = this._getQuantitySuggestions(product, quantity);
            suggestions.push(...quantitySuggestions);
        }

        // 3. Size Upgrade Suggestions
        const sizeSuggestions = this._getSizeUpgradeSuggestions(product);
        suggestions.push(...sizeSuggestions);

        // 4. Personalized Suggestions (if customer)
        if (customerId) {
            const personalizedSuggestions = this._getPersonalizedSuggestions(
                product,
                customerId,
                currentCart
            );
            suggestions.push(...personalizedSuggestions);
        }

        // 5. Cross-Sell Suggestions
        const crossSellSuggestions = this._getCrossSellSuggestions(product, currentCart);
        suggestions.push(...crossSellSuggestions);

        // Sort by priority and conversion probability
        return this._rankSuggestions(suggestions, customerId);
    }

    /**
     * Premium алтернативи (по-скъпи варианти)
     */
    _getPremiumAlternatives(product, currentCart) {
        const suggestions = [];
        const allProducts = this.productService.getAllProducts();

        // Find products in same category with higher price
        const alternatives = allProducts.filter(p =>
            p.category === product.category &&
            p.id !== product.id &&
            p.price > product.price &&
            p.price <= product.price * 2 && // Not too expensive
            p.stock > 0
        );

        alternatives.slice(0, 3).forEach(alt => {
            const priceDiff = alt.price - product.price;
            const percentMore = ((priceDiff / product.price) * 100).toFixed(0);

            suggestions.push({
                type: 'premium_alternative',
                priority: 1,
                product: alt,
                originalProduct: product,
                message: `Искате ли ${alt.name}? За само ${priceDiff.toFixed(2)} лв повече!`,
                expectedRevenue: priceDiff,
                conversionProbability: this._estimateConversionProbability('premium', product, alt)
            });
        });

        return suggestions;
    }

    /**
     * Quantity-based suggestions (купи повече)
     */
    _getQuantitySuggestions(product, currentQuantity) {
        const suggestions = [];
        const quantityOptions = [2, 3, 5, 10].filter(q => q > currentQuantity);

        quantityOptions.forEach(qty => {
            const totalPrice = product.price * qty;
            const discount = qty >= 5 ? 10 : (qty >= 3 ? 5 : 0);
            const discountedPrice = totalPrice * (1 - discount / 100);

            if (discount > 0) {
                suggestions.push({
                    type: 'quantity_upsell',
                    priority: 2,
                    product: product,
                    suggestedQuantity: qty,
                    currentQuantity: currentQuantity,
                    discount: discount,
                    totalPrice: discountedPrice,
                    savings: totalPrice - discountedPrice,
                    message: `Купете ${qty} бройки и спестете ${discount}% (${(totalPrice - discountedPrice).toFixed(2)} лв)!`,
                    expectedRevenue: discountedPrice - (product.price * currentQuantity),
                    conversionProbability: this._estimateConversionProbability('quantity', product, null, qty)
                });
            }
        });

        return suggestions;
    }

    /**
     * Size upgrade suggestions
     */
    _getSizeUpgradeSuggestions(product) {
        const suggestions = [];

        // Check if product has size/weight in name
        const sizeMatch = product.name.match(/(\d+)(ml|l|g|kg)/i);
        if (!sizeMatch) return suggestions;

        const currentSize = parseInt(sizeMatch[1]);
        const unit = sizeMatch[2].toLowerCase();

        // Find larger sizes
        const allProducts = this.productService.getAllProducts();
        const baseName = product.name.replace(/\d+(ml|l|g|kg)/i, '').trim();

        const largerSizes = allProducts.filter(p => {
            if (p.id === product.id) return false;
            if (!p.name.includes(baseName)) return false;

            const match = p.name.match(/(\d+)(ml|l|g|kg)/i);
            if (!match || match[2].toLowerCase() !== unit) return false;

            return parseInt(match[1]) > currentSize;
        });

        largerSizes.forEach(larger => {
            const largerSizeMatch = larger.name.match(/(\d+)(ml|l|g|kg)/i);
            const largerSize = parseInt(largerSizeMatch[1]);

            const priceDiff = larger.price - product.price;
            const sizeIncrease = ((largerSize - currentSize) / currentSize * 100).toFixed(0);
            const pricePerUnit = larger.price / largerSize;
            const currentPricePerUnit = product.price / currentSize;
            const betterValue = pricePerUnit < currentPricePerUnit;

            suggestions.push({
                type: 'size_upgrade',
                priority: 3,
                product: larger,
                originalProduct: product,
                priceDiff: priceDiff,
                sizeIncrease: sizeIncrease,
                betterValue: betterValue,
                message: `${larger.name} - ${sizeIncrease}% повече за само ${priceDiff.toFixed(2)} лв ${betterValue ? '(по-изгодно!)' : ''}`,
                expectedRevenue: priceDiff,
                conversionProbability: this._estimateConversionProbability('size', product, larger)
            });
        });

        return suggestions;
    }

    /**
     * Персонализирани препоръки базирани на customer история
     */
    _getPersonalizedSuggestions(product, customerId, currentCart) {
        const suggestions = [];
        const customerHistory = this.salesService.getCustomerSales(customerId);

        if (!customerHistory || customerHistory.length === 0) {
            return suggestions;
        }

        // Find what this customer usually buys with this product
        const relatedProducts = this._findCustomerPatterns(customerId, product);

        relatedProducts.forEach(related => {
            // Don't suggest if already in cart
            if (currentCart.some(item => item.id === related.productId)) {
                return;
            }

            const relatedProduct = this.productService.getProduct(related.productId);
            if (!relatedProduct || relatedProduct.stock <= 0) return;

            suggestions.push({
                type: 'personalized',
                priority: 4,
                product: relatedProduct,
                frequency: related.frequency,
                message: `Обикновено също купувате ${relatedProduct.name}`,
                expectedRevenue: relatedProduct.price,
                conversionProbability: Math.min(related.frequency / customerHistory.length, 0.8)
            });
        });

        return suggestions.slice(0, 2);
    }

    /**
     * Cross-sell suggestions (често купувани заедно)
     */
    _getCrossSellSuggestions(product, currentCart) {
        const suggestions = [];
        const allSales = this.salesService.getAllSales();

        // Find products frequently bought together
        const coOccurrences = {};

        allSales.forEach(sale => {
            const hasProduct = sale.items.some(item => item.id === product.id);
            if (!hasProduct) return;

            sale.items.forEach(item => {
                if (item.id === product.id) return;
                if (currentCart.some(cartItem => cartItem.id === item.id)) return;

                if (!coOccurrences[item.id]) {
                    coOccurrences[item.id] = 0;
                }
                coOccurrences[item.id]++;
            });
        });

        // Convert to array and sort
        const sorted = Object.entries(coOccurrences)
            .map(([productId, count]) => ({
                productId: parseInt(productId),
                count: count
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 3);

        sorted.forEach(item => {
            const crossProduct = this.productService.getProduct(item.productId);
            if (!crossProduct || crossProduct.stock <= 0) return;

            suggestions.push({
                type: 'cross_sell',
                priority: 5,
                product: crossProduct,
                frequency: item.count,
                message: `Често купувано заедно: ${crossProduct.name}`,
                expectedRevenue: crossProduct.price,
                conversionProbability: Math.min(item.count / allSales.length * 10, 0.6)
            });
        });

        return suggestions;
    }

    /**
     * Намиране на patterns в customer покупки
     */
    _findCustomerPatterns(customerId, product) {
        const sales = this.salesService.getCustomerSales(customerId);
        const patterns = {};

        sales.forEach(sale => {
            const hasProduct = sale.items.some(item => item.id === product.id);
            if (!hasProduct) return;

            sale.items.forEach(item => {
                if (item.id === product.id) return;

                if (!patterns[item.id]) {
                    patterns[item.id] = { productId: item.id, frequency: 0 };
                }
                patterns[item.id].frequency++;
            });
        });

        return Object.values(patterns)
            .sort((a, b) => b.frequency - a.frequency)
            .slice(0, 3);
    }

    /**
     * Ranking на suggestions по priority и conversion probability
     */
    _rankSuggestions(suggestions, customerId) {
        return suggestions
            .sort((a, b) => {
                // First by conversion probability
                const probDiff = b.conversionProbability - a.conversionProbability;
                if (Math.abs(probDiff) > 0.1) return probDiff;

                // Then by expected revenue
                const revDiff = b.expectedRevenue - a.expectedRevenue;
                if (Math.abs(revDiff) > 5) return revDiff;

                // Finally by priority
                return a.priority - b.priority;
            })
            .slice(0, 5); // Top 5 suggestions
    }

    /**
     * Оценка на conversion probability
     */
    _estimateConversionProbability(type, originalProduct, suggestedProduct, quantity = null) {
        // Base probabilities by type
        const baseProbabilities = {
            premium: 0.15,
            quantity: 0.25,
            size: 0.30,
            personalized: 0.40,
            cross_sell: 0.20
        };

        let probability = baseProbabilities[type] || 0.10;

        // Adjust based on price difference
        if (suggestedProduct) {
            const priceDiff = suggestedProduct.price - originalProduct.price;
            const priceRatio = priceDiff / originalProduct.price;

            if (priceRatio > 1) {
                probability *= 0.5; // Big price jump = lower conversion
            } else if (priceRatio > 0.5) {
                probability *= 0.7;
            } else if (priceRatio < 0.2) {
                probability *= 1.2; // Small price jump = higher conversion
            }
        }

        // Learn from historical data
        const historicalRate = this._getHistoricalConversionRate(type);
        if (historicalRate > 0) {
            probability = (probability + historicalRate) / 2; // Average with historical
        }

        return Math.min(probability, 0.9);
    }

    /**
     * Historical conversion rate по тип
     */
    _getHistoricalConversionRate(type) {
        const attempts = this.upsellAttempts.filter(a => a.type === type);
        const successes = this.upsellSuccesses.filter(s => s.type === type);

        if (attempts.length === 0) return 0;

        return successes.length / attempts.length;
    }

    /**
     * Tracking на upsell attempt
     */
    trackUpsellAttempt(suggestion, saleId) {
        const attempt = {
            id: Date.now() + Math.random(),
            type: suggestion.type,
            productId: suggestion.product.id,
            originalProductId: suggestion.originalProduct?.id,
            saleId: saleId,
            expectedRevenue: suggestion.expectedRevenue,
            timestamp: new Date().toISOString()
        };

        this.upsellAttempts.push(attempt);
        this._save();

        return attempt;
    }

    /**
     * Tracking на успешен upsell
     */
    trackUpsellSuccess(attemptId, actualRevenue, saleId) {
        const success = {
            id: Date.now() + Math.random(),
            attemptId: attemptId,
            saleId: saleId,
            actualRevenue: actualRevenue,
            timestamp: new Date().toISOString()
        };

        const attempt = this.upsellAttempts.find(a => a.id === attemptId);
        if (attempt) {
            success.type = attempt.type;
            success.productId = attempt.productId;
        }

        this.upsellSuccesses.push(success);
        this._save();

        return success;
    }

    /**
     * Отчет за upsell performance
     */
    getUpsellReport(period = 'month') {
        const { startDate, endDate } = this._getPeriodDates(period);

        const periodAttempts = this.upsellAttempts.filter(a => {
            const date = new Date(a.timestamp);
            return date >= startDate && date <= endDate;
        });

        const periodSuccesses = this.upsellSuccesses.filter(s => {
            const date = new Date(s.timestamp);
            return date >= startDate && date <= endDate;
        });

        const totalAttempts = periodAttempts.length;
        const totalSuccesses = periodSuccesses.length;
        const conversionRate = totalAttempts > 0 ? (totalSuccesses / totalAttempts * 100) : 0;
        const totalRevenue = periodSuccesses.reduce((sum, s) => sum + s.actualRevenue, 0);

        // Breakdown by type
        const typeBreakdown = {};
        ['premium', 'quantity', 'size', 'personalized', 'cross_sell'].forEach(type => {
            const typeAttempts = periodAttempts.filter(a => a.type === type).length;
            const typeSuccesses = periodSuccesses.filter(s => s.type === type).length;
            const typeRevenue = periodSuccesses
                .filter(s => s.type === type)
                .reduce((sum, s) => sum + s.actualRevenue, 0);

            typeBreakdown[type] = {
                attempts: typeAttempts,
                successes: typeSuccesses,
                conversionRate: typeAttempts > 0 ? (typeSuccesses / typeAttempts * 100) : 0,
                revenue: typeRevenue
            };
        });

        return {
            period,
            totalAttempts,
            totalSuccesses,
            conversionRate,
            totalRevenue,
            avgRevenuePerSuccess: totalSuccesses > 0 ? (totalRevenue / totalSuccesses) : 0,
            typeBreakdown
        };
    }

    /**
     * Helper: период за отчети
     */
    _getPeriodDates(period) {
        const endDate = new Date();
        let startDate = new Date();

        if (period === 'today') {
            startDate.setHours(0, 0, 0, 0);
        } else if (period === 'week') {
            startDate.setDate(startDate.getDate() - 7);
        } else if (period === 'month') {
            startDate.setMonth(startDate.getMonth() - 1);
        } else if (period === 'year') {
            startDate.setFullYear(startDate.getFullYear() - 1);
        } else {
            startDate = new Date(0);
        }

        return { startDate, endDate };
    }

    _save() {
        StorageService.save('upsellRules', this.upsellRules);
        StorageService.save('crossSellRules', this.crossSellRules);
        StorageService.save('upsellAttempts', this.upsellAttempts);
        StorageService.save('upsellSuccesses', this.upsellSuccesses);
    }
}
