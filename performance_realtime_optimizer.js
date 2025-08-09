/**
 * Real-time Performance Optimizer
 * TaskFlow Pro v3.0 - Phase 3 Performance Enhancement
 * Multi-Persona Ultra-Think Implementation
 */

class RealtimePerformanceOptimizer {
    constructor(config = {}) {
        this.config = {
            maxConcurrentConnections: config.maxConcurrentConnections || 1000,
            messageThrottleMs: config.messageThrottleMs || 100,
            batchSize: config.batchSize || 50,
            compressionEnabled: config.compressionEnabled !== false,
            metricsInterval: config.metricsInterval || 30000,
            memoryThreshold: config.memoryThreshold || 85, // percentage
            cpuThreshold: config.cpuThreshold || 80, // percentage
            ...config
        };

        this.metrics = {
            connections: {
                current: 0,
                peak: 0,
                total: 0
            },
            messages: {
                sent: 0,
                received: 0,
                queued: 0,
                dropped: 0,
                avgLatency: 0
            },
            performance: {
                memoryUsage: 0,
                cpuUsage: 0,
                throughput: 0,
                errorRate: 0
            },
            optimization: {
                compressionRatio: 0,
                batchingEfficiency: 0,
                throttledMessages: 0
            }
        };

        this.messageQueue = new Map();
        this.throttleTimers = new Map();
        this.compressionCache = new Map();
        this.connectionPool = new Map();
        this.performanceHistory = [];
        
        this.startPerformanceMonitoring();
    }

    /**
     * Connection Management & Optimization
     */
    optimizeConnection(connectionId, connection) {
        // Connection pooling and reuse
        if (this.connectionPool.has(connectionId)) {
            const existingConnection = this.connectionPool.get(connectionId);
            if (existingConnection.readyState === 1) { // OPEN
                return existingConnection;
            }
        }

        // Configure connection for optimal performance
        if (connection && connection.readyState === 1) {
            // Enable binary frames for better performance
            connection.binaryType = 'arraybuffer';
            
            // Set optimal buffer sizes
            if (connection.bufferedAmountLowThreshold !== undefined) {
                connection.bufferedAmountLowThreshold = 1024; // 1KB
            }

            this.connectionPool.set(connectionId, connection);
            this.metrics.connections.current++;
            this.metrics.connections.total++;
            
            if (this.metrics.connections.current > this.metrics.connections.peak) {
                this.metrics.connections.peak = this.metrics.connections.current;
            }

            // Set up connection optimization listeners
            connection.addEventListener('close', () => {
                this.connectionPool.delete(connectionId);
                this.metrics.connections.current--;
                this.cleanupConnection(connectionId);
            });

            connection.addEventListener('error', () => {
                this.metrics.performance.errorRate++;
            });
        }

        return connection;
    }

    /**
     * Message Throttling and Batching
     */
    optimizeMessage(type, data, priority = 'medium', connectionId = null) {
        const messageId = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const message = {
            id: messageId,
            type,
            data,
            priority,
            timestamp: Date.now(),
            connectionId,
            retries: 0
        };

        // Apply compression if enabled and message is large
        if (this.config.compressionEnabled && JSON.stringify(data).length > 1024) {
            message.data = this.compressMessage(data);
            message.compressed = true;
        }

        // Priority-based routing
        if (priority === 'critical') {
            // Send immediately for critical messages
            return this.sendMessage(message);
        } else {
            // Queue and batch non-critical messages
            return this.queueMessage(message);
        }
    }

    queueMessage(message) {
        const queueKey = `${message.type}_${message.priority}`;
        
        if (!this.messageQueue.has(queueKey)) {
            this.messageQueue.set(queueKey, []);
        }
        
        const queue = this.messageQueue.get(queueKey);
        queue.push(message);
        this.metrics.messages.queued++;

        // Throttle message processing based on type and priority
        const throttleKey = `${message.type}_${message.priority}`;
        if (!this.throttleTimers.has(throttleKey)) {
            const delay = this.getThrottleDelay(message.priority);
            
            this.throttleTimers.set(throttleKey, setTimeout(() => {
                this.processBatch(queueKey);
                this.throttleTimers.delete(throttleKey);
            }, delay));
        }

        // Force batch processing if queue is full
        if (queue.length >= this.config.batchSize) {
            clearTimeout(this.throttleTimers.get(throttleKey));
            this.throttleTimers.delete(throttleKey);
            this.processBatch(queueKey);
        }

        return Promise.resolve({ queued: true, messageId: message.id });
    }

