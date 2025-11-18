/**
 * Blockchain Receipt Service - v4.0
 * Immutable receipt storage and cryptocurrency payment support
 */
import { ValidationService } from './ValidationService.js';
import { StorageService } from './StorageService.js';

export class BlockchainService {
    constructor(salesService) {
        this.salesService = salesService;

        this.blockchain = StorageService.get('blockchain', []);
        this.pendingTransactions = StorageService.get('pendingTransactions', []);
        this.cryptoWallets = StorageService.get('cryptoWallets', {});

        // Initialize genesis block if blockchain is empty
        if (this.blockchain.length === 0) {
            this._createGenesisBlock();
        }
    }

    /**
     * Create immutable receipt for a sale
     * @param {Object} saleData - Sale data
     * @returns {Object} Blockchain receipt
     */
    createReceipt(saleData) {
        const validation = this._validateSaleData(saleData);
        if (!validation.isValid) {
            return { success: false, errors: validation.errors };
        }

        // Create block data
        const blockData = {
            type: 'receipt',
            saleId: saleData.id,
            timestamp: new Date().toISOString(),
            items: saleData.items,
            total: saleData.total,
            paymentMethod: saleData.paymentMethod,
            customerId: saleData.customerId,
            userId: saleData.userId
        };

        // Add to blockchain
        const block = this._createBlock(blockData);

        return {
            success: true,
            receipt: {
                blockNumber: block.index,
                blockHash: block.hash,
                previousHash: block.previousHash,
                timestamp: block.timestamp,
                data: block.data,
                verified: this._verifyBlock(block)
            }
        };
    }

    /**
     * Verify receipt authenticity
     * @param {number} blockNumber - Block number
     * @returns {Object} Verification result
     */
    verifyReceipt(blockNumber) {
        if (blockNumber < 0 || blockNumber >= this.blockchain.length) {
            return {
                success: false,
                errors: ['Невалиден номер на блок']
            };
        }

        const block = this.blockchain[blockNumber];
        const isValid = this._verifyBlock(block);

        return {
            success: true,
            verification: {
                blockNumber: block.index,
                blockHash: block.hash,
                isValid: isValid,
                timestamp: block.timestamp,
                data: block.data
            }
        };
    }

    /**
     * Get receipt by block number
     * @param {number} blockNumber - Block number
     * @returns {Object} Receipt data
     */
    getReceipt(blockNumber) {
        if (blockNumber < 0 || blockNumber >= this.blockchain.length) {
            return {
                success: false,
                errors: ['Невалиден номер на блок']
            };
        }

        const block = this.blockchain[blockNumber];

        return {
            success: true,
            receipt: {
                blockNumber: block.index,
                blockHash: block.hash,
                timestamp: block.timestamp,
                data: block.data,
                verified: this._verifyBlock(block)
            }
        };
    }

    /**
     * Get all receipts (blocks)
     * @param {number} limit - Maximum number to return
     * @returns {Object} Receipts list
     */
    getAllReceipts(limit = 100) {
        const receipts = this.blockchain
                            .slice(1) // Skip genesis block
                            .slice(-limit)
                            .map(block => ({
                                blockNumber: block.index,
                                blockHash: block.hash,
                                timestamp: block.timestamp,
                                type: block.data.type,
                                saleId: block.data.saleId
                            }));

        return {
            success: true,
            receipts: receipts,
            totalBlocks: this.blockchain.length,
            totalReceipts: this.blockchain.length - 1 // Exclude genesis
        };
    }

    /**
     * Verify entire blockchain integrity
     * @returns {Object} Verification result
     */
    verifyBlockchain() {
        const errors = [];

        for (let i = 1; i < this.blockchain.length; i++) {
            const currentBlock = this.blockchain[i];
            const previousBlock = this.blockchain[i - 1];

            // Verify current block hash
            if (!this._verifyBlock(currentBlock)) {
                errors.push(`Блок ${i}: невалиден hash`);
            }

            // Verify chain linkage
            if (currentBlock.previousHash !== previousBlock.hash) {
                errors.push(`Блок ${i}: невалидна връзка с предишен блок`);
            }
        }

        return {
            success: errors.length === 0,
            verification: {
                totalBlocks: this.blockchain.length,
                isValid: errors.length === 0,
                errors: errors
            }
        };
    }

