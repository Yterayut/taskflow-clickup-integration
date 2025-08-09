const bcrypt = require('bcrypt');
const { Database } = require('../database/config');
const { JWTAuth } = require('./jwt');

class AuthService {
    static async loginWithPassword(email, password) {
        try {
            // Find user by email
            const userQuery = `
                SELECT id, email, password_hash, role, full_name, is_active, last_login
                FROM users 
                WHERE email = $1 AND is_active = true
            `;
            
            const result = await Database.query(userQuery, [email.toLowerCase()]);
            
            if (result.rows.length === 0) {
                return {
                    success: false,
                    message: 'Invalid email or password'
                };
            }
            
            const user = result.rows[0];
            
            // Verify password
            const isValidPassword = await bcrypt.compare(password, user.password_hash);
            
            if (!isValidPassword) {
                return {
                    success: false,
                    message: 'Invalid email or password'
                };
            }
            
            // Update last login
            await Database.query(
                'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
                [user.id]
            );
            
            // Check for ClickUp token
            const clickupToken = await this.getClickUpToken(user.id);
            
            return {
                success: true,
                user: {
                    id: user.id,
                    email: user.email,
                    role: user.role,
                    full_name: user.full_name,
                    last_login: user.last_login
                },
                clickupToken
            };
            
        } catch (error) {
            console.error('Login error:', error);
            return {
                success: false,
                message: 'Login failed. Please try again.'
            };
        }
    }
    
