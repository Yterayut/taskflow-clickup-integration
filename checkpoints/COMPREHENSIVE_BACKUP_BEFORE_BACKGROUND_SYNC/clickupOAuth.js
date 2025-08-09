const axios = require('axios');
const { AuthService } = require('./authService');
const { Database } = require('../database/config');

class ClickUpOAuth {
    static getAuthorizationUrl() {
        const clientId = process.env.CLICKUP_CLIENT_ID;
        const redirectUri = encodeURIComponent(process.env.CLICKUP_REDIRECT_URI);
        
        const authUrl = `https://app.clickup.com/api?client_id=${clientId}&redirect_uri=${redirectUri}`;
        
        return authUrl;
    }
    
    static async exchangeCodeForToken(code) {
        try {
            const tokenUrl = 'https://api.clickup.com/api/v2/oauth/token';
            
            const data = {
                client_id: process.env.CLICKUP_CLIENT_ID,
                client_secret: process.env.CLICKUP_CLIENT_SECRET,
                code: code
            };
            
            const response = await axios.post(tokenUrl, data, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            return {
                success: true,
                tokens: response.data
            };
            
        } catch (error) {
            console.error('ClickUp token exchange error:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data?.error || 'Failed to exchange code for token'
            };
        }
    }
    
    static async getUserInfo(accessToken) {
        try {
            const userUrl = 'https://api.clickup.com/api/v2/user';
            
            const response = await axios.get(userUrl, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            });
            
            return {
                success: true,
                user: response.data.user
            };
            
        } catch (error) {
            console.error('ClickUp user info error:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data?.error || 'Failed to get user info'
            };
        }
    }
    
    static async handleCallback(code) {
        try {
            // Exchange code for tokens
            const tokenResult = await this.exchangeCodeForToken(code);
            
            if (!tokenResult.success) {
                throw new Error(tokenResult.error);
            }
            
            const { access_token } = tokenResult.tokens;
            
            // Get user info from ClickUp
            const userResult = await this.getUserInfo(access_token);
            
            if (!userResult.success) {
                throw new Error(userResult.error);
            }
            
            const clickupUser = userResult.user;
            const userEmail = clickupUser.email.toLowerCase();
            
            // Validate that this is the master user
            const isMasterUser = await AuthService.validateMasterUser(userEmail);
            
            if (!isMasterUser) {
                throw new Error('Unauthorized: Only master user can login via ClickUp');
            }
            
            // Get master user from database
            const userQuery = `
                SELECT id, email, role, full_name
                FROM users 
                WHERE email = $1 AND role = 'master' AND is_active = true
            `;
            
            const userDbResult = await Database.query(userQuery, [userEmail]);
            
            if (userDbResult.rows.length === 0) {
                throw new Error('Master user not found in database');
            }
            
            const masterUser = userDbResult.rows[0];
            
            // Store ClickUp tokens
            const storeResult = await AuthService.storeClickUpTokens(
                masterUser.id,
                tokenResult.tokens
            );
            
            if (!storeResult.success) {
                throw new Error('Failed to store ClickUp tokens');
            }
            
            // Update last login
            await Database.query(
                'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
                [masterUser.id]
            );
            
            // Generate JWT for the master user
            const { JWTAuth } = require('./jwt');
            const jwtToken = JWTAuth.generateToken({
                userId: masterUser.id,
                email: masterUser.email,
                role: masterUser.role
            });
            
            return {
                success: true,
                jwt: jwtToken,
                user: {
                    id: masterUser.id,
                    email: masterUser.email,
                    role: masterUser.role,
                    fullName: masterUser.full_name
                },
                clickupUser: {
                    id: clickupUser.id,
                    username: clickupUser.username,
                    email: clickupUser.email,
                    profilePicture: clickupUser.profilePicture
                }
            };
            
        } catch (error) {
            console.error('ClickUp OAuth callback error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    static async refreshTokens() {
        try {
            // Get current tokens
            const tokensResult = await AuthService.getClickUpTokens();
            
            if (!tokensResult.success) {
                throw new Error('No ClickUp tokens found');
            }
            
            const { refreshToken } = tokensResult.tokens;
            
            if (!refreshToken) {
                throw new Error('No refresh token available');
            }
            
            // Refresh tokens with ClickUp
            const refreshUrl = 'https://api.clickup.com/api/v2/oauth/token';
            
            const data = {
                client_id: process.env.CLICKUP_CLIENT_ID,
                client_secret: process.env.CLICKUP_CLIENT_SECRET,
                refresh_token: refreshToken
            };
            
            const response = await axios.post(refreshUrl, data, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            // Get master user ID
            const masterUserQuery = `
                SELECT id FROM users WHERE role = 'master' AND is_active = true LIMIT 1
            `;
            
            const masterResult = await Database.query(masterUserQuery);
            
            if (masterResult.rows.length === 0) {
                throw new Error('Master user not found');
            }
            
            const masterId = masterResult.rows[0].id;
            
            // Store new tokens
            const storeResult = await AuthService.storeClickUpTokens(
                masterId,
                response.data
            );
            
            if (!storeResult.success) {
                throw new Error('Failed to store refreshed tokens');
            }
            
            return {
                success: true,
                tokens: response.data
            };
            
        } catch (error) {
            console.error('ClickUp token refresh error:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data?.error || error.message
            };
        }
    }
    
    static async getValidAccessToken() {
        try {
            const tokensResult = await AuthService.getClickUpTokens();
            
            if (!tokensResult.success) {
                return tokensResult;
            }
            
            const { tokens } = tokensResult;
            
            // If token is not expired, return it
            if (!tokens.isExpired) {
                return {
                    success: true,
                    accessToken: tokens.accessToken
                };
            }
            
            // If expired, try to refresh
            const refreshResult = await this.refreshTokens();
            
            if (!refreshResult.success) {
                return refreshResult;
            }
            
            return {
                success: true,
                accessToken: refreshResult.tokens.access_token
            };
            
        } catch (error) {
            console.error('Get valid access token error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = { ClickUpOAuth };