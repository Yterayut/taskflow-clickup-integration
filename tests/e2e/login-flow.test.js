// End-to-End Tests for Complete Login Flow
const request = require('supertest');
const path = require('path');
const { spawn } = require('child_process');
const { resetTestData } = require('../test-setup');

// Test against actual auth server
const AUTH_SERVER_URL = process.env.TEST_AUTH_SERVER_URL || 'http://localhost:7811';
const FRONTEND_LOGIN_URL = process.env.TEST_FRONTEND_URL || 'http://localhost:8889';

describe('End-to-End Login Flow Tests', () => {
    let authServer;

    beforeAll(async () => {
        // Start test auth server if not already running
        if (!process.env.TEST_AUTH_SERVER_URL) {
            authServer = spawn('node', ['auth_server.js'], {
                env: { ...process.env, NODE_ENV: 'test' },
                cwd: path.join(__dirname, '../../'),
                stdio: 'pipe'
            });

            // Wait for server to start
            await new Promise((resolve) => {
                authServer.stdout.on('data', (data) => {
                    if (data.toString().includes('Authentication system ready')) {
                        resolve();
                    }
                });
            });
        }
    });

    afterAll(async () => {
        if (authServer) {
            authServer.kill();
        }
    });

    beforeEach(async () => {
        await resetTestData();
    });

    describe('Complete Authentication Workflow', () => {
        it('should complete full user authentication journey', async () => {
            // Step 1: Health check
            const healthResponse = await request(AUTH_SERVER_URL)
                .get('/health');

            expect(healthResponse.status).toBe(200);
            expect(healthResponse.body.status).toBe('OK');

            // Step 2: Login with valid credentials
            const loginResponse = await request(AUTH_SERVER_URL)
                .post('/api/auth/login')
                .send({
                    email: 'test.employee@example.com',
                    password: 'testpass123',
                    rememberMe: false
                })
                .expect(200);

            expect(loginResponse.body.success).toBe(true);
            expect(loginResponse.body.token).toBeTruthy();
            expect(loginResponse.body.user).toMatchObject({
                email: 'test.employee@example.com',
                role: 'employee',
                fullName: 'Test Employee User'
            });

            const authToken = loginResponse.body.token;
            const authCookies = loginResponse.headers['set-cookie'];

            // Step 3: Verify authentication status
            const verifyResponse = await request(AUTH_SERVER_URL)
                .get('/api/auth/verify')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(verifyResponse.body.success).toBe(true);
            expect(verifyResponse.body.user.email).toBe('test.employee@example.com');

            // Step 4: Access protected profile endpoint
            const profileResponse = await request(AUTH_SERVER_URL)
                .get('/api/auth/profile')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(profileResponse.body.success).toBe(true);
            expect(profileResponse.body.profile.email).toBe('test.employee@example.com');

            // Step 5: Change password
            const changePasswordResponse = await request(AUTH_SERVER_URL)
                .post('/api/auth/change-password')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    currentPassword: 'testpass123',
                    newPassword: 'newpassword456',
                    confirmPassword: 'newpassword456'
                })
                .expect(200);

            expect(changePasswordResponse.body.success).toBe(true);

            // Step 6: Verify old password no longer works
            const oldPasswordResponse = await request(AUTH_SERVER_URL)
                .post('/api/auth/login')
                .send({
                    email: 'test.employee@example.com',
                    password: 'testpass123'
                })
                .expect(401);

            expect(oldPasswordResponse.body.success).toBe(false);

            // Step 7: Login with new password
            const newLoginResponse = await request(AUTH_SERVER_URL)
                .post('/api/auth/login')
                .send({
                    email: 'test.employee@example.com',
                    password: 'newpassword456'
                })
                .expect(200);

            expect(newLoginResponse.body.success).toBe(true);
            const newAuthToken = newLoginResponse.body.token;

            // Step 8: Refresh token
            const refreshResponse = await request(AUTH_SERVER_URL)
                .post('/api/auth/refresh')
                .set('Authorization', `Bearer ${newAuthToken}`)
                .expect(200);

            expect(refreshResponse.body.success).toBe(true);
            expect(refreshResponse.body.token).toBeTruthy();
            expect(refreshResponse.body.token).not.toBe(newAuthToken);

            // Step 9: Logout
            const logoutResponse = await request(AUTH_SERVER_URL)
                .post('/api/auth/logout')
                .set('Authorization', `Bearer ${newAuthToken}`)
                .expect(200);

            expect(logoutResponse.body.success).toBe(true);

            // Step 10: Verify token is invalidated (this would require token blacklisting)
            // For now, we just verify the logout was successful
            expect(logoutResponse.headers['set-cookie']).toBeDefined();
        });

        it('should handle different user roles correctly', async () => {
            const roles = [
                { email: 'test.master@example.com', expectedRole: 'master' },
                { email: 'test.manager@example.com', expectedRole: 'manager' },
                { email: 'test.teamlead@example.com', expectedRole: 'team_lead' },
                { email: 'test.employee@example.com', expectedRole: 'employee' }
            ];

            for (const { email, expectedRole } of roles) {
                const loginResponse = await request(AUTH_SERVER_URL)
                    .post('/api/auth/login')
                    .send({
                        email: email,
                        password: 'testpass123'
                    })
                    .expect(200);

                expect(loginResponse.body.user.role).toBe(expectedRole);

                // Verify role persists in token verification
                const verifyResponse = await request(AUTH_SERVER_URL)
                    .get('/api/auth/verify')
                    .set('Authorization', `Bearer ${loginResponse.body.token}`)
                    .expect(200);

                expect(verifyResponse.body.user.role).toBe(expectedRole);
            }
        });

        it('should handle cookie-based authentication', async () => {
            // Login and get cookies
            const loginResponse = await request(AUTH_SERVER_URL)
                .post('/api/auth/login')
                .send({
                    email: 'test.employee@example.com',
                    password: 'testpass123'
                });

            const cookies = loginResponse.headers['set-cookie'];
            expect(cookies).toBeDefined();

            // Use cookies for authentication
            const verifyResponse = await request(AUTH_SERVER_URL)
                .get('/api/auth/verify')
                .set('Cookie', cookies)
                .expect(200);

            expect(verifyResponse.body.success).toBe(true);
            expect(verifyResponse.body.user.email).toBe('test.employee@example.com');
        });

        it('should handle remember me functionality', async () => {
            // Login with remember me
            const loginResponse = await request(AUTH_SERVER_URL)
                .post('/api/auth/login')
                .send({
                    email: 'test.employee@example.com',
                    password: 'testpass123',
                    rememberMe: true
                })
                .expect(200);

            expect(loginResponse.body.expiresIn).toBe('30d');

            const cookies = loginResponse.headers['set-cookie'];
            const taskflowCookie = cookies.find(cookie => cookie.startsWith('taskflow_token='));
            
            // Should have longer max-age
            expect(taskflowCookie).toBeTruthy();
            // Note: Exact max-age testing would require parsing the cookie
        });
    });

    describe('Error Scenarios and Edge Cases', () => {
        it('should handle invalid login attempts gracefully', async () => {
            const invalidAttempts = [
                { email: 'nonexistent@example.com', password: 'testpass123' },
                { email: 'test.employee@example.com', password: 'wrongpassword' },
                { email: 'invalid-email', password: 'testpass123' },
                { email: 'test.employee@example.com', password: '' },
                { email: '', password: 'testpass123' }
            ];

            for (const { email, password } of invalidAttempts) {
                const response = await request(AUTH_SERVER_URL)
                    .post('/api/auth/login')
                    .send({ email, password });

                expect(response.status).toBeGreaterThanOrEqual(400);
                expect(response.body.success).toBe(false);
            }
        });

        it('should handle inactive user login attempt', async () => {
            const response = await request(AUTH_SERVER_URL)
                .post('/api/auth/login')
                .send({
                    email: 'inactive.user@example.com',
                    password: 'testpass123'
                })
                .expect(401);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Invalid email or password');
        });

        it('should handle malformed requests', async () => {
            // Missing required fields
            const response1 = await request(AUTH_SERVER_URL)
                .post('/api/auth/login')
                .send({})
                .expect(400);

            expect(response1.body.success).toBe(false);

            // Invalid JSON
            const response2 = await request(AUTH_SERVER_URL)
                .post('/api/auth/login')
                .set('Content-Type', 'application/json')
                .send('{"invalid": json}')
                .expect(400);

            // Large payload
            const largePayload = {
                email: 'test@example.com',
                password: 'a'.repeat(10000),
                extra: 'x'.repeat(50000)
            };

            const response3 = await request(AUTH_SERVER_URL)
                .post('/api/auth/login')
                .send(largePayload);

            expect(response3.status).toBeGreaterThanOrEqual(400);
        });

        it('should handle concurrent authentication requests', async () => {
            const concurrentRequests = Array(10).fill().map(() =>
                request(AUTH_SERVER_URL)
                    .post('/api/auth/login')
                    .send({
                        email: 'test.employee@example.com',
                        password: 'testpass123'
                    })
            );

            const responses = await Promise.allSettled(concurrentRequests);

            // All requests should succeed
            responses.forEach(result => {
                expect(result.status).toBe('fulfilled');
                expect(result.value.status).toBe(200);
                expect(result.value.body.success).toBe(true);
            });
        });

        it('should enforce rate limiting', async () => {
            const rapidRequests = [];
            
            // Make multiple rapid failed login attempts
            for (let i = 0; i < 7; i++) {
                rapidRequests.push(
                    request(AUTH_SERVER_URL)
                        .post('/api/auth/login')
                        .send({
                            email: 'test.employee@example.com',
                            password: 'wrongpassword'
                        })
                );
            }

            const responses = await Promise.all(rapidRequests);
            
            // Some requests should be rate limited
            const rateLimitedResponses = responses.filter(r => r.status === 429);
            expect(rateLimitedResponses.length).toBeGreaterThan(0);
        });
    });

    describe('Security Validation', () => {
        it('should not expose sensitive information', async () => {
            // Test that errors don't reveal too much information
            const response = await request(AUTH_SERVER_URL)
                .post('/api/auth/login')
                .send({
                    email: 'nonexistent@example.com',
                    password: 'password123'
                })
                .expect(401);

            // Should not reveal whether email exists or not
            expect(response.body.message).toBe('Invalid email or password');
            expect(response.body).not.toHaveProperty('details');
            expect(response.body).not.toHaveProperty('stack');
        });

        it('should set appropriate security headers', async () => {
            const response = await request(AUTH_SERVER_URL)
                .get('/health');

            expect(response.headers).toHaveProperty('x-content-type-options');
            expect(response.headers).toHaveProperty('x-frame-options');
            expect(response.headers['x-content-type-options']).toBe('nosniff');
        });

        it('should use secure cookie settings in production', async () => {
            // This would need to be tested with NODE_ENV=production
            const loginResponse = await request(AUTH_SERVER_URL)
                .post('/api/auth/login')
                .send({
                    email: 'test.employee@example.com',
                    password: 'testpass123'
                });

            const cookies = loginResponse.headers['set-cookie'];
            const taskflowCookie = cookies.find(cookie => cookie.startsWith('taskflow_token='));

            expect(taskflowCookie).toContain('HttpOnly');
            expect(taskflowCookie).toContain('SameSite=Strict');
        });

        it('should handle JWT token edge cases', async () => {
            // Test with malformed JWT
            const response1 = await request(AUTH_SERVER_URL)
                .get('/api/auth/verify')
                .set('Authorization', 'Bearer malformed.jwt.token')
                .expect(401);

            expect(response1.body.success).toBe(false);

            // Test with empty Authorization header
            const response2 = await request(AUTH_SERVER_URL)
                .get('/api/auth/verify')
                .set('Authorization', 'Bearer ')
                .expect(401);

            expect(response2.body.success).toBe(false);

            // Test with no Authorization header
            const response3 = await request(AUTH_SERVER_URL)
                .get('/api/auth/verify')
                .expect(401);

            expect(response3.body.success).toBe(false);
        });
    });

    describe('Performance and Reliability', () => {
        it('should handle authentication requests within acceptable time', async () => {
            const startTime = Date.now();

            await request(AUTH_SERVER_URL)
                .post('/api/auth/login')
                .send({
                    email: 'test.employee@example.com',
                    password: 'testpass123'
                })
                .expect(200);

            const endTime = Date.now();
            const responseTime = endTime - startTime;

            // Should complete within 2 seconds
            expect(responseTime).toBeLessThan(2000);
        });

        it('should maintain consistent performance under load', async () => {
            const requests = Array(20).fill().map(() => {
                const startTime = Date.now();
                return request(AUTH_SERVER_URL)
                    .post('/api/auth/login')
                    .send({
                        email: 'test.employee@example.com',
                        password: 'testpass123'
                    })
                    .then(response => ({
                        response,
                        duration: Date.now() - startTime
                    }));
            });

            const results = await Promise.all(requests);

            // All should succeed
            results.forEach(({ response }) => {
                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
            });

            // Performance should be consistent
            const durations = results.map(r => r.duration);
            const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
            const maxDuration = Math.max(...durations);

            expect(avgDuration).toBeLessThan(1000); // Average under 1 second
            expect(maxDuration).toBeLessThan(3000); // Max under 3 seconds
        });
    });
});