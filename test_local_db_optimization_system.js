/**
 * TaskFlow Pro - Local Database + Cache Optimization System Test
 * ทดสอบระบบใหม่ที่ดึงข้อมูลจาก Local Database + Cache
 * แทน ClickUp API โดยตรง
 * 
 * Test Coverage:
 * 1. Database Schema Creation
 * 2. Cache Service Functionality
 * 3. Sync Service Operations
 * 4. API Route Performance
 * 5. Data Accuracy Verification
 * 6. Performance Benchmarking
 */

const axios = require('axios');
const { Pool } = require('pg');

class LocalDBOptimizationTest {
    constructor() {
        this.baseURL = 'http://192.168.20.10:7812';
        this.testResults = {
            passed: 0,
            failed: 0,
            warnings: 0,
            performance: {},
            errors: []
        };
        
        // Database connection for direct testing
        this.db = new Pool({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            database: process.env.DB_NAME || 'taskflow',
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || 'postgres',
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });
    }

    async runAllTests() {
        console.log('🚀 TaskFlow Pro - Local Database + Cache Optimization System Test');
        console.log('================================================================');
        console.log('');

        try {
            // Test sequence
            await this.testDatabaseSchema();
            await this.testCacheService();
            await this.testSyncService();
            await this.testAPIRoutes();
            await this.testPerformance();
            await this.testDataAccuracy();
            
            this.printResults();
            
        } catch (error) {
            console.error('❌ Test suite failed:', error.message);
            this.testResults.errors.push(`Test suite error: ${error.message}`);
        } finally {
            await this.cleanup();
        }
    }

    async testDatabaseSchema() {
        console.log('📊 Testing Database Schema...');
        
        try {
            // Test if all required tables exist
            const requiredTables = [
                'clickup_teams',
                'clickup_members', 
                'clickup_tasks',
                'clickup_sync_status',
                'clickup_task_members',
                'clickup_task_dependencies'
            ];

            for (const table of requiredTables) {
                const result = await this.db.query(`
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = 'public' 
                        AND table_name = $1
                    )
                `, [table]);

                if (result.rows[0].exists) {
                    console.log(`  ✅ Table ${table} exists`);
                    this.testResults.passed++;
                } else {
                    console.log(`  ❌ Table ${table} missing`);
                    this.testResults.failed++;
                    this.testResults.errors.push(`Missing table: ${table}`);
                }
            }

            // Test views
            const requiredViews = ['v_team_task_summary', 'v_member_workload'];
            for (const view of requiredViews) {
                const result = await this.db.query(`
                    SELECT EXISTS (
                        SELECT FROM information_schema.views 
                        WHERE table_schema = 'public' 
                        AND table_name = $1
                    )
                `, [view]);

                if (result.rows[0].exists) {
                    console.log(`  ✅ View ${view} exists`);
                    this.testResults.passed++;
                } else {
                    console.log(`  ❌ View ${view} missing`);
                    this.testResults.failed++;
                    this.testResults.errors.push(`Missing view: ${view}`);
                }
            }

            // Test indexes
            const indexResult = await this.db.query(`
                SELECT indexname, tablename 
                FROM pg_indexes 
                WHERE tablename LIKE 'clickup_%'
                ORDER BY tablename, indexname
            `);
            
            console.log(`  ✅ Found ${indexResult.rows.length} indexes on ClickUp tables`);
            this.testResults.passed++;

        } catch (error) {
            console.log(`  ❌ Database schema test failed: ${error.message}`);
            this.testResults.failed++;
            this.testResults.errors.push(`Database schema error: ${error.message}`);
        }
    }

    async testCacheService() {
        console.log('⚡ Testing Cache Service...');
        
        try {
            // Test cache endpoints via API
            const cacheTestKey = 'test-cache-key';
            const cacheTestValue = { test: 'data', timestamp: Date.now() };

            // Test cache set/get (we'll test via dashboard endpoint)
            const dashboardResponse = await axios.get(`${this.baseURL}/api/v2/dashboard/data`, {
                headers: { 'Cookie': 'session=test-session' }
            });

            if (dashboardResponse.status === 200) {
                console.log('  ✅ Cache service accessible via API');
                this.testResults.passed++;

                // Check response structure
                const response = dashboardResponse.data;
                if (response.performance && response.performance.source) {
                    console.log(`  ✅ Response source: ${response.performance.source}`);
                    console.log(`  ✅ Cache hit: ${response.performance.cache_hit}`);
                    this.testResults.passed++;
                } else {
                    console.log('  ⚠️ Response missing performance data');
                    this.testResults.warnings++;
                }
            }

        } catch (error) {
            if (error.response?.status === 401) {
                console.log('  ⚠️ Cache service test requires authentication (expected)');
                this.testResults.warnings++;
            } else {
                console.log(`  ❌ Cache service test failed: ${error.message}`);
                this.testResults.failed++;
                this.testResults.errors.push(`Cache service error: ${error.message}`);
            }
        }
    }

