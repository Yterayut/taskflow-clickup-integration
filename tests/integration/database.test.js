// Integration Tests for Database Operations
const { AuthService } = require('../../auth/authService');
const { resetTestData, getTestUser, createTestClickUpToken, executeTestSQL } = require('../test-setup');

// Use real database for integration tests
jest.unmock('../../database/config');

describe('Database Integration Tests', () => {
    beforeEach(async () => {
        await resetTestData();
    });

    describe('AuthService Database Integration', () => {
        describe('loginWithPassword', () => {
            it('should successfully authenticate with real database', async () => {
                const result = await AuthService.loginWithPassword('test.employee@example.com', 'testpass123');

                expect(result.success).toBe(true);
                expect(result.user.email).toBe('test.employee@example.com');
                expect(result.user.role).toBe('employee');
                expect(result.user.full_name).toBe('Test Employee User');
            });

            it('should fail with wrong password', async () => {
                const result = await AuthService.loginWithPassword('test.employee@example.com', 'wrongpassword');

                expect(result.success).toBe(false);
                expect(result.message).toBe('Invalid email or password');
            });

            it('should fail with non-existent user', async () => {
                const result = await AuthService.loginWithPassword('nonexistent@example.com', 'testpass123');

                expect(result.success).toBe(false);
                expect(result.message).toBe('Invalid email or password');
            });

            it('should fail with inactive user', async () => {
                const result = await AuthService.loginWithPassword('inactive.user@example.com', 'testpass123');

                expect(result.success).toBe(false);
                expect(result.message).toBe('Invalid email or password');
            });

            it('should update last_login timestamp', async () => {
                const userBefore = await getTestUser('test.employee@example.com');
                expect(userBefore.last_login).toBeNull();

                await AuthService.loginWithPassword('test.employee@example.com', 'testpass123');

                const userAfter = await getTestUser('test.employee@example.com');
                expect(userAfter.last_login).not.toBeNull();
                expect(new Date(userAfter.last_login)).toBeInstanceOf(Date);
            });

            it('should handle email case insensitivity', async () => {
                const result = await AuthService.loginWithPassword('TEST.EMPLOYEE@EXAMPLE.COM', 'testpass123');

                expect(result.success).toBe(true);
                expect(result.user.email).toBe('test.employee@example.com');
            });
        });

        describe('createUser', () => {
            it('should create new user successfully', async () => {
                const userData = {
                    email: 'newuser@example.com',
                    password: 'newpassword123',
                    role: 'employee',
                    fullName: 'New Test User'
                };

                const result = await AuthService.createUser(userData);

                expect(result.success).toBe(true);
                expect(result.user.email).toBe('newuser@example.com');
                expect(result.user.role).toBe('employee');
                expect(result.user.fullName).toBe('New Test User');

                // Verify user can login
                const loginResult = await AuthService.loginWithPassword('newuser@example.com', 'newpassword123');
                expect(loginResult.success).toBe(true);
            });

            it('should fail to create duplicate user', async () => {
                const userData = {
                    email: 'test.employee@example.com',
                    password: 'password123'
                };

                const result = await AuthService.createUser(userData);

                expect(result.success).toBe(false);
                expect(result.error).toBe('User already exists');
            });

            it('should default role to employee', async () => {
                const userData = {
                    email: 'defaultrole@example.com',
                    password: 'password123',
                    fullName: 'Default Role User'
                };

                const result = await AuthService.createUser(userData);

                expect(result.success).toBe(true);
                expect(result.user.role).toBe('employee');
            });

            it('should enforce role constraints', async () => {
                const userData = {
                    email: 'invalidrole@example.com',
                    password: 'password123',
                    role: 'invalid_role',
                    fullName: 'Invalid Role User'
                };

                const result = await AuthService.createUser(userData);

                expect(result.success).toBe(false);
                expect(result.error).toContain('constraint');
            });

            it('should hash password securely', async () => {
                const userData = {
                    email: 'hashtest@example.com',
                    password: 'plaintext_password',
                    role: 'employee'
                };

                await AuthService.createUser(userData);
                const user = await getTestUser('hashtest@example.com');

                expect(user.password_hash).not.toBe('plaintext_password');
                expect(user.password_hash.startsWith('$2b$')).toBe(true);
            });
        });

        describe('getUserById', () => {
            it('should retrieve user by ID', async () => {
                const testUser = await getTestUser('test.employee@example.com');
                const result = await AuthService.getUserById(testUser.id);

                expect(result).not.toBeNull();
                expect(result.id).toBe(testUser.id);
                expect(result.email).toBe('test.employee@example.com');
                expect(result.role).toBe('employee');
            });

            it('should return null for non-existent ID', async () => {
                const result = await AuthService.getUserById(99999);

                expect(result).toBeNull();
            });

            it('should not return inactive users', async () => {
                const inactiveUser = await getTestUser('inactive.user@example.com');
                const result = await AuthService.getUserById(inactiveUser.id);

                expect(result).toBeNull();
            });
        });

        describe('changePassword', () => {
            it('should change password successfully', async () => {
                const testUser = await getTestUser('test.employee@example.com');
                
                const result = await AuthService.changePassword(
                    testUser.id,
                    'testpass123',
                    'newpassword456'
                );

                expect(result.success).toBe(true);
                expect(result.message).toBe('Password changed successfully');

                // Verify old password no longer works
                const oldLogin = await AuthService.loginWithPassword('test.employee@example.com', 'testpass123');
                expect(oldLogin.success).toBe(false);

                // Verify new password works
                const newLogin = await AuthService.loginWithPassword('test.employee@example.com', 'newpassword456');
                expect(newLogin.success).toBe(true);
            });

            it('should fail with incorrect current password', async () => {
                const testUser = await getTestUser('test.employee@example.com');
                
                const result = await AuthService.changePassword(
                    testUser.id,
                    'wrongpassword',
                    'newpassword456'
                );

                expect(result.success).toBe(false);
                expect(result.message).toBe('Current password is incorrect');
            });

            it('should update updated_at timestamp', async () => {
                const testUser = await getTestUser('test.employee@example.com');
                const originalUpdatedAt = testUser.updated_at;

                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second

                await AuthService.changePassword(testUser.id, 'testpass123', 'newpassword');

                const updatedUser = await getTestUser('test.employee@example.com');
                expect(new Date(updatedUser.updated_at)).toBeAfter(new Date(originalUpdatedAt));
            });
        });

        describe('ClickUp Token Management', () => {
            it('should store and retrieve ClickUp tokens', async () => {
                const testUser = await getTestUser('test.master@example.com');
                const tokenData = {
                    access_token: 'test_access_token',
                    refresh_token: 'test_refresh_token',
                    expires_in: 3600
                };

                const storeResult = await AuthService.storeClickUpTokens(testUser.id, tokenData);
                expect(storeResult.success).toBe(true);

                const retrieveResult = await AuthService.getClickUpToken(testUser.id);
                expect(retrieveResult).not.toBeNull();
                expect(retrieveResult.accessToken).toBe('test_access_token');
                expect(retrieveResult.refreshToken).toBe('test_refresh_token');
                expect(retrieveResult.isExpired).toBe(false);
            });

            it('should detect expired tokens', async () => {
                const testUser = await getTestUser('test.master@example.com');
                
                // Create expired token directly in database
                const pastDate = new Date(Date.now() - 3600000); // 1 hour ago
                await executeTestSQL(`
                    INSERT INTO clickup_tokens (user_id, access_token, refresh_token, expires_at)
                    VALUES ($1, 'expired_token', 'expired_refresh', $2)
                `, [testUser.id, pastDate]);

                const result = await AuthService.getClickUpToken(testUser.id);
                expect(result.isExpired).toBe(true);
            });

            it('should replace existing tokens', async () => {
                const testUser = await getTestUser('test.master@example.com');
                
                // Store first token
                await AuthService.storeClickUpTokens(testUser.id, {
                    access_token: 'token1',
                    refresh_token: 'refresh1',
                    expires_in: 3600
                });

                // Store second token
                await AuthService.storeClickUpTokens(testUser.id, {
                    access_token: 'token2',
                    refresh_token: 'refresh2',
                    expires_in: 3600
                });

                // Should only have the latest token
                const tokens = await executeTestSQL(
                    'SELECT * FROM clickup_tokens WHERE user_id = $1',
                    [testUser.id]
                );
                expect(tokens.rows).toHaveLength(1);
                expect(tokens.rows[0].access_token).toBe('token2');
            });

            it('should get master user tokens', async () => {
                const masterUser = await getTestUser('test.master@example.com');
                await createTestClickUpToken('test.master@example.com', 'master_token');

                const result = await AuthService.getClickUpTokens();
                
                expect(result.success).toBe(true);
                expect(result.tokens.accessToken).toBe('master_token');
                expect(result.tokens.masterEmail).toBe('test.master@example.com');
            });

            it('should cascade delete tokens when user is deleted', async () => {
                const testUser = await getTestUser('test.employee@example.com');
                await createTestClickUpToken('test.employee@example.com', 'test_token');

                // Verify token exists
                let tokens = await executeTestSQL(
                    'SELECT * FROM clickup_tokens WHERE user_id = $1',
                    [testUser.id]
                );
                expect(tokens.rows).toHaveLength(1);

                // Delete user
                await executeTestSQL('DELETE FROM users WHERE id = $1', [testUser.id]);

                // Verify tokens were cascade deleted
                tokens = await executeTestSQL(
                    'SELECT * FROM clickup_tokens WHERE user_id = $1',
                    [testUser.id]
                );
                expect(tokens.rows).toHaveLength(0);
            });
        });

        describe('Database Constraints and Triggers', () => {
            it('should enforce unique email constraint', async () => {
                try {
                    await executeTestSQL(`
                        INSERT INTO users (email, password_hash, role, full_name)
                        VALUES ('test.employee@example.com', 'hash', 'employee', 'Duplicate User')
                    `);
                    throw new Error('Should have failed with unique constraint violation');
                } catch (error) {
                    expect(error.code).toBe('23505'); // Unique violation
                }
            });

            it('should enforce role check constraint', async () => {
                try {
                    await executeTestSQL(`
                        INSERT INTO users (email, password_hash, role, full_name)
                        VALUES ('invalid@example.com', 'hash', 'invalid_role', 'Invalid Role User')
                    `);
                    throw new Error('Should have failed with check constraint violation');
                } catch (error) {
                    expect(error.code).toBe('23514'); // Check violation
                }
            });

            it('should update updated_at trigger on user update', async () => {
                const testUser = await getTestUser('test.employee@example.com');
                const originalUpdatedAt = testUser.updated_at;

                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second

                await executeTestSQL(
                    'UPDATE users SET full_name = $1 WHERE id = $2',
                    ['Updated Name', testUser.id]
                );

                const updatedUser = await getTestUser('test.employee@example.com');
                expect(new Date(updatedUser.updated_at)).toBeAfter(new Date(originalUpdatedAt));
            });

            it('should update updated_at trigger on token update', async () => {
                const testUser = await getTestUser('test.master@example.com');
                const token = await createTestClickUpToken('test.master@example.com', 'test_token');
                const originalUpdatedAt = token.updated_at;

                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second

                await executeTestSQL(
                    'UPDATE clickup_tokens SET access_token = $1 WHERE id = $2',
                    ['updated_token', token.id]
                );

                const updatedTokens = await executeTestSQL(
                    'SELECT * FROM clickup_tokens WHERE id = $1',
                    [token.id]
                );
                expect(new Date(updatedTokens.rows[0].updated_at)).toBeAfter(new Date(originalUpdatedAt));
            });
        });

        describe('Performance and Indexing', () => {
            it('should efficiently query users by email', async () => {
                const startTime = Date.now();
                
                await AuthService.loginWithPassword('test.employee@example.com', 'testpass123');
                
                const endTime = Date.now();
                const queryTime = endTime - startTime;
                
                // Query should complete in under 100ms with proper indexing
                expect(queryTime).toBeLessThan(100);
            });

            it('should efficiently query tokens by user_id', async () => {
                const testUser = await getTestUser('test.master@example.com');
                await createTestClickUpToken('test.master@example.com', 'test_token');

                const startTime = Date.now();
                
                await AuthService.getClickUpToken(testUser.id);
                
                const endTime = Date.now();
                const queryTime = endTime - startTime;
                
                expect(queryTime).toBeLessThan(50);
            });
        });
    });
});