/**
 * Image Recognition Service - v4.0
 * Camera-based product recognition using computer vision
 */
import { ValidationService } from './ValidationService.js';
import { StorageService } from './StorageService.js';

export class ImageRecognitionService {
    constructor(productService) {
        this.productService = productService;
        this.productImages = StorageService.get('productImages', {});
        this.stream = null;
        this.videoElement = null;
    }

    /**
     * Initialize camera stream
     * @param {HTMLVideoElement} videoElement - Video element to display camera feed
     * @returns {Promise<Object>} Result with stream info
     */
    async initializeCamera(videoElement) {
        try {
            this.videoElement = videoElement;

            // Request camera access
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment', // Back camera on mobile
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            });

            videoElement.srcObject = this.stream;
            await videoElement.play();

            return {
                success: true,
                streamInfo: {
                    active: this.stream.active,
                    tracks: this.stream.getVideoTracks().length,
                    settings: this.stream.getVideoTracks()[0].getSettings()
                }
            };
        } catch (error) {
            return {
                success: false,
                errors: [`Грешка при достъп до камерата: ${error.message}`]
            };
        }
    }

    /**
     * Stop camera stream
     */
    stopCamera() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        if (this.videoElement) {
            this.videoElement.srcObject = null;
        }
        return { success: true };
    }

    /**
     * Capture image from video stream
     * @returns {Object} Result with captured image data
     */
    captureImage() {
        if (!this.videoElement) {
            return {
                success: false,
                errors: ['Камерата не е инициализирана']
            };
        }

        const canvas = document.createElement('canvas');
        canvas.width = this.videoElement.videoWidth;
        canvas.height = this.videoElement.videoHeight;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(this.videoElement, 0, 0);

        const imageData = canvas.toDataURL('image/jpeg', 0.8);

        return {
            success: true,
            image: {
                dataUrl: imageData,
                width: canvas.width,
                height: canvas.height,
                timestamp: new Date().toISOString()
            }
        };
    }

    /**
     * Train product recognition by storing product image
     * @param {number} productId - Product ID
     * @param {string} imageDataUrl - Image data URL
     * @returns {Object} Result
     */
    trainProductImage(productId, imageDataUrl) {
        const product = this.productService.getProductById(productId);

        if (!product) {
            return {
                success: false,
                errors: ['Продуктът не съществува']
            };
        }

        // Extract image features for comparison
        const features = this._extractImageFeatures(imageDataUrl);

        // Store product image
        if (!this.productImages[productId]) {
            this.productImages[productId] = [];
        }

        this.productImages[productId].push({
            imageData: imageDataUrl,
            features: features,
            timestamp: new Date().toISOString()
        });

        this._saveProductImages();

        return {
            success: true,
            training: {
                productId: productId,
                productName: product.name,
                imagesCount: this.productImages[productId].length,
                features: features
            }
        };
    }

    /**
     * Recognize product from captured image
     * @param {string} imageDataUrl - Image data URL
     * @param {number} threshold - Similarity threshold (0-1, default 0.7)
     * @returns {Object} Recognition result
     */
    recognizeProduct(imageDataUrl, threshold = 0.7) {
        if (Object.keys(this.productImages).length === 0) {
            return {
                success: false,
                errors: ['Няма обучени продукти. Използвайте trainProductImage() първо.']
            };
        }

        // Extract features from input image
        const inputFeatures = this._extractImageFeatures(imageDataUrl);

        // Compare with all stored product images
        const matches = [];

        Object.keys(this.productImages).forEach(productId => {
            const productImageSet = this.productImages[productId];

            productImageSet.forEach((stored, index) => {
                const similarity = this._calculateSimilarity(inputFeatures, stored.features);

                if (similarity >= threshold) {
                    const product = this.productService.getProductById(parseInt(productId));
                    if (product) {
                        matches.push({
                            productId: product.id,
                            productName: product.name,
                            barcode: product.barcode,
                            price: product.price,
                            stock: product.stock,
                            similarity: Math.round(similarity * 100),
                            matchedImageIndex: index
                        });
                    }
                }
            });
        });

        // Sort by similarity
        matches.sort((a, b) => b.similarity - a.similarity);

        if (matches.length === 0) {
            return {
                success: false,
                errors: [`Не са открити съвпадения (праг: ${threshold * 100}%)`]
            };
        }

        return {
            success: true,
            recognition: {
                matchesCount: matches.length,
                bestMatch: matches[0],
                allMatches: matches.slice(0, 5) // Top 5
            }
        };
    }

    /**
     * Detect barcode from image using Quagga (external library)
     * @param {string} imageDataUrl - Image data URL
     * @returns {Promise<Object>} Barcode detection result
     */
    async detectBarcodeFromImage(imageDataUrl) {
        // Check if Quagga is available (would need to be loaded externally)
        if (typeof window.Quagga === 'undefined') {
            return {
                success: false,
                errors: ['Quagga библиотеката не е заредена. Добавете <script src="https://cdn.jsdelivr.net/npm/quagga@0.12.1/dist/quagga.min.js"></script>']
            };
        }

        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                window.Quagga.decodeSingle({
                    src: imageDataUrl,
                    numOfWorkers: 0,
                    inputStream: {
                        size: 800
                    },
                    decoder: {
                        readers: ['ean_reader', 'code_128_reader', 'code_39_reader', 'upc_reader']
                    }
                }, (result) => {
                    if (result && result.codeResult) {
                        const barcode = result.codeResult.code;
                        const product = this.productService.getProductByBarcode(barcode);

                        resolve({
                            success: true,
                            barcode: {
                                code: barcode,
                                format: result.codeResult.format,
                                product: product || null
                            }
                        });
                    } else {
                        resolve({
                            success: false,
                            errors: ['Не е открит баркод в изображението']
                        });
                    }
                });
            };
            img.onerror = () => {
                resolve({
                    success: false,
                    errors: ['Грешка при зареждане на изображението']
                });
            };
            img.src = imageDataUrl;
        });
    }

    /**
     * Get all trained products
     * @returns {Object} Trained products list
     */
    getTrainedProducts() {
        const trained = Object.keys(this.productImages).map(productId => {
            const product = this.productService.getProductById(parseInt(productId));
            return {
                productId: parseInt(productId),
                productName: product ? product.name : 'Неизвестен',
                imagesCount: this.productImages[productId].length,
                lastTrained: this.productImages[productId][this.productImages[productId].length - 1].timestamp
            };
        });

        return {
            success: true,
            trainedProducts: trained,
            totalProducts: trained.length,
            totalImages: trained.reduce((sum, p) => sum + p.imagesCount, 0)
        };
    }

    /**
     * Delete trained images for a product
     * @param {number} productId - Product ID
     * @returns {Object} Result
     */
    deleteTrainedProduct(productId) {
        if (!this.productImages[productId]) {
            return {
                success: false,
                errors: ['Няма обучени изображения за този продукт']
            };
        }

        const count = this.productImages[productId].length;
        delete this.productImages[productId];
        this._saveProductImages();

        return {
            success: true,
            deleted: {
                productId: productId,
                imagesCount: count
            }
        };
    }

    /**
     * Clear all trained images
     * @returns {Object} Result
     */
    clearAllTraining() {
        const totalProducts = Object.keys(this.productImages).length;
        const totalImages = Object.values(this.productImages).reduce((sum, arr) => sum + arr.length, 0);

        this.productImages = {};
        this._saveProductImages();

        return {
            success: true,
            cleared: {
                products: totalProducts,
                images: totalImages
            }
        };
    }

    /**
     * Get camera capabilities
     * @returns {Promise<Object>} Camera capabilities
     */
    async getCameraCapabilities() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const cameras = devices.filter(device => device.kind === 'videoinput');

            const hasCamera = cameras.length > 0;
            const hasMultipleCameras = cameras.length > 1;

            return {
                success: true,
                capabilities: {
                    hasCamera: hasCamera,
                    cameraCount: cameras.length,
                    hasMultipleCameras: hasMultipleCameras,
                    cameras: cameras.map((cam, index) => ({
                        id: cam.deviceId,
                        label: cam.label || `Camera ${index + 1}`,
                        facing: this._guessCameraFacing(cam.label)
                    }))
                }
            };
        } catch (error) {
            return {
                success: false,
                errors: [`Грешка при проверка на камери: ${error.message}`]
            };
        }
    }

    /**
     * Scan continuously for products (video stream analysis)
     * @param {Function} onDetection - Callback when product is detected
     * @param {number} intervalMs - Scan interval in milliseconds
     * @returns {Object} Result with scanner ID
     */
    startContinuousScan(onDetection, intervalMs = 1000) {
        if (!this.videoElement) {
            return {
                success: false,
                errors: ['Камерата не е инициализирана']
            };
        }

        const scannerId = setInterval(() => {
            const captureResult = this.captureImage();
            if (captureResult.success) {
                const recognitionResult = this.recognizeProduct(captureResult.image.dataUrl, 0.75);
                if (recognitionResult.success && recognitionResult.recognition.bestMatch) {
                    onDetection(recognitionResult.recognition.bestMatch);
                }
            }
        }, intervalMs);

        return {
            success: true,
            scanner: {
                id: scannerId,
                intervalMs: intervalMs
            }
        };
    }

    /**
     * Stop continuous scan
     * @param {number} scannerId - Scanner ID from startContinuousScan
     */
    stopContinuousScan(scannerId) {
        clearInterval(scannerId);
        return { success: true };
    }

    // ============ PRIVATE HELPER METHODS ============

    /**
     * Extract image features for comparison
     * Uses color histogram and basic edge detection
     * @private
     */
    _extractImageFeatures(imageDataUrl) {
        const img = new Image();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Create temporary synchronous image load
        img.src = imageDataUrl;

        // Resize to standard size for comparison
        const size = 64;
        canvas.width = size;
        canvas.height = size;

        // Wait for image to load (synchronous for simplicity)
        if (img.complete) {
            ctx.drawImage(img, 0, 0, size, size);
        }

        const imageData = ctx.getImageData(0, 0, size, size);
        const pixels = imageData.data;

        // Color histogram (simplified - 8 bins per channel)
        const histogram = {
            red: new Array(8).fill(0),
            green: new Array(8).fill(0),
            blue: new Array(8).fill(0)
        };

        let brightnessSum = 0;

        for (let i = 0; i < pixels.length; i += 4) {
            const r = pixels[i];
            const g = pixels[i + 1];
            const b = pixels[i + 2];

            histogram.red[Math.floor(r / 32)]++;
            histogram.green[Math.floor(g / 32)]++;
            histogram.blue[Math.floor(b / 32)]++;

            brightnessSum += (r + g + b) / 3;
        }

        const pixelCount = pixels.length / 4;
        const averageBrightness = brightnessSum / pixelCount;

        // Normalize histogram
        Object.keys(histogram).forEach(channel => {
            histogram[channel] = histogram[channel].map(val => val / pixelCount);
        });

        return {
            histogram: histogram,
            averageBrightness: averageBrightness,
            size: size
        };
    }

    /**
     * Calculate similarity between two image features
     * Uses histogram correlation
     * @private
     */
    _calculateSimilarity(features1, features2) {
        // Calculate histogram correlation for each channel
        const correlations = [];

        ['red', 'green', 'blue'].forEach(channel => {
            const hist1 = features1.histogram[channel];
            const hist2 = features2.histogram[channel];

            // Calculate correlation
            let sum = 0;
            for (let i = 0; i < hist1.length; i++) {
                sum += Math.min(hist1[i], hist2[i]);
            }
            correlations.push(sum);
        });

        // Average correlation across channels
        const avgCorrelation = correlations.reduce((a, b) => a + b, 0) / correlations.length;

        // Factor in brightness similarity
        const brightnessDiff = Math.abs(features1.averageBrightness - features2.averageBrightness);
        const brightnessSimilarity = 1 - (brightnessDiff / 255);

        // Combined similarity (80% histogram, 20% brightness)
        return avgCorrelation * 0.8 + brightnessSimilarity * 0.2;
    }

    _guessCameraFacing(label) {
        const lowerLabel = label.toLowerCase();
        if (lowerLabel.includes('back') || lowerLabel.includes('rear')) {
            return 'back';
        }
        if (lowerLabel.includes('front')) {
            return 'front';
        }
        return 'unknown';
    }

    _saveProductImages() {
        // Store only metadata, not full images (to save storage)
        const metadata = {};
        Object.keys(this.productImages).forEach(productId => {
            metadata[productId] = this.productImages[productId].map(img => ({
                features: img.features,
                timestamp: img.timestamp,
                // Store thumbnail instead of full image
                thumbnail: this._createThumbnail(img.imageData)
            }));
        });

        StorageService.set('productImages', metadata);
    }

    _createThumbnail(imageDataUrl) {
        // Return first 100 chars as thumbnail marker
        return imageDataUrl.substring(0, 100);
    }
}
