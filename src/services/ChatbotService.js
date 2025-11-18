/**
 * AI Chatbot Service - v4.0
 * Intelligent customer assistant for POS system
 */
import { ValidationService } from './ValidationService.js';
import { StorageService } from './StorageService.js';

export class ChatbotService {
    constructor(productService, salesService, customerService) {
        this.productService = productService;
        this.salesService = salesService;
        this.customerService = customerService;

        this.conversationHistory = [];
        this.context = {};

        // Intent patterns
        this.intents = this._initializeIntents();
    }

    /**
     * Process user message and generate response
     * @param {string} message - User message
     * @param {Object} options - Additional options (userId, customerId)
     * @returns {Object} Bot response
     */
    processMessage(message, options = {}) {
        const validation = ValidationService.validateString(message, 'Съобщение', 1, 500);
        if (!validation.isValid) {
            return {
                success: false,
                errors: validation.errors
            };
        }

        const cleanMessage = validation.value.toLowerCase().trim();

        // Add to conversation history
        this.conversationHistory.push({
            role: 'user',
            message: message,
            timestamp: new Date().toISOString()
        });

        // Detect intent
        const intent = this._detectIntent(cleanMessage);

        // Generate response based on intent
        let response;
        try {
            response = this._generateResponse(intent, cleanMessage, options);
        } catch (error) {
            response = {
                text: 'Съжалявам, имам проблем с обработката на вашето съобщение. Моля, опитайте отново.',
                intent: 'error',
                suggestions: ['Помощ', 'Какво можеш да правиш?']
            };
        }

        // Add bot response to history
        this.conversationHistory.push({
            role: 'bot',
            message: response.text,
            intent: response.intent,
            timestamp: new Date().toISOString()
        });

        // Keep only last 50 messages
        if (this.conversationHistory.length > 50) {
            this.conversationHistory = this.conversationHistory.slice(-50);
        }

        return {
            success: true,
            response: {
                text: response.text,
                intent: response.intent,
                data: response.data || null,
                suggestions: response.suggestions || [],
                timestamp: new Date().toISOString()
            }
        };
    }

    /**
     * Get conversation history
     * @param {number} limit - Number of messages to return
     * @returns {Array} Conversation history
     */
    getConversationHistory(limit = 20) {
        return this.conversationHistory.slice(-limit);
    }

    /**
     * Clear conversation history
     */
    clearHistory() {
        this.conversationHistory = [];
        this.context = {};
        return { success: true };
    }

    /**
     * Get quick reply suggestions
     * @returns {Array} Suggested questions
     */
    getQuickReplies() {
        return [
            'Какви продукти имате?',
            'Покажи топ продукти',
            'Колко е продажбата днес?',
            'Кои продукти свършват?',
            'Какви промоции имате?',
            'Помощ'
        ];
    }

    /**
     * Set context for conversation
     * @param {string} key - Context key
     * @param {*} value - Context value
     */
    setContext(key, value) {
        this.context[key] = value;
    }

    /**
     * Get context value
     * @param {string} key - Context key
     * @returns {*} Context value
     */
    getContext(key) {
        return this.context[key];
    }

    /**
     * Train custom response
     * @param {string} pattern - Message pattern to match
     * @param {string} response - Response to give
     * @returns {Object} Result
     */
    trainCustomResponse(pattern, response) {
        const customIntents = StorageService.get('chatbotCustomIntents', []);

        customIntents.push({
            pattern: pattern.toLowerCase(),
            response: response,
            timestamp: new Date().toISOString()
        });

        StorageService.set('chatbotCustomIntents', customIntents);

        return {
            success: true,
            training: {
                pattern: pattern,
                response: response,
                totalCustomResponses: customIntents.length
            }
        };
    }

    // ============ PRIVATE METHODS ============

