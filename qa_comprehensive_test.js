/**
 * TaskFlow Pro - QA Comprehensive End-to-End Testing
 * Multi-Persona Ultra-Think Session Validation
 */

const axios = require('axios');
const { performance } = require('perf_hooks');

const BACKEND_URL = 'http://192.168.20.10:7812';
const FRONTEND_URL = 'http://192.168.20.10:8888';

class TaskFlowQAValidator {
    constructor() {
        this.results = {
            frontend: {},
            backend: {},
            database: {},
            security: {},
            performance: {},
            monitoring: {},
            errors: []
        };
    }

    async runCompleteValidation() {
        console.log('🧪 [QA] TaskFlow Pro End-to-End Validation');
        console.log('===============================================');
        
        try {
            await this.testFrontendResponsiveness();
            await this.testBackendAPIs();
            await this.testLocalDatabaseIntegration();
            await this.testSecurityHeaders();
            await this.testPerformanceMetrics();
            await this.testMonitoringEndpoints();
            await this.testTokenStatus();
            
            this.generateReport();
        } catch (error) {
            console.error('❌ Critical Error:', error.message);
            this.results.errors.push(error.message);
        }
    }

    async testFrontendResponsiveness() {
        console.log('\n📱 Testing Frontend Responsiveness...');
        
        const start = performance.now();
        try {
            const response = await axios.get(FRONTEND_URL, { timeout: 5000 });
            const end = performance.now();
            
            this.results.frontend = {
                status: response.status,
                response_time: Math.round(end - start),
                content_length: response.data.length,
                success: response.status === 200
            };
            
            console.log(`✅ Frontend: ${this.results.frontend.response_time}ms | Status: ${this.results.frontend.status}`);
        } catch (error) {
            this.results.frontend = { success: false, error: error.message };
            console.log('❌ Frontend test failed:', error.message);
        }
    }

    async testBackendAPIs() {
        console.log('\n🔧 Testing Backend API Endpoints...');
        
        const endpoints = [
            '/health',
            '/api/v2/system/status',
            '/api/v2/local/dashboard-data',
            '/api/v2/system/metrics'
        ];

        for (const endpoint of endpoints) {
            try {
                const start = performance.now();
                const response = await axios.get(`${BACKEND_URL}${endpoint}`, { timeout: 10000 });
                const end = performance.now();
                
                const result = {
                    status: response.status,
                    response_time: Math.round(end - start),
                    success: response.status === 200,
                    data_size: JSON.stringify(response.data).length
                };
                
                this.results.backend[endpoint] = result;
                console.log(`✅ ${endpoint}: ${result.response_time}ms | Status: ${result.status}`);
            } catch (error) {
                this.results.backend[endpoint] = { success: false, error: error.message };
                console.log(`❌ ${endpoint}: ${error.message}`);
            }
        }
    }

    async testLocalDatabaseIntegration() {
        console.log('\n💾 Testing Local Database Integration...');
        
        try {
            const response = await axios.get(`${BACKEND_URL}/api/v2/local/dashboard-data`);
            const data = response.data;
            
            this.results.database = {
                success: data.success,
                teams_count: data.data?.teams?.length || 0,
                spaces_count: data.data?.spaces?.length || 0,
                tasks_count: data.data?.tasks?.length || 0,
                last_synced: data.data?.teams?.[0]?.last_synced || null,
                data_integrity: data.success && data.data?.teams?.length > 0
            };
            
            console.log(`✅ Database: ${this.results.database.tasks_count} tasks | ${this.results.database.teams_count} teams`);
            console.log(`   Last sync: ${this.results.database.last_synced}`);
        } catch (error) {
            this.results.database = { success: false, error: error.message };
            console.log('❌ Database test failed:', error.message);
        }
    }

    async testSecurityHeaders() {
        console.log('\n🛡️ Testing Security Headers...');
        
        try {
            const response = await axios.get(BACKEND_URL, { timeout: 5000 });
            const headers = response.headers;
            
            this.results.security = {
                csp: !!headers['content-security-policy'],
                xframe: !!headers['x-frame-options'],
                xcto: !!headers['x-content-type-options'],
                powered_by_hidden: !headers['x-powered-by'],
                security_score: 0
            };
            
            // Calculate security score
            Object.keys(this.results.security).forEach(key => {
                if (key !== 'security_score' && this.results.security[key]) {
                    this.results.security.security_score += 25;
                }
            });
            
            console.log(`✅ Security Score: ${this.results.security.security_score}%`);
        } catch (error) {
            this.results.security = { success: false, error: error.message };
            console.log('❌ Security test failed:', error.message);
        }
    }

    async testPerformanceMetrics() {
        console.log('\n🚀 Testing Performance Metrics...');
        
        const tests = [];
        const iterations = 5;
        
        for (let i = 0; i < iterations; i++) {
            try {
                const start = performance.now();
                await axios.get(`${BACKEND_URL}/api/v2/local/dashboard-data`);
                const end = performance.now();
                tests.push(end - start);
            } catch (error) {
                console.log(`❌ Performance test ${i+1} failed`);
            }
        }
        
        if (tests.length > 0) {
            this.results.performance = {
                average_response: Math.round(tests.reduce((a, b) => a + b) / tests.length),
                min_response: Math.round(Math.min(...tests)),
                max_response: Math.round(Math.max(...tests)),
                tests_completed: tests.length,
                performance_grade: this.getPerformanceGrade(tests)
            };
            
            console.log(`✅ Performance: ${this.results.performance.average_response}ms avg | Grade: ${this.results.performance.performance_grade}`);
        }
    }

