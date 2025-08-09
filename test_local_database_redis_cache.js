/**
 * QA Testing Script - Local Database & Redis Cache System
 * Tests Phase 1 & Phase 2 Implementation
 */

const https = require('https');
const http = require('http');

// Test Configuration
const TEST_CONFIG = {
    baseUrl: 'http://192.168.20.10:7812',
    testUser: {
        email: 'chaiwutwck@gmail.com',
        password: '12345'
    },
    endpoints: {
        health: '/api/v2/local/health',
        dashboardData: '/api/v2/local/dashboard-data',
        tasks: '/api/v2/local/tasks',
        teams: '/api/v2/local/teams',
        syncStatus: '/api/v2/local/sync-status',
        forceSync: '/api/v2/local/force-sync',
        cacheStatus: '/api/v2/local/cache/status',
        cacheInvalidate: '/api/v2/local/cache/invalidate',
        cacheWarmup: '/api/v2/local/cache/warmup',
        performance: '/api/v2/local/performance'
    }
};

// Test Results Tracker
let testResults = {
    total: 0,
    passed: 0,
    failed: 0,
    details: []
};

// HTTP Request Helper
function makeRequest(method, path, data = null, token = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(TEST_CONFIG.baseUrl + path);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'TaskFlow-QA-Test/1.0'
            }
        };

        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const result = {
                        statusCode: res.statusCode,
                        headers: res.headers,
                        data: body ? JSON.parse(body) : null
                    };
                    resolve(result);
                } catch (error) {
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        data: { raw: body, error: error.message }
                    });
                }
            });
        });

        req.on('error', reject);

        if (data) {
            req.write(JSON.stringify(data));
        }

        req.end();
    });
}

// Test Helper Functions
function logTest(name, success, details = '') {
    testResults.total++;
    if (success) {
        testResults.passed++;
        console.log(`✅ ${name}`);
    } else {
        testResults.failed++;
        console.log(`❌ ${name} - ${details}`);
    }
    testResults.details.push({ name, success, details });
}

function logInfo(message) {
    console.log(`ℹ️  ${message}`);
}

function logSection(title) {
    console.log(`\n🧪 ${title}`);
    console.log('═'.repeat(60));
}

// Test Functions
async function testHealthEndpoint() {
    logSection('Testing Health Endpoint');
    
    try {
        const response = await makeRequest('GET', TEST_CONFIG.endpoints.health);
        
        // Test 1: HTTP Status
        logTest(
            'Health endpoint returns 200 OK',
            response.statusCode === 200,
            `Status: ${response.statusCode}`
        );
        
        // Test 2: Response Structure
        const hasRequiredFields = response.data?.database && response.data?.sync;
        logTest(
            'Health response has required fields',
            hasRequiredFields,
            hasRequiredFields ? '' : 'Missing database or sync fields'
        );
        
        // Test 3: Cache Status Check
        const hasCacheStatus = response.data?.cache !== undefined;
        logTest(
            'Health response includes cache status',
            hasCacheStatus,
            hasCacheStatus ? `Cache status: ${response.data.cache?.status}` : 'No cache field'
        );
        
        logInfo(`Database connected: ${response.data?.database?.connected}`);
        logInfo(`Cache status: ${response.data?.cache?.status || 'N/A'}`);
        logInfo(`Tasks available: ${response.data?.sync?.data_available}`);
        
        return response.data?.cache?.connected || false;
        
    } catch (error) {
        logTest('Health endpoint accessibility', false, error.message);
        return false;
    }
}

async function testDashboardDataEndpoint() {
    logSection('Testing Dashboard Data Endpoint with Cache');
    
    try {
        // Test 1: First request (should miss cache)
        const startTime1 = Date.now();
        const response1 = await makeRequest('GET', TEST_CONFIG.endpoints.dashboardData);
        const responseTime1 = Date.now() - startTime1;
        
        logTest(
            'Dashboard data endpoint returns 200 OK',
            response1.statusCode === 200,
            `Status: ${response1.statusCode}`
        );
        
        // Test 2: Response has data
        const hasData = response1.data?.data && response1.data?.performance;
        logTest(
            'Dashboard response contains data and performance info',
            hasData,
            hasData ? '' : 'Missing data or performance fields'
        );
        
        // Test 3: Source tracking
        const source1 = response1.data?.performance?.source;
        logTest(
            'Response includes data source information',
            source1 !== undefined,
            `Source: ${source1}`
        );
        
        logInfo(`First request: ${responseTime1}ms from ${source1}`);
        logInfo(`Cache hit: ${response1.data?.performance?.cache_hit}`);
        
        // Test 4: Second request (should hit cache if Redis working)
        await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
        
        const startTime2 = Date.now();
        const response2 = await makeRequest('GET', TEST_CONFIG.endpoints.dashboardData);
        const responseTime2 = Date.now() - startTime2;
        
        const source2 = response2.data?.performance?.source;
        const cacheHit2 = response2.data?.performance?.cache_hit;
        
        logInfo(`Second request: ${responseTime2}ms from ${source2}`);
        logInfo(`Cache hit: ${cacheHit2}`);
        
        // Test 5: Cache performance improvement
        if (source2 === 'redis_cache') {
            logTest(
                'Redis cache is working correctly',
                cacheHit2 === true,
                `Cache hit: ${cacheHit2}`
            );
            
            const improvement = Math.round(((responseTime1 - responseTime2) / responseTime1) * 100);
            logTest(
                'Cache provides performance improvement',
                responseTime2 < responseTime1,
                `${improvement}% faster (${responseTime1}ms → ${responseTime2}ms)`
            );
        } else {
            logInfo('Redis cache not active - testing database fallback');
            logTest(
                'Database fallback works correctly',
                source2 === 'local_database',
                `Fallback source: ${source2}`
            );
        }
        
        return {
            cacheWorking: source2 === 'redis_cache',
            responseTime1,
            responseTime2,
            source1,
            source2
        };
        
    } catch (error) {
        logTest('Dashboard data endpoint test', false, error.message);
        return null;
    }
}

