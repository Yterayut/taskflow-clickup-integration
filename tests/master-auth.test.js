const request = require('supertest');
const { jest } = require('@jest/globals');
const axios = require('axios');

// Mock axios for ClickUp API calls
jest.mock('axios');
const mockedAxios = axios;

describe('Master Auth Service API', () => {
    let app;
    let sessionToken;

    beforeAll(async () => {
        // Import the app
        delete require.cache[require.resolve('../master_auth_service.js')];
        app = require('../master_auth_service.js');
        
        // Wait for server to start
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Login to get session token
        const loginResponse = await request(app)
            .post('/api/v1/auth/login')
            .send({
                email: 'yterayut@gmail.com',
                password: '12345'
            });
        sessionToken = loginResponse.body.session_token;
    });

    beforeEach(() => {
        // Reset mocks before each test
        mockedAxios.get.mockReset();
        mockedAxios.post.mockReset();
    });

    describe('ClickUp Data Fetching', () => {
        test('GET /api/v1/clickup/data should return user tasks and teams', async () => {
            // Mock ClickUp API responses
            mockedAxios.get
                .mockResolvedValueOnce(global.mockClickUpResponses.user)
                .mockResolvedValueOnce(global.mockClickUpResponses.teams)
                .mockResolvedValueOnce(global.mockClickUpResponses.tasks);

            const response = await request(app)
                .get('/api/v1/clickup/data')
                .set('Authorization', `Bearer ${sessionToken}`)
                .expect(200);

            expect(response.body).toMatchObject({
                success: true,
                user: expect.objectContaining({
                    id: expect.any(Number),
                    username: expect.any(String)
                }),
                totalTasks: expect.any(Number),
                completedTasks: expect.any(Number),
                pendingTasks: expect.any(Number)
            });
        });

        test('GET /api/v1/clickup/data should handle ClickUp API errors', async () => {
            // Mock ClickUp API error
            mockedAxios.get.mockRejectedValue(new Error('ClickUp API Error'));

            const response = await request(app)
                .get('/api/v1/clickup/data')
                .set('Authorization', `Bearer ${sessionToken}`)
                .expect(500);

            expect(response.body).toMatchObject({
                success: false,
                error: expect.any(String)
            });
        });

        test('GET /api/v1/clickup/data should require authentication', async () => {
            const response = await request(app)
                .get('/api/v1/clickup/data')
                .expect(401);

            expect(response.body).toMatchObject({
                success: false,
                error: expect.any(String)
            });
        });
    });

    describe('Role-Based Data Filtering', () => {
        test('Manager should see all tasks', async () => {
            mockedAxios.get
                .mockResolvedValueOnce(global.mockClickUpResponses.user)
                .mockResolvedValueOnce(global.mockClickUpResponses.teams)
                .mockResolvedValueOnce({
                    data: {
                        tasks: [
                            {
                                id: 'task1',
                                name: 'Manager Task',
                                assignees: [{ email: 'manager@example.com' }]
                            },
                            {
                                id: 'task2', 
                                name: 'Employee Task',
                                assignees: [{ email: 'employee@example.com' }]
                            }
                        ]
                    }
                });

            const response = await request(app)
                .get('/api/v1/clickup/data')
                .set('Authorization', `Bearer ${sessionToken}`)
                .expect(200);

            expect(response.body.tasks).toHaveLength(2);
            expect(response.body.totalTasks).toBe(2);
        });

        test('Employee should see only assigned tasks', async () => {
            // Login as employee
            const employeeLogin = await request(app)
                .post('/api/v1/auth/login')
                .send({ email: 'kittipong@example.com', password: '12345' });
            
            const employeeToken = employeeLogin.body.session_token;

            mockedAxios.get
                .mockResolvedValueOnce(global.mockClickUpResponses.user)
                .mockResolvedValueOnce(global.mockClickUpResponses.teams)
                .mockResolvedValueOnce({
                    data: {
                        tasks: [
                            {
                                id: 'task1',
                                name: 'Employee Task',
                                assignees: [{ email: 'kittipong@example.com' }]
                            },
                            {
                                id: 'task2',
                                name: 'Other Task',
                                assignees: [{ email: 'other@example.com' }]
                            }
                        ]
                    }
                });

            const response = await request(app)
                .get('/api/v1/clickup/data')
                .set('Authorization', `Bearer ${employeeToken}`)
                .expect(200);

            // Employee should only see their assigned tasks
            expect(response.body.tasks).toHaveLength(1);
            expect(response.body.tasks[0].assignees[0].email).toBe('kittipong@example.com');
        });
    });

    describe('Task Status Analytics', () => {
        test('Should correctly calculate task statistics', async () => {
            mockedAxios.get
                .mockResolvedValueOnce(global.mockClickUpResponses.user)
                .mockResolvedValueOnce(global.mockClickUpResponses.teams)
                .mockResolvedValueOnce({
                    data: {
                        tasks: [
                            {
                                id: 'task1',
                                name: 'Completed Task',
                                status: { status: 'complete' },
                                assignees: [{ email: 'yterayut@gmail.com' }]
                            },
                            {
                                id: 'task2',
                                name: 'In Progress Task',
                                status: { status: 'in progress' },
                                assignees: [{ email: 'yterayut@gmail.com' }]
                            },
                            {
                                id: 'task3',
                                name: 'To Do Task',
                                status: { status: 'to do' },
                                assignees: [{ email: 'yterayut@gmail.com' }]
                            }
                        ]
                    }
                });

            const response = await request(app)
                .get('/api/v1/clickup/data')
                .set('Authorization', `Bearer ${sessionToken}`)
                .expect(200);

            expect(response.body.totalTasks).toBe(3);
            expect(response.body.completedTasks).toBe(1);
            expect(response.body.pendingTasks).toBe(2);
            expect(response.body.inProgressTasks).toBe(1);
        });
    });

    describe('ClickUp OAuth Setup', () => {
        test('GET /api/v1/auth/clickup/auth-url should handle already setup', async () => {
            const response = await request(app)
                .get('/api/v1/auth/clickup/auth-url')
                .expect(400);

            expect(response.body).toMatchObject({
                success: false,
                error: expect.stringContaining('already setup')
            });
        });
    });
});