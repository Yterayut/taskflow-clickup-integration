#!/usr/bin/env node

// Live OAuth Code Testing Script
// Automatically generates fresh OAuth URLs and tests token exchange

const axios = require('axios');
const crypto = require('crypto');

const CLICKUP_CONFIG = {
    clientId: 'DA3L6I2MS7RC39PFH7PZGRZAG4A1J8LL',
    clientSecret: 'BNLH0AZH1P4MHXQSANAM6N5RKNJPDD4I2IBC157H57G9V5NNET1HQ7V8I63K98ZX',
    redirectUri: '192.168.20.10:777',
    baseApiUrl: 'https://api.clickup.com/api/v2'
};

function log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
    if (data) {
        console.log(JSON.stringify(data, null, 2));
    }
}

async function generateOAuthURL() {
    try {
        console.log('🔗 Generating fresh OAuth URL...');
        
        const state = crypto.randomBytes(32).toString('hex');
        const authUrl = `https://app.clickup.com/api?` +
            `client_id=${CLICKUP_CONFIG.clientId}&` +
            `redirect_uri=${encodeURIComponent(CLICKUP_CONFIG.redirectUri)}&` +
            `state=${state}`;
        
        log('info', 'OAuth URL Generated', {
            url: authUrl,
            state: state,
            expires: 'Code expires in ~10 minutes'
        });
        
        console.log('\n📋 COPY THIS URL AND PASTE IN BROWSER:');
        console.log('=' + '='.repeat(60));
        console.log(authUrl);
        console.log('=' + '='.repeat(60));
        
        console.log('\n📝 Instructions:');
        console.log('1. Copy the URL above');
        console.log('2. Paste it in your browser');
        console.log('3. Authorize the ClickUp app');
        console.log('4. Copy the callback URL from browser');
        console.log('5. Run: node oauth_test_live.js test-code "CALLBACK_URL"');
        
        return { authUrl, state };
        
    } catch (error) {
        log('error', 'Failed to generate OAuth URL', error);
        throw error;
    }
}

async function testTokenExchange(callbackUrl) {
    try {
        console.log('🔍 Extracting code from callback URL...');
        
        const url = new URL(callbackUrl);
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        
        if (!code) {
            throw new Error('No authorization code found in URL');
        }
        
        log('info', 'Code extracted from callback', {
            code: code.substring(0, 20) + '...',
            state: state ? state.substring(0, 20) + '...' : 'none',
            fullUrl: callbackUrl
        });
        
        console.log('\n🔄 Testing token exchange...');
        
        // Method 1: Form data (standard)
        const formData = new URLSearchParams();
        formData.append('client_id', CLICKUP_CONFIG.clientId);
        formData.append('client_secret', CLICKUP_CONFIG.clientSecret);
        formData.append('code', code);
        
        log('info', 'Sending token request to ClickUp', {
            endpoint: 'https://app.clickup.com/api/v2/oauth/token',
            method: 'POST',
            contentType: 'application/x-www-form-urlencoded'
        });
        
        const response = await axios.post('https://app.clickup.com/api/v2/oauth/token', formData, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'TaskFlow-Pro/6.0.0'
            },
            timeout: 30000,
            validateStatus: function (status) {
                return status < 500; // Accept any status < 500
            }
        });
        
        log('info', 'Token exchange response', {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
            dataType: typeof response.data
        });
        
        if (response.status === 200 && response.data && response.data.access_token) {
            const accessToken = response.data.access_token;
            
            console.log('\n🎉 TOKEN EXCHANGE SUCCESS!');
            log('info', 'Access token received', {
                hasToken: true,
                tokenLength: accessToken.length,
                tokenPreview: accessToken.substring(0, 20) + '...',
                expires: response.data.expires_in ? `${response.data.expires_in} seconds` : 'unknown'
            });
            
            // Test the token with ClickUp API
            console.log('\n🧪 Testing token with ClickUp API...');
            await testClickUpAPI(accessToken);
            
            return accessToken;
            
        } else {
            throw new Error(`Token exchange failed: HTTP ${response.status} - ${JSON.stringify(response.data)}`);
        }
        
    } catch (error) {
        log('error', 'Token exchange failed', {
            error: error.message,
            response: error.response ? {
                status: error.response.status,
                data: error.response.data
            } : 'no-response'
        });
        throw error;
    }
}

async function testClickUpAPI(accessToken) {
    try {
        const headers = {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        };
        
        // Test 1: Get user info
        console.log('📊 Testing /user endpoint...');
        const userResponse = await axios.get(`${CLICKUP_CONFIG.baseApiUrl}/user`, {
            headers,
            timeout: 15000
        });
        
        log('info', 'User API test successful', {
            user: userResponse.data.user.username,
            email: userResponse.data.user.email,
            id: userResponse.data.user.id
        });
        
        // Test 2: Get teams
        console.log('🏢 Testing /team endpoint...');
        const teamsResponse = await axios.get(`${CLICKUP_CONFIG.baseApiUrl}/team`, {
            headers,
            timeout: 15000
        });
        
        log('info', 'Teams API test successful', {
            teamCount: teamsResponse.data.teams.length,
            teams: teamsResponse.data.teams.map(t => ({ id: t.id, name: t.name }))
        });
        
        console.log('\n✅ ALL TESTS PASSED!');
        console.log('🚀 ClickUp OAuth integration is working perfectly!');
        
        return {
            user: userResponse.data.user,
            teams: teamsResponse.data.teams
        };
        
    } catch (error) {
        log('error', 'ClickUp API test failed', {
            error: error.message,
            response: error.response ? {
                status: error.response.status,
                data: error.response.data
            } : 'no-response'
        });
        throw error;
    }
}

// Main execution
async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log('🚀 OAuth Live Testing Tool');
        console.log('==========================\n');
        
        console.log('Usage:');
        console.log('  node oauth_test_live.js                    # Generate OAuth URL');
        console.log('  node oauth_test_live.js test-code "URL"    # Test with callback URL');
        console.log('');
        
        await generateOAuthURL();
        
    } else if (args[0] === 'test-code' && args[1]) {
        console.log('🧪 Testing OAuth Code from Callback URL');
        console.log('==========================================\n');
        
        await testTokenExchange(args[1]);
        
    } else {
        console.log('❌ Invalid arguments. Use:');
        console.log('  node oauth_test_live.js');
        console.log('  node oauth_test_live.js test-code "callback_url"');
        process.exit(1);
    }
}

// Handle errors
process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled error:', error.message);
    process.exit(1);
});

// Run
main().catch(error => {
    console.error('❌ Script failed:', error.message);
    process.exit(1);
});