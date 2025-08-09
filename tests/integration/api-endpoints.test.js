// Integration Tests for API Endpoints
const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const authRoutes = require('../../auth/authRoutes');
const { resetTestData, getTestUser, createTestClickUpToken } = require('../test-setup');

// Use real dependencies for integration tests
jest.unmock('../../auth/authService');
jest.unmock('../../auth/jwt');
jest.unmock('../../database/config');

describe('API Endpoints Integration Tests', () => {
    let app;

    beforeAll(() => {
        // Set up test app with same middleware as production
        app = express();
        app.use(cors({
            origin: 'http://localhost:8889',
            credentials: true
        }));
        app.use(express.json());
        app.use(cookieParser());
        app.use('/api/auth', authRoutes);
    });

    beforeEach(async () => {
        await resetTestData();
    });

    describe('Complete Authentication Flow', () => {
        it('should complete full login-verify-logout cycle', async () => {
            // Step 1: Login
            const loginResponse = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'test.employee@example.com',
                    password: 'testpass123',
                    rememberMe: false
                });

            expect(loginResponse.status).toBe(200);
            expect(loginResponse.body.success).toBe(true);
            expect(loginResponse.body.token).toBeTruthy();
            expect(loginResponse.body.user.email).toBe('test.employee@example.com');

            const token = loginResponse.body.token;

            // Step 2: Verify token
            const verifyResponse = await request(app)
                .get('/api/auth/verify')
                .set('Authorization', `Bearer ${token}`);

            expect(verifyResponse.status).toBe(200);
            expect(verifyResponse.body.success).toBe(true);
            expect(verifyResponse.body.user.email).toBe('test.employee@example.com');

            // Step 3: Logout
            const logoutResponse = await request(app)
                .post('/api/auth/logout')
                .set('Authorization', `Bearer ${token}`);

            expect(logoutResponse.status).toBe(200);
            expect(logoutResponse.body.success).toBe(true);
        });

        it('should handle login with remember me option', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'test.employee@example.com',
                    password: 'testpass123',
                    rememberMe: true
                });

            expect(response.status).toBe(200);
            expect(response.body.expiresIn).toBe('30d');

            // Check that cookie is set with longer expiry
            const cookies = response.headers['set-cookie'];
            expect(cookies).toBeDefined();
            const taskflowCookie = cookies.find(cookie => cookie.startsWith('taskflow_token='));
            expect(taskflowCookie).toBeTruthy();
        });

        it('should persist login across requests using cookies', async () => {
            // Login and get cookie
            const loginResponse = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'test.employee@example.com',
                    password: 'testpass123'
                });

            const cookies = loginResponse.headers['set-cookie'];

            // Use cookie for verification
            const verifyResponse = await request(app)
                .get('/api/auth/verify')
                .set('Cookie', cookies);

            expect(verifyResponse.status).toBe(200);
            expect(verifyResponse.body.success).toBe(true);
        });
    });

    describe('Token Refresh Flow', () => {
        let authToken;

        beforeEach(async () => {
            const loginResponse = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'test.employee@example.com',
                    password: 'testpass123'
                });
            authToken = loginResponse.body.token;
        });

        it('should refresh token successfully', async () => {
            const response = await request(app)
                .post('/api/auth/refresh')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.token).toBeTruthy();
            expect(response.body.token).not.toBe(authToken); // Should be new token
            expect(response.body.expiresIn).toBe('24h');
        });

        it('should accept refreshed token for authentication', async () => {
            const refreshResponse = await request(app)
                .post('/api/auth/refresh')
                .set('Authorization', `Bearer ${authToken}`);

            const newToken = refreshResponse.body.token;

            const verifyResponse = await request(app)
                .get('/api/auth/verify')
                .set('Authorization', `Bearer ${newToken}`);

            expect(verifyResponse.status).toBe(200);
            expect(verifyResponse.body.success).toBe(true);
        });
    });

    describe('Password Change Flow', () => {
        let authToken;

        beforeEach(async () => {
            const loginResponse = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'test.employee@example.com',
                    password: 'testpass123'
                });
            authToken = loginResponse.body.token;
        });

        it('should change password and require new login', async () => {
            // Change password
            const changeResponse = await request(app)
                .post('/api/auth/change-password')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    currentPassword: 'testpass123',
                    newPassword: 'newpassword456',
                    confirmPassword: 'newpassword456'
                });

            expect(changeResponse.status).toBe(200);
            expect(changeResponse.body.success).toBe(true);

            // Old password should no longer work
            const oldLoginResponse = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'test.employee@example.com',
                    password: 'testpass123'
                });

            expect(oldLoginResponse.status).toBe(401);
            expect(oldLoginResponse.body.success).toBe(false);

            // New password should work
            const newLoginResponse = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'test.employee@example.com',
                    password: 'newpassword456'
                });

            expect(newLoginResponse.status).toBe(200);
            expect(newLoginResponse.body.success).toBe(true);
        });
    });

    describe('Profile Management', () => {
        let authToken;

        beforeEach(async () => {
            const loginResponse = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'test.manager@example.com',
                    password: 'testpass123'
                });
            authToken = loginResponse.body.token;
        });

        it('should retrieve user profile', async () => {
            const response = await request(app)
                .get('/api/auth/profile')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.profile.email).toBe('test.manager@example.com');
            expect(response.body.profile.role).toBe('manager');
            expect(response.body.profile.fullName).toBe('Test Manager User');
            expect(response.body.profile.clickupConnected).toBe(false);
        });

        it('should show ClickUp connection status', async () => {
            // Create ClickUp token for user
            await createTestClickUpToken('test.manager@example.com', 'manager_token');

            const response = await request(app)
                .get('/api/auth/profile')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.profile.clickupConnected).toBe(true);
        });
    });

    describe('Role-based Access Control', () => {
        let masterToken, managerToken, teamLeadToken, employeeToken;

        beforeEach(async () => {
            // Get tokens for different roles
            const masterLogin = await request(app)
                .post('/api/auth/login')
                .send({ email: 'test.master@example.com', password: 'testpass123' });
            masterToken = masterLogin.body.token;

            const managerLogin = await request(app)
                .post('/api/auth/login')
                .send({ email: 'test.manager@example.com', password: 'testpass123' });
            managerToken = managerLogin.body.token;

            const teamLeadLogin = await request(app)
                .post('/api/auth/login')
                .send({ email: 'test.teamlead@example.com', password: 'testpass123' });
            teamLeadToken = teamLeadLogin.body.token;

            const employeeLogin = await request(app)
                .post('/api/auth/login')
                .send({ email: 'test.employee@example.com', password: 'testpass123' });
            employeeToken = employeeLogin.body.token;
        });

        it('should allow all roles to access basic endpoints', async () => {
            const tokens = [masterToken, managerToken, teamLeadToken, employeeToken];

            for (const token of tokens) {
                const verifyResponse = await request(app)
                    .get('/api/auth/verify')
                    .set('Authorization', `Bearer ${token}`);
                expect(verifyResponse.status).toBe(200);

                const profileResponse = await request(app)
                    .get('/api/auth/profile')
                    .set('Authorization', `Bearer ${token}`);
                expect(profileResponse.status).toBe(200);
            }
        });

        it('should return correct role information', async () => {
            const roles = [
                { token: masterToken, expectedRole: 'master' },
                { token: managerToken, expectedRole: 'manager' },
                { token: teamLeadToken, expectedRole: 'team_lead' },
                { token: employeeToken, expectedRole: 'employee' }
            ];

            for (const { token, expectedRole } of roles) {
                const response = await request(app)
                    .get('/api/auth/verify')
                    .set('Authorization', `Bearer ${token}`);

                expect(response.status).toBe(200);
                expect(response.body.user.role).toBe(expectedRole);
            }
        });
    });

    describe('Error Handling and Edge Cases', () => {
        it('should handle malformed JSON', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .set('Content-Type', 'application/json')
                .send('{"invalid": json}');

            expect(response.status).toBe(400);
        });

        it('should handle very long passwords', async () => {
            const longPassword = 'a'.repeat(1000);
            
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'test.employee@example.com',
                    password: longPassword
                });

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
        });

        it('should handle special characters in email', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'special.chars@test-domain.co.uk',
                    password: 'testpass123'
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });

        it('should handle concurrent login attempts', async () => {
            const promises = Array(5).fill().map(() =>
                request(app)
                    .post('/api/auth/login')
                    .send({
                        email: 'test.employee@example.com',
                        password: 'testpass123'
                    })
            );

            const responses = await Promise.all(promises);
            
            // All should succeed
            responses.forEach(response => {
                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
            });
        });

        it('should handle expired tokens gracefully', async () => {
            // This would require creating an expired token
            // For now, we'll test with an invalid token
            const response = await request(app)
                .get('/api/auth/verify')
                .set('Authorization', 'Bearer expired.token.here');

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
        });
    });

    describe('Security Features', () => {
        it('should include security headers', async () => {
            const response = await request(app)
                .get('/api/auth/health');

            expect(response.headers['x-content-type-options']).toBe('nosniff');
            expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
        });

        it('should set httpOnly cookies', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'test.employee@example.com',
                    password: 'testpass123'
                });

            const cookies = response.headers['set-cookie'];
            const taskflowCookie = cookies.find(cookie => cookie.startsWith('taskflow_token='));
            expect(taskflowCookie).toContain('HttpOnly');
        });

        it('should clear cookies on logout', async () => {
            const loginResponse = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'test.employee@example.com',
                    password: 'testpass123'
                });

            const token = loginResponse.body.token;

            const logoutResponse = await request(app)
                .post('/api/auth/logout')
                .set('Authorization', `Bearer ${token}`);

            expect(logoutResponse.status).toBe(200);
            
            const cookies = logoutResponse.headers['set-cookie'];
            const clearedCookie = cookies.find(cookie => cookie.startsWith('taskflow_token='));
            expect(clearedCookie).toContain('Thu, 01 Jan 1970'); // Expired date
        });

        it('should not expose sensitive information in errors', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'nonexistent@example.com',
                    password: 'password123'
                });

            expect(response.status).toBe(401);
            expect(response.body.message).toBe('Invalid email or password');
            // Should not reveal whether email exists or not
        });
    });

    describe('Rate Limiting', () => {
        it('should rate limit login attempts', async () => {
            const requests = [];
            
            // Make 6 requests rapidly (limit is 5 per 15 minutes)
            for (let i = 0; i < 6; i++) {
                requests.push(
                    request(app)
                        .post('/api/auth/login')
                        .send({
                            email: 'test.employee@example.com',
                            password: 'wrong_password'
                        })
                );
            }

            const responses = await Promise.all(requests);
            
            // Last request should be rate limited
            const lastResponse = responses[responses.length - 1];
            expect(lastResponse.status).toBe(429);
            expect(lastResponse.body.error).toContain('Too many login attempts');
        });

        it('should include rate limit headers', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'test.employee@example.com',
                    password: 'testpass123'
                });

            expect(response.headers['ratelimit-limit']).toBeTruthy();
            expect(response.headers['ratelimit-remaining']).toBeTruthy();
        });
    });

    describe('Health Check', () => {
        it('should return health status', async () => {
            const response = await request(app)
                .get('/api/auth/health');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.service).toBe('TaskFlow Pro Authentication Service');
            expect(response.body.status).toBe('healthy');
            expect(response.body.timestamp).toBeTruthy();
        });
    });
});