    /**
     * Initialize crypto wallet
     * @param {string} walletAddress - Wallet address
     * @param {string} cryptocurrency - Cryptocurrency type (BTC, ETH, USDT)
     * @returns {Object} Result
     */
    initializeCryptoWallet(walletAddress, cryptocurrency = 'BTC') {
        const validation = ValidationService.validateString(walletAddress, 'Адрес на портфейл', 10, 100);
        if (!validation.isValid) {
            return { success: false, errors: validation.errors };
        }

        const supportedCryptos = ['BTC', 'ETH', 'USDT', 'USDC'];
        if (!supportedCryptos.includes(cryptocurrency)) {
            return {
                success: false,
                errors: ['Неподдържана криптовалута. Поддържани: ' + supportedCryptos.join(', ')]
            };
        }

        this.cryptoWallets[cryptocurrency] = {
            address: validation.value,
            cryptocurrency: cryptocurrency,
            balance: 0,
            transactions: [],
            createdAt: new Date().toISOString()
        };

        this._saveCryptoWallets();

        return {
            success: true,
            wallet: this.cryptoWallets[cryptocurrency]
        };
    }

    /**
     * Process cryptocurrency payment
     * @param {string} cryptocurrency - Cryptocurrency type
     * @param {number} amount - Amount in fiat currency (BGN)
     * @param {string} fromAddress - Sender wallet address
     * @returns {Promise<Object>} Payment result
     */
    async processCryptoPayment(cryptocurrency, amount, fromAddress) {
        if (!this.cryptoWallets[cryptocurrency]) {
            return {
                success: false,
                errors: ['Портфейлът не е инициализиран. Използвайте initializeCryptoWallet() първо.']
            };
        }

        const amountValidation = ValidationService.validateNumber(amount, 'Сума', 0.01, 1000000);
        if (!amountValidation.isValid) {
            return { success: false, errors: amountValidation.errors };
        }

        // Simulate exchange rate (in real app, fetch from API)
        const exchangeRates = {
            'BTC': 50000, // 1 BTC = 50000 BGN
            'ETH': 3000,  // 1 ETH = 3000 BGN
            'USDT': 1.8,  // 1 USDT = 1.8 BGN
            'USDC': 1.8   // 1 USDC = 1.8 BGN
        };

        const cryptoAmount = amountValidation.value / exchangeRates[cryptocurrency];

        // Create transaction
        const transaction = {
            id: Date.now().toString(),
            type: 'payment',
            cryptocurrency: cryptocurrency,
            fromAddress: fromAddress,
            toAddress: this.cryptoWallets[cryptocurrency].address,
            amountCrypto: cryptoAmount,
            amountFiat: amountValidation.value,
            exchangeRate: exchangeRates[cryptocurrency],
            status: 'pending',
            timestamp: new Date().toISOString(),
            confirmations: 0
        };

        this.pendingTransactions.push(transaction);
        this._savePendingTransactions();

        // Simulate blockchain confirmation (in real app, wait for network confirmations)
        await this._simulateConfirmation(transaction);

        return {
            success: true,
            payment: {
                transactionId: transaction.id,
                cryptocurrency: cryptocurrency,
                amountCrypto: Math.round(cryptoAmount * 100000000) / 100000000,
                amountFiat: amountValidation.value,
                exchangeRate: exchangeRates[cryptocurrency],
                status: transaction.status,
                confirmations: transaction.confirmations,
                walletAddress: this.cryptoWallets[cryptocurrency].address
            }
        };
    }

    /**
     * Get crypto payment status
     * @param {string} transactionId - Transaction ID
     * @returns {Object} Transaction status
     */
    getCryptoPaymentStatus(transactionId) {
        const transaction = this.pendingTransactions.find(t => t.id === transactionId) ||
                          Object.values(this.cryptoWallets)
                                .flatMap(w => w.transactions)
                                .find(t => t.id === transactionId);

        if (!transaction) {
            return {
                success: false,
                errors: ['Транзакцията не е намерена']
            };
        }

        return {
            success: true,
            transaction: {
                id: transaction.id,
                cryptocurrency: transaction.cryptocurrency,
                amountCrypto: transaction.amountCrypto,
                amountFiat: transaction.amountFiat,
                status: transaction.status,
                confirmations: transaction.confirmations,
                timestamp: transaction.timestamp
            }
        };
    }

    /**
     * Get supported cryptocurrencies
     * @returns {Object} Supported cryptos
     */
    getSupportedCryptocurrencies() {
        return {
            success: true,
            cryptocurrencies: [
                {
                    code: 'BTC',
                    name: 'Bitcoin',
                    symbol: '₿',
                    decimals: 8
                },
                {
                    code: 'ETH',
                    name: 'Ethereum',
                    symbol: 'Ξ',
                    decimals: 18
                },
                {
                    code: 'USDT',
                    name: 'Tether',
                    symbol: '₮',
                    decimals: 6
                },
                {
                    code: 'USDC',
                    name: 'USD Coin',
                    symbol: '$',
                    decimals: 6
                }
            ]
        };
    }

