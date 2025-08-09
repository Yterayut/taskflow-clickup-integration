// Unit Tests for JWT Middleware
const jwt = require('jsonwebtoken');
const { JWTAuth, authenticateToken, requireRole } = require('../../auth/jwt');

// Mock the database module
jest.mock('../../database/config', () => ({
    Database: {
        query: jest.fn()
    }
}));

const { Database } = require('../../database/config');

describe('JWT Middleware Unit Tests', () => {
    const mockSecret = 'test_jwt_secret';
    const originalSecret = process.env.JWT_SECRET;

    beforeAll(() => {
        process.env.JWT_SECRET = mockSecret;
    });

    afterAll(() => {
        process.env.JWT_SECRET = originalSecret;
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('JWTAuth.generateToken', () => {
        it('should generate valid JWT token', () => {
            const payload = {
                userId: 1,
                email: 'test@example.com',
                role: 'employee'
            };

            const token = JWTAuth.generateToken(payload);

            expect(token).toBeTruthy();
            expect(typeof token).toBe('string');

            // Verify token can be decoded
            const decoded = jwt.verify(token, mockSecret);
            expect(decoded.userId).toBe(1);
            expect(decoded.email).toBe('test@example.com');
            expect(decoded.role).toBe('employee');
        });

        it('should generate token with custom expiry', () => {
            const payload = {
                userId: 1,
                email: 'test@example.com',
                role: 'employee'
            };

            const token = JWTAuth.generateToken(payload, '2h');
            const decoded = jwt.verify(token, mockSecret);

            // Check that token has expiry
            expect(decoded.exp).toBeTruthy();
            expect(decoded.iat).toBeTruthy();
        });

        it('should include issuer and audience', () => {
            const payload = {
                userId: 1,
                email: 'test@example.com',
                role: 'employee'
            };

            const token = JWTAuth.generateToken(payload);
            const decoded = jwt.verify(token, mockSecret);

            expect(decoded.iss).toBe('taskflow-pro');
            expect(decoded.aud).toBe('taskflow-users');
        });

        it('should handle missing JWT secret', () => {
            const originalSecret = process.env.JWT_SECRET;
            delete process.env.JWT_SECRET;

            const payload = {
                userId: 1,
                email: 'test@example.com',
                role: 'employee'
            };

            expect(() => {
                JWTAuth.generateToken(payload);
            }).toThrow('Failed to generate token');

            process.env.JWT_SECRET = originalSecret;
        });
    });

    describe('JWTAuth.verifyToken', () => {
        it('should verify valid token', () => {
            const payload = {
                userId: 1,
                email: 'test@example.com',
                role: 'employee'
            };

            const token = JWTAuth.generateToken(payload);
            const decoded = JWTAuth.verifyToken(token);

            expect(decoded.userId).toBe(1);
            expect(decoded.email).toBe('test@example.com');
            expect(decoded.role).toBe('employee');
        });

        it('should reject invalid token', () => {
            expect(() => {
                JWTAuth.verifyToken('invalid.token.here');
            }).toThrow('Invalid token');
        });

        it('should reject token with wrong secret', () => {
            const wrongToken = jwt.sign(
                { userId: 1 },
                'wrong_secret',
                { expiresIn: '1h' }
            );

            expect(() => {
                JWTAuth.verifyToken(wrongToken);
            }).toThrow('Invalid token');
        });

        it('should reject expired token', () => {
            const expiredToken = jwt.sign(
                { userId: 1 },
                mockSecret,
                { expiresIn: '-1h' } // Expired 1 hour ago
            );

            expect(() => {
                JWTAuth.verifyToken(expiredToken);
            }).toThrow('Token expired');
        });
    });

    describe('authenticateToken middleware', () => {
        let req, res, next;

        beforeEach(() => {
            req = {
                cookies: {},
                headers: {}
            };
            res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
                clearCookie: jest.fn()
            };
            next = jest.fn();
        });

        it('should authenticate valid token from cookie', async () => {
            const payload = { userId: 1, email: 'test@example.com', role: 'employee' };
            const token = JWTAuth.generateToken(payload);
            
            req.cookies.taskflow_token = token;

            // Mock database response
            Database.query.mockResolvedValueOnce({
                rows: [{
                    id: 1,
                    email: 'test@example.com',
                    role: 'employee',
                    full_name: 'Test User',
                    is_active: true
                }]
            });

            await authenticateToken(req, res, next);

            expect(next).toHaveBeenCalled();
            expect(req.user).toEqual({
                userId: 1,
                id: 1,
                email: 'test@example.com',
                role: 'employee',
                fullName: 'Test User',
                lastLogin: undefined
            });
        });

        it('should authenticate valid token from Authorization header', async () => {
            const payload = { userId: 1, email: 'test@example.com', role: 'employee' };
            const token = JWTAuth.generateToken(payload);
            
            req.headers.authorization = `Bearer ${token}`;

            Database.query.mockResolvedValueOnce({
                rows: [{
                    id: 1,
                    email: 'test@example.com',
                    role: 'employee',
                    full_name: 'Test User',
                    is_active: true
                }]
            });

            await authenticateToken(req, res, next);

            expect(next).toHaveBeenCalled();
            expect(req.user.userId).toBe(1);
        });

        it('should reject request with no token', async () => {
            await authenticateToken(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: 'Access token required',
                code: 'NO_TOKEN'
            });
            expect(next).not.toHaveBeenCalled();
        });

        it('should reject invalid token', async () => {
            req.cookies.taskflow_token = 'invalid.token.here';

            await authenticateToken(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: 'Invalid token',
                code: 'AUTH_FAILED'
            });
        });

        it('should reject token for inactive user', async () => {
            const payload = { userId: 1, email: 'test@example.com', role: 'employee' };
            const token = JWTAuth.generateToken(payload);
            
            req.cookies.taskflow_token = token;
            Database.query.mockResolvedValueOnce({ rows: [] }); // No active user found

            await authenticateToken(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: 'User not found or inactive',
                code: 'USER_NOT_FOUND'
            });
        });

        it('should handle database errors', async () => {
            const payload = { userId: 1, email: 'test@example.com', role: 'employee' };
            const token = JWTAuth.generateToken(payload);
            
            req.cookies.taskflow_token = token;
            Database.query.mockRejectedValueOnce(new Error('Database connection failed'));

            await authenticateToken(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: 'Database connection failed',
                code: 'AUTH_FAILED'
            });
        });
    });

    describe('requireRole middleware', () => {
        let req, res, next;

        beforeEach(() => {
            req = {
                user: {
                    userId: 1,
                    email: 'test@example.com',
                    role: 'employee'
                }
            };
            res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };
            next = jest.fn();
        });

        it('should allow access for correct single role', () => {
            const middleware = requireRole('employee');
            middleware(req, res, next);

            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });

        it('should allow access for correct role in array', () => {
            const middleware = requireRole(['manager', 'employee']);
            middleware(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        it('should deny access for incorrect role', () => {
            const middleware = requireRole('manager');
            middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: 'Insufficient permissions',
                code: 'INSUFFICIENT_PERMISSIONS',
                required: ['manager'],
                current: 'employee'
            });
            expect(next).not.toHaveBeenCalled();
        });

        it('should deny access if user not authenticated', () => {
            req.user = null;
            const middleware = requireRole('employee');
            middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: 'Authentication required',
                code: 'NOT_AUTHENTICATED'
            });
        });

        it('should handle master role access', () => {
            req.user.role = 'master';
            const middleware = requireRole('master');
            middleware(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        it('should handle multiple roles correctly', () => {
            req.user.role = 'team_lead';
            const middleware = requireRole(['master', 'manager', 'team_lead']);
            middleware(req, res, next);

            expect(next).toHaveBeenCalled();
        });
    });

    describe('Cookie management', () => {
        let res;

        beforeEach(() => {
            res = {
                cookie: jest.fn(),
                clearCookie: jest.fn()
            };
        });

        it('should create secure cookie', () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'production';

            JWTAuth.createSecureCookie(res, 'test_token');

            expect(res.cookie).toHaveBeenCalledWith('auth_token', 'test_token', {
                httpOnly: true,
                secure: true,
                sameSite: 'strict',
                maxAge: 7 * 24 * 60 * 60 * 1000,
                path: '/'
            });

            process.env.NODE_ENV = originalEnv;
        });

        it('should create non-secure cookie in development', () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'development';

            JWTAuth.createSecureCookie(res, 'test_token');

            expect(res.cookie).toHaveBeenCalledWith('auth_token', 'test_token', {
                httpOnly: true,
                secure: false,
                sameSite: 'strict',
                maxAge: 7 * 24 * 60 * 60 * 1000,
                path: '/'
            });

            process.env.NODE_ENV = originalEnv;
        });

        it('should clear cookie correctly', () => {
            JWTAuth.clearCookie(res);

            expect(res.clearCookie).toHaveBeenCalledWith('auth_token', {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                path: '/'
            });
        });
    });
});