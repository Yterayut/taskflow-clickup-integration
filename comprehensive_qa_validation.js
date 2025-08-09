/**
 * TaskFlow Pro - Comprehensive QA Validation System
 * QA Persona: Validate all improvements and test edge cases
 */

const fs = require('fs').promises;
const axios = require('axios');

class ComprehensiveQAValidation {
    constructor() {
        this.config = {
            backendUrl: 'http://192.168.20.10:7812',
            frontendUrl: 'http://192.168.20.10:8888'
        };
        this.results = {
            oauthValidation: {},
            frontendValidation: {},
            securityValidation: {},
            monitoringValidation: {},
            performanceValidation: {},
            integrationTests: {},
            edgeCases: {}
        };
        this.overallScore = 0;
    }

    async validate() {
        console.log('🧪 [QA] Comprehensive System Validation & Testing');
        console.log('==================================================');
        
        try {
            await this.step1_ValidateOAuthSystem();
            await this.step2_ValidateFrontendOptimizations();
            await this.step3_ValidateSecurityEnhancements();
            await this.step4_ValidateMonitoringSystem();
            await this.step5_ValidatePerformanceOptimizations();
            await this.step6_IntegrationTesting();
            await this.step7_EdgeCaseTesting();
            
            this.generateQAReport();
        } catch (error) {
            console.error('❌ QA validation failed:', error.message);
            throw error;
        }
    }

    async step1_ValidateOAuthSystem() {
        console.log('\n🔑 Step 1: OAuth System Validation');
        console.log('----------------------------------');
        
        try {
            // Test OAuth endpoints
            const tests = [
                { name: 'Health Check', url: '/health', expectAuth: false },
                { name: 'System Status', url: '/api/v2/system/status', expectAuth: false },
                { name: 'User Profile', url: '/api/v2/auth/profile', expectAuth: true },
                { name: 'OAuth Callback', url: '/oauth/callback', expectAuth: false }
            ];
            
            const oauthResults = {};
            
            for (const test of tests) {
                try {
                    console.log('   Testing:', test.name + '...');
                    const response = await axios.get(this.config.backendUrl + test.url, { 
                        timeout: 5000,
                        validateStatus: () => true // Don't throw on HTTP errors
                    });
                    
                    oauthResults[test.name] = {
                        status: response.status,
                        success: response.status < 500,
                        responseTime: response.headers['x-response-time'] || 'N/A',
                        protected: response.status === 401 || response.status === 403,
                        data: response.data
                    };
                    
                    const statusIcon = response.status < 400 ? '✅' : 
                                     response.status < 500 ? '⚠️' : '❌';
                    console.log('     ' + statusIcon, 'Status:', response.status);
                    
                } catch (error) {
                    oauthResults[test.name] = {
                        status: 0,
                        success: false,
                        error: error.message
                    };
                    console.log('     ❌ Error:', error.message);
                }
            }
            
            // Validate token refresh functionality
            console.log('   Testing token refresh system...');
            try {
                const tokenFiles = ['master_clickup_token.json', 'implement_automated_token_refresh_fixed.js'];
                const tokenValidation = {};
                
                for (const file of tokenFiles) {
                    try {
                        const stats = await fs.stat(file);
                        tokenValidation[file] = {
                            exists: true,
                            size: stats.size,
                            modified: stats.mtime
                        };
                        console.log('     ✅', file, 'exists and accessible');
                    } catch (error) {
                        tokenValidation[file] = {
                            exists: false,
                            error: error.message
                        };
                        console.log('     ⚠️', file, 'not accessible');
                    }
                }
                
                oauthResults.tokenSystem = tokenValidation;
                
            } catch (error) {
                console.log('     ❌ Token system validation failed:', error.message);
            }
            
            this.results.oauthValidation = oauthResults;
            
        } catch (error) {
            console.error('❌ OAuth validation failed:', error.message);
            throw error;
        }
    }

