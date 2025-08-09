/**
 * Compression Middleware for TaskFlow Pro
 * Advanced response compression with adaptive algorithms
 */

const zlib = require('zlib');

class CompressionMiddleware {
    constructor(config = {}) {
        this.config = {
            threshold: 1024,           // 1KB minimum
            level: 6,                  // Compression level (1-9)
            windowBits: 15,            // Memory usage
            memLevel: 8,               // Memory usage
            strategy: zlib.constants.Z_DEFAULT_STRATEGY,
            compressibleTypes: [
                'text/',
                'application/json',
                'application/javascript',
                'application/xml',
                'image/svg+xml'
            ],
            ...config
        };
        
        this.stats = {
            requests: 0,
            compressed: 0,
            originalBytes: 0,
            compressedBytes: 0,
            savings: 0
        };
    }

    middleware() {
        return (req, res, next) => {
            this.stats.requests++;
            
            // Skip if not supported
            if (!this.shouldCompress(req)) {
                return next();
            }
            
            // Override res.json to compress JSON responses
            const originalJson = res.json;
            res.json = (obj) => {
                const data = JSON.stringify(obj);
                return this.compressAndSend(res, data, 'application/json', originalJson);
            };
            
            // Override res.send for other responses
            const originalSend = res.send;
            res.send = (data) => {
                if (typeof data === 'string' && data.length > this.config.threshold) {
                    const contentType = res.get('Content-Type') || 'text/html';
                    return this.compressAndSend(res, data, contentType, originalSend);
                }
                return originalSend.call(res, data);
            };
            
            next();
        };
    }

    shouldCompress(req) {
        const acceptEncoding = req.headers['accept-encoding'];
        if (!acceptEncoding) return false;
        
        return acceptEncoding.includes('gzip') || 
               acceptEncoding.includes('deflate') || 
               acceptEncoding.includes('br');
    }

    isCompressible(contentType) {
        return this.config.compressibleTypes.some(type => 
            contentType.toLowerCase().startsWith(type)
        );
    }

    async compressAndSend(res, data, contentType, originalMethod) {
        if (!this.isCompressible(contentType) || data.length < this.config.threshold) {
            return originalMethod.call(res, data);
        }
        
        try {
            const acceptEncoding = res.req.headers['accept-encoding'];
            let compressed;
            let encoding;
            
            // Choose best compression method
            if (acceptEncoding.includes('br')) {
                compressed = await this.brotliCompress(data);
                encoding = 'br';
            } else if (acceptEncoding.includes('gzip')) {
                compressed = await this.gzipCompress(data);
                encoding = 'gzip';
            } else if (acceptEncoding.includes('deflate')) {
                compressed = await this.deflateCompress(data);
                encoding = 'deflate';
            } else {
                return originalMethod.call(res, data);
            }
            
            // Update statistics
            this.updateStats(data.length, compressed.length);
            
            // Set headers and send compressed data
            res.set({
                'Content-Encoding': encoding,
                'Content-Length': compressed.length,
                'Vary': 'Accept-Encoding'
            });
            
            res.status(res.statusCode).end(compressed);
            
        } catch (error) {
            console.error('Compression failed:', error.message);
            return originalMethod.call(res, data);
        }
    }

    async gzipCompress(data) {
        return new Promise((resolve, reject) => {
            zlib.gzip(data, {
                level: this.config.level,
                windowBits: this.config.windowBits,
                memLevel: this.config.memLevel,
                strategy: this.config.strategy
            }, (error, result) => {
                if (error) reject(error);
                else resolve(result);
            });
        });
    }

    async deflateCompress(data) {
        return new Promise((resolve, reject) => {
            zlib.deflate(data, {
                level: this.config.level,
                windowBits: this.config.windowBits,
                memLevel: this.config.memLevel,
                strategy: this.config.strategy
            }, (error, result) => {
                if (error) reject(error);
                else resolve(result);
            });
        });
    }

    async brotliCompress(data) {
        return new Promise((resolve, reject) => {
            zlib.brotliCompress(data, {
                params: {
                    [zlib.constants.BROTLI_PARAM_QUALITY]: this.config.level,
                    [zlib.constants.BROTLI_PARAM_SIZE_HINT]: data.length
                }
            }, (error, result) => {
                if (error) reject(error);
                else resolve(result);
            });
        });
    }

    updateStats(originalSize, compressedSize) {
        this.stats.compressed++;
        this.stats.originalBytes += originalSize;
        this.stats.compressedBytes += compressedSize;
        this.stats.savings = this.stats.originalBytes - this.stats.compressedBytes;
    }

    getStats() {
        const compressionRatio = this.stats.originalBytes > 0 
            ? Math.round((this.stats.compressedBytes / this.stats.originalBytes) * 100)
            : 0;
        
        const savingsRatio = this.stats.originalBytes > 0
            ? Math.round((this.stats.savings / this.stats.originalBytes) * 100)
            : 0;
        
        return {
            requests: this.stats.requests,
            compressed: this.stats.compressed,
            compressionRate: Math.round((this.stats.compressed / this.stats.requests) * 100) + '%',
            originalBytes: this.stats.originalBytes,
            compressedBytes: this.stats.compressedBytes,
            savings: this.stats.savings,
            compressionRatio: compressionRatio + '%',
            savingsRatio: savingsRatio + '%'
        };
    }

    reset() {
        this.stats = {
            requests: 0,
            compressed: 0,
            originalBytes: 0,
            compressedBytes: 0,
            savings: 0
        };
    }
}

module.exports = { CompressionMiddleware };