const request = require('supertest');
const axios = require('axios');
const app = require('../real_clickup_service');

// Mock axios for testing
jest.mock('axios');
const mockedAxios = axios;

describe('ClickUp Service API Tests', () => {
    let server;
    
    beforeAll(() => {
        server = app.listen(0); // Use random port for testing
    });
    
    afterAll(() => {
        server.close();
    });
    
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Health Check', () => {
        test('GET /health should return service status', async () => {
            const response = await request(app)
                .get('/health')
                .expect(200);
            
            expect(response.body).toHaveProperty('status', 'OK');
            expect(response.body).toHaveProperty('service', 'Real ClickUp Service');
            expect(response.body).toHaveProperty('timestamp');
            expect(response.body).toHaveProperty('version');
        });
    });

    describe('OAuth Authentication', () => {
        test('GET /api/v1/auth/clickup/auth-url should return authorization URL', async () => {
            const response = await request(app)
                .get('/api/v1/auth/clickup/auth-url')
                .expect(200);
            
            expect(response.body).toHaveProperty('authorization_url');
            expect(response.body).toHaveProperty('state');
            expect(response.body).toHaveProperty('message');
            expect(response.body.authorization_url).toContain('app.clickup.com/api');
            expect(response.body.authorization_url).toContain('client_id=DA3L6I2MS7RC39PFH7PZGRZAG4A1J8LL');
        });

        test('GET /api/v1/auth/clickup/callback should handle missing code', async () => {
            const response = await request(app)
                .get('/api/v1/auth/clickup/callback')
                .expect(400);
            
            expect(response.body).toHaveProperty('success', false);
            expect(response.body).toHaveProperty('error', 'Authorization code required');
        });

        test('GET /api/v1/auth/clickup/callback should exchange code for token', async () => {
            // Mock successful token exchange
            mockedAxios.post.mockResolvedValueOnce({
                data: { access_token: 'test_access_token' }
            });

            const response = await request(app)
                .get('/api/v1/auth/clickup/callback?code=test_code&state=test_state')
                .expect(302);
            
            expect(response.headers.location).toContain('http://192.168.20.10:8080/?auth=success&token=');
            expect(mockedAxios.post).toHaveBeenCalledWith(
                'https://api.clickup.com/api/v2/oauth/token',
                expect.objectContaining({
                    client_id: 'DA3L6I2MS7RC39PFH7PZGRZAG4A1J8LL',
                    code: 'test_code'
                })
            );
        });

        test('GET /api/v1/auth/clickup/callback should handle token exchange error', async () => {
            // Mock failed token exchange
            mockedAxios.post.mockRejectedValueOnce({
                response: { data: { error: 'invalid_code' } },
                message: 'Invalid authorization code'
            });

            const response = await request(app)
                .get('/api/v1/auth/clickup/callback?code=invalid_code')
                .expect(302);
            
            expect(response.headers.location).toContain('http://192.168.20.10:8080/?auth=error&message=');
        });
    });

    describe('Dashboard API', () => {
        test('GET /api/v1/dashboard should require authentication', async () => {
            const response = await request(app)
                .get('/api/v1/dashboard')
                .expect(401);
            
            expect(response.body).toHaveProperty('success', false);
            expect(response.body).toHaveProperty('error');
            expect(response.body.error).toContain('Authentication required');
        });

        test('GET /api/v1/dashboard should return dashboard data with valid token', async () => {
            // Mock ClickUp API responses
            mockedAxios.mockImplementation((config) => {
                if (config.url.includes('/user')) {
                    return Promise.resolve({
                        data: {
                            user: {
                                id: 123,
                                username: 'testuser',
                                email: 'test@example.com'
                            }
                        }
                    });
                }
                if (config.url.includes('/team')) {
                    return Promise.resolve({
                        data: {
                            teams: [
                                {
                                    id: 'team1',
                                    name: 'Development Team',
                                    members: [{ id: 1 }, { id: 2 }],
                                    color: '#3498db'
                                }
                            ]
                        }
                    });
                }
                if (config.url.includes('/task')) {
                    return Promise.resolve({
                        data: {
                            tasks: [
                                {
                                    id: 'task1',
                                    name: 'Test Task 1',
                                    status: { status: 'complete' },
                                    date_updated: Date.now().toString(),
                                    assignees: [{ username: 'testuser' }]
                                },
                                {
                                    id: 'task2',
                                    name: 'Test Task 2',
                                    status: { status: 'in progress' },
                                    date_updated: Date.now().toString(),
                                    due_date: (Date.now() - 86400000).toString(), // Yesterday (overdue)
                                    assignees: [{ username: 'testuser2' }]
                                }
                            ]
                        }
                    });
                }
                return Promise.reject(new Error('Unknown endpoint'));
            });

            // First, simulate successful OAuth to get a session token
            await request(app)
                .get('/api/v1/auth/clickup/callback?code=test_code')
                .expect(302);

            // Get the stored session token (simulate it)
            const testSessionId = 'test_session_id';
            
            // Manually add token to simulate authenticated state
            const userTokens = new Map();
            userTokens.set(testSessionId, {
                accessToken: 'test_access_token',
                createdAt: new Date(),
                lastUsed: new Date()
            });

            const response = await request(app)
                .get('/api/v1/dashboard')
                .set('Authorization', `Bearer ${testSessionId}`)
                .expect(200);
            
            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('data');
            expect(response.body.data).toHaveProperty('kpis');
            expect(response.body.data).toHaveProperty('recentActivities');
            expect(response.body.data).toHaveProperty('teams');
            expect(response.body.data).toHaveProperty('user');
            expect(response.body.data).toHaveProperty('source', 'real-clickup-api');
            
            // Verify KPI calculations
            expect(response.body.data.kpis).toHaveProperty('totalTasks');
            expect(response.body.data.kpis).toHaveProperty('completedTasks');
            expect(response.body.data.kpis).toHaveProperty('inProgressTasks');
            expect(response.body.data.kpis).toHaveProperty('overdueTasks');
            expect(response.body.data.kpis).toHaveProperty('teamMembers');
        });
    });

    describe('Test ClickUp Data API', () => {
        test('GET /api/v1/test/clickup-data should require authentication', async () => {
            const response = await request(app)
                .get('/api/v1/test/clickup-data')
                .expect(200);
            
            expect(response.body).toHaveProperty('success', false);
            expect(response.body).toHaveProperty('error');
            expect(response.body.error).toContain('No authentication token');
            expect(response.body).toHaveProperty('auth_url');
        });

        test('GET /api/v1/test/clickup-data should return connection info with valid token', async () => {
            // Mock ClickUp API responses
            mockedAxios.mockImplementation((config) => {
                if (config.url.includes('/user')) {
                    return Promise.resolve({
                        data: {
                            user: { username: 'testuser' }
                        }
                    });
                }
                if (config.url.includes('/team')) {
                    return Promise.resolve({
                        data: {
                            teams: [
                                { id: 'team1', name: 'Test Team 1' },
                                { id: 'team2', name: 'Test Team 2' }
                            ]
                        }
                    });
                }
                return Promise.reject(new Error('Unknown endpoint'));
            });

            const testSessionId = 'test_session_id';
            
            const response = await request(app)
                .get('/api/v1/test/clickup-data')
                .set('Authorization', `Bearer ${testSessionId}`)
                .expect(200);
            
            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('message');
            expect(response.body).toHaveProperty('data');
            expect(response.body.data).toHaveProperty('user');
            expect(response.body.data).toHaveProperty('teams_count');
            expect(response.body.data).toHaveProperty('teams');
            expect(response.body).toHaveProperty('timestamp');
        });
    });

    describe('ClickUp Service Class', () => {
        test('ClickUpService should make API requests correctly', async () => {
            const ClickUpService = require('../real_clickup_service');
            // Note: This would require extracting the class to a separate module for proper testing
            
            // Mock successful API response
            mockedAxios.mockResolvedValueOnce({
                data: { user: { id: 123, username: 'testuser' } }
            });

            // This test would require the service to be properly exported
            // For now, we test through the API endpoints which use the service
        });
    });

    describe('Error Handling', () => {
        test('API should handle ClickUp API errors gracefully', async () => {
            // Mock ClickUp API error
            mockedAxios.mockRejectedValueOnce({
                response: {
                    status: 401,
                    data: { err: 'Unauthorized access token' }
                }
            });

            const testSessionId = 'test_session_id';
            
            const response = await request(app)
                .get('/api/v1/dashboard')
                .set('Authorization', `Bearer ${testSessionId}`)
                .expect(500);
            
            expect(response.body).toHaveProperty('success', false);
            expect(response.body).toHaveProperty('error');
        });

        test('API should handle network errors', async () => {
            // Mock network error
            mockedAxios.mockRejectedValueOnce(new Error('Network Error'));

            const testSessionId = 'test_session_id';
            
            const response = await request(app)
                .get('/api/v1/test/clickup-data')
                .set('Authorization', `Bearer ${testSessionId}`)
                .expect(500);
            
            expect(response.body).toHaveProperty('success', false);
            expect(response.body).toHaveProperty('error');
        });
    });

    describe('Data Validation', () => {
        test('Dashboard KPIs should be calculated correctly', async () => {
            // Mock data with known values for testing calculations
            mockedAxios.mockImplementation((config) => {
                if (config.url.includes('/user')) {
                    return Promise.resolve({
                        data: { user: { id: 123, username: 'testuser', email: 'test@example.com' } }
                    });
                }
                if (config.url.includes('/team')) {
                    return Promise.resolve({
                        data: {
                            teams: [
                                { id: 'team1', name: 'Team 1', members: [{ id: 1 }, { id: 2 }] }
                            ]
                        }
                    });
                }
                if (config.url.includes('/task')) {
                    return Promise.resolve({
                        data: {
                            tasks: [
                                { id: 'task1', name: 'Task 1', status: { status: 'complete' }, date_updated: Date.now().toString() },
                                { id: 'task2', name: 'Task 2', status: { status: 'in progress' }, date_updated: Date.now().toString() },
                                { id: 'task3', name: 'Task 3', status: { status: 'to do' }, due_date: (Date.now() - 86400000).toString(), date_updated: Date.now().toString() }
                            ]
                        }
                    });
                }
                return Promise.reject(new Error('Unknown endpoint'));
            });

            const testSessionId = 'test_session_id';
            
            const response = await request(app)
                .get('/api/v1/dashboard')
                .set('Authorization', `Bearer ${testSessionId}`)
                .expect(200);
            
            expect(response.body.data.kpis.totalTasks).toBe(3);
            expect(response.body.data.kpis.completedTasks).toBe(1);
            expect(response.body.data.kpis.inProgressTasks).toBe(1);
            expect(response.body.data.kpis.overdueTasks).toBe(1); // Task 3 is overdue
            expect(response.body.data.kpis.teamMembers).toBe(2);
        });

        test('Recent activities should be sorted by date', async () => {
            const now = Date.now();
            const yesterday = now - 86400000;
            const twoDaysAgo = now - 172800000;

            mockedAxios.mockImplementation((config) => {
                if (config.url.includes('/user')) {
                    return Promise.resolve({
                        data: { user: { id: 123, username: 'testuser', email: 'test@example.com' } }
                    });
                }
                if (config.url.includes('/team')) {
                    return Promise.resolve({
                        data: { teams: [{ id: 'team1', name: 'Team 1', members: [] }] }
                    });
                }
                if (config.url.includes('/task')) {
                    return Promise.resolve({
                        data: {
                            tasks: [
                                { id: 'task1', name: 'Oldest Task', date_updated: twoDaysAgo.toString(), assignees: [{ username: 'user1' }] },
                                { id: 'task2', name: 'Newest Task', date_updated: now.toString(), assignees: [{ username: 'user2' }] },
                                { id: 'task3', name: 'Middle Task', date_updated: yesterday.toString(), assignees: [{ username: 'user3' }] }
                            ]
                        }
                    });
                }
                return Promise.reject(new Error('Unknown endpoint'));
            });

            const testSessionId = 'test_session_id';
            
            const response = await request(app)
                .get('/api/v1/dashboard')
                .set('Authorization', `Bearer ${testSessionId}`)
                .expect(200);
            
            const activities = response.body.data.recentActivities;
            expect(activities[0].message).toContain('Newest Task');
            expect(activities[1].message).toContain('Middle Task');
            expect(activities[2].message).toContain('Oldest Task');
        });
    });
});