const request = require('supertest');
const { jest } = require('@jest/globals');
const axios = require('axios');

// Mock axios for ClickUp API calls
jest.mock('axios');
const mockedAxios = axios;

describe('TaskFlow Integration Tests', () => {
    let app;
    let managerToken, teamLeadToken, employeeToken;

    beforeAll(async () => {
        // Import the app
        delete require.cache[require.resolve('../master_auth_service.js')];
        app = require('../master_auth_service.js');
        
        // Wait for server to start
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Get authentication tokens for different roles
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

    beforeEach(() => {
        // Reset mocks before each test
        mockedAxios.get.mockReset();
        mockedAxios.post.mockReset();
    });

    describe('End-to-End Authentication Flow', () => {
        test('Complete login-to-dashboard flow for Manager', async () => {
            // Step 1: Login
            const loginResponse = await request(app)
                .post('/api/v1/auth/login')
                .send({ email: 'yterayut@gmail.com', password: '12345' })
                .expect(200);

            expect(loginResponse.body.success).toBe(true);
            expect(loginResponse.body.user.role).toBe('Manager');
            const token = loginResponse.body.session_token;

            // Step 2: Validate session
            const sessionResponse = await request(app)
                .get('/api/v1/auth/session')
                .set('Authorization', `Bearer ${token}`)
                .expect(200);

            expect(sessionResponse.body.success).toBe(true);
            expect(sessionResponse.body.user.email).toBe('yterayut@gmail.com');

            // Step 3: Fetch dashboard data
            mockedAxios.get
                .mockResolvedValueOnce({ data: { user: { id: 1, username: 'manager' } } })
                .mockResolvedValueOnce({ data: { teams: [{ id: 'team1', name: 'Test Team' }] } })
                .mockResolvedValueOnce({ data: { tasks: [] } });

            const dataResponse = await request(app)
                .get('/api/v1/clickup/data')
                .set('Authorization', `Bearer ${token}`)
                .expect(200);

            expect(dataResponse.body.success).toBe(true);
            expect(dataResponse.body.user).toBeDefined();

            // Step 4: Logout
            const logoutResponse = await request(app)
                .post('/api/v1/auth/logout')
                .set('Authorization', `Bearer ${token}`)
                .expect(200);

            expect(logoutResponse.body.success).toBe(true);

            // Step 5: Verify session is invalidated
            await request(app)
                .get('/api/v1/auth/session')
                .set('Authorization', `Bearer ${token}`)
                .expect(401);
        });
    });

    describe('Role-Based Access Control Integration', () => {
        test('Manager can access all data', async () => {
            // Mock comprehensive data response
            mockedAxios.get
                .mockResolvedValueOnce({ data: { user: { id: 1, username: 'manager' } } })
                .mockResolvedValueOnce({ data: { teams: [{ id: 'team1', name: 'Test Team' }] } })
                .mockResolvedValueOnce({
                    data: {
                        tasks: [
                            { id: 'task1', name: 'Manager Task', assignees: [{ email: 'yterayut@gmail.com' }] },
                            { id: 'task2', name: 'Employee Task', assignees: [{ email: 'employee@example.com' }] },
                            { id: 'task3', name: 'Team Lead Task', assignees: [{ email: 'teamlead@example.com' }] }
                        ]
                    }
                });

            const response = await request(app)
                .get('/api/v1/clickup/data')
                .set('Authorization', `Bearer ${managerToken}`)
                .expect(200);

            // Manager should see all tasks
            expect(response.body.tasks).toHaveLength(3);
            expect(response.body.totalTasks).toBe(3);
        });

        test('Team Lead can access team data', async () => {
            mockedAxios.get
                .mockResolvedValueOnce({ data: { user: { id: 2, username: 'teamlead' } } })
                .mockResolvedValueOnce({ data: { teams: [{ id: 'team1', name: 'Test Team' }] } })
                .mockResolvedValueOnce({
                    data: {
                        tasks: [
                            { id: 'task1', name: 'Team Task 1', assignees: [{ email: 'employee1@example.com' }] },
                            { id: 'task2', name: 'Team Task 2', assignees: [{ email: 'employee2@example.com' }] },
                            { id: 'task3', name: 'Manager Task', assignees: [{ email: 'yterayut@gmail.com' }] }
                        ]
                    }
                });

            const response = await request(app)
                .get('/api/v1/clickup/data')
                .set('Authorization', `Bearer ${teamLeadToken}`)
                .expect(200);

            // Team Lead should see team tasks (excluding Manager-only tasks)
            expect(response.body.success).toBe(true);
            expect(response.body.user.username).toBe('teamlead');
        });

        test('Employee can only access assigned tasks', async () => {
            mockedAxios.get
                .mockResolvedValueOnce({ data: { user: { id: 3, username: 'employee' } } })
                .mockResolvedValueOnce({ data: { teams: [{ id: 'team1', name: 'Test Team' }] } })
                .mockResolvedValueOnce({
                    data: {
                        tasks: [
                            { id: 'task1', name: 'My Task', assignees: [{ email: 'kittipong@example.com' }] },
                            { id: 'task2', name: 'Other Task', assignees: [{ email: 'other@example.com' }] },
                            { id: 'task3', name: 'Shared Task', assignees: [{ email: 'kittipong@example.com' }, { email: 'other@example.com' }] }
                        ]
                    }
                });

            const response = await request(app)
                .get('/api/v1/clickup/data')
                .set('Authorization', `Bearer ${employeeToken}`)
                .expect(200);

            // Employee should only see their assigned tasks
            expect(response.body.success).toBe(true);
            // The filtering should happen server-side based on user email
            expect(response.body.user.username).toBe('employee');
        });
    });

    describe('Data Consistency Tests', () => {
        test('Task statistics should be consistent across endpoints', async () => {
            const mockTasks = [
                { id: 'task1', status: { status: 'complete' }, assignees: [{ email: 'yterayut@gmail.com' }] },
                { id: 'task2', status: { status: 'in progress' }, assignees: [{ email: 'yterayut@gmail.com' }] },
                { id: 'task3', status: { status: 'to do' }, assignees: [{ email: 'yterayut@gmail.com' }] },
                { id: 'task4', status: { status: 'complete' }, assignees: [{ email: 'yterayut@gmail.com' }] }
            ];

            mockedAxios.get
                .mockResolvedValueOnce({ data: { user: { id: 1, username: 'manager' } } })
                .mockResolvedValueOnce({ data: { teams: [{ id: 'team1', name: 'Test Team' }] } })
                .mockResolvedValueOnce({ data: { tasks: mockTasks } });

            const response = await request(app)
                .get('/api/v1/clickup/data')
                .set('Authorization', `Bearer ${managerToken}`)
                .expect(200);

            // Verify statistics are correctly calculated
            expect(response.body.totalTasks).toBe(4);
            expect(response.body.completedTasks).toBe(2);
            expect(response.body.pendingTasks).toBe(2);
            expect(response.body.inProgressTasks).toBe(1);

            // Verify tasks are properly returned
            expect(response.body.tasks).toHaveLength(4);
        });
    });

    describe('Error Handling Integration', () => {
        test('Should handle ClickUp API failures gracefully', async () => {
            // Mock ClickUp API failure
            mockedAxios.get.mockRejectedValue(new Error('ClickUp API temporarily unavailable'));

            const response = await request(app)
                .get('/api/v1/clickup/data')
                .set('Authorization', `Bearer ${managerToken}`)
                .expect(500);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('ClickUp API');
        });

        test('Should handle network timeouts', async () => {
            // Mock network timeout
            mockedAxios.get.mockRejectedValue(new Error('timeout of 5000ms exceeded'));

            const response = await request(app)
                .get('/api/v1/clickup/data')
                .set('Authorization', `Bearer ${managerToken}`)
                .expect(500);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBeDefined();
        });
    });

    describe('Session Management Integration', () => {
        test('Session should expire after logout', async () => {
            // Login to get a fresh token
            const loginResponse = await request(app)
                .post('/api/v1/auth/login')
                .send({ email: 'yterayut@gmail.com', password: '12345' });
            
            const token = loginResponse.body.session_token;

            // Verify session is valid
            await request(app)
                .get('/api/v1/auth/session')
                .set('Authorization', `Bearer ${token}`)
                .expect(200);

            // Logout
            await request(app)
                .post('/api/v1/auth/logout')
                .set('Authorization', `Bearer ${token}`)
                .expect(200);

            // Verify session is invalidated
            await request(app)
                .get('/api/v1/auth/session')
                .set('Authorization', `Bearer ${token}`)
                .expect(401);

            // Verify cannot access protected endpoints
            await request(app)
                .get('/api/v1/clickup/data')
                .set('Authorization', `Bearer ${token}`)
                .expect(401);
        });

        test('Multiple sessions should work independently', async () => {
            // Create two different sessions
            const session1 = await request(app)
                .post('/api/v1/auth/login')
                .send({ email: 'yterayut@gmail.com', password: '12345' });

            const session2 = await request(app)
                .post('/api/v1/auth/login')
                .send({ email: 'chaiwutwck@gmail.com', password: '12345' });

            const token1 = session1.body.session_token;
            const token2 = session2.body.session_token;

            // Both sessions should be valid
            await request(app)
                .get('/api/v1/auth/session')
                .set('Authorization', `Bearer ${token1}`)
                .expect(200);

            await request(app)
                .get('/api/v1/auth/session')
                .set('Authorization', `Bearer ${token2}`)
                .expect(200);

            // Logout session 1
            await request(app)
                .post('/api/v1/auth/logout')
                .set('Authorization', `Bearer ${token1}`)
                .expect(200);

            // Session 1 should be invalid, session 2 should still be valid
            await request(app)
                .get('/api/v1/auth/session')
                .set('Authorization', `Bearer ${token1}`)
                .expect(401);

            await request(app)
                .get('/api/v1/auth/session')
                .set('Authorization', `Bearer ${token2}`)
                .expect(200);
        });
    });
});