    static async createUser(userData) {
        try {
            const { email, password, role, fullName } = userData;
            
            // Check if user already exists
            const existingUser = await Database.query(
                'SELECT id FROM users WHERE email = $1',
                [email.toLowerCase()]
            );
            
            if (existingUser.rows.length > 0) {
                throw new Error('User already exists');
            }
            
            // Hash password
            const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
            const passwordHash = await bcrypt.hash(password, saltRounds);
            
            // Insert new user
            const insertQuery = `
                INSERT INTO users (email, password_hash, role, full_name)
                VALUES ($1, $2, $3, $4)
                RETURNING id, email, role, full_name, created_at
            `;
            
            const result = await Database.query(insertQuery, [
                email.toLowerCase(),
                passwordHash,
                role || 'employee',
                fullName
            ]);
            
            const newUser = result.rows[0];
            
            return {
                success: true,
                user: {
                    id: newUser.id,
                    email: newUser.email,
                    role: newUser.role,
                    fullName: newUser.full_name,
                    createdAt: newUser.created_at
                }
            };
            
        } catch (error) {
            console.error('Create user error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    static async updatePassword(userId, oldPassword, newPassword) {
        try {
            // Get current password hash
            const userQuery = `
                SELECT password_hash FROM users WHERE id = $1 AND is_active = true
            `;
            
            const result = await Database.query(userQuery, [userId]);
            
            if (result.rows.length === 0) {
                throw new Error('User not found');
            }
            
            const user = result.rows[0];
            
            // Verify old password
            const isValidPassword = await bcrypt.compare(oldPassword, user.password_hash);
            
            if (!isValidPassword) {
                throw new Error('Current password is incorrect');
            }
            
            // Hash new password
            const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
            const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);
            
            // Update password
            await Database.query(
                'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                [newPasswordHash, userId]
            );
            
            return {
                success: true,
                message: 'Password updated successfully'
            };
            
        } catch (error) {
            console.error('Update password error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    static async getUserProfile(userId) {
        try {
            const userQuery = `
                SELECT id, email, role, full_name, created_at, last_login
                FROM users 
                WHERE id = $1 AND is_active = true
            `;
            
            const result = await Database.query(userQuery, [userId]);
            
            if (result.rows.length === 0) {
                throw new Error('User not found');
            }
            
            const user = result.rows[0];
            
            return {
                success: true,
                user: {
                    id: user.id,
                    email: user.email,
                    role: user.role,
                    fullName: user.full_name,
                    createdAt: user.created_at,
                    lastLogin: user.last_login
                }
            };
            
        } catch (error) {
            console.error('Get user profile error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    static async validateMasterUser(email) {
        try {
            const result = await Database.query(
                'SELECT id, role FROM users WHERE email = $1 AND role = $2 AND is_active = true',
                [email.toLowerCase(), 'master']
            );
            
            return result.rows.length > 0;
        } catch (error) {
            console.error('Validate master user error:', error);
            return false;
        }
    }
    
    static async storeClickUpTokens(userId, tokenData) {
        try {
            console.log('[DEBUG] Storing ClickUp tokens for userId:', userId);
            console.log('[DEBUG] Token data received:', JSON.stringify(tokenData, null, 2));
            
            const { access_token, refresh_token, expires_in } = tokenData;
            
            // Calculate expiration timestamp with safety checks
            let expiresAt;
            if (expires_in && typeof expires_in === 'number') {
                expiresAt = new Date(Date.now() + (expires_in * 1000));
                console.log('[DEBUG] Calculated expiresAt:', expiresAt.toISOString());
            } else {
                // Default to 1 hour if expires_in is not provided or invalid
                expiresAt = new Date(Date.now() + (3600 * 1000));
                console.log('[DEBUG] Using default expiresAt (1 hour):', expiresAt.toISOString());
            }
            
            // Validate required fields
            if (!access_token) {
                throw new Error('Access token is required');
            }
            
            // Delete existing tokens for this user
            await Database.query(
                'DELETE FROM clickup_tokens WHERE user_id = $1',
                [userId]
            );
            
            // Insert new tokens
            const insertQuery = `
                INSERT INTO clickup_tokens (user_id, access_token, refresh_token, expires_at)
                VALUES ($1, $2, $3, $4)
                RETURNING id
            `;
            
            console.log('[DEBUG] Inserting tokens with params:', [userId, access_token ? 'present' : 'missing', refresh_token ? 'present' : 'missing', expiresAt.toISOString()]);
            
            const result = await Database.query(insertQuery, [
                userId,
                access_token,
                refresh_token || null,
                expiresAt
            ]);
            
            console.log('[DEBUG] Tokens stored successfully with ID:', result.rows[0].id);
            
            return {
                success: true,
                tokenId: result.rows[0].id
            };
            
        } catch (error) {
            console.error('[ERROR] Store ClickUp tokens error:', error);
            console.error('[ERROR] Error details:', {
                message: error.message,
                code: error.code,
                detail: error.detail,
                where: error.where
            });
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    static async getClickUpTokens() {
        try {
            const query = `
                SELECT ct.access_token, ct.refresh_token, ct.expires_at,
                       u.email as master_email
                FROM clickup_tokens ct
                JOIN users u ON ct.user_id = u.id
                WHERE u.role = 'master' AND u.is_active = true
                ORDER BY ct.created_at DESC
                LIMIT 1
            `;
            
            const result = await Database.query(query);
            
            if (result.rows.length === 0) {
                return {
                    success: false,
                    error: 'No ClickUp tokens found'
                };
            }
            
            const tokens = result.rows[0];
            
            // Check if token is expired
            const isExpired = new Date() > new Date(tokens.expires_at);
            
            return {
                success: true,
                tokens: {
                    accessToken: tokens.access_token,
                    refreshToken: tokens.refresh_token,
                    expiresAt: tokens.expires_at,
                    isExpired,
                    masterEmail: tokens.master_email
                }
            };
            
        } catch (error) {
            console.error('Get ClickUp tokens error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    static async getUserById(userId) {
        try {
            const userQuery = `
                SELECT id, email, role, full_name, created_at, last_login, is_active
                FROM users 
                WHERE id = $1 AND is_active = true
            `;
            
            const result = await Database.query(userQuery, [userId]);
            
            if (result.rows.length === 0) {
                return null;
            }
            
            return result.rows[0];
            
        } catch (error) {
            console.error('Get user by ID error:', error);
            return null;
        }
    }
    
    static async getClickUpToken(userId) {
        try {
            const query = `
                SELECT access_token, refresh_token, expires_at, token_type, scope
                FROM clickup_tokens 
                WHERE user_id = $1 
                ORDER BY created_at DESC 
                LIMIT 1
            `;
            
            const result = await Database.query(query, [userId]);
            
            if (result.rows.length === 0) {
                return null;
            }
            
            const token = result.rows[0];
            
            // Check if token is expired
            const isExpired = new Date() > new Date(token.expires_at);
            
            return {
                accessToken: token.access_token,
                refreshToken: token.refresh_token,
                expiresAt: token.expires_at,
                tokenType: token.token_type,
                scope: token.scope,
                isExpired
            };
            
        } catch (error) {
            console.error('Get ClickUp token error:', error);
            return null;
        }
    }
    
    static async changePassword(userId, currentPassword, newPassword) {
        try {
            // Get current password hash
            const userQuery = `
                SELECT password_hash FROM users WHERE id = $1 AND is_active = true
            `;
            
            const result = await Database.query(userQuery, [userId]);
            
            if (result.rows.length === 0) {
                return {
                    success: false,
                    message: 'User not found'
                };
            }
            
            const user = result.rows[0];
            
            // Verify current password
            const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
            
            if (!isValidPassword) {
                return {
                    success: false,
                    message: 'Current password is incorrect'
                };
            }
            
            // Hash new password
            const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
            const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);
            
            // Update password
            await Database.query(
                'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                [newPasswordHash, userId]
            );
            
            return {
                success: true,
                message: 'Password changed successfully'
            };
            
        } catch (error) {
            console.error('Change password error:', error);
            return {
                success: false,
                message: 'Password change failed'
            };
        }
    }
}

module.exports = { AuthService };