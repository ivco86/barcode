/**
 * Competitor Tracking Service - v8.0
 * Следене на конкурентни цени и промоции
 */
import { StorageService } from './StorageService.js';
import { ValidationService } from './ValidationService.js';

export class CompetitorTrackingService {
    constructor(productService) {
        this.productService = productService;

        // Конкуренти
        this.competitors = StorageService.get('competitors', []);

        // Конкурентни цени
        this.competitorPrices = StorageService.get('competitorPrices', []);

        // Конкурентни промоции
        this.competitorPromotions = StorageService.get('competitorPromotions', []);

        // Photo storage (base64)
        this.competitorPhotos = StorageService.get('competitorPhotos', []);

        // Alerts settings
        this.alertSettings = StorageService.get('competitorAlertSettings', {
            enabled: true,
            alertOnPriceDrop: true,
            alertOnPromotion: true,
            priceThreshold: 5 // Alert ако разликата е > 5%
        });
    }

    /**
     * Добави конкурент
     * @param {Object} competitorData - Данни за конкурент
     * @returns {Object} Резултат
     */
    addCompetitor(competitorData) {
        const validation = ValidationService.validateRequired(competitorData, ['name']);
        if (!validation.valid) {
            return {
                success: false,
                errors: validation.errors
            };
        }

        const competitor = {
            id: Date.now() + Math.random(),
            name: ValidationService.sanitizeString(competitorData.name),
            type: competitorData.type || 'retail', // retail, online, wholesale
            location: competitorData.location || '',
            website: competitorData.website || '',
            notes: competitorData.notes || '',
            createdAt: new Date().toISOString(),
            active: true
        };

        this.competitors.push(competitor);
        this._saveCompetitors();

        return {
            success: true,
            competitor: competitor
        };
    }

    /**
     * Добави конкурентна цена
     * @param {Object} priceData - Ценови данни
     * @returns {Object} Резултат
     */
    addCompetitorPrice(priceData) {
        const validation = ValidationService.validateRequired(priceData, ['competitorId', 'productId', 'price']);
        if (!validation.valid) {
            return {
                success: false,
                errors: validation.errors
            };
        }

        const competitor = this.competitors.find(c => c.id === priceData.competitorId);
        if (!competitor) {
            return {
                success: false,
                errors: ['Конкурентът не е намерен']
            };
        }

        const product = this.productService.getProductById(priceData.productId);
        if (!product) {
            return {
                success: false,
                errors: ['Продуктът не е намерен']
            };
        }

        const priceEntry = {
            id: Date.now() + Math.random(),
            competitorId: priceData.competitorId,
            competitorName: competitor.name,
            productId: priceData.productId,
            productName: product.name,
            price: parseFloat(priceData.price),
            ourPrice: product.price,
            priceDifference: product.price - parseFloat(priceData.price),
            priceDifferencePercent: ((product.price - parseFloat(priceData.price)) / product.price) * 100,
            source: priceData.source || 'manual', // manual, flyer, website, visit
            notes: priceData.notes || '',
            photoId: priceData.photoId || null,
            recordedAt: new Date().toISOString(),
            recordedBy: priceData.recordedBy || null
        };

        this.competitorPrices.unshift(priceEntry);
        this._saveCompetitorPrices();

        // Check if alert needed
        const alert = this._checkPriceAlert(priceEntry);

        return {
            success: true,
            priceEntry: priceEntry,
            alert: alert
        };
    }