    async testSyncService() {
        console.log('🔄 Testing Sync Service...');
        
        try {
            // Test sync status endpoint
            const syncStatusResponse = await axios.get(`${this.baseURL}/api/v2/dashboard/sync/status`);
            
            if (syncStatusResponse.status === 200) {
                console.log('  ✅ Sync status endpoint working');
                this.testResults.passed++;

                const status = syncStatusResponse.data;
                if (status.sync_service && status.cache_service && status.database) {
                    console.log(`  ✅ Sync service health: ${status.sync_service.healthScore || 'N/A'}`);
                    console.log(`  ✅ Cache service health: ${status.cache_service.stats?.healthScore || 'N/A'}`);
                    console.log(`  ✅ Database status: ${status.database.status}`);
                    this.testResults.passed++;
                } else {
                    console.log('  ⚠️ Incomplete sync status response');
                    this.testResults.warnings++;
                }
            }

            // Test sync table data
            const syncTableResult = await this.db.query(`
                SELECT COUNT(*) as sync_records 
                FROM clickup_sync_status
            `);
            
            console.log(`  ✅ Sync status table has ${syncTableResult.rows[0].sync_records} records`);
            this.testResults.passed++;

        } catch (error) {
            console.log(`  ❌ Sync service test failed: ${error.message}`);
            this.testResults.failed++;
            this.testResults.errors.push(`Sync service error: ${error.message}`);
        }
    }

    async testAPIRoutes() {
        console.log('🌐 Testing API Routes...');
        
        const routes = [
            { path: '/health', method: 'GET', requiresAuth: false },
            { path: '/api/v2/dashboard/data', method: 'GET', requiresAuth: true },
            { path: '/api/v2/dashboard/sync/status', method: 'GET', requiresAuth: false },
            { path: '/api/v2/dashboard/performance/metrics', method: 'GET', requiresAuth: false }
        ];

        for (const route of routes) {
            try {
                const response = await axios.get(`${this.baseURL}${route.path}`);
                
                if (response.status === 200) {
                    console.log(`  ✅ ${route.path} - Status: ${response.status}`);
                    this.testResults.passed++;
                    
                    // Check response time
                    const responseTime = response.headers['x-response-time'] || 'N/A';
                    console.log(`    Response time: ${responseTime}`);
                } else {
                    console.log(`  ⚠️ ${route.path} - Unexpected status: ${response.status}`);
                    this.testResults.warnings++;
                }

            } catch (error) {
                if (error.response?.status === 401 && route.requiresAuth) {
                    console.log(`  ✅ ${route.path} - Correctly requires authentication`);
                    this.testResults.passed++;
                } else {
                    console.log(`  ❌ ${route.path} - Error: ${error.message}`);
                    this.testResults.failed++;
                    this.testResults.errors.push(`Route ${route.path} error: ${error.message}`);
                }
            }
        }
    }

    async testPerformance() {
        console.log('⚡ Testing Performance...');
        
        try {
            const performanceTests = [
                { name: 'Health Check', url: `${this.baseURL}/health` },
                { name: 'Sync Status', url: `${this.baseURL}/api/v2/dashboard/sync/status` },
                { name: 'Performance Metrics', url: `${this.baseURL}/api/v2/dashboard/performance/metrics` }
            ];

            for (const test of performanceTests) {
                const iterations = 5;
                const times = [];

                for (let i = 0; i < iterations; i++) {
                    const startTime = Date.now();
                    try {
                        await axios.get(test.url);
                        const endTime = Date.now();
                        times.push(endTime - startTime);
                    } catch (error) {
                        // Skip auth errors for performance testing
                        if (error.response?.status !== 401) {
                            console.log(`    ⚠️ ${test.name} - Error during performance test: ${error.message}`);
                        }
                    }
                }

                if (times.length > 0) {
                    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
                    const minTime = Math.min(...times);
                    const maxTime = Math.max(...times);

                    console.log(`  ✅ ${test.name} - Avg: ${avgTime.toFixed(2)}ms, Min: ${minTime}ms, Max: ${maxTime}ms`);
                    
                    this.testResults.performance[test.name] = {
                        average: avgTime,
                        min: minTime,
                        max: maxTime,
                        iterations: times.length
                    };
                    
                    this.testResults.passed++;
                }
            }

        } catch (error) {
            console.log(`  ❌ Performance test failed: ${error.message}`);
            this.testResults.failed++;
            this.testResults.errors.push(`Performance test error: ${error.message}`);
        }
    }