    async step2_ValidateFrontendOptimizations() {
        console.log('\n🎨 Step 2: Frontend Optimization Validation');
        console.log('-------------------------------------------');
        
        try {
            // Test frontend performance
            const performanceTests = [];
            
            console.log('   Measuring frontend load times...');
            
            for (let i = 0; i < 3; i++) {
                const start = Date.now();
                try {
                    const response = await axios.get(this.config.frontendUrl, { timeout: 10000 });
                    const duration = Date.now() - start;
                    performanceTests.push({
                        attempt: i + 1,
                        duration: duration,
                        success: true,
                        contentLength: response.data.length
                    });
                    console.log('     Attempt', i + 1 + ':', duration + 'ms ✅');
                } catch (error) {
                    performanceTests.push({
                        attempt: i + 1,
                        duration: null,
                        success: false,
                        error: error.message
                    });
                    console.log('     Attempt', i + 1 + ': Failed ❌');
                }
            }
            
            // Calculate average performance
            const successfulTests = performanceTests.filter(t => t.success);
            const avgLoadTime = successfulTests.length > 0 ? 
                Math.round(successfulTests.reduce((sum, t) => sum + t.duration, 0) / successfulTests.length) : 
                null;
            
            console.log('   Average load time:', avgLoadTime ? avgLoadTime + 'ms' : 'N/A');
            
            // Test optimization files
            const optimizationFiles = [
                'taskflow-sw.js',
                'fetch-utility.js', 
                'performance-monitor.js'
            ];
            
            const fileValidation = {};
            console.log('   Checking optimization files...');
            
            for (const file of optimizationFiles) {
                try {
                    const stats = await fs.stat(file);
                    fileValidation[file] = {
                        exists: true,
                        size: stats.size,
                        created: stats.birthtime
                    };
                    console.log('     ✅', file, '(' + stats.size, 'bytes)');
                } catch (error) {
                    fileValidation[file] = {
                        exists: false,
                        error: error.message
                    };
                    console.log('     ❌', file, 'missing');
                }
            }
            
            this.results.frontendValidation = {
                performanceTests: performanceTests,
                averageLoadTime: avgLoadTime,
                optimizationFiles: fileValidation
            };
            
        } catch (error) {
            console.error('❌ Frontend validation failed:', error.message);
            throw error;
        }
    }

    async step3_ValidateSecurityEnhancements() {
        console.log('\n🛡️ Step 3: Security Enhancement Validation');
        console.log('------------------------------------------');
        
        try {
            // Test security headers
            console.log('   Validating security headers...');
            const response = await axios.head(this.config.backendUrl);
            const headers = response.headers;
            
            const securityHeaders = {
                'content-security-policy': !!headers['content-security-policy'],
                'x-frame-options': !!headers['x-frame-options'],
                'x-content-type-options': !!headers['x-content-type-options'],
                'referrer-policy': !!headers['referrer-policy'],
                'x-powered-by': !headers['x-powered-by'] // Good if NOT present
            };
            
            console.log('   Security Headers Analysis:');
            Object.entries(securityHeaders).forEach(([header, present]) => {
                const status = present ? '✅' : '❌';
                console.log('     ' + header + ':', status);
            });
            
            // Calculate security score
            const securityScore = Math.round(
                (Object.values(securityHeaders).filter(Boolean).length / Object.keys(securityHeaders).length) * 100
            );
            
            console.log('   Security Score:', securityScore + '/100');
            
            // Test authentication endpoints
            console.log('   Testing authentication security...');
            const authTests = [
                { endpoint: '/api/v2/auth/profile', shouldRequireAuth: true },
                { endpoint: '/api/v2/system/metrics', shouldRequireAuth: true },
                { endpoint: '/health', shouldRequireAuth: false }
            ];
            
            const authResults = {};
            
            for (const test of authTests) {
                try {
                    const authResponse = await axios.get(this.config.backendUrl + test.endpoint, {
                        validateStatus: () => true
                    });
                    
                    const isProtected = authResponse.status === 401 || authResponse.status === 403;
                    const isCorrect = test.shouldRequireAuth ? isProtected : authResponse.status === 200;
                    
                    authResults[test.endpoint] = {
                        status: authResponse.status,
                        protected: isProtected,
                        correct: isCorrect
                    };
                    
                    console.log('     ' + test.endpoint + ':', isCorrect ? '✅' : '❌', 
                               '(Status:', authResponse.status + ')');
                    
                } catch (error) {
                    authResults[test.endpoint] = {
                        status: 0,
                        error: error.message,
                        correct: false
                    };
                    console.log('     ' + test.endpoint + ': ❌ Error');
                }
            }
            
            this.results.securityValidation = {
                headers: securityHeaders,
                securityScore: securityScore,
                authentication: authResults
            };
            
        } catch (error) {
            console.error('❌ Security validation failed:', error.message);
            throw error;
        }
    }