    _initializeIntents() {
        return {
            greeting: {
                patterns: ['здрав', 'здравей', 'добър ден', 'добро утро', 'здрасти', 'привет', 'здравеи'],
                responses: [
                    'Здравейте! Как мога да ви помогна?',
                    'Добър ден! Аз съм вашият виртуален асистент. С какво мога да бъда полезен?',
                    'Здравейте! Готов съм да отговоря на вашите въпроси.'
                ]
            },
            farewell: {
                patterns: ['довиждане', 'чао', 'bye', 'бай', 'до скоро', 'лека нощ'],
                responses: [
                    'Довиждане! Приятен ден!',
                    'До скоро! Винаги съм тук, ако имате нужда.',
                    'Чао! Успешна работа!'
                ]
            },
            thanks: {
                patterns: ['благодаря', 'мерси', 'thanks', 'благодаря ти', 'супер', 'перфектно'],
                responses: [
                    'Няма защо! Радвам се да помогна.',
                    'Винаги на разположение!',
                    'С удоволствие!'
                ]
            },
            product_search: {
                patterns: ['какви продукти', 'какво имате', 'продукти', 'артикули', 'стоки', 'наличност'],
                handler: 'handleProductSearch'
            },
            product_info: {
                patterns: ['колко струва', 'цена', 'информация за', 'детайли за', 'покажи'],
                handler: 'handleProductInfo'
            },
            top_products: {
                patterns: ['топ продукти', 'най-продавани', 'бестселъри', 'популярни продукти', 'хит'],
                handler: 'handleTopProducts'
            },
            low_stock: {
                patterns: ['свършват', 'малко количество', 'ниски наличности', 'почти няма', 'low stock'],
                handler: 'handleLowStock'
            },
            sales_today: {
                patterns: ['продажби днес', 'колко е продажбата', 'приходи днес', 'днешни продажби'],
                handler: 'handleSalesToday'
            },
            promotions: {
                patterns: ['промоции', 'отстъпки', 'оферти', 'намаления', 'какви промоции'],
                handler: 'handlePromotions'
            },
            customer_search: {
                patterns: ['клиент', 'клиенти', 'потребител', 'търси клиент'],
                handler: 'handleCustomerSearch'
            },
            help: {
                patterns: ['помощ', 'help', 'какво можеш', 'команди', 'функции'],
                handler: 'handleHelp'
            },
            stats: {
                patterns: ['статистика', 'статистики', 'analytics', 'анализ', 'данни'],
                handler: 'handleStats'
            }
        };
    }

    _detectIntent(message) {
        // Check custom intents first
        const customIntents = StorageService.get('chatbotCustomIntents', []);
        for (const custom of customIntents) {
            if (message.includes(custom.pattern)) {
                return { type: 'custom', custom: custom };
            }
        }

        // Check built-in intents
        for (const [intentName, intentData] of Object.entries(this.intents)) {
            for (const pattern of intentData.patterns) {
                if (message.includes(pattern)) {
                    return { type: intentName, data: intentData };
                }
            }
        }

        return { type: 'unknown' };
    }

    _generateResponse(intent, message, options) {
        // Handle custom intent
        if (intent.type === 'custom') {
            return {
                text: intent.custom.response,
                intent: 'custom',
                suggestions: this.getQuickReplies().slice(0, 3)
            };
        }

        // Handle built-in intents with handlers
        if (intent.data && intent.data.handler) {
            return this[intent.data.handler](message, options);
        }

        // Handle simple response intents
        if (intent.data && intent.data.responses) {
            const randomResponse = intent.data.responses[
                Math.floor(Math.random() * intent.data.responses.length)
            ];
            return {
                text: randomResponse,
                intent: intent.type,
                suggestions: this.getQuickReplies().slice(0, 3)
            };
        }

        // Unknown intent
        return {
            text: 'Не разбрах въпроса ви. Можете да ме попитате за продукти, продажби, промоции или статистики.',
            intent: 'unknown',
            suggestions: this.getQuickReplies()
        };
    }

    // ============ INTENT HANDLERS ============

    handleProductSearch(message, options) {
        const products = this.productService.getAllProducts();

        if (products.length === 0) {
            return {
                text: 'В момента няма добавени продукти в системата.',
                intent: 'product_search',
                suggestions: ['Помощ']
            };
        }

        const productsInStock = products.filter(p => p.stock > 0);

        let responseText = `Имаме общо ${products.length} продукта в системата.\n`;
        responseText += `${productsInStock.length} от тях са налични на склад.\n\n`;
        responseText += `Топ 5 продукта:\n`;

        products.slice(0, 5).forEach((p, i) => {
            responseText += `${i + 1}. ${p.name} - ${p.price.toFixed(2)} лв (${p.stock} бр.)\n`;
        });

        return {
            text: responseText,
            intent: 'product_search',
            data: { products: products.slice(0, 5) },
            suggestions: ['Топ продукти', 'Кои продукти свършват?', 'Промоции']
        };
    }