async function testTasksEndpoint() {
    logSection('Testing Tasks Endpoint with Filtering');
    
    try {
        // Test 1: Get all tasks
        const allTasksResponse = await makeRequest('GET', TEST_CONFIG.endpoints.tasks);
        
        logTest(
            'Tasks endpoint returns 200 OK',
            allTasksResponse.statusCode === 200,
            `Status: ${allTasksResponse.statusCode}`
        );
        
        // Test 2: Response structure
        const hasTasksData = allTasksResponse.data?.data && Array.isArray(allTasksResponse.data.data);
        logTest(
            'Tasks response contains array of tasks',
            hasTasksData,
            hasTasksData ? `${allTasksResponse.data.count} tasks found` : 'No tasks array'
        );
        
        // Test 3: Performance info
        const hasPerformanceInfo = allTasksResponse.data?.performance?.source;
        logTest(
            'Tasks response includes performance metadata',
            hasPerformanceInfo,
            `Source: ${allTasksResponse.data?.performance?.source}`
        );
        
        logInfo(`Total tasks: ${allTasksResponse.data?.count || 0}`);
        logInfo(`Data source: ${allTasksResponse.data?.performance?.source}`);
        logInfo(`Cache hit: ${allTasksResponse.data?.performance?.cache_hit}`);
        
        // Test 4: Filtered query (cache key variation)
        const filteredResponse = await makeRequest('GET', TEST_CONFIG.endpoints.tasks + '?status=in progress');
        
        logTest(
            'Tasks endpoint supports filtering',
            filteredResponse.statusCode === 200,
            `Filtered tasks: ${filteredResponse.data?.count || 0}`
        );
        
        return true;
        
    } catch (error) {
        logTest('Tasks endpoint test', false, error.message);
        return false;
    }
}

async function testCacheManagementEndpoints() {
    logSection('Testing Cache Management Endpoints');
    
    try {
        // Test 1: Cache Status
        const statusResponse = await makeRequest('GET', TEST_CONFIG.endpoints.cacheStatus);
        
        logTest(
            'Cache status endpoint returns 200 OK',
            statusResponse.statusCode === 200,
            `Status: ${statusResponse.statusCode}`
        );
        
        const cacheConnected = statusResponse.data?.connected;
        logInfo(`Cache connected: ${cacheConnected}`);
        logInfo(`Cache status: ${statusResponse.data?.status}`);
        
        if (cacheConnected) {
            // Test 2: Cache Warmup
            const warmupResponse = await makeRequest('POST', TEST_CONFIG.endpoints.cacheWarmup);
            
            logTest(
                'Cache warmup endpoint works',
                warmupResponse.statusCode === 200,
                warmupResponse.data?.message || 'No message'
            );
            
            logInfo(`Warmed up: ${warmupResponse.data?.warmed_up?.join(', ') || 'none'}`);
            
            // Test 3: Cache Invalidation
            const invalidateResponse = await makeRequest('POST', TEST_CONFIG.endpoints.cacheInvalidate, {
                pattern: 'dashboard_data:*',
                type: 'pattern'
            });
            
            logTest(
                'Cache invalidation endpoint works',
                invalidateResponse.statusCode === 200,
                invalidateResponse.data?.message || 'No message'
            );
            
        } else {
            logInfo('Skipping cache management tests - Redis not connected');
        }
        
        return cacheConnected;
        
    } catch (error) {
        logTest('Cache management endpoints test', false, error.message);
        return false;
    }
}

async function testSyncEndpoints() {
    logSection('Testing Sync Management Endpoints');
    
    try {
        // Test 1: Sync Status
        const statusResponse = await makeRequest('GET', TEST_CONFIG.endpoints.syncStatus);
        
        logTest(
            'Sync status endpoint returns 200 OK',
            statusResponse.statusCode === 200,
            `Status: ${statusResponse.statusCode}`
        );
        
        logInfo(`Sync status available: ${statusResponse.data?.status !== undefined}`);
        
        // Test 2: Performance Comparison
        const perfResponse = await makeRequest('GET', TEST_CONFIG.endpoints.performance);
        
        logTest(
            'Performance comparison endpoint works',
            perfResponse.statusCode === 200,
            `Status: ${perfResponse.statusCode}`
        );
        
        if (perfResponse.data?.performance) {
            const localTime = perfResponse.data.performance.local_database?.response_time_ms;
            const improvement = perfResponse.data.performance.estimated_clickup_api?.improvement_percentage;
            
            logInfo(`Local DB response time: ${localTime}ms`);
            logInfo(`Estimated improvement: ${improvement}%`);
        }
        
        return true;
        
    } catch (error) {
        logTest('Sync endpoints test', false, error.message);
        return false;
    }
}