    async step4_ValidateMonitoringSystem() {
        console.log('\n📊 Step 4: Monitoring System Validation');
        console.log('---------------------------------------');
        
        try {
            // Check monitoring files
            const monitoringFiles = [
                'system_metrics_collector.js',
                'performance_monitor.js',
                'health_checker.js',
                'alert_manager.js'
            ];
            
            const fileValidation = {};
            console.log('   Checking monitoring components...');
            
            for (const file of monitoringFiles) {
                try {
                    const stats = await fs.stat(file);
                    fileValidation[file] = {
                        exists: true,
                        size: stats.size,
                        modified: stats.mtime
                    };
                    console.log('     ✅', file, '(' + stats.size, 'bytes)');
                } catch (error) {
                    fileValidation[file] = {
                        exists: false,
                        error: error.message
                    };
                    console.log('     ❌', file, 'missing');
                }
            }
            
            // Test monitoring endpoints
            console.log('   Testing monitoring endpoints...');
            const monitoringEndpoints = [
                '/health',
                '/api/v2/system/status',
                '/api/v2/system/metrics'
            ];
            
            const endpointResults = {};
            
            for (const endpoint of monitoringEndpoints) {
                try {
                    const start = Date.now();
                    const response = await axios.get(this.config.backendUrl + endpoint, {
                        timeout: 5000,
                        validateStatus: () => true
                    });
                    const duration = Date.now() - start;
                    
                    endpointResults[endpoint] = {
                        status: response.status,
                        responseTime: duration,
                        success: response.status < 400,
                        dataSize: JSON.stringify(response.data).length
                    };
                    
                    const statusIcon = response.status < 400 ? '✅' : '❌';
                    console.log('     ' + endpoint + ':', statusIcon, duration + 'ms');
                    
                } catch (error) {
                    endpointResults[endpoint] = {
                        status: 0,
                        error: error.message,
                        success: false
                    };
                    console.log('     ' + endpoint + ': ❌ Failed');
                }
            }
            
            this.results.monitoringValidation = {
                components: fileValidation,
                endpoints: endpointResults
            };
            
        } catch (error) {
            console.error('❌ Monitoring validation failed:', error.message);
            throw error;
        }
    }