    /**
     * Добави конкурентна промоция
     * @param {Object} promotionData - Промоция
     * @returns {Object} Резултат
     */
    addCompetitorPromotion(promotionData) {
        const validation = ValidationService.validateRequired(promotionData, ['competitorId', 'title']);
        if (!validation.valid) {
            return {
                success: false,
                errors: validation.errors
            };
        }

        const competitor = this.competitors.find(c => c.id === promotionData.competitorId);
        if (!competitor) {
            return {
                success: false,
                errors: ['Конкурентът не е намерен']
            };
        }

        const promotion = {
            id: Date.now() + Math.random(),
            competitorId: promotionData.competitorId,
            competitorName: competitor.name,
            title: ValidationService.sanitizeString(promotionData.title),
            description: promotionData.description || '',
            type: promotionData.type || 'discount', // discount, bogo, bundle, loyalty
            startDate: promotionData.startDate || new Date().toISOString(),
            endDate: promotionData.endDate || null,
            products: promotionData.products || [], // Array of product IDs
            photoIds: promotionData.photoIds || [],
            notes: promotionData.notes || '',
            recordedAt: new Date().toISOString(),
            active: true
        };

        this.competitorPromotions.unshift(promotion);
        this._saveCompetitorPromotions();

        return {
            success: true,
            promotion: promotion
        };
    }

    /**
     * Upload снимка (flyer, price tag, etc.)
     * @param {Object} photoData - Photo данни
     * @returns {Object} Резултат
     */
    uploadCompetitorPhoto(photoData) {
        const photo = {
            id: Date.now() + Math.random(),
            competitorId: photoData.competitorId || null,
            type: photoData.type || 'other', // flyer, price_tag, shelf, storefront, other
            description: photoData.description || '',
            base64Data: photoData.base64Data, // Base64 encoded image
            uploadedAt: new Date().toISOString(),
            uploadedBy: photoData.uploadedBy || null
        };

        this.competitorPhotos.push(photo);
        this._saveCompetitorPhotos();

        return {
            success: true,
            photo: {
                id: photo.id,
                type: photo.type,
                description: photo.description,
                uploadedAt: photo.uploadedAt
            }
        };
    }

    /**
     * Price comparison report
     * @param {number} productId - Product ID (optional)
     * @returns {Object} Сравнение на цени
     */
    getPriceComparison(productId = null) {
        let prices = this.competitorPrices;

        if (productId) {
            prices = prices.filter(p => p.productId === productId);
        }

        // Group by product
        const productGroups = {};

        prices.forEach(priceEntry => {
            if (!productGroups[priceEntry.productId]) {
                productGroups[priceEntry.productId] = {
                    productId: priceEntry.productId,
                    productName: priceEntry.productName,
                    ourPrice: priceEntry.ourPrice,
                    competitors: [],
                    lowestCompetitorPrice: Infinity,
                    highestCompetitorPrice: 0,
                    avgCompetitorPrice: 0
                };
            }

            const group = productGroups[priceEntry.productId];
            group.competitors.push({
                competitorName: priceEntry.competitorName,
                price: priceEntry.price,
                priceDifference: priceEntry.priceDifference,
                priceDifferencePercent: Math.round(priceEntry.priceDifferencePercent * 100) / 100,
                recordedAt: priceEntry.recordedAt
            });

            if (priceEntry.price < group.lowestCompetitorPrice) {
                group.lowestCompetitorPrice = priceEntry.price;
            }
            if (priceEntry.price > group.highestCompetitorPrice) {
                group.highestCompetitorPrice = priceEntry.price;
            }
        });

        // Calculate averages
        Object.keys(productGroups).forEach(productId => {
            const group = productGroups[productId];
            const totalPrice = group.competitors.reduce((sum, c) => sum + c.price, 0);
            group.avgCompetitorPrice = Math.round((totalPrice / group.competitors.length) * 100) / 100;

            // Market position
            if (group.ourPrice < group.lowestCompetitorPrice) {
                group.marketPosition = 'lowest';
            } else if (group.ourPrice > group.highestCompetitorPrice) {
                group.marketPosition = 'highest';
            } else {
                group.marketPosition = 'competitive';
            }

            // Sort competitors by price
            group.competitors.sort((a, b) => a.price - b.price);
        });

        return {
            success: true,
            comparison: Object.values(productGroups)
        };
    }