    /**
     * Get crypto wallet info
     * @param {string} cryptocurrency - Cryptocurrency type
     * @returns {Object} Wallet info
     */
    getCryptoWallet(cryptocurrency) {
        if (!this.cryptoWallets[cryptocurrency]) {
            return {
                success: false,
                errors: ['Портфейлът не е инициализиран']
            };
        }

        return {
            success: true,
            wallet: this.cryptoWallets[cryptocurrency]
        };
    }

    /**
     * Export blockchain to JSON
     * @returns {Object} Blockchain data
     */
    exportBlockchain() {
        return {
            success: true,
            blockchain: {
                blocks: this.blockchain,
                totalBlocks: this.blockchain.length,
                isValid: this.verifyBlockchain().success,
                exportedAt: new Date().toISOString()
            }
        };
    }

    /**
     * Get blockchain statistics
     * @returns {Object} Statistics
     */
    getBlockchainStats() {
        const receiptBlocks = this.blockchain.filter(b => b.data && b.data.type === 'receipt');
        const totalRevenue = receiptBlocks.reduce((sum, b) => sum + (b.data.total || 0), 0);

        return {
            success: true,
            stats: {
                totalBlocks: this.blockchain.length,
                receiptBlocks: receiptBlocks.length,
                genesisBlock: this.blockchain[0],
                latestBlock: this.blockchain[this.blockchain.length - 1],
                totalRevenue: Math.round(totalRevenue * 100) / 100,
                blockchainValid: this.verifyBlockchain().success,
                averageBlockSize: Math.round(JSON.stringify(this.blockchain).length / this.blockchain.length)
            }
        };
    }

    // ============ PRIVATE METHODS ============

    _createGenesisBlock() {
        const genesisBlock = {
            index: 0,
            timestamp: '2025-01-01T00:00:00.000Z',
            data: {
                type: 'genesis',
                message: 'POS System Blockchain - Genesis Block'
            },
            previousHash: '0',
            hash: ''
        };

        genesisBlock.hash = this._calculateHash(genesisBlock);
        this.blockchain.push(genesisBlock);
        this._saveBlockchain();
    }

    _createBlock(data) {
        const previousBlock = this.blockchain[this.blockchain.length - 1];

        const block = {
            index: this.blockchain.length,
            timestamp: new Date().toISOString(),
            data: data,
            previousHash: previousBlock.hash,
            hash: ''
        };

        block.hash = this._calculateHash(block);
        this.blockchain.push(block);
        this._saveBlockchain();

        return block;
    }

    _calculateHash(block) {
        const data = block.index + block.timestamp + JSON.stringify(block.data) + block.previousHash;
        return this._sha256(data);
    }

    _sha256(message) {
        // Simple hash function (in production, use crypto.subtle.digest or similar)
        let hash = 0;
        for (let i = 0; i < message.length; i++) {
            const char = message.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash).toString(16).padStart(16, '0');
    }

    _verifyBlock(block) {
        const recalculatedHash = this._calculateHash(block);
        return recalculatedHash === block.hash;
    }

    _validateSaleData(data) {
        const errors = [];

        if (!data.id) {
            errors.push('Липсва ID на продажба');
        }

        if (!data.items || data.items.length === 0) {
            errors.push('Липсват артикули');
        }

        if (!data.total || data.total <= 0) {
            errors.push('Невалидна обща сума');
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    async _simulateConfirmation(transaction) {
        // Simulate blockchain confirmations
        return new Promise((resolve) => {
            let confirmations = 0;
            const interval = setInterval(() => {
                confirmations++;
                transaction.confirmations = confirmations;

                if (confirmations >= 3) {
                    clearInterval(interval);
                    transaction.status = 'confirmed';

                    // Move to wallet transactions
                    const wallet = this.cryptoWallets[transaction.cryptocurrency];
                    wallet.transactions.push(transaction);
                    wallet.balance += transaction.amountCrypto;

                    // Remove from pending
                    const index = this.pendingTransactions.findIndex(t => t.id === transaction.id);
                    if (index > -1) {
                        this.pendingTransactions.splice(index, 1);
                    }

                    this._saveCryptoWallets();
                    this._savePendingTransactions();

                    resolve();
                }
            }, 100); // Fast simulation
        });
    }

    _saveBlockchain() {
        StorageService.set('blockchain', this.blockchain);
    }

    _savePendingTransactions() {
        StorageService.set('pendingTransactions', this.pendingTransactions);
    }

    _saveCryptoWallets() {
        StorageService.set('cryptoWallets', this.cryptoWallets);
    }
}
