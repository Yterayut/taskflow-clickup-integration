#!/usr/bin/env node
/**
 * Role-Based Dashboard System Integration Test
 * Comprehensive testing for the redesigned authentication and dashboard system
 */

const axios = require('axios');
const assert = require('assert');

// Test configuration
const BASE_URL = 'http://192.168.20.10:7812';
const FRONTEND_URL = 'http://192.168.20.10:8888';

// Test users
const TEST_USERS = {
    master: {
        email: 'yterayut@gmail.com',
        expectedRole: 'master',
        authType: 'oauth'
    },
    teamLead: {
        email: 'chaiwutwck@gmail.com',
        password: '12345',
        expectedRole: 'team_lead',
        authType: 'password'
    },
    employee: {
        email: 'atthakorn.na@ku.th',
        password: '12345',
        expectedRole: 'employee',
        authType: 'password'
    }
};

// Test results tracking
const testResults = {
    passed: 0,
    failed: 0,
    errors: []
};

/**
 * HTTP client with cookie support
 */
class TestClient {
    constructor() {
        this.cookies = '';
        this.token = null;
    }

    async request(method, endpoint, data = null, headers = {}) {
        try {
            const config = {
                method,
                url: BASE_URL + endpoint,
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': this.cookies,
                    ...headers
                },
                validateStatus: () => true // Don't throw on HTTP errors
            };

            if (data) {
                config.data = data;
            }

            const response = await axios(config);

            // Extract cookies from response
            if (response.headers['set-cookie']) {
                this.cookies = response.headers['set-cookie'].join('; ');
                
                // Extract auth token
                const tokenMatch = this.cookies.match(/auth_token=([^;]+)/);
                if (tokenMatch) {
                    this.token = tokenMatch[1];
                }
            }

            return response;
        } catch (error) {
            throw new Error(`HTTP request failed: ${error.message}`);
        }
    }

    async get(endpoint, headers = {}) {
        return this.request('GET', endpoint, null, headers);
    }

    async post(endpoint, data, headers = {}) {
        return this.request('POST', endpoint, data, headers);
    }
}

/**
 * Test utilities
 */
function log(message, type = 'info') {
    const colors = {
        info: '\x1b[36m',
        success: '\x1b[32m',
        error: '\x1b[31m',
        warning: '\x1b[33m',
        reset: '\x1b[0m'
    };
    
    console.log(`${colors[type]}${message}${colors.reset}`);
}

function test(name, testFn) {
    return async () => {
        try {
            log(`\n🧪 Running: ${name}`, 'info');
            await testFn();
            log(`✅ PASSED: ${name}`, 'success');
            testResults.passed++;
        } catch (error) {
            log(`❌ FAILED: ${name} - ${error.message}`, 'error');
            testResults.failed++;
            testResults.errors.push({ test: name, error: error.message });
        }
    };
}

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(`${message}: Expected ${expected}, got ${actual}`);
    }
}