    /**
     * Market position analysis
     * @returns {Object} Market position
     */
    getMarketPosition() {
        const comparison = this.getPriceComparison();

        const stats = {
            totalProducts: comparison.comparison.length,
            lowest: 0,
            competitive: 0,
            highest: 0,
            avgPriceDifference: 0
        };

        let totalDifference = 0;

        comparison.comparison.forEach(product => {
            if (product.marketPosition === 'lowest') stats.lowest++;
            if (product.marketPosition === 'competitive') stats.competitive++;
            if (product.marketPosition === 'highest') stats.highest++;

            totalDifference += product.ourPrice - product.avgCompetitorPrice;
        });

        stats.avgPriceDifference = stats.totalProducts > 0
            ? Math.round((totalDifference / stats.totalProducts) * 100) / 100
            : 0;

        stats.lowestPercent = Math.round((stats.lowest / stats.totalProducts) * 10000) / 100;
        stats.competitivePercent = Math.round((stats.competitive / stats.totalProducts) * 10000) / 100;
        stats.highestPercent = Math.round((stats.highest / stats.totalProducts) * 10000) / 100;

        return {
            success: true,
            marketPosition: stats,
            message: this._getMarketPositionMessage(stats)
        };
    }

    /**
     * Get price alerts
     * @returns {Object} Active alerts
     */
    getPriceAlerts() {
        if (!this.alertSettings.enabled) {
            return {
                success: true,
                alerts: [],
                message: 'Alerts are disabled'
            };
        }

        const alerts = [];
        const comparison = this.getPriceComparison();

        comparison.comparison.forEach(product => {
            // Alert ако конкурентите са по-евтини
            if (product.ourPrice > product.lowestCompetitorPrice) {
                const difference = ((product.ourPrice - product.lowestCompetitorPrice) / product.ourPrice) * 100;

                if (difference >= this.alertSettings.priceThreshold) {
                    alerts.push({
                        type: 'price_too_high',
                        severity: difference > 15 ? 'critical' : 'warning',
                        productId: product.productId,
                        productName: product.productName,
                        ourPrice: product.ourPrice,
                        competitorPrice: product.lowestCompetitorPrice,
                        difference: Math.round(difference * 100) / 100,
                        message: `${product.productName}: Конкуренцията е по-евтина с ${Math.round(difference)}%`
                    });
                }
            }
        });

        return {
            success: true,
            alerts: alerts,
            count: alerts.length
        };
    }

    /**
     * Get active competitor promotions
     * @param {number} competitorId - Competitor ID (optional)
     * @returns {Object} Active promotions
     */
    getActivePromotions(competitorId = null) {
        let promotions = this.competitorPromotions.filter(p => p.active);

        if (competitorId) {
            promotions = promotions.filter(p => p.competitorId === competitorId);
        }

        // Filter by date
        const now = new Date();
        promotions = promotions.filter(p => {
            const start = new Date(p.startDate);
            const end = p.endDate ? new Date(p.endDate) : null;

            return start <= now && (!end || end >= now);
        });

        return {
            success: true,
            promotions: promotions,
            count: promotions.length
        };
    }

