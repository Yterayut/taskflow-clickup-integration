// TaskFlow Pro Performance Monitor
// Real-time performance tracking and optimization

class PerformanceMonitor {
    constructor() {
        this.metrics = {
            apiCalls: 0,
            totalResponseTime: 0,
            errors: 0,
            cacheHits: 0,
            cacheMisses: 0
        };
        this.startTime = Date.now();
        this.isMonitoring = false;
    }

    start() {
        if (this.isMonitoring) return;
        
        this.isMonitoring = true;
        console.log('🚀 TaskFlow Performance Monitor started');
        
        // Monitor API calls
        this.monitorFetch();
        
        // Report metrics every 30 seconds
        setInterval(() => {
            this.reportMetrics();
        }, 30000);
    }

    monitorFetch() {
        const originalFetch = window.fetch;
        const monitor = this;
        
        window.fetch = async function(...args) {
            const start = Date.now();
            monitor.metrics.apiCalls++;
            
            try {
                const response = await originalFetch.apply(this, args);
                const duration = Date.now() - start;
                monitor.metrics.totalResponseTime += duration;
                
                if (!response.ok) {
                    monitor.metrics.errors++;
                }
                
                return response;
            } catch (error) {
                monitor.metrics.errors++;
                throw error;
            }
        };
    }

    recordCacheHit() {
        this.metrics.cacheHits++;
    }

    recordCacheMiss() {
        this.metrics.cacheMisses++;
    }

    getAverageResponseTime() {
        return this.metrics.apiCalls > 0 
            ? Math.round(this.metrics.totalResponseTime / this.metrics.apiCalls)
            : 0;
    }

    getCacheHitRate() {
        const totalCacheAttempts = this.metrics.cacheHits + this.metrics.cacheMisses;
        return totalCacheAttempts > 0 
            ? Math.round((this.metrics.cacheHits / totalCacheAttempts) * 100)
            : 0;
    }

    getErrorRate() {
        return this.metrics.apiCalls > 0
            ? Math.round((this.metrics.errors / this.metrics.apiCalls) * 100)
            : 0;
    }

    reportMetrics() {
        const uptime = Math.round((Date.now() - this.startTime) / 1000);
        
        console.log(`📊 TaskFlow Performance Report (${uptime}s uptime)`);
        console.log(`   API Calls: ${this.metrics.apiCalls}`);
        console.log(`   Avg Response: ${this.getAverageResponseTime()}ms`);
        console.log(`   Cache Hit Rate: ${this.getCacheHitRate()}%`);
        console.log(`   Error Rate: ${this.getErrorRate()}%`);
    }

    getMetrics() {
        return {
            ...this.metrics,
            averageResponseTime: this.getAverageResponseTime(),
            cacheHitRate: this.getCacheHitRate(),
            errorRate: this.getErrorRate(),
            uptime: Math.round((Date.now() - this.startTime) / 1000)
        };
    }
}

// Auto-start performance monitoring
window.performanceMonitor = new PerformanceMonitor();
window.performanceMonitor.start();