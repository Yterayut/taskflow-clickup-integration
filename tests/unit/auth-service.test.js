// Unit Tests for AuthService Class
const bcrypt = require('bcrypt');
const { AuthService } = require('../../auth/authService');
const { resetTestData, getTestUser, createTestClickUpToken } = require('../test-setup');

// Mock the database module
jest.mock('../../database/config', () => ({
    Database: {
        query: jest.fn()
    }
}));

const { Database } = require('../../database/config');

describe('AuthService Unit Tests', () => {
    beforeEach(async () => {
        jest.clearAllMocks();
        await resetTestData();
    });

    describe('loginWithPassword', () => {
        it('should successfully authenticate valid user', async () => {
            // Mock database response
            const mockUser = {
                id: 1,
                email: 'test@example.com',
                password_hash: await bcrypt.hash('password123', 4),
                role: 'employee',
                full_name: 'Test User',
                last_login: null
            };

            Database.query
                .mockResolvedValueOnce({ rows: [mockUser] }) // User lookup
                .mockResolvedValueOnce({ rows: [] }); // Update last login

            const result = await AuthService.loginWithPassword('test@example.com', 'password123');

            expect(result.success).toBe(true);
            expect(result.user).toEqual({
                id: 1,
                email: 'test@example.com',
                role: 'employee',
                full_name: 'Test User',
                last_login: null
            });
            expect(Database.query).toHaveBeenCalledTimes(2);
        });

        it('should fail with invalid email', async () => {
            Database.query.mockResolvedValueOnce({ rows: [] });

            const result = await AuthService.loginWithPassword('invalid@example.com', 'password123');

            expect(result.success).toBe(false);
            expect(result.message).toBe('Invalid email or password');
        });

        it('should fail with invalid password', async () => {
            const mockUser = {
                id: 1,
                email: 'test@example.com',
                password_hash: await bcrypt.hash('correct_password', 4),
                role: 'employee',
                full_name: 'Test User'
            };

            Database.query.mockResolvedValueOnce({ rows: [mockUser] });

            const result = await AuthService.loginWithPassword('test@example.com', 'wrong_password');

            expect(result.success).toBe(false);
            expect(result.message).toBe('Invalid email or password');
        });

        it('should handle database errors gracefully', async () => {
            Database.query.mockRejectedValueOnce(new Error('Database connection failed'));

            const result = await AuthService.loginWithPassword('test@example.com', 'password123');

            expect(result.success).toBe(false);
            expect(result.message).toBe('Login failed. Please try again.');
        });

        it('should normalize email to lowercase', async () => {
            const mockUser = {
                id: 1,
                email: 'test@example.com',
                password_hash: await bcrypt.hash('password123', 4),
                role: 'employee'
            };

            Database.query
                .mockResolvedValueOnce({ rows: [mockUser] })
                .mockResolvedValueOnce({ rows: [] });

            await AuthService.loginWithPassword('TEST@EXAMPLE.COM', 'password123');

            expect(Database.query).toHaveBeenCalledWith(
                expect.any(String),
                ['test@example.com']
            );
        });
    });

    describe('createUser', () => {
        it('should successfully create new user', async () => {
            const userData = {
                email: 'newuser@example.com',
                password: 'password123',
                role: 'employee',
                fullName: 'New User'
            };

            Database.query
                .mockResolvedValueOnce({ rows: [] }) // Check existing user
                .mockResolvedValueOnce({ // Insert new user
                    rows: [{
                        id: 2,
                        email: 'newuser@example.com',
                        role: 'employee',
                        full_name: 'New User',
                        created_at: new Date()
                    }]
                });

            const result = await AuthService.createUser(userData);

            expect(result.success).toBe(true);
            expect(result.user.email).toBe('newuser@example.com');
            expect(result.user.role).toBe('employee');
        });

        it('should fail if user already exists', async () => {
            Database.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

            const userData = {
                email: 'existing@example.com',
                password: 'password123'
            };

            const result = await AuthService.createUser(userData);

            expect(result.success).toBe(false);
            expect(result.error).toBe('User already exists');
        });

        it('should hash password securely', async () => {
            const userData = {
                email: 'newuser@example.com',
                password: 'password123',
                role: 'employee'
            };

            Database.query
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [{ id: 1 }] });

            await AuthService.createUser(userData);

            const insertCall = Database.query.mock.calls[1];
            const hashedPassword = insertCall[1][1];

            expect(hashedPassword).not.toBe('password123');
            expect(hashedPassword.startsWith('$2b$')).toBe(true);
        });
    });

    describe('getUserById', () => {
        it('should return user by ID', async () => {
            const mockUser = {
                id: 1,
                email: 'test@example.com',
                role: 'employee',
                full_name: 'Test User',
                is_active: true
            };

            Database.query.mockResolvedValueOnce({ rows: [mockUser] });

            const result = await AuthService.getUserById(1);

            expect(result).toEqual(mockUser);
            expect(Database.query).toHaveBeenCalledWith(
                expect.stringContaining('SELECT'),
                [1]
            );
        });

        it('should return null for non-existent user', async () => {
            Database.query.mockResolvedValueOnce({ rows: [] });

            const result = await AuthService.getUserById(999);

            expect(result).toBeNull();
        });

        it('should handle database errors', async () => {
            Database.query.mockRejectedValueOnce(new Error('Database error'));

            const result = await AuthService.getUserById(1);

            expect(result).toBeNull();
        });
    });

    describe('getClickUpToken', () => {
        it('should return valid ClickUp token', async () => {
            const futureDate = new Date(Date.now() + 3600000);
            const mockToken = {
                access_token: 'valid_token',
                refresh_token: 'refresh_token',
                expires_at: futureDate,
                token_type: 'Bearer',
                scope: 'read'
            };

            Database.query.mockResolvedValueOnce({ rows: [mockToken] });

            const result = await AuthService.getClickUpToken(1);

            expect(result.accessToken).toBe('valid_token');
            expect(result.isExpired).toBe(false);
        });

        it('should detect expired tokens', async () => {
            const pastDate = new Date(Date.now() - 3600000);
            const mockToken = {
                access_token: 'expired_token',
                expires_at: pastDate
            };

            Database.query.mockResolvedValueOnce({ rows: [mockToken] });

            const result = await AuthService.getClickUpToken(1);

            expect(result.isExpired).toBe(true);
        });

        it('should return null if no token found', async () => {
            Database.query.mockResolvedValueOnce({ rows: [] });

            const result = await AuthService.getClickUpToken(1);

            expect(result).toBeNull();
        });
    });

    describe('changePassword', () => {
        it('should successfully change password', async () => {
            const currentPasswordHash = await bcrypt.hash('current_password', 4);
            const mockUser = {
                password_hash: currentPasswordHash
            };

            Database.query
                .mockResolvedValueOnce({ rows: [mockUser] }) // Get current password
                .mockResolvedValueOnce({ rows: [] }); // Update password

            const result = await AuthService.changePassword(1, 'current_password', 'new_password');

            expect(result.success).toBe(true);
            expect(result.message).toBe('Password changed successfully');
        });

        it('should fail with incorrect current password', async () => {
            const currentPasswordHash = await bcrypt.hash('actual_password', 4);
            const mockUser = {
                password_hash: currentPasswordHash
            };

            Database.query.mockResolvedValueOnce({ rows: [mockUser] });

            const result = await AuthService.changePassword(1, 'wrong_password', 'new_password');

            expect(result.success).toBe(false);
            expect(result.message).toBe('Current password is incorrect');
        });

        it('should fail if user not found', async () => {
            Database.query.mockResolvedValueOnce({ rows: [] });

            const result = await AuthService.changePassword(999, 'current_password', 'new_password');

            expect(result.success).toBe(false);
            expect(result.message).toBe('User not found');
        });
    });

    describe('validateMasterUser', () => {
        it('should validate master user', async () => {
            Database.query.mockResolvedValueOnce({ rows: [{ id: 1, role: 'master' }] });

            const result = await AuthService.validateMasterUser('master@example.com');

            expect(result).toBe(true);
        });

        it('should reject non-master user', async () => {
            Database.query.mockResolvedValueOnce({ rows: [] });

            const result = await AuthService.validateMasterUser('employee@example.com');

            expect(result).toBe(false);
        });
    });

    describe('storeClickUpTokens', () => {
        it('should store ClickUp tokens successfully', async () => {
            const tokenData = {
                access_token: 'new_access_token',
                refresh_token: 'new_refresh_token',
                expires_in: 3600
            };

            Database.query
                .mockResolvedValueOnce({ rows: [] }) // Delete existing
                .mockResolvedValueOnce({ rows: [{ id: 1 }] }); // Insert new

            const result = await AuthService.storeClickUpTokens(1, tokenData);

            expect(result.success).toBe(true);
            expect(result.tokenId).toBe(1);
        });

        it('should handle database errors when storing tokens', async () => {
            Database.query.mockRejectedValueOnce(new Error('Database error'));

            const result = await AuthService.storeClickUpTokens(1, {});

            expect(result.success).toBe(false);
            expect(result.error).toBe('Database error');
        });
    });

    describe('getClickUpTokens', () => {
        it('should get master user ClickUp tokens', async () => {
            const futureDate = new Date(Date.now() + 3600000);
            const mockTokens = {
                access_token: 'master_token',
                refresh_token: 'master_refresh',
                expires_at: futureDate,
                master_email: 'master@example.com'
            };

            Database.query.mockResolvedValueOnce({ rows: [mockTokens] });

            const result = await AuthService.getClickUpTokens();

            expect(result.success).toBe(true);
            expect(result.tokens.accessToken).toBe('master_token');
            expect(result.tokens.isExpired).toBe(false);
        });

        it('should return error if no master tokens found', async () => {
            Database.query.mockResolvedValueOnce({ rows: [] });

            const result = await AuthService.getClickUpTokens();

            expect(result.success).toBe(false);
            expect(result.error).toBe('No ClickUp tokens found');
        });
    });
});