    handleProductInfo(message, options) {
        // Try to extract product name from message
        const products = this.productService.getAllProducts();
        let foundProduct = null;

        for (const product of products) {
            if (message.includes(product.name.toLowerCase())) {
                foundProduct = product;
                break;
            }
        }

        if (!foundProduct && products.length > 0) {
            return {
                text: 'Не намерих продукта, който търсите. Можете да ме попитате например: "Колко струва Кафе Лавацца?"',
                intent: 'product_info',
                suggestions: ['Какви продукти имате?']
            };
        }

        if (!foundProduct) {
            return {
                text: 'Няма продукти в системата.',
                intent: 'product_info'
            };
        }

        let responseText = `📦 ${foundProduct.name}\n\n`;
        responseText += `💰 Цена: ${foundProduct.price.toFixed(2)} лв\n`;
        responseText += `📊 Наличност: ${foundProduct.stock} ${foundProduct.unit || 'бр.'}\n`;
        responseText += `🏷️ Баркод: ${foundProduct.barcode}\n`;
        if (foundProduct.category) {
            responseText += `📁 Категория: ${foundProduct.category}\n`;
        }

        return {
            text: responseText,
            intent: 'product_info',
            data: { product: foundProduct },
            suggestions: ['Топ продукти', 'Продажби днес']
        };
    }

    handleTopProducts(message, options) {
        const sales = this.salesService.getAllSales();

        if (sales.length === 0) {
            return {
                text: 'Все още няма регистрирани продажби.',
                intent: 'top_products',
                suggestions: ['Какви продукти имате?']
            };
        }

        // Calculate product sales
        const productSales = {};
        sales.forEach(sale => {
            sale.items.forEach(item => {
                if (!productSales[item.productId]) {
                    productSales[item.productId] = {
                        name: item.name,
                        quantity: 0,
                        revenue: 0
                    };
                }
                productSales[item.productId].quantity += item.quantity;
                productSales[item.productId].revenue += item.price * item.quantity;
            });
        });

        // Sort by quantity
        const sorted = Object.entries(productSales)
            .sort(([, a], [, b]) => b.quantity - a.quantity)
            .slice(0, 5);

        let responseText = '🏆 Топ 5 най-продавани продукти:\n\n';
        sorted.forEach(([id, data], index) => {
            responseText += `${index + 1}. ${data.name}\n`;
            responseText += `   Продадени: ${data.quantity} бр.\n`;
            responseText += `   Приходи: ${data.revenue.toFixed(2)} лв\n\n`;
        });

        return {
            text: responseText,
            intent: 'top_products',
            data: { topProducts: sorted },
            suggestions: ['Продажби днес', 'Статистика']
        };
    }

    handleLowStock(message, options) {
        const products = this.productService.getAllProducts();
        const lowStockProducts = products.filter(p => p.stock < p.minStock || p.stock < 5);

        if (lowStockProducts.length === 0) {
            return {
                text: '✅ Всички продукти са с нормална наличност!',
                intent: 'low_stock',
                suggestions: ['Топ продукти', 'Какви продукти имате?']
            };
        }

        let responseText = `⚠️ ${lowStockProducts.length} продукта със ниска наличност:\n\n`;
        lowStockProducts.slice(0, 10).forEach(p => {
            const emoji = p.stock === 0 ? '🔴' : '🟡';
            responseText += `${emoji} ${p.name} - ${p.stock} бр.\n`;
        });

        if (lowStockProducts.length > 10) {
            responseText += `\n...и още ${lowStockProducts.length - 10} продукта`;
        }

        return {
            text: responseText,
            intent: 'low_stock',
            data: { lowStockProducts: lowStockProducts },
            suggestions: ['Топ продукти', 'Помощ']
        };
    }