    async testMonitoringEndpoints() {
        console.log('\n📊 Testing Monitoring Systems...');
        
        try {
            const healthResponse = await axios.get(`${BACKEND_URL}/health`);
            const metricsResponse = await axios.get(`${BACKEND_URL}/api/v2/system/metrics`);
            
            this.results.monitoring = {
                health_check: healthResponse.status === 200,
                metrics_available: metricsResponse.status === 200,
                uptime: metricsResponse.data?.uptime || null,
                memory_usage: metricsResponse.data?.memory || null,
                monitoring_operational: true
            };
            
            console.log(`✅ Monitoring: Health ${this.results.monitoring.health_check ? '✓' : '✗'} | Metrics ${this.results.monitoring.metrics_available ? '✓' : '✗'}`);
        } catch (error) {
            this.results.monitoring = { success: false, error: error.message };
            console.log('❌ Monitoring test failed:', error.message);
        }
    }

    async testTokenStatus() {
        console.log('\n🔐 Testing Token & Authentication...');
        
        try {
            const response = await axios.get(`${BACKEND_URL}/api/v2/system/status`);
            const status = response.data;
            
            this.results.authentication = {
                clickup_connected: status.clickup_connected,
                time_until_expiry: status.time_until_expiry_minutes,
                is_operational: status.is_operational,
                needs_refresh: status.time_until_expiry_minutes < 60,
                critical_status: status.time_until_expiry_minutes < 30
            };
            
            console.log(`✅ Auth: Connected ${this.results.authentication.clickup_connected ? '✓' : '✗'} | ${this.results.authentication.time_until_expiry}min remaining`);
            
            if (this.results.authentication.critical_status) {
                console.log('⚠️  CRITICAL: Token expires in <30 minutes!');
            }
        } catch (error) {
            this.results.authentication = { success: false, error: error.message };
            console.log('❌ Authentication test failed:', error.message);
        }
    }

    getPerformanceGrade(tests) {
        const avg = tests.reduce((a, b) => a + b) / tests.length;
        if (avg < 50) return 'A+ (Excellent)';
        if (avg < 100) return 'A (Very Good)';
        if (avg < 200) return 'B (Good)';
        if (avg < 500) return 'C (Fair)';
        return 'D (Poor)';
    }

    generateReport() {
        console.log('\n📋 QA VALIDATION REPORT');
        console.log('======================');
        
        const overallScore = this.calculateOverallScore();
        
        console.log(`\n🏆 OVERALL SCORE: ${overallScore}%`);
        console.log(`📊 SYSTEM STATUS: ${overallScore >= 90 ? 'EXCELLENT' : overallScore >= 80 ? 'GOOD' : overallScore >= 70 ? 'FAIR' : 'NEEDS ATTENTION'}`);
        
        // Detailed breakdown
        console.log('\n📈 COMPONENT SCORES:');
        console.log(`   Frontend: ${this.results.frontend.success ? '✅' : '❌'} (${this.results.frontend.response_time || 'N/A'}ms)`);
        console.log(`   Backend: ${Object.values(this.results.backend).every(r => r.success) ? '✅' : '❌'}`);
        console.log(`   Database: ${this.results.database.success ? '✅' : '❌'} (${this.results.database.tasks_count || 0} tasks)`);
        console.log(`   Security: ${this.results.security.security_score >= 75 ? '✅' : '❌'} (${this.results.security.security_score || 0}%)`);
        console.log(`   Performance: ${this.results.performance.performance_grade ? '✅' : '❌'} (${this.results.performance.average_response || 'N/A'}ms)`);
        console.log(`   Monitoring: ${this.results.monitoring.monitoring_operational ? '✅' : '❌'}`);
        
        // Critical issues
        if (this.results.authentication?.critical_status) {
            console.log('\n🚨 CRITICAL ISSUES:');
            console.log(`   - OAuth token expires in ${this.results.authentication.time_until_expiry} minutes!`);
        }
        
        if (this.results.errors.length > 0) {
            console.log('\n❌ ERRORS FOUND:');
            this.results.errors.forEach(error => console.log(`   - ${error}`));
        }
        
        console.log('\n✅ VALIDATION COMPLETE');
        
        return this.results;
    }

    calculateOverallScore() {
        let score = 0;
        let components = 0;
        
        // Frontend (15%)
        if (this.results.frontend.success) score += 15;
        components++;
        
        // Backend APIs (20%)
        const backendSuccessRate = Object.values(this.results.backend).filter(r => r.success).length / 
                                   Object.values(this.results.backend).length;
        score += Math.round(backendSuccessRate * 20);
        components++;
        
        // Database (20%)
        if (this.results.database.success && this.results.database.tasks_count > 0) score += 20;
        components++;
        
        // Security (15%)
        score += Math.round((this.results.security.security_score || 0) * 0.15);
        components++;
        
        // Performance (15%)
        if (this.results.performance.average_response) {
            const perfScore = this.results.performance.average_response < 100 ? 15 : 
                             this.results.performance.average_response < 200 ? 12 : 
                             this.results.performance.average_response < 500 ? 8 : 5;
            score += perfScore;
        }
        components++;
        
        // Monitoring (15%)
        if (this.results.monitoring.monitoring_operational) score += 15;
        components++;
        
        return Math.round(score);
    }
}

// Run validation if called directly
if (require.main === module) {
    const validator = new TaskFlowQAValidator();
    validator.runCompleteValidation().catch(console.error);
}

module.exports = TaskFlowQAValidator;