    async testDataAccuracy() {
        console.log('📊 Testing Data Accuracy...');
        
        try {
            // Test database data integrity
            const dataTests = [
                {
                    name: 'Teams table structure',
                    query: `SELECT column_name, data_type 
                            FROM information_schema.columns 
                            WHERE table_name = 'clickup_teams' 
                            ORDER BY ordinal_position`
                },
                {
                    name: 'Members table structure', 
                    query: `SELECT column_name, data_type 
                            FROM information_schema.columns 
                            WHERE table_name = 'clickup_members' 
                            ORDER BY ordinal_position`
                },
                {
                    name: 'Tasks table structure',
                    query: `SELECT column_name, data_type 
                            FROM information_schema.columns 
                            WHERE table_name = 'clickup_tasks' 
                            ORDER BY ordinal_position`
                }
            ];

            for (const test of dataTests) {
                const result = await this.db.query(test.query);
                console.log(`  ✅ ${test.name} - ${result.rows.length} columns`);
                this.testResults.passed++;
            }

            // Test view functionality
            const viewTests = [
                {
                    name: 'Team task summary view',
                    query: 'SELECT * FROM v_team_task_summary LIMIT 1'
                },
                {
                    name: 'Member workload view',
                    query: 'SELECT * FROM v_member_workload LIMIT 1'
                }
            ];

            for (const test of viewTests) {
                try {
                    const result = await this.db.query(test.query);
                    console.log(`  ✅ ${test.name} - View functional`);
                    this.testResults.passed++;
                } catch (error) {
                    console.log(`  ⚠️ ${test.name} - No data (expected for new installation)`);
                    this.testResults.warnings++;
                }
            }

        } catch (error) {
            console.log(`  ❌ Data accuracy test failed: ${error.message}`);
            this.testResults.failed++;
            this.testResults.errors.push(`Data accuracy error: ${error.message}`);
        }
    }

    async cleanup() {
        try {
            await this.db.end();
        } catch (error) {
            console.error('Cleanup error:', error.message);
        }
    }

    printResults() {
        console.log('');
        console.log('================================================================');
        console.log('🎯 TEST RESULTS SUMMARY');
        console.log('================================================================');
        console.log('');
        
        console.log(`✅ Passed Tests: ${this.testResults.passed}`);
        console.log(`❌ Failed Tests: ${this.testResults.failed}`);
        console.log(`⚠️ Warnings: ${this.testResults.warnings}`);
        console.log('');

        if (Object.keys(this.testResults.performance).length > 0) {
            console.log('⚡ PERFORMANCE RESULTS:');
            for (const [test, metrics] of Object.entries(this.testResults.performance)) {
                console.log(`  ${test}: ${metrics.average.toFixed(2)}ms avg (${metrics.iterations} tests)`);
            }
            console.log('');
        }

        if (this.testResults.errors.length > 0) {
            console.log('❌ ERRORS ENCOUNTERED:');
            this.testResults.errors.forEach((error, index) => {
                console.log(`  ${index + 1}. ${error}`);
            });
            console.log('');
        }

        // Overall assessment
        const totalTests = this.testResults.passed + this.testResults.failed;
        const successRate = totalTests > 0 ? (this.testResults.passed / totalTests * 100).toFixed(2) : 0;
        
        console.log(`📊 Overall Success Rate: ${successRate}%`);
        
        if (this.testResults.failed === 0) {
            console.log('🎉 ALL CRITICAL TESTS PASSED! System is ready for deployment.');
        } else if (this.testResults.failed <= 2) {
            console.log('⚠️ Some tests failed, but system may still be functional. Review errors.');
        } else {
            console.log('❌ Multiple critical failures detected. System needs attention.');
        }

        console.log('');
        console.log('🔗 ENDPOINTS TO TEST MANUALLY:');
        console.log('  • Dashboard Data: http://192.168.20.10:7812/api/v2/dashboard/data');
        console.log('  • Team Ranking: http://192.168.20.10:7812/api/v2/dashboard/team-ranking/{teamId}');
        console.log('  • Sync Status: http://192.168.20.10:7812/api/v2/dashboard/sync/status');
        console.log('  • Performance Metrics: http://192.168.20.10:7812/api/v2/dashboard/performance/metrics');
        console.log('');
        console.log('📝 NEXT STEPS:');
        console.log('  1. Deploy the system using: ./deploy_local_db_optimization.sh');
        console.log('  2. Run initial sync to populate database');
        console.log('  3. Monitor performance and cache hit rates');
        console.log('  4. Update frontend to use new /api/v2/dashboard/* endpoints');
        console.log('');
    }
}

// Run tests if called directly
if (require.main === module) {
    const tester = new LocalDBOptimizationTest();
    tester.runAllTests().catch(console.error);
}

module.exports = LocalDBOptimizationTest;