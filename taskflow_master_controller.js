/**
 * TaskFlow Pro - Master System Controller
 * Centralized control for all system components
 */

const { UnifiedSecurityFramework } = require('./unified_security_framework');
const { UnifiedPerformanceEngine } = require('./unified_performance_engine');
const { UnifiedMonitoringSystem } = require('./unified_monitoring_system');
const { UnifiedFrontendOptimizations } = require('./unified_frontend_optimizations');

class TaskFlowMasterController {
    constructor(config = {}) {
        this.config = {
            backendUrl: config.backendUrl || 'http://192.168.20.10:7812',
            frontendUrl: config.frontendUrl || 'http://192.168.20.10:8888',
            autoStart: config.autoStart !== false
        };
        
        // Initialize all subsystems
        this.security = new UnifiedSecurityFramework(this.config);
        this.performance = new UnifiedPerformanceEngine(this.config);
        this.monitoring = new UnifiedMonitoringSystem(this.config);
        this.frontend = new UnifiedFrontendOptimizations(this.config);
        
        this.status = {
            initialized: false,
            running: false,
            lastHealthCheck: null
        };
    }

    async initialize() {
        console.log('🚀 Initializing TaskFlow Pro Master Controller...');
        
        try {
            // Start monitoring system
            await this.monitoring.start();
            console.log('   ✅ Monitoring system started');
            
            // Initialize performance engine
            await this.performance.optimize();
            console.log('   ✅ Performance engine optimized');
            
            // Validate security
            const securityResult = await this.security.validateSecurity();
            console.log('   ✅ Security validation completed - Score:', securityResult.score);
            
            this.status.initialized = true;
            this.status.running = true;
            this.status.lastHealthCheck = new Date().toISOString();
            
            console.log('🎉 TaskFlow Pro Master Controller initialized successfully!');
            
            return {
                status: 'initialized',
                components: {
                    security: securityResult.score,
                    performance: 'optimized',
                    monitoring: 'running',
                    frontend: 'ready'
                }
            };
            
        } catch (error) {
            console.error('❌ Initialization failed:', error.message);
            throw error;
        }
    }

    async getSystemStatus() {
        const systemStatus = {
            controller: this.status,
            security: await this.security.validateSecurity(),
            performance: this.performance.getMetrics(),
            monitoring: this.monitoring.getHealthStatus(),
            frontend: this.frontend.getMetrics()
        };
        
        const overallHealth = this.calculateOverallHealth(systemStatus);
        
        return {
            ...systemStatus,
            overallHealth: overallHealth,
            timestamp: new Date().toISOString()
        };
    }

    calculateOverallHealth(status) {
        let score = 100;
        
        if (!status.controller.running) score -= 50;
        if (status.security.score < 80) score -= 20;
        if (!status.monitoring.healthy) score -= 20;
        if (status.performance.hitRate < 70) score -= 10;
        
        return {
            score: Math.max(0, score),
            status: score >= 90 ? 'Excellent' : score >= 70 ? 'Good' : score >= 50 ? 'Fair' : 'Poor'
        };
    }

    async runHealthCheck() {
        console.log('🔍 Running comprehensive health check...');
        
        const healthCheck = {
            timestamp: new Date().toISOString(),
            security: await this.security.validateSecurity(),
            performance: await this.performance.measureBaseline(),
            monitoring: this.monitoring.getHealthStatus(),
            frontend: this.frontend.getMetrics()
        };
        
        this.status.lastHealthCheck = healthCheck.timestamp;
        
        console.log('✅ Health check completed');
        return healthCheck;
    }

    async shutdown() {
        console.log('🛑 Shutting down TaskFlow Pro Master Controller...');
        
        try {
            await this.monitoring.stop();
            this.status.running = false;
            console.log('✅ Shutdown completed');
        } catch (error) {
            console.error('❌ Shutdown error:', error.message);
        }
    }
}

// Export for use in other modules
module.exports = { TaskFlowMasterController };

// Auto-initialize if run directly
if (require.main === module) {
    const controller = new TaskFlowMasterController();
    controller.initialize().catch(console.error);
    
    // Graceful shutdown
    process.on('SIGINT', async () => {
        await controller.shutdown();
        process.exit(0);
    });
}