function assertTrue(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

/**
 * System Health Tests
 */
const testSystemHealth = test('System Health Check', async () => {
    const client = new TestClient();
    const response = await client.get('/health');
    
    assertEqual(response.status, 200, 'Health endpoint status');
    assertTrue(response.data.status === 'OK', 'System health status');
    assertTrue(response.data.service.includes('TaskFlow'), 'Service name');
    log(`   Service: ${response.data.service}`);
    log(`   Version: ${response.data.version}`);
});

/**
 * Authentication Tests
 */
const testMasterUserOAuthFlow = test('Master User OAuth Flow Detection', async () => {
    const client = new TestClient();
    const response = await client.post('/api/v2/auth/login', {
        email: TEST_USERS.master.email,
        password: ''
    });
    
    assertTrue(response.data.success, 'OAuth flow initiated');
    assertTrue(response.data.requiresOAuth, 'OAuth requirement detected');
    assertTrue(response.data.redirect, 'Redirect flag set');
    assertTrue(response.data.location.includes('clickup'), 'ClickUp OAuth URL');
    log(`   OAuth URL: ${response.data.location.substring(0, 50)}...`);
});

const testRegularUserPasswordAuth = test('Regular User Password Authentication', async () => {
    const client = new TestClient();
    const response = await client.post('/api/v2/auth/login', {
        email: TEST_USERS.teamLead.email,
        password: TEST_USERS.teamLead.password
    });
    
    assertEqual(response.status, 200, 'Login response status');
    assertTrue(response.data.success, 'Login success');
    assertTrue(!response.data.requiresOAuth, 'No OAuth required');
    assertTrue(response.data.user, 'User data returned');
    assertTrue(client.token, 'Auth token received');
    
    log(`   User: ${response.data.user.email}`);
    log(`   Role: ${response.data.user.role}`);
    log(`   Token: ${client.token.substring(0, 20)}...`);
});

const testInvalidCredentials = test('Invalid Credentials Rejection', async () => {
    const client = new TestClient();
    const response = await client.post('/api/v2/auth/login', {
        email: TEST_USERS.teamLead.email,
        password: 'wrongpassword'
    });
    
    assertTrue(!response.data.success, 'Login should fail');
    assertTrue(response.data.error, 'Error message present');
    log(`   Error: ${response.data.error}`);
});

/**
 * JWT Token Tests
 */
const testTokenGeneration = test('JWT Token Generation', async () => {
    const client = new TestClient();
    
    // Login to get token
    const loginResponse = await client.post('/api/v2/auth/login', {
        email: TEST_USERS.teamLead.email,
        password: TEST_USERS.teamLead.password
    });
    
    assertTrue(loginResponse.data.success, 'Login successful');
    assertTrue(client.token, 'Token generated');
    
    // Test token validation
    const validateResponse = await client.post('/api/v2/token/validate', {
        token: client.token
    });
    
    assertTrue(validateResponse.data.success, 'Token validation success');
    assertTrue(validateResponse.data.valid, 'Token is valid');
    assertTrue(validateResponse.data.payload.userId, 'User ID in payload');
    assertTrue(validateResponse.data.payload.capabilities, 'Capabilities in payload');
    
    log(`   Token valid: ${validateResponse.data.valid}`);
    log(`   User ID: ${validateResponse.data.payload.userId}`);
    log(`   Role: ${validateResponse.data.payload.role}`);
});

const testTokenStatus = test('Token Status Check', async () => {
    const client = new TestClient();
    
    // Login first
    await client.post('/api/v2/auth/login', {
        email: TEST_USERS.teamLead.email,
        password: TEST_USERS.teamLead.password
    });
    
    const statusResponse = await client.get('/api/v2/token/status');
    
    assertTrue(statusResponse.data.success, 'Status check success');
    assertTrue(statusResponse.data.valid, 'Token is valid');
    assertTrue(statusResponse.data.timeUntilExpiry > 0, 'Time until expiry');
    assertTrue(statusResponse.data.user, 'User info returned');
    
    log(`   Valid: ${statusResponse.data.valid}`);
    log(`   Expires in: ${statusResponse.data.timeUntilExpiry} minutes`);
    log(`   Needs refresh: ${statusResponse.data.needsRefresh}`);
});

const testTokenRefresh = test('Token Refresh', async () => {
    const client = new TestClient();
    
    // Login first
    await client.post('/api/v2/auth/login', {
        email: TEST_USERS.teamLead.email,
        password: TEST_USERS.teamLead.password
    });
    
    const oldToken = client.token;
    
    // Wait a moment then refresh
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const refreshResponse = await client.post('/api/v2/token/refresh');
    
    assertTrue(refreshResponse.data.success, 'Token refresh success');
    assertTrue(refreshResponse.data.user, 'User data in refresh response');
    assertTrue(client.token !== oldToken, 'New token generated');
    
    log(`   Old token: ${oldToken.substring(0, 20)}...`);
    log(`   New token: ${client.token.substring(0, 20)}...`);
});

/**
 * Role-Based Access Tests
 */
const testRoleBasedNavigation = test('Role-Based Navigation Configuration', async () => {
    const client = new TestClient();
    
    // Test Team Lead navigation
    await client.post('/api/v2/auth/login', {
        email: TEST_USERS.teamLead.email,
        password: TEST_USERS.teamLead.password
    });
    
    const configResponse = await client.get('/api/v2/dashboard/config');
    
    assertTrue(configResponse.data.success, 'Config fetch success');
    assertTrue(configResponse.data.data.role, 'Role in config');
    assertTrue(configResponse.data.data.navigation, 'Navigation array');
    assertTrue(configResponse.data.data.capabilities, 'Capabilities object');
    
    const navigation = configResponse.data.data.navigation;
    assertTrue(navigation.includes('My Team Dashboard'), 'Team Lead navigation includes team dashboard');
    assertTrue(navigation.includes('Team Tasks'), 'Team Lead navigation includes team tasks');
    assertTrue(!navigation.includes('System Settings'), 'Team Lead cannot access system settings');
    
    log(`   Role: ${configResponse.data.data.role}`);
    log(`   Navigation items: ${navigation.length}`);
    log(`   Items: ${navigation.join(', ')}`);
});

const testRoleBasedDataAccess = test('Role-Based Data Access', async () => {
    const client = new TestClient();
    
    // Login as Team Lead
    await client.post('/api/v2/auth/login', {
        email: TEST_USERS.teamLead.email,
        password: TEST_USERS.teamLead.password
    });
    
    // Test tasks endpoint
    const tasksResponse = await client.get('/api/v2/dashboard/tasks');
    
    assertTrue(tasksResponse.data.success, 'Tasks fetch success');
    assertTrue(tasksResponse.data.data.role, 'Role in response');
    assertTrue(Array.isArray(tasksResponse.data.data.tasks), 'Tasks array');
    
    log(`   Role: ${tasksResponse.data.data.role}`);
    log(`   Tasks count: ${tasksResponse.data.data.count}`);
});

const testUnauthorizedAccess = test('Unauthorized Access Prevention', async () => {
    const client = new TestClient();
    
    // Try to access protected endpoint without token
    const response = await client.get('/api/v2/dashboard/config');
    
    assertEqual(response.status, 401, 'Unauthorized status code');
    assertTrue(!response.data.success, 'Request should fail');
    assertTrue(response.data.error.includes('Authentication required'), 'Auth required error');
    
    log(`   Status: ${response.status}`);
    log(`   Error: ${response.data.error}`);
});

/**
 * UserRole Value Object Tests
 */
const testUserRoleCapabilities = test('UserRole Value Object Capabilities', async () => {
    const client = new TestClient();
    
    // Login and get user profile
    await client.post('/api/v2/auth/login', {
        email: TEST_USERS.teamLead.email,
        password: TEST_USERS.teamLead.password
    });
    
    const profileResponse = await client.get('/api/v2/auth/profile');
    
    assertTrue(profileResponse.data.success, 'Profile fetch success');
    
    const capabilities = profileResponse.data.data.capabilities;
    assertTrue(capabilities, 'Capabilities object exists');
    assertTrue(capabilities.canViewTeamTasks === true, 'Team Lead can view team tasks');
    assertTrue(capabilities.canManageTeamMembers === true, 'Team Lead can manage team members');
    assertTrue(capabilities.canViewAllTasks === false, 'Team Lead cannot view all tasks');
    
    log(`   Role: ${profileResponse.data.data.user.role}`);
    log(`   Display Name: ${profileResponse.data.data.displayName}`);
    log(`   Capabilities: ${Object.keys(capabilities).length} permissions`);
});

/**
 * Frontend Integration Tests
 */
const testFrontendAccessibility = test('Frontend Dashboard Accessibility', async () => {
    try {
        const response = await axios.get(FRONTEND_URL + '/role_based_dashboard.html', {
            validateStatus: () => true
        });
        
        assertTrue(response.status === 200, 'Dashboard page accessible');
        assertTrue(response.data.includes('TaskFlow Pro'), 'Dashboard content loaded');
        assertTrue(response.data.includes('token-manager.js'), 'Token manager included');
        
        log(`   Status: ${response.status}`);
        log(`   Content size: ${response.data.length} bytes`);
    } catch (error) {
        throw new Error(`Frontend accessibility test failed: ${error.message}`);
    }
});

const testStaticAssets = test('Static Assets Availability', async () => {
    try {
        const jsResponse = await axios.get(FRONTEND_URL + '/js/token-manager.js', {
            validateStatus: () => true
        });
        
        assertTrue(jsResponse.status === 200, 'Token manager JS accessible');
        assertTrue(jsResponse.data.includes('TokenManager'), 'Token manager class defined');
        
        log(`   Token manager JS: ${jsResponse.status}`);
    } catch (error) {
        throw new Error(`Static assets test failed: ${error.message}`);
    }
});

/**
 * System Integration Tests
 */
const testFullLoginFlow = test('Complete Login Flow Integration', async () => {
    const client = new TestClient();
    
    // 1. Login
    const loginResponse = await client.post('/api/v2/auth/login', {
        email: TEST_USERS.teamLead.email,
        password: TEST_USERS.teamLead.password
    });
    
    assertTrue(loginResponse.data.success, 'Login successful');
    
    // 2. Get dashboard config
    const configResponse = await client.get('/api/v2/dashboard/config');
    assertTrue(configResponse.data.success, 'Config loaded');
    
    // 3. Load dashboard data
    const tasksResponse = await client.get('/api/v2/dashboard/tasks');
    assertTrue(tasksResponse.data.success, 'Tasks loaded');
    
    // 4. Check token status
    const statusResponse = await client.get('/api/v2/token/status');
    assertTrue(statusResponse.data.success, 'Token status checked');
    
    // 5. Logout
    const logoutResponse = await client.post('/api/v2/token/revoke');
    assertTrue(logoutResponse.data.success, 'Logout successful');
    
    log(`   ✅ Login → Config → Data → Status → Logout`);
});

/**
 * Run all tests
 */
async function runTests() {
    log('🚀 Starting Role-Based Dashboard System Tests\n', 'info');
    log(`Base URL: ${BASE_URL}`, 'info');
    log(`Frontend URL: ${FRONTEND_URL}`, 'info');
    
    const tests = [
        // System Health
        testSystemHealth,
        
        // Authentication
        testMasterUserOAuthFlow,
        testRegularUserPasswordAuth,
        testInvalidCredentials,
        
        // JWT Tokens
        testTokenGeneration,
        testTokenStatus,
        testTokenRefresh,
        
        // Role-Based Access
        testRoleBasedNavigation,
        testRoleBasedDataAccess,
        testUnauthorizedAccess,
        testUserRoleCapabilities,
        
        // Frontend Integration
        testFrontendAccessibility,
        testStaticAssets,
        
        // System Integration
        testFullLoginFlow
    ];
    
    for (const testFn of tests) {
        await testFn();
    }
    
    // Test Summary
    log('\n📊 Test Results Summary', 'info');
    log(`✅ Passed: ${testResults.passed}`, 'success');
    log(`❌ Failed: ${testResults.failed}`, testResults.failed > 0 ? 'error' : 'success');
    
    if (testResults.errors.length > 0) {
        log('\n🔍 Failed Tests:', 'error');
        testResults.errors.forEach(({ test, error }) => {
            log(`   ${test}: ${error}`, 'error');
        });
    }
    
    if (testResults.failed === 0) {
        log('\n🎉 All tests passed! System is ready for deployment.', 'success');
    } else {
        log('\n⚠️  Some tests failed. Please review and fix issues before deployment.', 'warning');
    }
    
    process.exit(testResults.failed > 0 ? 1 : 0);
}

// Run tests if called directly
if (require.main === module) {
    runTests().catch(error => {
        log(`Fatal error: ${error.message}`, 'error');
        process.exit(1);
    });
}

module.exports = {
    runTests,
    TEST_USERS,
    testResults
};