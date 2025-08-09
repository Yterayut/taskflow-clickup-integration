/**
 * Production Phase 3 Deployment Validation Test
 */

const https = require('http');

console.log('🎯 PRODUCTION PHASE 3 DEPLOYMENT VALIDATION');
console.log('===========================================');
console.log('Testing production server: 192.168.20.10:7812');
console.log('Date:', new Date().toISOString());
console.log('');

async function makeAPICall(endpoint, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: '192.168.20.10',
            port: 7812,
            path: endpoint,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let responseData = '';
            res.on('data', (chunk) => {
                responseData += chunk;
            });
            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(responseData);
                    resolve({
                        status: res.statusCode,
                        data: jsonData
                    });
                } catch (e) {
                    resolve({
                        status: res.statusCode,
                        data: responseData
                    });
                }
            });
        });

        req.on('error', (e) => {
            reject(e);
        });

        req.setTimeout(10000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        if (data && method !== 'GET') {
            req.write(JSON.stringify(data));
        }
        
        req.end();
    });
}

async function runProductionValidation() {
    console.log('📊 Production System Tests');
    console.log('---------------------------');
    
    const tests = [
        { name: 'Health Check', endpoint: '/health' },
        { name: 'Phase 3 Health', endpoint: '/api/v3/health' },
        { name: 'WebSocket Status', endpoint: '/api/v3/websocket/status' },
        { name: 'Real-time Analytics', endpoint: '/api/v3/analytics/realtime' },
        { name: 'Advanced Cache Status', endpoint: '/api/v3/cache/advanced/status' },
        { name: 'Background Sync Status', endpoint: '/api/v2/sync/status' }
    ];
    
    const results = [];
    
    for (const test of tests) {
        try {
            console.log(`🔍 Testing ${test.name}...`);
            const response = await makeAPICall(test.endpoint);
            
            if (response.status === 200) {
                console.log(`   ✅ ${test.name}: SUCCESS`);
                
                if (response.data) {
                    if (response.data.status) {
                        console.log(`   📊 Status: ${response.data.status}`);
                    }
                    if (response.data.version) {
                        console.log(`   🔧 Version: ${response.data.version}`);
                    }
                    if (response.data.phase) {
                        console.log(`   🚀 Phase: ${response.data.phase}`);
                    }
                    if (response.data.services) {
                        const serviceCount = Object.keys(response.data.services).length;
                        console.log(`   🔧 Services: ${serviceCount} detected`);
                    }
                }
                
                results.push({ test: test.name, status: 'SUCCESS', code: response.status });
            } else {
                console.log(`   ❌ ${test.name}: FAILED (${response.status})`);
                console.log(`   📋 Response: ${JSON.stringify(response.data).substring(0, 100)}...`);
                results.push({ test: test.name, status: 'FAILED', code: response.status });
            }
        } catch (error) {
            console.log(`   ❌ ${test.name}: ERROR - ${error.message}`);
            results.push({ test: test.name, status: 'ERROR', error: error.message });
        }
        
        console.log(''); // Empty line
    }
    
    // Authentication Test
    console.log('🔐 Authentication Test');
    console.log('----------------------');
    
    try {
        console.log('🔍 Testing user authentication...');
        const authResponse = await makeAPICall('/api/v2/auth/login', 'POST', {
            email: 'chaiwutwck@gmail.com',
            password: '12345'
        });
        
        if (authResponse.status === 200 && authResponse.data.success) {
            console.log('   ✅ Authentication: SUCCESS');
            console.log(`   👤 User: ${authResponse.data.user.name} (${authResponse.data.user.role})`);
            results.push({ test: 'Authentication', status: 'SUCCESS', code: authResponse.status });
        } else {
            console.log('   ❌ Authentication: FAILED');
            results.push({ test: 'Authentication', status: 'FAILED', code: authResponse.status });
        }
    } catch (error) {
        console.log(`   ❌ Authentication: ERROR - ${error.message}`);
        results.push({ test: 'Authentication', status: 'ERROR', error: error.message });
    }
    
    console.log('');
    
    // Summary
    console.log('📊 Production Validation Summary');
    console.log('================================');
    
    const successCount = results.filter(r => r.status === 'SUCCESS').length;
    const totalCount = results.length;
    
    results.forEach(result => {
        const icon = result.status === 'SUCCESS' ? '✅' : '❌';
        console.log(`   ${icon} ${result.test}: ${result.status}`);
    });
    
    console.log(`\n🎯 Overall: ${successCount}/${totalCount} tests passed (${Math.round((successCount/totalCount)*100)}%)`);
    
    if (successCount === totalCount) {
        console.log('\n🎉 PRODUCTION DEPLOYMENT: SUCCESSFUL!');
        console.log('✅ All Phase 3 Components: OPERATIONAL');
        console.log('✅ Production Server: HEALTHY');
        console.log('✅ Authentication: WORKING');
        console.log('✅ Real-time Features: ACTIVE');
        
        console.log('\n🌐 Production URLs Ready:');
        console.log('   Main System: http://192.168.20.10:8888/');
        console.log('   Backend API: http://192.168.20.10:7812/');
        console.log('   Phase 3 Dashboard: http://192.168.20.10:7812/phase3');
        console.log('   Health Check: http://192.168.20.10:7812/health');
        console.log('   Phase 3 Health: http://192.168.20.10:7812/api/v3/health');
        
    } else if (successCount >= totalCount * 0.7) {
        console.log('\n⚠️ PRODUCTION DEPLOYMENT: PARTIAL SUCCESS');
        console.log('Most components are operational, but some need attention');
    } else {
        console.log('\n❌ PRODUCTION DEPLOYMENT: NEEDS ATTENTION');
        console.log('Multiple components require fixes');
    }
    
    return {
        success: successCount === totalCount,
        results: results,
        successRate: (successCount / totalCount) * 100
    };
}

runProductionValidation().catch(console.error);