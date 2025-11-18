/**
 * Voice Commands Service - v4.0
 * Hands-free operation using Web Speech API
 */
import { ValidationService } from './ValidationService.js';

export class VoiceService {
    constructor(productService, cartService, salesService) {
        this.productService = productService;
        this.cartService = cartService;
        this.salesService = salesService;

        this.recognition = null;
        this.synthesis = window.speechSynthesis;
        this.isListening = false;
        this.voiceCommands = this._initializeVoiceCommands();
        this.language = 'bg-BG';
    }

    /**
     * Check if speech recognition is supported
     * @returns {Object} Support status
     */
    isSupported() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const speechSupported = SpeechRecognition !== undefined;
        const synthesisSupported = 'speechSynthesis' in window;

        return {
            success: true,
            support: {
                recognition: speechSupported,
                synthesis: synthesisSupported,
                fullSupport: speechSupported && synthesisSupported
            }
        };
    }

    /**
     * Start voice recognition
     * @param {Function} onCommand - Callback for recognized commands
     * @param {Function} onError - Callback for errors
     * @returns {Object} Result
     */
    startListening(onCommand, onError) {
        const support = this.isSupported();
        if (!support.support.recognition) {
            return {
                success: false,
                errors: ['Браузърът не поддържа гласово разпознаване']
            };
        }

        if (this.isListening) {
            return {
                success: false,
                errors: ['Вече слуша за команди']
            };
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();

        this.recognition.lang = this.language;
        this.recognition.continuous = true;
        this.recognition.interimResults = false;
        this.recognition.maxAlternatives = 1;

        this.recognition.onstart = () => {
            this.isListening = true;
            this.speak('Слушам ви');
        };

        this.recognition.onresult = (event) => {
            const last = event.results.length - 1;
            const command = event.results[last][0].transcript.toLowerCase().trim();

            console.log('Разпозната команда:', command);

            // Process command
            const result = this.processVoiceCommand(command);

            if (result.success && onCommand) {
                onCommand(result);
            }

            // Speak response
            if (result.response) {
                this.speak(result.response);
            }
        };

        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            if (onError) {
                onError(event.error);
            }
        };

        this.recognition.onend = () => {
            // Auto-restart if it was listening
            if (this.isListening) {
                this.recognition.start();
            }
        };

        try {
            this.recognition.start();
            return {
                success: true,
                listening: true
            };
        } catch (error) {
            return {
                success: false,
                errors: [`Грешка при стартиране: ${error.message}`]
            };
        }
    }

    /**
     * Stop voice recognition
     * @returns {Object} Result
     */
    stopListening() {
        if (!this.isListening || !this.recognition) {
            return {
                success: false,
                errors: ['Не слуша за команди']
            };
        }

        this.isListening = false;
        this.recognition.stop();

        return {
            success: true,
            listening: false
        };
    }

    /**
     * Process voice command
     * @param {string} command - Voice command text
     * @returns {Object} Command result
     */
    processVoiceCommand(command) {
        const cleanCommand = command.toLowerCase().trim();

        // Try to match command
        for (const [commandName, commandData] of Object.entries(this.voiceCommands)) {
            for (const pattern of commandData.patterns) {
                if (cleanCommand.includes(pattern)) {
                    return this[commandData.handler](cleanCommand);
                }
            }
        }

        return {
            success: false,
            command: command,
            response: 'Не разпознах командата. Кажете "помощ" за списък с команди.'
        };
    }

    /**
     * Text-to-speech
     * @param {string} text - Text to speak
     * @param {Object} options - Speech options
     * @returns {Object} Result
     */
    speak(text, options = {}) {
        if (!this.synthesis) {
            return {
                success: false,
                errors: ['Text-to-speech не е поддържан']
            };
        }

        // Cancel any ongoing speech
        this.synthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = options.lang || this.language;
        utterance.rate = options.rate || 1.0;
        utterance.pitch = options.pitch || 1.0;
        utterance.volume = options.volume || 1.0;

        // Get Bulgarian voice if available
        const voices = this.synthesis.getVoices();
        const bgVoice = voices.find(voice => voice.lang.startsWith('bg'));
        if (bgVoice) {
            utterance.voice = bgVoice;
        }

        this.synthesis.speak(utterance);

        return {
            success: true,
            text: text
        };
    }

    /**
     * Get available voices
     * @returns {Object} Voices list
     */
    getAvailableVoices() {
        if (!this.synthesis) {
            return {
                success: false,
                errors: ['Speech synthesis не е поддържан']
            };
        }

        const voices = this.synthesis.getVoices();

        return {
            success: true,
            voices: voices.map(voice => ({
                name: voice.name,
                lang: voice.lang,
                default: voice.default,
                localService: voice.localService
            })),
            totalVoices: voices.length
        };
    }

    /**
     * Set language for voice recognition
     * @param {string} lang - Language code (e.g., 'bg-BG', 'en-US')
     * @returns {Object} Result
     */
    setLanguage(lang) {
        const validation = ValidationService.validateString(lang, 'Език', 2, 10);
        if (!validation.isValid) {
            return { success: false, errors: validation.errors };
        }

        this.language = validation.value;

        if (this.recognition) {
            this.recognition.lang = this.language;
        }

        return {
            success: true,
            language: this.language
        };
    }

    /**
     * Get help text
     * @returns {Array} Available commands
     */
    getVoiceCommandsHelp() {
        const commands = [];

        Object.values(this.voiceCommands).forEach(cmd => {
            commands.push({
                name: cmd.name,
                examples: cmd.examples,
                description: cmd.description
            });
        });

        return commands;
    }

    // ============ COMMAND HANDLERS ============

    handleAddProduct(command) {
        // Extract product name or barcode
        // Examples: "добави кафе", "добави продукт 123", "сканирай баркод 456"

        // Try to find product name in command
        const products = this.productService.getAllProducts();
        let foundProduct = null;

        for (const product of products) {
            if (command.includes(product.name.toLowerCase())) {
                foundProduct = product;
                break;
            }
        }

        // Try to extract barcode (numbers in command)
        if (!foundProduct) {
            const numbers = command.match(/\d+/);
            if (numbers) {
                const barcode = numbers[0];
                foundProduct = this.productService.getProductByBarcode(barcode);
            }
        }

        if (!foundProduct) {
            return {
                success: false,
                command: command,
                response: 'Не намерих продукта. Моля, повторете името на продукта.'
            };
        }

        // Extract quantity
        let quantity = 1;
        const quantityMatch = command.match(/(\d+)\s*(брой|бр|штук|броя)/);
        if (quantityMatch) {
            quantity = parseInt(quantityMatch[1]);
        }

        // Add to cart
        const result = this.cartService.addToCart(foundProduct.id, quantity);

        if (result.success) {
            return {
                success: true,
                command: command,
                action: 'add_product',
                product: foundProduct,
                quantity: quantity,
                response: `Добавих ${quantity} ${foundProduct.name} в количката. Цена: ${(foundProduct.price * quantity).toFixed(2)} лева.`
            };
        } else {
            return {
                success: false,
                command: command,
                response: 'Не успях да добавя продукта. ' + result.errors.join(', ')
            };
        }
    }

    handleRemoveProduct(command) {
        // Extract product name
        const products = this.productService.getAllProducts();
        let foundProduct = null;

        for (const product of products) {
            if (command.includes(product.name.toLowerCase())) {
                foundProduct = product;
                break;
            }
        }

        if (!foundProduct) {
            return {
                success: false,
                command: command,
                response: 'Не намерих продукта за премахване.'
            };
        }

        const result = this.cartService.removeFromCart(foundProduct.id);

        if (result.success) {
            return {
                success: true,
                command: command,
                action: 'remove_product',
                product: foundProduct,
                response: `Премахнах ${foundProduct.name} от количката.`
            };
        } else {
            return {
                success: false,
                command: command,
                response: 'Не успях да премахна продукта.'
            };
        }
    }

    handleShowCart(command) {
        const cart = this.cartService.getCart();

        if (!cart || cart.length === 0) {
            return {
                success: true,
                command: command,
                action: 'show_cart',
                cart: [],
                response: 'Количката е празна.'
            };
        }

        const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

        let response = `В количката има ${itemCount} артикула. `;
        if (cart.length <= 3) {
            cart.forEach(item => {
                response += `${item.name} ${item.quantity} броя, `;
            });
        }
        response += `Обща сума: ${total.toFixed(2)} лева.`;

        return {
            success: true,
            command: command,
            action: 'show_cart',
            cart: cart,
            total: total,
            response: response
        };
    }

    handleClearCart(command) {
        this.cartService.clearCart();

        return {
            success: true,
            command: command,
            action: 'clear_cart',
            response: 'Изчистих количката.'
        };
    }

    handleCheckPrice(command) {
        // Extract product name
        const products = this.productService.getAllProducts();
        let foundProduct = null;

        for (const product of products) {
            if (command.includes(product.name.toLowerCase())) {
                foundProduct = product;
                break;
            }
        }

        if (!foundProduct) {
            return {
                success: false,
                command: command,
                response: 'Не намерих продукта.'
            };
        }

        return {
            success: true,
            command: command,
            action: 'check_price',
            product: foundProduct,
            response: `${foundProduct.name} струва ${foundProduct.price.toFixed(2)} лева. Налични ${foundProduct.stock} броя.`
        };
    }

    handleCheckStock(command) {
        // Extract product name
        const products = this.productService.getAllProducts();
        let foundProduct = null;

        for (const product of products) {
            if (command.includes(product.name.toLowerCase())) {
                foundProduct = product;
                break;
            }
        }

        if (!foundProduct) {
            return {
                success: false,
                command: command,
                response: 'Не намерих продукта.'
            };
        }

        const stockStatus = foundProduct.stock > 10 ? 'много' :
                          foundProduct.stock > 5 ? 'достатъчно' :
                          foundProduct.stock > 0 ? 'малко' : 'няма';

        return {
            success: true,
            command: command,
            action: 'check_stock',
            product: foundProduct,
            response: `${foundProduct.name} - налични ${foundProduct.stock} броя. Статус: ${stockStatus}.`
        };
    }

    handleSearchProduct(command) {
        // Extract search term (word after "търси")
        const searchMatch = command.match(/търси\s+(.+)/);
        const searchTerm = searchMatch ? searchMatch[1] : '';

        if (!searchTerm) {
            return {
                success: false,
                command: command,
                response: 'Какво да търся?'
            };
        }

        const results = this.productService.searchProducts(searchTerm);

        if (results.length === 0) {
            return {
                success: false,
                command: command,
                response: `Не намерих продукти с "${searchTerm}".`
            };
        }

        let response = `Намерих ${results.length} продукта: `;
        results.slice(0, 3).forEach((p, i) => {
            response += `${i + 1}. ${p.name}, `;
        });

        return {
            success: true,
            command: command,
            action: 'search_product',
            results: results,
            response: response
        };
    }

    handleHelp(command) {
        const response = 'Гласови команди: ' +
                        'Добави продукт. ' +
                        'Премахни продукт. ' +
                        'Покажи количка. ' +
                        'Изчисти количка. ' +
                        'Колко струва продукт. ' +
                        'Колко има продукт. ' +
                        'Търси продукт. ' +
                        'Помощ.';

        return {
            success: true,
            command: command,
            action: 'help',
            response: response
        };
    }

    // ============ PRIVATE METHODS ============

    _initializeVoiceCommands() {
        return {
            add_product: {
                name: 'Добави продукт',
                patterns: ['добави', 'сканирай', 'вземи', 'напълни'],
                examples: ['Добави кафе', 'Добави 2 броя мляко', 'Сканирай баркод 123'],
                description: 'Добавя продукт в количката',
                handler: 'handleAddProduct'
            },
            remove_product: {
                name: 'Премахни продукт',
                patterns: ['премахни', 'изтрий', 'махни'],
                examples: ['Премахни кафе', 'Изтрий последния продукт'],
                description: 'Премахва продукт от количката',
                handler: 'handleRemoveProduct'
            },
            show_cart: {
                name: 'Покажи количка',
                patterns: ['покажи количка', 'какво има в количката', 'количка', 'колко е'],
                examples: ['Покажи количка', 'Какво има в количката', 'Колко е общо'],
                description: 'Показва съдържанието на количката',
                handler: 'handleShowCart'
            },
            clear_cart: {
                name: 'Изчисти количка',
                patterns: ['изчисти количка', 'изпразни количка', 'нулирай'],
                examples: ['Изчисти количка', 'Изпразни количката'],
                description: 'Изчиства цялата количка',
                handler: 'handleClearCart'
            },
            check_price: {
                name: 'Провери цена',
                patterns: ['колко струва', 'цена на', 'каква е цената'],
                examples: ['Колко струва кафе', 'Цена на мляко'],
                description: 'Проверява цената на продукт',
                handler: 'handleCheckPrice'
            },
            check_stock: {
                name: 'Провери наличност',
                patterns: ['колко има', 'наличност', 'има ли'],
                examples: ['Колко има кафе', 'Има ли мляко'],
                description: 'Проверява наличността на продукт',
                handler: 'handleCheckStock'
            },
            search_product: {
                name: 'Търси продукт',
                patterns: ['търси', 'намери'],
                examples: ['Търси кафе', 'Намери мляко'],
                description: 'Търси продукти по име',
                handler: 'handleSearchProduct'
            },
            help: {
                name: 'Помощ',
                patterns: ['помощ', 'команди', 'какво мога'],
                examples: ['Помощ', 'Какви команди има'],
                description: 'Показва списък с команди',
                handler: 'handleHelp'
            }
        };
    }
}