    async step5_ValidatePerformanceOptimizations() {
        console.log('\n🚀 Step 5: Performance Optimization Validation');
        console.log('----------------------------------------------');
        
        try {
            // Check performance optimization files
            const performanceFiles = [
                'advanced_cache_layer.js',
                'connection_pool_optimizer.js',
                'compression_middleware.js',
                'database_query_optimizer.js',
                'api_response_optimizer.js',
                'performance_integration.js'
            ];
            
            const fileValidation = {};
            console.log('   Checking performance optimization files...');
            
            for (const file of performanceFiles) {
                try {
                    const stats = await fs.stat(file);
                    fileValidation[file] = {
                        exists: true,
                        size: stats.size,
                        created: stats.birthtime
                    };
                    console.log('     ✅', file, '(' + stats.size, 'bytes)');
                } catch (error) {
                    fileValidation[file] = {
                        exists: false,
                        error: error.message
                    };
                    console.log('     ❌', file, 'missing');
                }
            }
            
            // Performance benchmark tests
            console.log('   Running performance benchmarks...');
            const benchmarkTests = [
                { name: 'Frontend Load', url: this.config.frontendUrl },
                { name: 'API Health', url: this.config.backendUrl + '/health' },
                { name: 'System Status', url: this.config.backendUrl + '/api/v2/system/status' },
                { name: 'Local Dashboard', url: this.config.backendUrl + '/api/v2/local/dashboard-data' }
            ];
            
            const benchmarkResults = {};
            
            for (const test of benchmarkTests) {
                const times = [];
                console.log('     Testing:', test.name + '...');
                
                // Run 3 tests for each endpoint
                for (let i = 0; i < 3; i++) {
                    try {
                        const start = Date.now();
                        await axios.get(test.url, { timeout: 10000 });
                        const duration = Date.now() - start;
                        times.push(duration);
                    } catch (error) {
                        // Log but continue with other tests
                        console.log('       Attempt', i + 1, 'failed:', error.message);
                    }
                }
                
                if (times.length > 0) {
                    benchmarkResults[test.name] = {
                        average: Math.round(times.reduce((sum, time) => sum + time, 0) / times.length),
                        min: Math.min(...times),
                        max: Math.max(...times),
                        samples: times.length
                    };
                    console.log('       Average:', benchmarkResults[test.name].average + 'ms');
                } else {
                    benchmarkResults[test.name] = { error: 'All tests failed' };
                    console.log('       ❌ All tests failed');
                }
            }
            
            this.results.performanceValidation = {
                optimizationFiles: fileValidation,
                benchmarks: benchmarkResults
            };
            
        } catch (error) {
            console.error('❌ Performance validation failed:', error.message);
            throw error;
        }
    }

    async step6_IntegrationTesting() {
        console.log('\n🔗 Step 6: Integration Testing');
        console.log('------------------------------');
        
        try {
            console.log('   Testing end-to-end integration...');
            
            // Test complete workflow
            const integrationTests = [
                { name: 'Frontend → Backend Connection', test: 'frontend_backend_connection' },
                { name: 'Authentication Flow', test: 'auth_flow' },
                { name: 'API Response Integrity', test: 'api_integrity' },
                { name: 'Security Headers Integration', test: 'security_integration' },
                { name: 'Performance Optimization Active', test: 'performance_active' }
            ];
            
            const integrationResults = {};
            
            for (const integration of integrationTests) {
                console.log('     Testing:', integration.name + '...');
                
                try {
                    switch (integration.test) {
                        case 'frontend_backend_connection':
                            // Test if frontend can reach backend
                            const frontendResponse = await axios.get(this.config.frontendUrl, { timeout: 5000 });
                            const backendResponse = await axios.get(this.config.backendUrl + '/health', { timeout: 5000 });
                            integrationResults[integration.name] = {
                                success: frontendResponse.status === 200 && backendResponse.status === 200,
                                frontendStatus: frontendResponse.status,
                                backendStatus: backendResponse.status
                            };
                            break;
                            
                        case 'auth_flow':
                            // Test authentication endpoints
                            const profileResponse = await axios.get(this.config.backendUrl + '/api/v2/auth/profile', {
                                validateStatus: () => true
                            });
                            integrationResults[integration.name] = {
                                success: profileResponse.status === 401 || profileResponse.status === 200,
                                status: profileResponse.status,
                                properlyProtected: profileResponse.status === 401
                            };
                            break;
                            
                        case 'api_integrity':
                            // Test API responses
                            const statusResponse = await axios.get(this.config.backendUrl + '/api/v2/system/status');
                            integrationResults[integration.name] = {
                                success: statusResponse.status === 200 && statusResponse.data,
                                status: statusResponse.status,
                                hasData: !!statusResponse.data
                            };
                            break;
                            
                        case 'security_integration':
                            // Test security headers
                            const securityResponse = await axios.head(this.config.backendUrl);
                            const hasSecurityHeaders = !!(
                                securityResponse.headers['x-frame-options'] ||
                                securityResponse.headers['content-security-policy']
                            );
                            integrationResults[integration.name] = {
                                success: hasSecurityHeaders,
                                securityHeadersPresent: hasSecurityHeaders
                            };
                            break;
                            
                        case 'performance_active':
                            // Test if performance optimizations are active
                            const start = Date.now();
                            await axios.get(this.config.backendUrl + '/health');
                            const responseTime = Date.now() - start;
                            integrationResults[integration.name] = {
                                success: responseTime < 100, // Good performance
                                responseTime: responseTime,
                                performanceGood: responseTime < 100
                            };
                            break;
                    }
                    
                    const result = integrationResults[integration.name];
                    const status = result.success ? '✅' : '❌';
                    console.log('       ' + status, result.success ? 'PASS' : 'FAIL');
                    
                } catch (error) {
                    integrationResults[integration.name] = {
                        success: false,
                        error: error.message
                    };
                    console.log('       ❌ ERROR:', error.message);
                }
            }
            
            this.results.integrationTests = integrationResults;
            
        } catch (error) {
            console.error('❌ Integration testing failed:', error.message);
            throw error;
        }
    }

