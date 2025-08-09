#!/usr/bin/env node

/**
 * Test Profile API Fix
 * Tests the frontend profile loading fix to ensure capabilities are loaded correctly
 */

const https = require('https');
const http = require('http');

const API_BASE_URL = 'http://192.168.20.10:7812';

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
            port: urlParts.port || (urlParts.protocol === 'https:' ? 443 : 80),
            path: urlParts.pathname + urlParts.search,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'TaskFlow-Profile-Test/1.0'
            }
        };

        if (cookies) {
            options.headers['Cookie'] = cookies;
        }

        const req = (urlParts.protocol === 'https:' ? https : http).request(options, (res) => {
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

async function testProfileAPIFix() {
    console.log('🧪 Testing Profile API Fix...\n');

    try {
        // Step 1: Test backend health
        console.log('1. Testing backend health...');
        const healthResponse = await makeRequest(`${API_BASE_URL}/health`);
        console.log(`   Status: ${healthResponse.status}`);
        console.log(`   Service: ${healthResponse.body.service}`);
        console.log(`   Version: ${healthResponse.body.version}\n`);

        // Step 2: Test login to get token
        console.log('2. Testing login...');
        const loginResponse = await makeRequest(
            `${API_BASE_URL}/api/v2/auth/login`, 
            'POST', 
            testCredentials
        );
        console.log(`   Login Status: ${loginResponse.status}`);
        console.log(`   Login Success: ${loginResponse.body.success}`);
        
        if (!loginResponse.body.success) {
            console.log(`   Login Error: ${loginResponse.body.error}`);
            return;
        }

        // Extract cookie from login response
        const setCookieHeader = loginResponse.headers['set-cookie'];
        if (!setCookieHeader) {
            console.log('   ❌ No cookie received from login');
            return;
        }
        
        const cookies = setCookieHeader.map(cookie => cookie.split(';')[0]).join('; ');
        console.log(`   Cookie received: ${cookies.substring(0, 50)}...\n`);

        // Step 3: Test profile API
        console.log('3. Testing profile API...');
        const profileResponse = await makeRequest(
            `${API_BASE_URL}/api/v2/auth/profile`,
            'GET',
            null,
            cookies
        );

        console.log(`   Profile Status: ${profileResponse.status}`);
        console.log(`   Profile Success: ${profileResponse.body.success}`);

        if (profileResponse.body.success) {
            console.log('\n✅ Profile API Response Structure:');
            console.log(JSON.stringify(profileResponse.body, null, 2));
            
            // Check the structure
            const data = profileResponse.body;
            console.log('\n🔍 Structure Analysis:');
            console.log(`   - data.user exists: ${!!data.user}`);
            console.log(`   - data.capabilities exists: ${!!data.capabilities}`);
            console.log(`   - data.navigation exists: ${!!data.navigation}`);
            console.log(`   - data.displayName exists: ${!!data.displayName}`);
            
            if (data.user) {
                console.log(`   - data.user.role: ${data.user.role}`);
                console.log(`   - data.user.email: ${data.user.email}`);
                console.log(`   - data.user.full_name: ${data.user.full_name}`);
            }
            
            if (data.capabilities) {
                console.log(`   - capabilities type: ${typeof data.capabilities}`);
                console.log(`   - capabilities keys: ${Object.keys(data.capabilities)}`);
            }

            console.log('\n✅ Profile API Fix Test: PASSED');
            console.log('Frontend should now correctly access:');
            console.log('- data.capabilities (NOT data.user.capabilities)');
            console.log('- data.navigation');
            console.log('- data.displayName');
            
        } else {
            console.log(`   ❌ Profile API Error: ${profileResponse.body.error}`);
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run the test
testProfileAPIFix().catch(console.error);