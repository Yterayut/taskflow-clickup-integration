const fs = require('fs');
const path = require('path');

class TokenRefreshService {
    constructor() {
        this.tokenPath = path.join(__dirname, '..', 'master_clickup_token.json');
        this.refreshInterval = 24 * 60 * 60 * 1000; // 24 hours
        this.refreshTimer = null;
    }

    // Start automatic token refresh
    startAutoRefresh() {
        console.log(`[${new Date().toISOString()}] 🔄 Starting automatic token refresh service...`);
        
        // Check token validity every 24 hours
        this.refreshTimer = setInterval(() => {
            this.checkAndRefreshToken();
        }, this.refreshInterval);

        // Also check immediately on startup
        setTimeout(() => this.checkAndRefreshToken(), 5000);
    }

    // Stop automatic refresh
    stopAutoRefresh() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
            console.log(`[${new Date().toISOString()}] 🔄 Token refresh service stopped`);
        }
    }

    // Check token validity and refresh if needed
    async checkAndRefreshToken() {
        try {
            console.log(`[${new Date().toISOString()}] 🔍 Checking ClickUp token validity...`);
            
            // Load current token
            const tokenData = this.loadToken();
            if (!tokenData || !tokenData.accessToken) {
                console.warn(`[${new Date().toISOString()}] ⚠️ No token found - manual setup required`);
                return false;
            }

            // Test token validity with ClickUp API
            const isValid = await this.testTokenValidity(tokenData.accessToken);
            
            if (isValid) {
                console.log(`[${new Date().toISOString()}] ✅ Token is still valid`);
                // Update last used timestamp
                this.updateTokenTimestamp(tokenData);
                return true;
            } else {
                console.warn(`[${new Date().toISOString()}] ❌ Token is invalid or expired`);
                console.warn(`[${new Date().toISOString()}] 🔧 Manual token refresh required:`);
                console.warn(`[${new Date().toISOString()}] 1. Go to https://app.clickup.com/settings/apps`);
                console.warn(`[${new Date().toISOString()}] 2. Generate new Personal API Token`);
                console.warn(`[${new Date().toISOString()}] 3. Update master_clickup_token.json`);
                return false;
            }
            
        } catch (error) {
            console.error(`[${new Date().toISOString()}] ❌ Token check error:`, error.message);
            return false;
        }
    }

    // Load token from file
    loadToken() {
        try {
            if (fs.existsSync(this.tokenPath)) {
                const tokenData = JSON.parse(fs.readFileSync(this.tokenPath, 'utf8'));
                return tokenData;
            }
            return null;
        } catch (error) {
            console.error(`[${new Date().toISOString()}] ❌ Token loading error:`, error.message);
            return null;
        }
    }

    // Test token validity with ClickUp API
    async testTokenValidity(token) {
        try {
            const axios = require('axios');
            const response = await axios.get('https://api.clickup.com/api/v2/user', {
                headers: { 'Authorization': token },
                timeout: 5000
            });
            
            return response.status === 200 && response.data.user;
        } catch (error) {
            return false;
        }
    }

    // Update token timestamp
    updateTokenTimestamp(tokenData) {
        try {
            tokenData.lastUsed = new Date().toISOString();
            fs.writeFileSync(this.tokenPath, JSON.stringify(tokenData, null, 2));
        } catch (error) {
            console.error(`[${new Date().toISOString()}] ❌ Token timestamp update error:`, error.message);
        }
    }

    // Get token status for monitoring
    async getTokenStatus() {
        try {
            const tokenData = this.loadToken();
            if (!tokenData) {
                return {
                    status: 'missing',
                    message: 'No token file found',
                    lastUsed: null,
                    isValid: false
                };
            }

            const isValid = await this.testTokenValidity(tokenData.accessToken);
            
            return {
                status: isValid ? 'valid' : 'invalid',
                message: isValid ? 'Token is working' : 'Token expired or invalid',
                lastUsed: tokenData.lastUsed,
                userEmail: tokenData.userEmail,
                isValid: isValid
            };
        } catch (error) {
            return {
                status: 'error',
                message: error.message,
                lastUsed: null,
                isValid: false
            };
        }
    }

    // Manual token refresh helper
    async updateToken(newToken, userEmail = 'yterayut@gmail.com') {
        try {
            // Test new token first
            const isValid = await this.testTokenValidity(newToken);
            if (!isValid) {
                throw new Error('New token is invalid');
            }

            const tokenData = {
                accessToken: newToken,
                tokenType: 'Token',
                userEmail: userEmail,
                lastUsed: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            fs.writeFileSync(this.tokenPath, JSON.stringify(tokenData, null, 2));
            console.log(`[${new Date().toISOString()}] ✅ Token updated successfully for ${userEmail}`);
            
            return true;
        } catch (error) {
            console.error(`[${new Date().toISOString()}] ❌ Token update error:`, error.message);
            return false;
        }
    }
}

module.exports = { TokenRefreshService };