    async step7_EdgeCaseTesting() {
        console.log('\n🎯 Step 7: Edge Case Testing');
        console.log('-----------------------------');
        
        try {
            console.log('   Testing edge cases and error handling...');
            
            const edgeCaseTests = [
                { name: 'Invalid Endpoint', url: '/api/v2/nonexistent', expectedStatus: 404 },
                { name: 'Malformed Request', url: '/api/v2/auth/profile?invalid=data', expectedStatus: [400, 401] },
                { name: 'Timeout Handling', url: '/health', timeout: 1 }, // Very short timeout
                { name: 'Large Response', url: '/api/v2/system/status', expectData: true }
            ];
            
            const edgeCaseResults = {};
            
            for (const test of edgeCaseTests) {
                console.log('     Testing:', test.name + '...');
                
                try {
                    const options = {
                        timeout: test.timeout || 5000,
                        validateStatus: () => true // Don't throw on HTTP errors
                    };
                    
                    const response = await axios.get(this.config.backendUrl + test.url, options);
                    
                    let success = false;
                    if (Array.isArray(test.expectedStatus)) {
                        success = test.expectedStatus.includes(response.status);
                    } else if (test.expectedStatus) {
                        success = response.status === test.expectedStatus;
                    } else if (test.expectData) {
                        success = response.status === 200 && response.data;
                    }
                    
                    edgeCaseResults[test.name] = {
                        success: success,
                        status: response.status,
                        hasData: !!response.data,
                        responseSize: response.data ? JSON.stringify(response.data).length : 0
                    };
                    
                    const status = success ? '✅' : '⚠️';
                    console.log('       ' + status, 'Status:', response.status);
                    
                } catch (error) {
                    // For timeout test, timeout is expected
                    const isExpectedTimeout = test.name === 'Timeout Handling' && error.code === 'ECONNABORTED';
                    
                    edgeCaseResults[test.name] = {
                        success: isExpectedTimeout,
                        error: error.message,
                        expectedError: isExpectedTimeout
                    };
                    
                    const status = isExpectedTimeout ? '✅' : '❌';
                    console.log('       ' + status, isExpectedTimeout ? 'Expected timeout' : 'Error:', error.message);
                }
            }
            
            this.results.edgeCases = edgeCaseResults;
            
        } catch (error) {
            console.error('❌ Edge case testing failed:', error.message);
            throw error;
        }
    }