    handleSalesToday(message, options) {
        const today = new Date().toISOString().split('T')[0];
        const todaySales = this.salesService.getSalesByDateRange(today, today);

        if (todaySales.length === 0) {
            return {
                text: 'Днес все още няма регистрирани продажби.',
                intent: 'sales_today',
                suggestions: ['Статистика', 'Топ продукти']
            };
        }

        const totalRevenue = todaySales.reduce((sum, sale) => sum + sale.total, 0);
        const cashSales = todaySales.filter(s => s.paymentMethod === 'cash');
        const cardSales = todaySales.filter(s => s.paymentMethod === 'card');

        let responseText = `💰 Продажби за днес:\n\n`;
        responseText += `📊 Общо продажби: ${todaySales.length}\n`;
        responseText += `💵 Общи приходи: ${totalRevenue.toFixed(2)} лв\n\n`;
        responseText += `💵 Кеш: ${cashSales.length} (${cashSales.reduce((s, sale) => s + sale.total, 0).toFixed(2)} лв)\n`;
        responseText += `💳 Карта: ${cardSales.length} (${cardSales.reduce((s, sale) => s + sale.total, 0).toFixed(2)} лв)\n`;

        return {
            text: responseText,
            intent: 'sales_today',
            data: { todaySales: todaySales, totalRevenue: totalRevenue },
            suggestions: ['Топ продукти', 'Статистика']
        };
    }

    handlePromotions(message, options) {
        // This would integrate with PromotionService from v3.0
        return {
            text: 'Функцията за промоции ще бъде интегрирана с PromotionService от v3.0.',
            intent: 'promotions',
            suggestions: ['Топ продукти', 'Продажби днес']
        };
    }

    handleCustomerSearch(message, options) {
        const customers = this.customerService.getAllCustomers();

        if (customers.length === 0) {
            return {
                text: 'Няма регистрирани клиенти в системата.',
                intent: 'customer_search',
                suggestions: ['Помощ']
            };
        }

        let responseText = `👥 Регистрирани клиенти: ${customers.length}\n\n`;
        responseText += `Топ 5 клиенти:\n`;
        customers.slice(0, 5).forEach((c, i) => {
            responseText += `${i + 1}. ${c.name} - ${c.loyaltyPoints || 0} точки\n`;
        });

        return {
            text: responseText,
            intent: 'customer_search',
            data: { customers: customers.slice(0, 5) },
            suggestions: ['Продажби днес', 'Статистика']
        };
    }

    handleHelp(message, options) {
        let responseText = `🤖 Аз съм вашият виртуален асистент!\n\n`;
        responseText += `Мога да ви помогна с:\n\n`;
        responseText += `📦 Продукти - "Какви продукти имате?"\n`;
        responseText += `🏆 Топ продажби - "Покажи топ продукти"\n`;
        responseText += `💰 Днешни продажби - "Колко е продажбата днес?"\n`;
        responseText += `⚠️ Ниски наличности - "Кои продукти свършват?"\n`;
        responseText += `👥 Клиенти - "Покажи клиенти"\n`;
        responseText += `📊 Статистики - "Статистика"\n\n`;
        responseText += `Просто ми задайте въпрос на естествен български език!`;

        return {
            text: responseText,
            intent: 'help',
            suggestions: this.getQuickReplies().slice(0, 4)
        };
    }

    handleStats(message, options) {
        const products = this.productService.getAllProducts();
        const sales = this.salesService.getAllSales();
        const customers = this.customerService.getAllCustomers();

        const totalRevenue = sales.reduce((sum, sale) => sum + sale.total, 0);
        const avgSale = sales.length > 0 ? totalRevenue / sales.length : 0;

        let responseText = `📊 Обща статистика:\n\n`;
        responseText += `📦 Продукти: ${products.length}\n`;
        responseText += `💰 Продажби: ${sales.length}\n`;
        responseText += `👥 Клиенти: ${customers.length}\n\n`;
        responseText += `💵 Общи приходи: ${totalRevenue.toFixed(2)} лв\n`;
        responseText += `📈 Средна продажба: ${avgSale.toFixed(2)} лв\n`;

        return {
            text: responseText,
            intent: 'stats',
            data: {
                products: products.length,
                sales: sales.length,
                customers: customers.length,
                totalRevenue: totalRevenue
            },
            suggestions: ['Топ продукти', 'Продажби днес']
        };
    }
}
