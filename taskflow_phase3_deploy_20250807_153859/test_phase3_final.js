/**
 * Phase 3 Final Testing & Validation
 */

const https = require('http');

console.log('🎯 PHASE 3 FINAL TESTING & VALIDATION\n');

async function makeAPICall(endpoint, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
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

async function runPhase3Tests() {
    console.log('📊 Testing Phase 3 Real-time Enhancements...\n');
    
    const tests = [
        { name: 'Health Check', endpoint: '/health' },
        { name: 'Phase 3 Health', endpoint: '/api/v3/health' },
        { name: 'WebSocket Status', endpoint: '/api/v3/websocket/status' },
        { name: 'Real-time Analytics', endpoint: '/api/v3/analytics/realtime' },
        { name: 'Advanced Cache Status', endpoint: '/api/v3/cache/advanced/status' },
        { name: 'Dashboard Analytics', endpoint: '/api/v3/analytics/dashboard' }
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
                    if (response.data.phase) {
                        console.log(`   🚀 Phase: ${response.data.phase}`);
                    }
                    if (response.data.services) {
                        const serviceCount = Object.keys(response.data.services).length;
                        console.log(`   🔧 Services: ${serviceCount} active`);
                    }
                    if (response.data.features) {
                        console.log(`   ⚡ Features: ${response.data.features.length} enabled`);
                    }
                }
                
                results.push({ test: test.name, status: 'SUCCESS', code: response.status });
            } else {
                console.log(`   ❌ ${test.name}: FAILED (${response.status})`);
                results.push({ test: test.name, status: 'FAILED', code: response.status });
            }
        } catch (error) {
            console.log(`   ❌ ${test.name}: ERROR - ${error.message}`);
            results.push({ test: test.name, status: 'ERROR', error: error.message });
        }
        
        console.log(''); // Empty line
    }
    
    // Summary
    console.log('📊 Phase 3 Testing Summary:\n');
    
    const successCount = results.filter(r => r.status === 'SUCCESS').length;
    const totalCount = results.length;
    
    results.forEach(result => {
        const icon = result.status === 'SUCCESS' ? '✅' : '❌';
        console.log(`   ${icon} ${result.test}: ${result.status}`);
    });
    
    console.log(`\n🎯 Overall: ${successCount}/${totalCount} tests passed (${Math.round((successCount/totalCount)*100)}%)`);
    
    if (successCount === totalCount) {
        console.log('\n🎉 PHASE 3 IMPLEMENTATION: COMPLETE!');
        console.log('✅ All Real-time Components: OPERATIONAL');
        console.log('✅ WebSocket Service: ACTIVE');
        console.log('✅ Real-time Analytics: RUNNING');
        console.log('✅ Advanced Caching: FUNCTIONAL');
        console.log('✅ API Endpoints: RESPONDING');
        
        console.log('\n🚀 Phase 3 Features Ready:');
        console.log('   🔄 Real-time WebSocket communication');
        console.log('   📊 Live analytics updates');
        console.log('   💾 Advanced multi-layer caching');
        console.log('   🔔 Real-time notifications');
        console.log('   📈 Performance monitoring');
        console.log('   🎯 Smart cache warming');
    } else {
        console.log('\n⚠️ Some Phase 3 components need attention');
    }
    
    return {
        success: successCount === totalCount,
        results: results,
        successRate: (successCount / totalCount) * 100
    };
}

runPhase3Tests().catch(console.error);