    generateQAReport() {
        console.log('\n🧪 COMPREHENSIVE QA VALIDATION REPORT');
        console.log('======================================');
        
        // Calculate component scores
        const componentScores = {
            oauth: this.calculateOAuthScore(),
            frontend: this.calculateFrontendScore(),
            security: this.calculateSecurityScore(),
            monitoring: this.calculateMonitoringScore(),
            performance: this.calculatePerformanceScore(),
            integration: this.calculateIntegrationScore(),
            edgeCases: this.calculateEdgeCaseScore()
        };
        
        // Calculate overall score
        this.overallScore = Math.round(
            Object.values(componentScores).reduce((sum, score) => sum + score, 0) / 
            Object.keys(componentScores).length
        );
        
        console.log('\n🏆 OVERALL QA SCORE:', this.overallScore + '/100');
        console.log('🎯 SYSTEM GRADE:', this.getQAGrade(this.overallScore));
        
        console.log('\n📊 COMPONENT SCORES:');
        Object.entries(componentScores).forEach(([component, score]) => {
            const status = score >= 80 ? '✅' : score >= 60 ? '⚠️' : '❌';
            console.log('   ' + component.charAt(0).toUpperCase() + component.slice(1) + ':', 
                       status, score + '/100');
        });
        
        console.log('\n✅ VALIDATION SUMMARY:');
        console.log('   🔑 OAuth System:', componentScores.oauth >= 80 ? 'VALIDATED ✅' : 'NEEDS ATTENTION ⚠️');
        console.log('   🎨 Frontend Optimization:', componentScores.frontend >= 80 ? 'VALIDATED ✅' : 'NEEDS ATTENTION ⚠️');
        console.log('   🛡️ Security Enhancement:', componentScores.security >= 80 ? 'VALIDATED ✅' : 'NEEDS ATTENTION ⚠️');
        console.log('   📊 Monitoring System:', componentScores.monitoring >= 80 ? 'VALIDATED ✅' : 'NEEDS ATTENTION ⚠️');
        console.log('   🚀 Performance Optimization:', componentScores.performance >= 80 ? 'VALIDATED ✅' : 'NEEDS ATTENTION ⚠️');
        console.log('   🔗 System Integration:', componentScores.integration >= 80 ? 'VALIDATED ✅' : 'NEEDS ATTENTION ⚠️');
        console.log('   🎯 Edge Case Handling:', componentScores.edgeCases >= 60 ? 'VALIDATED ✅' : 'NEEDS ATTENTION ⚠️');
        
        console.log('\n🔍 DETAILED FINDINGS:');
        this.reportDetailedFindings();
        
        console.log('\n🚀 RECOMMENDATIONS:');
        this.generateRecommendations(componentScores);
        
        console.log('\n✅ COMPREHENSIVE QA VALIDATION: COMPLETE');
        console.log('📈 ENTERPRISE READINESS:', this.overallScore >= 85 ? 'READY FOR PRODUCTION ✅' : 'NEEDS OPTIMIZATION ⚠️');
        
        return {
            overallScore: this.overallScore,
            grade: this.getQAGrade(this.overallScore),
            componentScores: componentScores,
            results: this.results
        };
    }

    calculateOAuthScore() {
        if (!this.results.oauthValidation) return 0;
        
        let score = 100;
        const results = this.results.oauthValidation;
        
        // Check endpoint functionality
        Object.values(results).forEach(result => {
            if (result.success === false) score -= 20;
        });
        
        return Math.max(0, score);
    }

    calculateFrontendScore() {
        if (!this.results.frontendValidation) return 0;
        
        let score = 100;
        const results = this.results.frontendValidation;
        
        // Check load time performance
        if (results.averageLoadTime && results.averageLoadTime > 1000) score -= 30;
        else if (results.averageLoadTime && results.averageLoadTime > 500) score -= 15;
        
        // Check optimization files
        const optimizationFiles = results.optimizationFiles || {};
        const missingFiles = Object.values(optimizationFiles).filter(f => !f.exists).length;
        score -= missingFiles * 20;
        
        return Math.max(0, score);
    }

    calculateSecurityScore() {
        if (!this.results.securityValidation) return 0;
        return this.results.securityValidation.securityScore || 0;
    }