    /**
     * Price history for product
     * @param {number} productId - Product ID
     * @param {number} limit - Number of entries
     * @returns {Object} Price history
     */
    getPriceHistory(productId, limit = 20) {
        const history = this.competitorPrices
            .filter(p => p.productId === productId)
            .sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt))
            .slice(0, limit);

        return {
            success: true,
            productId: productId,
            history: history,
            count: history.length
        };
    }

    /**
     * Get all competitors
     * @returns {Object} Competitors list
     */
    getAllCompetitors() {
        return {
            success: true,
            competitors: this.competitors.filter(c => c.active),
            count: this.competitors.filter(c => c.active).length
        };
    }

    /**
     * Update competitor
     * @param {number} competitorId - Competitor ID
     * @param {Object} updates - Updates
     * @returns {Object} Result
     */
    updateCompetitor(competitorId, updates) {
        const index = this.competitors.findIndex(c => c.id === competitorId);

        if (index === -1) {
            return {
                success: false,
                errors: ['Конкурентът не е намерен']
            };
        }

        this.competitors[index] = {
            ...this.competitors[index],
            ...updates,
            updatedAt: new Date().toISOString()
        };

        this._saveCompetitors();

        return {
            success: true,
            competitor: this.competitors[index]
        };
    }

    /**
     * Delete competitor price entry
     * @param {number} priceId - Price entry ID
     * @returns {Object} Result
     */
    deleteCompetitorPrice(priceId) {
        const index = this.competitorPrices.findIndex(p => p.id === priceId);

        if (index === -1) {
            return {
                success: false,
                errors: ['Записът не е намерен']
            };
        }

        this.competitorPrices.splice(index, 1);
        this._saveCompetitorPrices();

        return {
            success: true,
            message: 'Записът е изтрит'
        };
    }

    /**
     * Update alert settings
     * @param {Object} settings - Settings
     * @returns {Object} Result
     */
    updateAlertSettings(settings) {
        this.alertSettings = { ...this.alertSettings, ...settings };
        StorageService.set('competitorAlertSettings', this.alertSettings);

        return {
            success: true,
            settings: this.alertSettings
        };
    }

    /**
     * Statistics
     * @returns {Object} Stats
     */
    getStatistics() {
        const totalPriceEntries = this.competitorPrices.length;
        const totalPromotions = this.competitorPromotions.length;
        const activeCompetitors = this.competitors.filter(c => c.active).length;

        // Recent activity
        const last7Days = new Date();
        last7Days.setDate(last7Days.getDate() - 7);

        const recentEntries = this.competitorPrices.filter(p =>
            new Date(p.recordedAt) >= last7Days
        ).length;

        return {
            success: true,
            statistics: {
                activeCompetitors: activeCompetitors,
                totalPriceEntries: totalPriceEntries,
                totalPromotions: totalPromotions,
                recentEntries: recentEntries,
                photosUploaded: this.competitorPhotos.length
            }
        };
    }

    // ============ PRIVATE METHODS ============

    _checkPriceAlert(priceEntry) {
        if (!this.alertSettings.enabled || !this.alertSettings.alertOnPriceDrop) {
            return null;
        }

        const differencePercent = Math.abs(priceEntry.priceDifferencePercent);

        if (differencePercent >= this.alertSettings.priceThreshold && priceEntry.priceDifference > 0) {
            return {
                type: 'price_alert',
                severity: differencePercent > 15 ? 'critical' : 'warning',
                message: `${priceEntry.competitorName} продава ${priceEntry.productName} по-евтино с ${Math.round(differencePercent)}%!`,
                ourPrice: priceEntry.ourPrice,
                theirPrice: priceEntry.price,
                difference: Math.round(priceEntry.priceDifference * 100) / 100
            };
        }

        return null;
    }

    _getMarketPositionMessage(stats) {
        if (stats.lowestPercent > 50) {
            return 'Отлично! Вие сте лидер по цени в повече от 50% от продуктите.';
        } else if (stats.competitivePercent > 60) {
            return 'Добра конкурентна позиция. Повечето цени са в конкурентния диапазон.';
        } else if (stats.highestPercent > 50) {
            return 'ВНИМАНИЕ: Вашите цени са най-високи в повече от 50% от продуктите!';
        } else {
            return 'Смесена позиция на пазара.';
        }
    }

    _saveCompetitors() {
        StorageService.set('competitors', this.competitors);
    }

    _saveCompetitorPrices() {
        // Keep only last 500 entries
        if (this.competitorPrices.length > 500) {
            this.competitorPrices = this.competitorPrices.slice(0, 500);
        }
        StorageService.set('competitorPrices', this.competitorPrices);
    }

    _saveCompetitorPromotions() {
        StorageService.set('competitorPromotions', this.competitorPromotions);
    }

    _saveCompetitorPhotos() {
        // Keep only last 100 photos
        if (this.competitorPhotos.length > 100) {
            this.competitorPhotos = this.competitorPhotos.slice(0, 100);
        }
        StorageService.set('competitorPhotos', this.competitorPhotos);
    }
}
