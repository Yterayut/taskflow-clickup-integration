// Unit Tests for Authentication Routes
const request = require('supertest');
const express = require('express');
const authRoutes = require('../../auth/authRoutes');

// Mock dependencies
jest.mock('../../auth/authService');
jest.mock('../../auth/jwt');

const { AuthService } = require('../../auth/authService');
const { authenticateToken } = require('../../auth/jwt');

describe('Authentication Routes Unit Tests', () => {
    let app;

    beforeAll(() => {
        app = express();
        app.use(express.json());
        app.use('/api/auth', authRoutes);
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('POST /api/auth/login', () => {
        it('should successfully login with valid credentials', async () => {
            AuthService.loginWithPassword.mockResolvedValueOnce({
                success: true,
                user: {
                    id: 1,
                    email: 'test@example.com',
                    role: 'employee',
                    full_name: 'Test User',
                    last_login: null
                },
                clickupToken: null
            });

            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'password123',
                    rememberMe: false
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.user.email).toBe('test@example.com');
            expect(response.body.token).toBeTruthy();
        });

        it('should fail login with invalid credentials', async () => {
            AuthService.loginWithPassword.mockResolvedValueOnce({
                success: false,
                message: 'Invalid email or password'
            });

            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'wrong_password'
                });

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Invalid email or password');
        });

        it('should validate email format', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'invalid-email',
                    password: 'password123'
                });

            expect(response.status).toBe(400);
            expect(response.body.message).toBe('Validation failed');
            expect(response.body.errors).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        msg: 'Please provide a valid email address'
                    })
                ])
            );
        });

        it('should validate password length', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'test@example.com',
                    password: '12'
                });

            expect(response.status).toBe(400);
            expect(response.body.message).toBe('Validation failed');
            expect(response.body.errors).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        msg: 'Password must be at least 3 characters long'
                    })
                ])
            );
        });

        it('should handle remember me option', async () => {
            AuthService.loginWithPassword.mockResolvedValueOnce({
                success: true,
                user: {
                    id: 1,
                    email: 'test@example.com',
                    role: 'employee'
                }
            });

            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'password123',
                    rememberMe: true
                });

            expect(response.status).toBe(200);
            expect(response.body.expiresIn).toBe('30d');
        });

        it('should rate limit login attempts', async () => {
            // Make multiple requests to trigger rate limiting
            const promises = Array(6).fill().map(() =>
                request(app)
                    .post('/api/auth/login')
                    .send({
                        email: 'test@example.com',
                        password: 'password123'
                    })
            );

            const responses = await Promise.all(promises);
            
            // The 6th request should be rate limited
            const lastResponse = responses[responses.length - 1];
            expect(lastResponse.status).toBe(429);
        });

        it('should handle service errors gracefully', async () => {
            AuthService.loginWithPassword.mockRejectedValueOnce(new Error('Database error'));

            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'password123'
                });

            expect(response.status).toBe(500);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Internal server error. Please try again.');
        });
    });

    describe('POST /api/auth/logout', () => {
        beforeEach(() => {
            // Mock authentication middleware
            authenticateToken.mockImplementation((req, res, next) => {
                req.user = { userId: 1, email: 'test@example.com' };
                next();
            });
        });

        it('should successfully logout authenticated user', async () => {
            const response = await request(app)
                .post('/api/auth/logout')
                .set('Authorization', 'Bearer valid_token');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('Logout successful');
        });

        it('should clear authentication cookie', async () => {
            const response = await request(app)
                .post('/api/auth/logout')
                .set('Authorization', 'Bearer valid_token');

            expect(response.status).toBe(200);
            // Check that Set-Cookie header is present to clear the cookie
            expect(response.headers['set-cookie']).toBeDefined();
        });
    });

    describe('GET /api/auth/verify', () => {
        beforeEach(() => {
            authenticateToken.mockImplementation((req, res, next) => {
                req.user = { userId: 1, email: 'test@example.com' };
                next();
            });
        });

        it('should verify valid token and return user info', async () => {
            AuthService.getUserById.mockResolvedValueOnce({
                id: 1,
                email: 'test@example.com',
                role: 'employee',
                full_name: 'Test User',
                is_active: true
            });

            AuthService.getClickUpToken.mockResolvedValueOnce(null);

            const response = await request(app)
                .get('/api/auth/verify')
                .set('Authorization', 'Bearer valid_token');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.user.email).toBe('test@example.com');
            expect(response.body.clickupConnected).toBe(false);
        });

        it('should return error if user not found', async () => {
            AuthService.getUserById.mockResolvedValueOnce(null);

            const response = await request(app)
                .get('/api/auth/verify')
                .set('Authorization', 'Bearer valid_token');

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('User not found');
        });
    });

    describe('POST /api/auth/refresh', () => {
        beforeEach(() => {
            authenticateToken.mockImplementation((req, res, next) => {
                req.user = { 
                    userId: 1, 
                    email: 'test@example.com',
                    role: 'employee'
                };
                next();
            });
        });

        it('should refresh token successfully', async () => {
            const response = await request(app)
                .post('/api/auth/refresh')
                .set('Authorization', 'Bearer valid_token');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.token).toBeTruthy();
            expect(response.body.expiresIn).toBe('24h');
        });
    });

    describe('POST /api/auth/change-password', () => {
        beforeEach(() => {
            authenticateToken.mockImplementation((req, res, next) => {
                req.user = { userId: 1 };
                next();
            });
        });

        it('should change password successfully', async () => {
            AuthService.changePassword.mockResolvedValueOnce({
                success: true,
                message: 'Password changed successfully'
            });

            const response = await request(app)
                .post('/api/auth/change-password')
                .set('Authorization', 'Bearer valid_token')
                .send({
                    currentPassword: 'old_password',
                    newPassword: 'new_password123',
                    confirmPassword: 'new_password123'
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('Password changed successfully');
        });

        it('should validate password confirmation', async () => {
            const response = await request(app)
                .post('/api/auth/change-password')
                .set('Authorization', 'Bearer valid_token')
                .send({
                    currentPassword: 'old_password',
                    newPassword: 'new_password123',
                    confirmPassword: 'different_password'
                });

            expect(response.status).toBe(400);
            expect(response.body.message).toBe('Validation failed');
        });

        it('should validate new password length', async () => {
            const response = await request(app)
                .post('/api/auth/change-password')
                .set('Authorization', 'Bearer valid_token')
                .send({
                    currentPassword: 'old_password',
                    newPassword: '123',
                    confirmPassword: '123'
                });

            expect(response.status).toBe(400);
            expect(response.body.message).toBe('Validation failed');
        });

        it('should handle incorrect current password', async () => {
            AuthService.changePassword.mockResolvedValueOnce({
                success: false,
                message: 'Current password is incorrect'
            });

            const response = await request(app)
                .post('/api/auth/change-password')
                .set('Authorization', 'Bearer valid_token')
                .send({
                    currentPassword: 'wrong_password',
                    newPassword: 'new_password123',
                    confirmPassword: 'new_password123'
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Current password is incorrect');
        });
    });

    describe('GET /api/auth/profile', () => {
        beforeEach(() => {
            authenticateToken.mockImplementation((req, res, next) => {
                req.user = { userId: 1 };
                next();
            });
        });

        it('should return user profile', async () => {
            AuthService.getUserById.mockResolvedValueOnce({
                id: 1,
                email: 'test@example.com',
                role: 'employee',
                full_name: 'Test User',
                created_at: new Date(),
                is_active: true
            });

            AuthService.getClickUpToken.mockResolvedValueOnce(null);

            const response = await request(app)
                .get('/api/auth/profile')
                .set('Authorization', 'Bearer valid_token');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.profile.email).toBe('test@example.com');
            expect(response.body.profile.clickupConnected).toBe(false);
        });

        it('should return 404 if user not found', async () => {
            AuthService.getUserById.mockResolvedValueOnce(null);

            const response = await request(app)
                .get('/api/auth/profile')
                .set('Authorization', 'Bearer valid_token');

            expect(response.status).toBe(404);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('User not found');
        });
    });

    describe('GET /api/auth/health', () => {
        it('should return health status', async () => {
            const response = await request(app)
                .get('/api/auth/health');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.service).toBe('TaskFlow Pro Authentication Service');
            expect(response.body.status).toBe('healthy');
        });
    });

    describe('Authentication middleware tests', () => {
        it('should reject requests without authentication', async () => {
            // Mock middleware to reject unauthenticated requests
            authenticateToken.mockImplementation((req, res, next) => {
                res.status(401).json({
                    success: false,
                    message: 'Access token required'
                });
            });

            const response = await request(app)
                .get('/api/auth/verify');

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
        });

        it('should handle malformed Authorization header', async () => {
            authenticateToken.mockImplementation((req, res, next) => {
                res.status(401).json({
                    success: false,
                    message: 'Invalid token format'
                });
            });

            const response = await request(app)
                .get('/api/auth/verify')
                .set('Authorization', 'InvalidFormat');

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
        });
    });
});