    processBatch(queueKey) {
        const queue = this.messageQueue.get(queueKey);
        if (!queue || queue.length === 0) return;

        const batch = queue.splice(0, this.config.batchSize);
        this.metrics.messages.queued -= batch.length;

        // Group messages by connection for efficient sending
        const connectionGroups = new Map();
        
        batch.forEach(message => {
            const connId = message.connectionId || 'broadcast';
            if (!connectionGroups.has(connId)) {
                connectionGroups.set(connId, []);
            }
            connectionGroups.get(connId).push(message);
        });

        // Send batched messages
        connectionGroups.forEach((messages, connectionId) => {
            if (connectionId === 'broadcast') {
                this.broadcastBatch(messages);
            } else {
                this.sendBatchToConnection(messages, connectionId);
            }
        });

        // Update batching efficiency
        this.metrics.optimization.batchingEfficiency = 
            (batch.length / this.config.batchSize) * 100;
    }

    /**
     * Message Compression
     */
    compressMessage(data) {
        const jsonString = JSON.stringify(data);
        const cacheKey = this.generateCacheKey(jsonString);
        
        // Check compression cache
        if (this.compressionCache.has(cacheKey)) {
            this.metrics.optimization.compressionRatio = 
                this.compressionCache.get(cacheKey).ratio;
            return this.compressionCache.get(cacheKey).compressed;
        }

        // Simple compression simulation (in real implementation, use actual compression)
        const compressed = this.simulateCompression(jsonString);
        const ratio = (jsonString.length - compressed.length) / jsonString.length * 100;
        
        // Cache the result
        this.compressionCache.set(cacheKey, {
            compressed,
            ratio,
            timestamp: Date.now()
        });

        // Cleanup old cache entries
        this.cleanupCompressionCache();

        this.metrics.optimization.compressionRatio = ratio;
        return compressed;
    }