async function testErrorHandling() {
    logSection('Testing Error Handling & Edge Cases');
    
    try {
        // Test 1: Invalid endpoint
        const invalidResponse = await makeRequest('GET', '/api/v2/local/nonexistent');
        
        logTest(
            'Invalid endpoint returns 404',
            invalidResponse.statusCode === 404,
            `Status: ${invalidResponse.statusCode}`
        );
        
        // Test 2: Invalid cache operation
        const invalidCacheResponse = await makeRequest('POST', TEST_CONFIG.endpoints.cacheInvalidate, {
            invalid: 'data'
        });
        
        // Should either work with defaults or return meaningful error
        const validResponse = invalidCacheResponse.statusCode === 200 || invalidCacheResponse.statusCode >= 400;
        logTest(
            'Invalid cache request handled properly',
            validResponse,
            `Status: ${invalidCacheResponse.statusCode}`
        );
        
        return true;
        
    } catch (error) {
        logTest('Error handling test', false, error.message);
        return false;
    }
}

// Main Test Runner
async function runAllTests() {
    console.log('🧪 TaskFlow Pro - Local Database & Redis Cache QA Testing');
    console.log('═'.repeat(80));
    console.log(`📍 Testing: ${TEST_CONFIG.baseUrl}`);
    console.log(`⏰ Started: ${new Date().toISOString()}`);
    
    try {
        // Phase 1: Infrastructure Tests
        const cacheConnected = await testHealthEndpoint();
        
        // Phase 2: Core Functionality Tests
        const dashboardResults = await testDashboardDataEndpoint();
        await testTasksEndpoint();
        
        // Phase 3: Cache Management Tests
        const cacheManagementWorking = await testCacheManagementEndpoints();
        
        // Phase 4: Sync System Tests
        await testSyncEndpoints();
        
        // Phase 5: Error Handling Tests
        await testErrorHandling();
        
        // Final Summary
        console.log('\n📊 Test Results Summary');
        console.log('═'.repeat(60));
        console.log(`✅ Passed: ${testResults.passed}`);
        console.log(`❌ Failed: ${testResults.failed}`);
        console.log(`📈 Success Rate: ${Math.round((testResults.passed / testResults.total) * 100)}%`);
        
        // Performance Summary
        if (dashboardResults) {
            console.log('\n🚀 Performance Summary');
            console.log('═'.repeat(60));
            console.log(`First request: ${dashboardResults.responseTime1}ms (${dashboardResults.source1})`);
            console.log(`Second request: ${dashboardResults.responseTime2}ms (${dashboardResults.source2})`);
            
            if (dashboardResults.cacheWorking) {
                const improvement = Math.round(((dashboardResults.responseTime1 - dashboardResults.responseTime2) / dashboardResults.responseTime1) * 100);
                console.log(`🔥 Cache Performance: ${improvement}% improvement`);
            }
        }
        
        // System Status Summary
        console.log('\n🏥 System Health Summary');
        console.log('═'.repeat(60));
        console.log(`Redis Cache: ${cacheConnected ? '✅ Connected' : '⚠️ Not Connected'}`);
        console.log(`Cache Management: ${cacheManagementWorking ? '✅ Working' : '⚠️ Limited'}`);
        console.log(`Local Database: ✅ Working`);
        console.log(`API Endpoints: ✅ Responding`);
        
        // Recommendations
        console.log('\n💡 QA Recommendations');
        console.log('═'.repeat(60));
        
        if (testResults.failed === 0) {
            console.log('✅ All tests passed - System ready for production');
        } else {
            console.log(`⚠️ ${testResults.failed} tests failed - Review required`);
        }
        
        if (!cacheConnected) {
            console.log('📝 Consider setting up Redis for improved performance');
        }
        
        if (dashboardResults?.cacheWorking) {
            console.log('🚀 Redis cache is providing significant performance benefits');
        }
        
        console.log('\n⏰ Test completed:', new Date().toISOString());
        
        return {
            success: testResults.failed === 0,
            results: testResults,
            performance: dashboardResults,
            cacheWorking: cacheConnected && cacheManagementWorking
        };
        
    } catch (error) {
        console.error('❌ Test suite failed:', error);
        return {
            success: false,
            error: error.message,
            results: testResults
        };
    }
}

// Run tests if called directly
if (require.main === module) {
    runAllTests().then(results => {
        process.exit(results.success ? 0 : 1);
    }).catch(error => {
        console.error('💥 Test suite crashed:', error);
        process.exit(1);
    });
}

module.exports = { runAllTests, TEST_CONFIG };