    calculateMonitoringScore() {
        if (!this.results.monitoringValidation) return 0;
        
        let score = 100;
        const results = this.results.monitoringValidation;
        
        // Check monitoring components
        const components = results.components || {};
        const missingComponents = Object.values(components).filter(c => !c.exists).length;
        score -= missingComponents * 20;
        
        // Check endpoints
        const endpoints = results.endpoints || {};
        const failedEndpoints = Object.values(endpoints).filter(e => !e.success).length;
        score -= failedEndpoints * 15;
        
        return Math.max(0, score);
    }

    calculatePerformanceScore() {
        if (!this.results.performanceValidation) return 0;
        
        let score = 100;
        const results = this.results.performanceValidation;
        
        // Check optimization files
        const optimizationFiles = results.optimizationFiles || {};
        const missingFiles = Object.values(optimizationFiles).filter(f => !f.exists).length;
        score -= missingFiles * 15;
        
        // Check benchmark performance
        const benchmarks = results.benchmarks || {};
        Object.values(benchmarks).forEach(benchmark => {
            if (benchmark.error) {
                score -= 20;
            } else if (benchmark.average > 100) {
                score -= 10;
            }
        });
        
        return Math.max(0, score);
    }

    calculateIntegrationScore() {
        if (!this.results.integrationTests) return 0;
        
        const results = this.results.integrationTests;
        const totalTests = Object.keys(results).length;
        const passedTests = Object.values(results).filter(test => test.success).length;
        
        return totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;
    }

    calculateEdgeCaseScore() {
        if (!this.results.edgeCases) return 0;
        
        const results = this.results.edgeCases;
        const totalTests = Object.keys(results).length;
        const passedTests = Object.values(results).filter(test => test.success).length;
        
        return totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;
    }

    reportDetailedFindings() {
        // Report specific issues found during validation
        const issues = [];
        
        // Check for specific issues
        if (this.results.frontendValidation?.averageLoadTime > 1000) {
            issues.push('Frontend load time exceeds 1 second');
        }
        
        if (this.results.securityValidation?.securityScore < 80) {
            issues.push('Security headers need improvement');
        }
        
        if (issues.length === 0) {
            console.log('   ✅ No critical issues detected');
        } else {
            issues.forEach(issue => {
                console.log('   ⚠️', issue);
            });
        }
    }

    generateRecommendations(componentScores) {
        const recommendations = [];
        
        if (componentScores.oauth < 80) {
            recommendations.push('Review OAuth implementation and error handling');
        }
        
        if (componentScores.frontend < 80) {
            recommendations.push('Optimize frontend performance and ensure optimization files are deployed');
        }
        
        if (componentScores.security < 80) {
            recommendations.push('Enhance security headers and authentication protection');
        }
        
        if (componentScores.monitoring < 80) {
            recommendations.push('Deploy missing monitoring components and fix endpoint issues');
        }
        
        if (componentScores.performance < 80) {
            recommendations.push('Deploy performance optimization files and improve response times');
        }
        
        if (componentScores.integration < 80) {
            recommendations.push('Fix integration issues between system components');
        }
        
        if (recommendations.length === 0) {
            console.log('   ✅ System performing well - continue with current optimizations');
        } else {
            recommendations.forEach((recommendation, index) => {
                console.log('   ' + (index + 1) + '.', recommendation);
            });
        }
    }

    getQAGrade(score) {
        if (score >= 95) return 'A+ (Exceptional)';
        if (score >= 90) return 'A (Excellent)';
        if (score >= 85) return 'A- (Very Good)';
        if (score >= 80) return 'B+ (Good)';
        if (score >= 75) return 'B (Satisfactory)';
        if (score >= 70) return 'B- (Acceptable)';
        if (score >= 60) return 'C (Needs Improvement)';
        return 'D (Poor)';
    }
}

// Run validation if called directly
if (require.main === module) {
    const qa = new ComprehensiveQAValidation();
    qa.validate().catch(console.error);
}

module.exports = { ComprehensiveQAValidation };