    simulateCompression(data) {
        // This is a simulation - in real implementation, use libraries like pako, lz-string, etc.
        // Remove unnecessary whitespace and apply basic compression
        return data
            .replace(/\s+/g, ' ')
            .replace(/([{,]\s*)/g, '$1')
            .replace(/(\s*[}\]])/g, '$1');
    }

    /**
     * Adaptive Performance Monitoring
     */
    startPerformanceMonitoring() {
        setInterval(() => {
            this.updatePerformanceMetrics();
            this.applyAdaptiveOptimizations();
            this.cleanupResources();
        }, this.config.metricsInterval);
    }

    updatePerformanceMetrics() {
        // Simulate system metrics (in real implementation, use actual system monitoring)
        this.metrics.performance.memoryUsage = this.getMemoryUsage();
        this.metrics.performance.cpuUsage = this.getCPUUsage();
        this.metrics.performance.throughput = this.calculateThroughput();
        
        // Store performance history for trend analysis
        this.performanceHistory.push({
            timestamp: Date.now(),
            ...this.metrics.performance
        });

        // Keep only last 100 entries
        if (this.performanceHistory.length > 100) {
            this.performanceHistory.shift();
        }
    }

    applyAdaptiveOptimizations() {
        const { memoryUsage, cpuUsage } = this.metrics.performance;

        // Adaptive batch size based on system load
        if (cpuUsage > this.config.cpuThreshold) {
            this.config.batchSize = Math.max(10, this.config.batchSize - 10);
            this.config.messageThrottleMs = Math.min(1000, this.config.messageThrottleMs + 50);
        } else if (cpuUsage < 50) {
            this.config.batchSize = Math.min(100, this.config.batchSize + 5);
            this.config.messageThrottleMs = Math.max(50, this.config.messageThrottleMs - 25);
        }

        // Memory-based optimizations
        if (memoryUsage > this.config.memoryThreshold) {
            this.aggressiveCleanup();
            // Reduce cache sizes
            this.compressionCache.clear();
        }

        // Connection throttling based on load
        if (this.metrics.connections.current > this.config.maxConcurrentConnections * 0.9) {
            this.throttleNewConnections = true;
        } else if (this.metrics.connections.current < this.config.maxConcurrentConnections * 0.7) {
            this.throttleNewConnections = false;
        }
    }

    /**
     * Utility Methods
     */
    getThrottleDelay(priority) {
        const baseDelay = this.config.messageThrottleMs;
        switch (priority) {
            case 'critical': return 0;
            case 'high': return baseDelay * 0.5;
            case 'medium': return baseDelay;
            case 'low': return baseDelay * 2;
            default: return baseDelay;
        }
    }

    sendMessage(message) {
        this.metrics.messages.sent++;
        const startTime = Date.now();
        
        // Simulate sending (in real implementation, send via WebSocket)
        return new Promise((resolve) => {
            setTimeout(() => {
                const latency = Date.now() - startTime;
                this.updateLatencyMetrics(latency);
                resolve({ sent: true, messageId: message.id, latency });
            }, 1);
        });
    }

    broadcastBatch(messages) {
        messages.forEach(message => {
            this.sendMessage(message);
        });
    }

    sendBatchToConnection(messages, connectionId) {
        const connection = this.connectionPool.get(connectionId);
        if (connection && connection.readyState === 1) {
            messages.forEach(message => {
                this.sendMessage(message);
            });
        } else {
            // Connection not available, re-queue messages
            messages.forEach(message => {
                message.retries++;
                if (message.retries < 3) {
                    this.queueMessage(message);
                } else {
                    this.metrics.messages.dropped++;
                }
            });
        }
    }

    updateLatencyMetrics(latency) {
        if (this.metrics.messages.avgLatency === 0) {
            this.metrics.messages.avgLatency = latency;
        } else {
            // Exponential moving average
            this.metrics.messages.avgLatency = 
                (this.metrics.messages.avgLatency * 0.9) + (latency * 0.1);
        }
    }

    calculateThroughput() {
        const now = Date.now();
        const fiveMinutesAgo = now - (5 * 60 * 1000);
        
        const recentHistory = this.performanceHistory.filter(
            entry => entry.timestamp > fiveMinutesAgo
        );
        
        if (recentHistory.length < 2) return 0;
        
        const totalMessages = this.metrics.messages.sent + this.metrics.messages.received;
        const timeSpan = (now - recentHistory[0].timestamp) / 1000; // seconds
        
        return timeSpan > 0 ? Math.round(totalMessages / timeSpan) : 0;
    }

    getMemoryUsage() {
        // Simulate memory usage (in real implementation, use process.memoryUsage())
        return Math.random() * 100;
    }

    getCPUUsage() {
        // Simulate CPU usage (in real implementation, use system monitoring)
        return Math.random() * 100;
    }

    generateCacheKey(data) {
        // Simple hash function for cache keys
        let hash = 0;
        for (let i = 0; i < data.length; i++) {
            const char = data.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString();
    }

    cleanupConnection(connectionId) {
        // Clean up resources associated with connection
        this.messageQueue.forEach((queue, queueKey) => {
            const filteredQueue = queue.filter(msg => msg.connectionId !== connectionId);
            this.messageQueue.set(queueKey, filteredQueue);
        });
    }

    cleanupCompressionCache() {
        const now = Date.now();
        const maxAge = 10 * 60 * 1000; // 10 minutes
        
        this.compressionCache.forEach((value, key) => {
            if (now - value.timestamp > maxAge) {
                this.compressionCache.delete(key);
            }
        });
    }

    aggressiveCleanup() {
        // Force cleanup when memory is high
        this.compressionCache.clear();
        
        // Clear old message queues
        this.messageQueue.forEach((queue, queueKey) => {
            if (queue.length === 0) {
                this.messageQueue.delete(queueKey);
            }
        });
        
        // Clear old performance history
        this.performanceHistory = this.performanceHistory.slice(-50);
    }

    cleanupResources() {
        this.cleanupCompressionCache();
        
        // Clean up empty throttle timers
        this.throttleTimers.forEach((timer, key) => {
            if (!timer) {
                this.throttleTimers.delete(key);
            }
        });
    }

    /**
     * Public API for metrics and monitoring
     */
    getMetrics() {
        return {
            ...this.metrics,
            config: { ...this.config },
            queues: {
                messageQueueSize: Array.from(this.messageQueue.values())
                    .reduce((total, queue) => total + queue.length, 0),
                compressionCacheSize: this.compressionCache.size,
                connectionPoolSize: this.connectionPool.size
            },
            performance: {
                ...this.metrics.performance,
                adaptiveOptimizations: {
                    currentBatchSize: this.config.batchSize,
                    currentThrottleMs: this.config.messageThrottleMs,
                    connectionThrottled: this.throttleNewConnections || false
                }
            }
        };
    }

    getPerformanceHistory() {
        return [...this.performanceHistory];
    }

    getOptimizationRecommendations() {
        const recommendations = [];
        const metrics = this.getMetrics();
        
        if (metrics.performance.memoryUsage > 80) {
            recommendations.push({
                type: 'memory',
                priority: 'high',
                message: 'High memory usage detected. Consider reducing cache sizes or batch sizes.'
            });
        }
        
        if (metrics.performance.cpuUsage > 75) {
            recommendations.push({
                type: 'cpu',
                priority: 'medium',
                message: 'High CPU usage. Consider increasing throttle delays or reducing batch processing frequency.'
            });
        }
        
        if (metrics.messages.avgLatency > 1000) {
            recommendations.push({
                type: 'latency',
                priority: 'medium',
                message: 'High message latency detected. Check network conditions and optimize message size.'
            });
        }
        
        if (metrics.optimization.compressionRatio < 10) {
            recommendations.push({
                type: 'compression',
                priority: 'low',
                message: 'Low compression efficiency. Consider adjusting compression thresholds.'
            });
        }
        
        return recommendations;
    }

    // Reset metrics for testing or monitoring
    resetMetrics() {
        this.metrics = {
            connections: { current: this.metrics.connections.current, peak: 0, total: 0 },
            messages: { sent: 0, received: 0, queued: 0, dropped: 0, avgLatency: 0 },
            performance: { memoryUsage: 0, cpuUsage: 0, throughput: 0, errorRate: 0 },
            optimization: { compressionRatio: 0, batchingEfficiency: 0, throttledMessages: 0 }
        };
    }
}

module.exports = { RealtimePerformanceOptimizer };