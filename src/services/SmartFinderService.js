/**
 * Smart Product Finder - v7.0
 * Интелигентно търсене на продукти (fuzzy search, suggestions, recent items)
 */
import { StorageService } from './StorageService.js';

export class SmartFinderService {
    constructor(productService, salesService) {
        this.productService = productService;
        this.salesService = salesService;

        // Recent scanned products (последно сканирани)
        this.recentProducts = StorageService.get('recentScannedProducts', []);
        this.maxRecentProducts = 20;

        // Frequently confused products
        this.confusedProducts = StorageService.get('confusedProducts', {});

        // Search history за learning
        this.searchHistory = StorageService.get('searchHistory', []);
    }

    /**
     * Smart search с fuzzy matching и suggestions
     * @param {string} query - Търсене
     * @param {Object} options - Опции
     * @returns {Object} Резултати
     */
    smartSearch(query, options = {}) {
        if (!query || query.trim() === '') {
            return {
                success: false,
                errors: ['Въведи търсене']
            };
        }

        const {
            maxResults = 10,
            includeOutOfStock = false,
            fuzzyThreshold = 0.6 // 0-1, колко близко трябва да е match-а
        } = options;

        const normalizedQuery = this._normalizeString(query);
        const allProducts = this.productService.getAllProducts();

        // Филтрирай out of stock ако е зададено
        const availableProducts = includeOutOfStock
            ? allProducts
            : allProducts.filter(p => p.quantity > 0);

        // Изчисли score за всеки продукт
        const scoredProducts = availableProducts.map(product => {
            const score = this._calculateSearchScore(normalizedQuery, product);
            return { product, score };
        });

        // Филтрирай по threshold и сортирай
        const results = scoredProducts
            .filter(item => item.score >= fuzzyThreshold)
            .sort((a, b) => b.score - a.score)
            .slice(0, maxResults)
            .map(item => ({
                ...item.product,
                matchScore: Math.round(item.score * 100),
                matchReason: this._getMatchReason(normalizedQuery, item.product, item.score)
            }));

        // Запиши в search history
        this._recordSearch(query, results.length);

        // Генерирай suggestions ако няма exact match
        const suggestions = results.length === 0 ? this._generateSuggestions(query) : [];

        return {
            success: true,
            query: query,
            results: results,
            resultCount: results.length,
            suggestions: suggestions,
            hasExactMatch: results.length > 0 && results[0].matchScore >= 95
        };
    }

    /**
     * Търсене по частичен баркод (когато баркодът е частично четим)
     * @param {string} partialBarcode - Частичен баркод
     * @returns {Object} Възможни продукти
     */
    searchByPartialBarcode(partialBarcode) {
        if (!partialBarcode || partialBarcode.length < 3) {
            return {
                success: false,
                errors: ['Въведи поне 3 цифри от баркода']
            };
        }

        const allProducts = this.productService.getAllProducts();
        const matches = allProducts.filter(product => {
            return product.barcode && product.barcode.includes(partialBarcode);
        });

        return {
            success: true,
            partialBarcode: partialBarcode,
            matches: matches,
            count: matches.length,
            message: matches.length === 0
                ? 'Няма намерени продукти с този частичен баркод'
                : `Намерени ${matches.length} възможни продукта`
        };
    }

    /**
     * Получи recent scanned products (бързи бутони)
     * @param {number} limit - Лимит
     * @returns {Object} Recent products
     */
    getRecentProducts(limit = 10) {
        const recent = this.recentProducts.slice(0, limit).map(productId => {
            return this.productService.getProductById(productId);
        }).filter(p => p !== null);

        return {
            success: true,
            products: recent,
            count: recent.length
        };
    }

    /**
     * Запиши сканиран продукт в recent
     * @param {number} productId - Product ID
     * @returns {Object} Резултат
     */
    recordScannedProduct(productId) {
        // Премахни ако вече е в списъка
        this.recentProducts = this.recentProducts.filter(id => id !== productId);

        // Добави в началото
        this.recentProducts.unshift(productId);

        // Ограничи размера
        if (this.recentProducts.length > this.maxRecentProducts) {
            this.recentProducts = this.recentProducts.slice(0, this.maxRecentProducts);
        }

        this._saveRecentProducts();

        return {
            success: true,
            productId: productId
        };
    }

