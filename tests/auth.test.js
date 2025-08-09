const request = require('supertest');
const { jest } = require('@jest/globals');

describe('TaskFlow Authentication API', () => {
    let app;
    let server;

    beforeAll(async () => {
        // Import the app after setting test environment
        delete require.cache[require.resolve('../master_auth_service.js')];
        app = require('../master_auth_service.js');
        
        // Wait for server to start
        await new Promise(resolve => setTimeout(resolve, 1000));
    });

    afterAll(async () => {
        if (server) {
            server.close();
        }
    });

    describe('Health Check', () => {
        test('GET /health should return service status', async () => {
            const response = await request(app)
                .get('/health')
                .expect(200);

            expect(response.body).toMatchObject({
                status: 'OK',
                service: 'TaskFlow Master Auth Service',
                version: '1.0.0-master-auth'
            });
            expect(response.body.timestamp).toBeDefined();
        });
    });

    describe('User Authentication', () => {
        test('POST /api/v1/auth/login should authenticate valid user', async () => {
            const validCredentials = {
                email: 'yterayut@gmail.com',
                password: '12345'
            };

            const response = await request(app)
                .post('/api/v1/auth/login')
                .send(validCredentials)
                .expect(200);

            expect(response.body).toMatchObject({
                success: true,
                user: {
                    id: expect.any(Number),
                    email: validCredentials.email,
                    role: expect.any(String)
                }
            });
            expect(response.body.session_token).toBeDefined();
        });

        test('POST /api/v1/auth/login should reject invalid credentials', async () => {
            const invalidCredentials = {
                email: 'wrong@email.com',
                password: 'wrongpassword'
            };

            const response = await request(app)
                .post('/api/v1/auth/login')
                .send(invalidCredentials)
                .expect(401);

            expect(response.body).toMatchObject({
                success: false,
                error: expect.any(String)
            });
        });

        test('POST /api/v1/auth/login should require email and password', async () => {
            const response = await request(app)
                .post('/api/v1/auth/login')
                .send({})
                .expect(400);

            expect(response.body).toMatchObject({
                success: false,
                error: 'Email and password are required'
            });
        });
    });

    describe('Session Management', () => {
        let sessionToken;

        beforeEach(async () => {
            // Login to get session token
            const loginResponse = await request(app)
                .post('/api/v1/auth/login')
                .send({
                    email: 'yterayut@gmail.com',
                    password: '12345'
                });
            sessionToken = loginResponse.body.session_token;
        });

        test('GET /api/v1/auth/session should validate session', async () => {
            const response = await request(app)
                .get('/api/v1/auth/session')
                .set('Authorization', `Bearer ${sessionToken}`)
                .expect(200);

            expect(response.body).toMatchObject({
                success: true,
                user: {
                    email: 'yterayut@gmail.com',
                    role: expect.any(String)
                }
            });
        });

        test('GET /api/v1/auth/session should reject invalid token', async () => {
            const response = await request(app)
                .get('/api/v1/auth/session')
                .set('Authorization', 'Bearer invalid_token')
                .expect(401);

            expect(response.body).toMatchObject({
                success: false,
                error: expect.any(String)
            });
        });

        test('POST /api/v1/auth/logout should invalidate session', async () => {
            const response = await request(app)
                .post('/api/v1/auth/logout')
                .set('Authorization', `Bearer ${sessionToken}`)
                .expect(200);

            expect(response.body).toMatchObject({
                success: true,
                message: 'Logged out successfully'
            });

            // Verify session is invalidated
            await request(app)
                .get('/api/v1/auth/session')
                .set('Authorization', `Bearer ${sessionToken}`)
                .expect(401);
        });
    });

    describe('Role-Based Access', () => {
        let managerToken, teamLeadToken, employeeToken;

        beforeAll(async () => {
            // Get tokens for different roles
            const managerLogin = await request(app)
                .post('/api/v1/auth/login')
                .send({ email: 'yterayut@gmail.com', password: '12345' });
            managerToken = managerLogin.body.session_token;

            const teamLeadLogin = await request(app)
                .post('/api/v1/auth/login')
                .send({ email: 'chaiwutwck@gmail.com', password: '12345' });
            teamLeadToken = teamLeadLogin.body.session_token;

            const employeeLogin = await request(app)
                .post('/api/v1/auth/login')
                .send({ email: 'kittipong@example.com', password: '12345' });
            employeeToken = employeeLogin.body.session_token;
        });

        test('Manager should have full access permissions', async () => {
            const response = await request(app)
                .get('/api/v1/auth/session')
                .set('Authorization', `Bearer ${managerToken}`)
                .expect(200);

            expect(response.body.user.role).toBe('Manager');
            expect(response.body.user.permissions).toContain('all');
        });

        test('Team Lead should have team management permissions', async () => {
            const response = await request(app)
                .get('/api/v1/auth/session')
                .set('Authorization', `Bearer ${teamLeadToken}`)
                .expect(200);

            expect(response.body.user.role).toBe('Team Lead');
            expect(response.body.user.permissions).toContain('team');
        });

        test('Employee should have limited permissions', async () => {
            const response = await request(app)
                .get('/api/v1/auth/session')
                .set('Authorization', `Bearer ${employeeToken}`)
                .expect(200);

            expect(response.body.user.role).toBe('Employee');
            expect(response.body.user.permissions).toContain('self');
        });
    });
});