/**
 * Single Login System Validation Script
 * Comprehensive testing of the new authentication system
 */
require('dotenv').config();
const axios = require('axios');

class SingleLoginSystemTester {
    constructor() {
        this.baseUrl = `http://localhost:${process.env.PORT || 7812}`;
        this.testResults = [];
    }

    /**
     * Run all tests
     */
    async runAllTests() {
        console.log('🧪 Starting Single Login System Validation');
        console.log('=' .repeat(50));
        
        try {
            await this.testSystemHealth();
            await this.testSystemStatus();
            await this.testEmailFlowDetection();
            await this.testRegularUserLogin();
            await this.testMasterUserRedirect();
            await this.testTokenVerification();
            await this.testRateLimiting();
            await this.testInvalidInputs();
            
            this.printResults();
        } catch (error) {
            console.error('❌ Test suite failed:', error);
        }
    }

    /**
     * Test system health endpoint
     */
    async testSystemHealth() {
        const testName = 'System Health Check';
        try {
            const response = await axios.get(`${this.baseUrl}/health`);
            
            const expected = {
                status: 'OK',
                service: 'TaskFlow Pro Single Login Authentication Service',
                version: '2.1.0'
            };
            
            const isValid = response.status === 200 &&
                           response.data.status === expected.status &&
                           response.data.service === expected.service &&
                           response.data.version === expected.version;
            
            this.addResult(testName, isValid, response.data);
        } catch (error) {
            this.addResult(testName, false, error.message);
        }
    }

    /**
     * Test system status endpoint
     */
    async testSystemStatus() {
        const testName = 'System Status Check';
        try {
            const response = await axios.get(`${this.baseUrl}/api/v2/system/status`);
            
            const requiredFields = [
                'clickup_connected',
                'is_operational',
                'status_level',
                'message'
            ];
            
            const hasRequiredFields = requiredFields.every(field => 
                response.data.hasOwnProperty(field)
            );
            
            this.addResult(testName, response.status === 200 && hasRequiredFields, response.data);
        } catch (error) {
            this.addResult(testName, false, error.message);
        }
    }

    /**
     * Test email flow detection logic
     */
    async testEmailFlowDetection() {
        const testCases = [
            {
                name: 'Master User Email Detection',
                email: process.env.MASTER_USER_EMAIL,
                password: 'test123',
                expectedRedirect: true
            },
            {
                name: 'Regular User Email Detection',
                email: 'chaiwutwck@gmail.com',
                password: '12345',
                expectedRedirect: false
            }
        ];

        for (const testCase of testCases) {
            try {
                const response = await axios.post(`${this.baseUrl}/api/v2/auth/login`, {
                    email: testCase.email,
                    password: testCase.password
                }, {
                    validateStatus: () => true // Accept all status codes
                });

                const isCorrectFlow = testCase.expectedRedirect ? 
                    response.data.redirect === true :
                    response.data.redirect !== true;

                this.addResult(testCase.name, isCorrectFlow, {
                    redirect: response.data.redirect,
                    expected: testCase.expectedRedirect
                });
            } catch (error) {
                this.addResult(testCase.name, false, error.message);
            }
        }
    }

    /**
     * Test regular user login (expect system not ready or success)
     */
    async testRegularUserLogin() {
        const testName = 'Regular User Login Flow';
        try {
            const response = await axios.post(`${this.baseUrl}/api/v2/auth/login`, {
                email: 'chaiwutwck@gmail.com',
                password: '12345',
                rememberMe: false
            }, {
                validateStatus: () => true
            });

            // Should either succeed (if system ready) or fail with system not ready
            const isValidResponse = 
                (response.status === 200 && response.data.success) ||
                (response.status === 503 && response.data.code === 'SYSTEM_NOT_READY') ||
                (response.status === 401 && response.data.code === 'INVALID_CREDENTIALS');

            this.addResult(testName, isValidResponse, {
                status: response.status,
                data: response.data
            });
        } catch (error) {
            this.addResult(testName, false, error.message);
        }
    }

    /**
     * Test master user redirect behavior
     */
    async testMasterUserRedirect() {
        const testName = 'Master User OAuth Redirect';
        try {
            const response = await axios.post(`${this.baseUrl}/api/v2/auth/login`, {
                email: process.env.MASTER_USER_EMAIL,
                password: 'any-password' // Password ignored for master
            }, {
                validateStatus: () => true
            });

            const isCorrectRedirect = response.data.redirect === true &&
                                    response.data.location &&
                                    response.data.location.includes('clickup.com');

            this.addResult(testName, isCorrectRedirect, response.data);
        } catch (error) {
            this.addResult(testName, false, error.message);
        }
    }