    /**
     * Намери подобни продукти (when you can't find exact match)
     * @param {number} productId - Product ID
     * @param {number} limit - Лимит
     * @returns {Object} Similar products
     */
    findSimilarProducts(productId, limit = 5) {
        const product = this.productService.getProductById(productId);

        if (!product) {
            return {
                success: false,
                errors: ['Продуктът не е намерен']
            };
        }

        const allProducts = this.productService.getAllProducts();

        // Изчисли similarity score
        const similarProducts = allProducts
            .filter(p => p.id !== productId)
            .map(p => ({
                product: p,
                similarity: this._calculateSimilarity(product, p)
            }))
            .filter(item => item.similarity > 0.3)
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, limit)
            .map(item => ({
                ...item.product,
                similarityScore: Math.round(item.similarity * 100)
            }));

        return {
            success: true,
            originalProduct: product,
            similarProducts: similarProducts,
            count: similarProducts.length
        };
    }

    /**
     * Find frequently confused products
     * @param {number} productId - Product ID
     * @returns {Object} Често объркани продукти
     */
    getFrequentlyConfused(productId) {
        const confused = this.confusedProducts[productId] || [];

        const products = confused.map(c => ({
            product: this.productService.getProductById(c.confusedWithId),
            confusionCount: c.count
        })).filter(p => p.product !== null);

        return {
            success: true,
            products: products,
            message: products.length > 0
                ? `Този продукт често се обърква с ${products.length} други`
                : 'Няма данни за объркани продукти'
        };
    }

    /**
     * Запиши объркан продукт (when user searches for X but meant Y)
     * @param {number} searchedProductId - Търсен продукт
     * @param {number} actualProductId - Реален продукт
     * @returns {Object} Резултат
     */
    recordConfusion(searchedProductId, actualProductId) {
        if (!this.confusedProducts[searchedProductId]) {
            this.confusedProducts[searchedProductId] = [];
        }

        // Провери дали вече съществува
        const existing = this.confusedProducts[searchedProductId].find(
            c => c.confusedWithId === actualProductId
        );

        if (existing) {
            existing.count++;
        } else {
            this.confusedProducts[searchedProductId].push({
                confusedWithId: actualProductId,
                count: 1,
                lastConfused: new Date().toISOString()
            });
        }

        this._saveConfusedProducts();

        return {
            success: true,
            message: 'Confusion записан за подобряване на search'
        };
    }

    /**
     * Search suggestions based on history
     * @param {string} partialQuery - Частична заявка
     * @returns {Object} Suggestions
     */
    getSearchSuggestions(partialQuery) {
        if (!partialQuery || partialQuery.length < 2) {
            // Покажи popular searches
            return this._getPopularSearches();
        }

        const normalized = this._normalizeString(partialQuery);

        // Филтрирай от history
        const historySuggestions = this.searchHistory
            .filter(h => this._normalizeString(h.query).startsWith(normalized))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5)
            .map(h => h.query);

        // Филтрирай от product names
        const allProducts = this.productService.getAllProducts();
        const productSuggestions = allProducts
            .filter(p => this._normalizeString(p.name).startsWith(normalized))
            .slice(0, 5)
            .map(p => p.name);

        // Комбинирай и премахни дубликати
        const combined = [...new Set([...historySuggestions, ...productSuggestions])];

        return {
            success: true,
            suggestions: combined.slice(0, 8)
        };
    }

    /**
     * Quick manual price entry (when barcode doesn't work)
     * @param {number} price - Цена
     * @param {string} description - Описание
     * @returns {Object} Manual item
     */
    createManualItem(price, description = 'Manual Item') {
        if (price <= 0) {
            return {
                success: false,
                errors: ['Цената трябва да е по-голяма от 0']
            };
        }

        // Създай temporary manual item
        const manualItem = {
            productId: null,
            productName: description,
            price: Math.round(price * 100) / 100,
            quantity: 1,
            manual: true,
            requiresApproval: price > 50 // Require manager approval for high prices
        };

        return {
            success: true,
            item: manualItem,
            warning: manualItem.requiresApproval
                ? 'Необходимо е одобрение от мениджър за цена над 50лв'
                : null
        };
    }

    /**
     * Търсене по категория
     * @param {string} category - Категория
     * @returns {Object} Продукти
     */
    searchByCategory(category) {
        const allProducts = this.productService.getAllProducts();
        const products = allProducts.filter(p =>
            p.category && p.category.toLowerCase() === category.toLowerCase()
        );

        return {
            success: true,
            category: category,
            products: products,
            count: products.length
        };
    }

    /**
     * Популярни продукти (most sold)
     * @param {number} limit - Лимит
     * @param {string} period - Период ('today', 'week', 'month')
     * @returns {Object} Popular products
     */
    getPopularProducts(limit = 10, period = 'week') {
        const allSales = this.salesService.getAllSales();

        // Филтрирай по период
        const now = new Date();
        let startDate;

        if (period === 'today') {
            startDate = new Date(now.setHours(0, 0, 0, 0));
        } else if (period === 'week') {
            startDate = new Date(now.setDate(now.getDate() - 7));
        } else if (period === 'month') {
            startDate = new Date(now.setMonth(now.getMonth() - 1));
        }

        const recentSales = allSales.filter(s => new Date(s.date) >= startDate);

        // Брой продажби по продукт
        const productCounts = {};

        recentSales.forEach(sale => {
            sale.items.forEach(item => {
                if (!productCounts[item.productId]) {
                    productCounts[item.productId] = 0;
                }
                productCounts[item.productId] += item.quantity;
            });
        });

        // Сортирай и вземи top N
        const popular = Object.keys(productCounts)
            .map(productId => ({
                product: this.productService.getProductById(parseInt(productId)),
                salesCount: productCounts[productId]
            }))
            .filter(item => item.product !== null)
            .sort((a, b) => b.salesCount - a.salesCount)
            .slice(0, limit);

        return {
            success: true,
            period: period,
            products: popular,
            count: popular.length
        };
    }

    /**
     * Изчисти recent products
     */
    clearRecentProducts() {
        this.recentProducts = [];
        this._saveRecentProducts();

        return {
            success: true,
            message: 'Recent products изчистени'
        };
    }

    /**
     * Search statistics
     * @returns {Object} Статистика
     */
    getSearchStatistics() {
        const totalSearches = this.searchHistory.reduce((sum, h) => sum + h.count, 0);
        const topSearches = this.searchHistory
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        return {
            success: true,
            statistics: {
                totalSearches: totalSearches,
                uniqueQueries: this.searchHistory.length,
                topSearches: topSearches
            }
        };
    }

    // ============ PRIVATE METHODS ============

    _normalizeString(str) {
        return str
            .toLowerCase()
            .trim()
            .replace(/\s+/g, ' ') // Multiple spaces to single
            .normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // Remove accents
    }

    _calculateSearchScore(query, product) {
        const productName = this._normalizeString(product.name);
        const productCategory = product.category ? this._normalizeString(product.category) : '';
        const productBarcode = product.barcode || '';

        let score = 0;

        // Exact match (100%)
        if (productName === query) {
            return 1.0;
        }

        // Starts with (80%)
        if (productName.startsWith(query)) {
            score = 0.8;
        }

        // Contains (60%)
        else if (productName.includes(query)) {
            score = 0.6;
        }

        // Fuzzy match
        else {
            score = this._fuzzyMatch(query, productName);
        }

        // Bonus for category match
        if (productCategory.includes(query)) {
            score += 0.1;
        }

        // Bonus for barcode match
        if (productBarcode.includes(query)) {
            score += 0.2;
        }

        // Bonus for word match
        const queryWords = query.split(' ');
        const productWords = productName.split(' ');

        const wordMatches = queryWords.filter(qw =>
            productWords.some(pw => pw.includes(qw) || qw.includes(pw))
        ).length;

        if (queryWords.length > 0) {
            score += (wordMatches / queryWords.length) * 0.2;
        }

        return Math.min(score, 1.0);
    }

    _fuzzyMatch(query, target) {
        // Levenshtein distance based fuzzy matching
        const distance = this._levenshteinDistance(query, target);
        const maxLength = Math.max(query.length, target.length);

        if (maxLength === 0) return 1.0;

        return 1 - (distance / maxLength);
    }

    _levenshteinDistance(str1, str2) {
        const matrix = [];

        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }

        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }

        return matrix[str2.length][str1.length];
    }

    _getMatchReason(query, product, score) {
        const productName = this._normalizeString(product.name);

        if (score >= 0.95) return 'Точно съвпадение';
        if (productName.startsWith(query)) return 'Започва с търсенето';
        if (productName.includes(query)) return 'Съдържа търсенето';
        if (product.barcode && product.barcode.includes(query)) return 'Баркод съвпадение';
        if (score >= 0.7) return 'Подобно име';
        return 'Частично съвпадение';
    }

    _generateSuggestions(query) {
        const suggestions = [];

        // Suggestion: Търси без последната буква (typo?)
        if (query.length > 3) {
            suggestions.push(`Имаше предвид "${query.slice(0, -1)}"?`);
        }

        // Suggestion: Провери категорията
        const allProducts = this.productService.getAllProducts();
        const categories = [...new Set(allProducts.map(p => p.category).filter(c => c))];

        const categoryMatches = categories.filter(cat =>
            this._normalizeString(cat).includes(this._normalizeString(query))
        );

        if (categoryMatches.length > 0) {
            suggestions.push(`Категория "${categoryMatches[0]}" съществува. Търси в нея?`);
        }

        // Suggestion: Popular products
        suggestions.push('Виж популярни продукти');

        return suggestions;
    }

    _calculateSimilarity(product1, product2) {
        let similarity = 0;

        // Same category (40%)
        if (product1.category && product2.category &&
            product1.category.toLowerCase() === product2.category.toLowerCase()) {
            similarity += 0.4;
        }

        // Similar price (30%)
        const priceDiff = Math.abs(product1.price - product2.price);
        const avgPrice = (product1.price + product2.price) / 2;
        if (avgPrice > 0) {
            const priceSimiliarity = 1 - Math.min(priceDiff / avgPrice, 1);
            similarity += priceSimiliarity * 0.3;
        }

        // Similar name (30%)
        const nameSimiliarity = this._fuzzyMatch(
            this._normalizeString(product1.name),
            this._normalizeString(product2.name)
        );
        similarity += nameSimiliarity * 0.3;

        return similarity;
    }

    _recordSearch(query, resultCount) {
        const existing = this.searchHistory.find(h =>
            this._normalizeString(h.query) === this._normalizeString(query)
        );

        if (existing) {
            existing.count++;
            existing.lastSearched = new Date().toISOString();
            existing.avgResults = (existing.avgResults * (existing.count - 1) + resultCount) / existing.count;
        } else {
            this.searchHistory.push({
                query: query,
                count: 1,
                firstSearched: new Date().toISOString(),
                lastSearched: new Date().toISOString(),
                avgResults: resultCount
            });
        }

        // Пази само последните 100 unique searches
        if (this.searchHistory.length > 100) {
            this.searchHistory.sort((a, b) => b.count - a.count);
            this.searchHistory = this.searchHistory.slice(0, 100);
        }

        this._saveSearchHistory();
    }

    _getPopularSearches() {
        const popular = this.searchHistory
            .sort((a, b) => b.count - a.count)
            .slice(0, 10)
            .map(h => h.query);

        return {
            success: true,
            suggestions: popular,
            type: 'popular_searches'
        };
    }

    _saveRecentProducts() {
        StorageService.set('recentScannedProducts', this.recentProducts);
    }

    _saveConfusedProducts() {
        StorageService.set('confusedProducts', this.confusedProducts);
    }

    _saveSearchHistory() {
        StorageService.set('searchHistory', this.searchHistory);
    }
}
