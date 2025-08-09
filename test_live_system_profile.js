#!/usr/bin/env node

/**
 * Test Live System Profile Integration
 * Full end-to-end test of the profile API fix
 */

const http = require('http');

const API_BASE_URL = 'http://192.168.20.10:7812';
const FRONTEND_URL = 'http://192.168.20.10:8888';

// Test credentials
const testCredentials = {
    email: 'chaiwutwck@gmail.com',
    password: '12345'
};

async function makeRequest(url, method = 'GET', data = null, cookies = null) {
    return new Promise((resolve, reject) => {
        const urlParts = new URL(url);
        const options = {
            hostname: urlParts.hostname,
            port: urlParts.port || 80,
            path: urlParts.pathname + urlParts.search,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'TaskFlow-Live-Test/1.0'
            }
        };

        if (cookies) {
            options.headers['Cookie'] = cookies;
        }

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const parsedBody = JSON.parse(body);
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        body: parsedBody
                    });
                } catch (error) {
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        body: body
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

async function testLiveSystemProfile() {
    console.log('🚀 Testing Live System Profile Integration...\n');

    try {
        // Step 1: Check frontend is accessible
        console.log('1. Checking frontend accessibility...');
        const frontendResponse = await makeRequest(FRONTEND_URL);
        console.log(`   Frontend Status: ${frontendResponse.status}`);
        
        // Step 2: Check backend health
        console.log('\n2. Checking backend health...');
        const healthResponse = await makeRequest(`${API_BASE_URL}/health`);
        console.log(`   Backend Status: ${healthResponse.status}`);
        console.log(`   Service: ${healthResponse.body.service}`);
        console.log(`   Version: ${healthResponse.body.version}`);

        // Step 3: Test login flow
        console.log('\n3. Testing login flow...');
        const loginResponse = await makeRequest(
            `${API_BASE_URL}/api/v2/auth/login`, 
            'POST', 
            testCredentials
        );
        console.log(`   Login Status: ${loginResponse.status}`);
        console.log(`   Login Success: ${loginResponse.body.success}`);
        
        if (!loginResponse.body.success) {
            console.log(`   ❌ Login failed: ${loginResponse.body.error}`);
            return false;
        }

        // Extract cookie
        const setCookieHeader = loginResponse.headers['set-cookie'];
        if (!setCookieHeader) {
            console.log('   ❌ No authentication cookie received');
            return false;
        }
        
        const cookies = setCookieHeader.map(cookie => cookie.split(';')[0]).join('; ');
        console.log(`   ✅ Authentication cookie received`);

        // Step 4: Test profile API with authentication
        console.log('\n4. Testing authenticated profile API...');
        const profileResponse = await makeRequest(
            `${API_BASE_URL}/api/v2/auth/profile`,
            'GET',
            null,
            cookies
        );

        console.log(`   Profile Status: ${profileResponse.status}`);
        console.log(`   Profile Success: ${profileResponse.body.success}`);

        if (!profileResponse.body.success) {
            console.log(`   ❌ Profile API failed: ${profileResponse.body.error}`);
            return false;
        }

        // Step 5: Validate profile structure matches frontend expectations
        console.log('\n5. Validating profile structure...');
        const data = profileResponse.body;
        
        const checks = [
            { path: 'data.user', value: data.user, required: true },
            { path: 'data.user.user', value: data.user?.user, required: true },
            { path: 'data.user.capabilities', value: data.user?.capabilities, required: true },
            { path: 'data.user.navigation', value: data.user?.navigation, required: true },
            { path: 'data.user.displayName', value: data.user?.displayName, required: true },
            { path: 'data.user.user.role', value: data.user?.user?.role, required: true },
            { path: 'data.user.user.email', value: data.user?.user?.email, required: true },
            { path: 'data.user.user.fullName', value: data.user?.user?.fullName, required: true }
        ];

        let allChecksPassed = true;
        checks.forEach(check => {
            const exists = check.value !== undefined && check.value !== null;
            const status = exists ? '✅' : (check.required ? '❌' : '⚠️');
            console.log(`   ${status} ${check.path}: ${exists ? 'exists' : 'missing'}`);
            if (check.required && !exists) {
                allChecksPassed = false;
            }
        });

        // Step 6: Simulate frontend profile parsing
        console.log('\n6. Simulating frontend profile parsing...');
        const roleMapping = {
            'master': 'Manager',
            'manager': 'Manager', 
            'team_lead': 'Team Lead',
            'employee': 'Employee',
            'user': 'User'
        };
        
        const currentUser = {
            role: roleMapping[data.user.user.role] || 'User',
            name: data.user.user.fullName || data.user.user.email,
            email: data.user.user.email,
            capabilities: data.user.capabilities || {},
            navigation: data.user.navigation || [],
            displayName: data.user.displayName || roleMapping[data.user.user.role] || 'User',
            backendRole: data.user.user.role
        };

        console.log(`   ✅ Role: ${currentUser.role} (${currentUser.backendRole})`);
        console.log(`   ✅ Name: ${currentUser.name}`);
        console.log(`   ✅ Email: ${currentUser.email}`);
        console.log(`   ✅ Capabilities: ${Object.keys(currentUser.capabilities).length} permissions`);
        console.log(`   ✅ Navigation: ${currentUser.navigation.length} items`);
        console.log(`   ✅ Display Name: ${currentUser.displayName}`);

        // Step 7: Test logout
        console.log('\n7. Testing logout...');
        const logoutResponse = await makeRequest(
            `${API_BASE_URL}/api/v2/auth/logout`,
            'POST',
            null,
            cookies
        );
        console.log(`   Logout Status: ${logoutResponse.status}`);
        console.log(`   Logout Success: ${logoutResponse.body.success}`);

        if (allChecksPassed) {
            console.log('\n🎉 LIVE SYSTEM PROFILE INTEGRATION TEST: PASSED');
            console.log('✅ Frontend profile loading is now working correctly');
            console.log('✅ Role-based components should display properly');
            console.log('✅ User capabilities are correctly loaded');
            console.log('✅ Navigation components are available');
            return true;
        } else {
            console.log('\n❌ LIVE SYSTEM PROFILE INTEGRATION TEST: FAILED');
            console.log('Some required profile data is missing');
            return false;
        }

    } catch (error) {
        console.error('❌ Live system test failed:', error.message);
        return false;
    }
}

// Run the test
testLiveSystemProfile().then(success => {
    process.exit(success ? 0 : 1);
}).catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
});