    /**
     * Test token verification endpoint
     */
    async testTokenVerification() {
        const testName = 'Token Verification Endpoint';
        try {
            // Test without token
            const response = await axios.get(`${this.baseUrl}/api/v2/auth/verify`, {
                validateStatus: () => true
            });

            const isCorrectUnauthorized = response.status === 401 &&
                                        response.data.code === 'TOKEN_MISSING';

            this.addResult(testName, isCorrectUnauthorized, {
                status: response.status,
                code: response.data.code
            });
        } catch (error) {
            this.addResult(testName, false, error.message);
        }
    }

    /**
     * Test rate limiting
     */
    async testRateLimiting() {
        const testName = 'Rate Limiting Protection';
        try {
            const requests = [];
            const maxRequests = 6; // Should exceed the limit of 5

            for (let i = 0; i < maxRequests; i++) {
                requests.push(
                    axios.post(`${this.baseUrl}/api/v2/auth/login`, {
                        email: 'test@example.com',
                        password: 'wrong-password'
                    }, {
                        validateStatus: () => true
                    })
                );
            }

            const responses = await Promise.all(requests);
            const rateLimitedResponse = responses.find(r => r.status === 429);

            this.addResult(testName, !!rateLimitedResponse, {
                totalRequests: maxRequests,
                rateLimited: !!rateLimitedResponse
            });
        } catch (error) {
            this.addResult(testName, false, error.message);
        }
    }

    /**
     * Test invalid input handling
     */
    async testInvalidInputs() {
        const testCases = [
            {
                name: 'Missing Email',
                data: { password: '12345' },
                expectedCode: 'MISSING_CREDENTIALS'
            },
            {
                name: 'Missing Password',
                data: { email: 'test@example.com' },
                expectedCode: 'MISSING_CREDENTIALS'
            },
            {
                name: 'Invalid Email Format',
                data: { email: 'invalid-email', password: '12345' },
                expectedCode: 'INVALID_EMAIL'
            }
        ];

        for (const testCase of testCases) {
            try {
                const response = await axios.post(`${this.baseUrl}/api/v2/auth/login`, testCase.data, {
                    validateStatus: () => true
                });

                const isCorrectError = response.status === 400 &&
                                     response.data.code === testCase.expectedCode;

                this.addResult(testCase.name, isCorrectError, {
                    status: response.status,
                    code: response.data.code,
                    expected: testCase.expectedCode
                });
            } catch (error) {
                this.addResult(testCase.name, false, error.message);
            }
        }
    }

    /**
     * Add test result
     */
    addResult(testName, passed, details) {
        this.testResults.push({
            test: testName,
            passed,
            details
        });

        const icon = passed ? '✅' : '❌';
        console.log(`${icon} ${testName}: ${passed ? 'PASSED' : 'FAILED'}`);
        
        if (!passed || process.env.DEBUG_TESTS === 'true') {
            console.log('   Details:', JSON.stringify(details, null, 2));
        }
    }

    /**
     * Print final test results
     */
    printResults() {
        console.log('\n' + '='.repeat(50));
        console.log('📊 TEST RESULTS SUMMARY');
        console.log('='.repeat(50));

        const passedTests = this.testResults.filter(r => r.passed).length;
        const totalTests = this.testResults.length;
        const passRate = ((passedTests / totalTests) * 100).toFixed(1);

        console.log(`Total Tests: ${totalTests}`);
        console.log(`Passed: ${passedTests}`);
        console.log(`Failed: ${totalTests - passedTests}`);
        console.log(`Pass Rate: ${passRate}%`);

        if (passedTests === totalTests) {
            console.log('\n🎉 All tests passed! System validation successful.');
        } else {
            console.log('\n⚠️  Some tests failed. Please review the results above.');
        }

        // Failed tests summary
        const failedTests = this.testResults.filter(r => !r.passed);
        if (failedTests.length > 0) {
            console.log('\n❌ Failed Tests:');
            failedTests.forEach(test => {
                console.log(`   - ${test.test}`);
            });
        }
    }
}

// Run tests if called directly
if (require.main === module) {
    const tester = new SingleLoginSystemTester();
    tester.runAllTests().catch(error => {
        console.error('Test runner error:', error);
        process.exit(1);
    });
}

module.exports = { SingleLoginSystemTester };