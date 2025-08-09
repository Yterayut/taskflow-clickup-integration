const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 777;

// ClickUp API Configuration - DUAL AUTH VERSION
const CLICKUP_CONFIG = {
    clientId: 'DA3L6I2MS7RC39PFH7PZGRZAG4A1J8LL',
    clientSecret: 'BNLH0AZH1P4MHXQSANAM6N5RKNJPDD4I2IBC157H57G9V5NNET1HQ7V8I63K98ZX',
    redirectUri: 'https://192.168.20.10:777', // HTTPS for OAuth
    baseApiUrl: 'https://api.clickup.com/api/v2',
    personalToken: process.env.CLICKUP_PERSONAL_TOKEN || null // pk_ token
};

// Middleware
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(cors({
    origin: [
        'http://192.168.20.10:555',
        'https://192.168.20.10:555',
        'http://localhost:555',
        'http://localhost:3000'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200
});

app.use(limiter);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// In-memory storage
let sessionStorage = new Map();
let clickupTokens = new Map();

// Enhanced logging function
function log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    console.log(logMessage);
    
    if (data) {
        if (typeof data === 'string') {
            console.log(`[${timestamp}] [DATA] ${data}`);
        } else {
            console.log(`[${timestamp}] [DATA] ${JSON.stringify(data, null, 2)}`);
        }
    }
}

// Health check endpoint
app.get('/health', (req, res) => {
    const health = {
        status: 'OK',
        timestamp: new Date().toISOString(),
        service: 'TaskFlow Backend - DUAL AUTH',
        version: '7.0.0-dual-auth',
        clickup: {
            configured: true,
            clientId: CLICKUP_CONFIG.clientId.substring(0, 10) + '...',
            redirectUri: CLICKUP_CONFIG.redirectUri,
            hasPersonalToken: !!CLICKUP_CONFIG.personalToken,
            authModes: ['oauth', 'personal_token']
        }
    };
    
    log('info', 'Health check requested', health);
    res.json(health);
});

// AUTH MODE 1: Personal Token Authentication
app.post('/api/v1/auth/personal-token', async (req, res) => {
    try {
        const { token } = req.body;
        
        if (!token || !token.startsWith('pk_')) {
            return res.status(400).json({
                success: false,
                error: 'Invalid personal token format. Must start with pk_'
            });
        }
        
        log('info', 'Personal token authentication attempt', {
            tokenStart: token.substring(0, 10) + '...'
        });
        
        // Test the token by fetching user info
        const userResponse = await axios.get(`${CLICKUP_CONFIG.baseApiUrl}/user`, {
            headers: {
                'Authorization': token
            },
            timeout: 15000
        });
        
        if (userResponse.status === 200 && userResponse.data.user) {
            // Generate session ID
            const sessionId = crypto.randomBytes(32).toString('hex');
            clickupTokens.set(sessionId, {
                accessToken: token,
                tokenType: 'personal',
                timestamp: Date.now(),
                ip: req.ip,
                user: userResponse.data.user
            });
            
            log('info', 'Personal token authentication successful', {
                user: userResponse.data.user.username,
                sessionId: sessionId.substring(0, 10) + '...'
            });
            
            res.json({
                success: true,
                session: sessionId,
                user: userResponse.data.user,
                authType: 'personal_token'
            });
        } else {
            throw new Error('Invalid token or user data');
        }
        
    } catch (error) {
        log('error', 'Personal token authentication failed', {
            error: error.message,
            response: error.response?.data
        });
        
        res.status(401).json({
            success: false,
            error: 'Invalid personal token or authentication failed',
            details: error.response?.data || error.message
        });
    }
});

// AUTH MODE 2: OAuth Flow (requires HTTPS)
app.get('/api/v1/auth/clickup/auth-url', (req, res) => {
    try {
        const state = crypto.randomBytes(32).toString('hex');
        sessionStorage.set(state, { 
            timestamp: Date.now(),
            ip: req.ip 
        });
        
        const authUrl = `https://app.clickup.com/api?` +
            `client_id=${CLICKUP_CONFIG.clientId}&` +
            `redirect_uri=${encodeURIComponent(CLICKUP_CONFIG.redirectUri)}&` +
            `state=${state}`;
        
        log('info', 'OAuth URL generated (HTTPS)', { 
            redirectUri: CLICKUP_CONFIG.redirectUri,
            state: state,
            authUrl: authUrl
        });
        
        res.json({
            success: true,
            authorization_url: authUrl,
            state: state,
            note: 'OAuth requires HTTPS redirect URI'
        });
    } catch (error) {
        log('error', 'Auth URL generation failed', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate authorization URL'
        });
    }
});

// OAuth callback handler - ROOT PATH (HTTPS version)
app.get('/', async (req, res) => {
    const { code, state, error } = req.query;
    
    log('info', '=== DUAL AUTH OAUTH CALLBACK ===', {
        hasCode: !!code,
        hasState: !!state,
        hasError: !!error,
        protocol: req.protocol,
        host: req.get('host'),
        url: req.url
    });
    
    // Non-OAuth request
    if (!code && !state) {
        return res.send(`
            <h1>🚀 TaskFlow Pro Backend - DUAL AUTH</h1>
            <p>✅ Server is running properly.</p>
            <p>📋 Version: 7.0.0-dual-auth</p>
            <p>🕐 Time: ${new Date().toISOString()}</p>
            <p>🔧 Authentication Methods:</p>
            <ul>
                <li>✅ Personal Token (pk_) - Ready</li>
                <li>${req.protocol === 'https' ? '✅' : '⚠️'} OAuth2 Flow - ${req.protocol === 'https' ? 'Ready' : 'Requires HTTPS'}</li>
            </ul>
            <p>🌐 Frontend URL: <a href="http://192.168.20.10:555">http://192.168.20.10:555</a></p>
            <hr>
            <h3>🔐 OAuth Testing (HTTPS Required)</h3>
            <p><a href="/api/v1/auth/clickup/auth-url">Get ClickUp Auth URL (JSON)</a></p>
        `);
    }
    
    // OAuth callback processing
    try {
        if (error) {
            throw new Error(`OAuth error: ${error}`);
        }
        
        if (!state || !sessionStorage.has(state)) {
            throw new Error('Invalid state parameter');
        }
        
        if (!code) {
            throw new Error('No authorization code received');
        }
        
        // Check code age
        const stateData = sessionStorage.get(state);
        const codeAge = Date.now() - stateData.timestamp;
        
        if (codeAge > 10 * 60 * 1000) {
            throw new Error('Authorization code has expired');
        }
        
        log('info', 'Starting OAuth token exchange (HTTPS)', {
            code: code.substring(0, 20) + '...',
            protocol: req.protocol
        });
        
        // Token exchange - Standard OAuth2 format
        const tokenResponse = await axios.post('https://api.clickup.com/api/v2/oauth/token', {
            client_id: CLICKUP_CONFIG.clientId,
            client_secret: CLICKUP_CONFIG.clientSecret,
            code: code,
            grant_type: 'authorization_code'
        }, {
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'TaskFlow-Pro/7.0.0-DualAuth'
            },
            timeout: 30000
        });
        
        if (tokenResponse.status === 200 && tokenResponse.data.access_token) {
            const accessToken = tokenResponse.data.access_token;
            
            // Generate session ID
            const sessionId = crypto.randomBytes(32).toString('hex');
            clickupTokens.set(sessionId, {
                accessToken: accessToken,
                tokenType: 'oauth',
                timestamp: Date.now(),
                ip: req.ip,
                tokenData: tokenResponse.data
            });
            
            log('info', '🎉 OAuth token exchange successful', {
                tokenLength: accessToken.length,
                sessionId: sessionId.substring(0, 10) + '...'
            });
            
            // Clean up state
            sessionStorage.delete(state);
            
            // Redirect to frontend
            const redirectUrl = `http://192.168.20.10:555?auth=success&session=${sessionId}&type=oauth`;
            log('info', 'OAuth success - redirecting', { redirectUrl });
            
            res.writeHead(302, {
                'Location': redirectUrl,
                'Cache-Control': 'no-cache'
            });
            res.end();
            
        } else {
            throw new Error('Token exchange failed - no access token received');
        }
        
    } catch (error) {
        log('error', '❌ OAuth callback error', {
            error: error.message,
            response: error.response?.data
        });
        
        const errorMessage = error.message || 'OAuth authentication failed';
        const redirectUrl = `http://192.168.20.10:555?auth=error&message=${encodeURIComponent(errorMessage)}`;
        
        res.writeHead(302, {
            'Location': redirectUrl,
            'Cache-Control': 'no-cache'
        });
        res.end();
    }
});

// Get ClickUp data with unified token handling
app.get('/api/v1/clickup/dashboard-data', async (req, res) => {
    const sessionId = req.headers.authorization?.replace('Bearer ', '');
    
    try {
        const tokenData = clickupTokens.get(sessionId);
        if (!tokenData) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        
        log('info', 'Dashboard data requested', {
            tokenType: tokenData.tokenType,
            sessionId: sessionId ? sessionId.substring(0, 10) + '...' : 'none'
        });
        
        const headers = {
            'Authorization': tokenData.tokenType === 'oauth' ? 
                `Bearer ${tokenData.accessToken}` : 
                tokenData.accessToken
        };
        
        // Fetch user info
        const userResponse = await axios.get(`${CLICKUP_CONFIG.baseApiUrl}/user`, { 
            headers,
            timeout: 15000 
        });
        
        // Fetch teams
        const teamsResponse = await axios.get(`${CLICKUP_CONFIG.baseApiUrl}/team`, { 
            headers,
            timeout: 15000 
        });
        
        // Get first team's spaces and tasks
        let tasks = [];
        let spaces = [];
        
        if (teamsResponse.data.teams && teamsResponse.data.teams.length > 0) {
            const teamId = teamsResponse.data.teams[0].id;
            
            try {
                // Get spaces
                const spacesResponse = await axios.get(`${CLICKUP_CONFIG.baseApiUrl}/team/${teamId}/space`, {
                    headers,
                    timeout: 15000
                });
                spaces = spacesResponse.data.spaces || [];
                
                // Get tasks from first space
                if (spaces.length > 0) {
                    const spaceId = spaces[0].id;
                    const tasksResponse = await axios.get(`${CLICKUP_CONFIG.baseApiUrl}/space/${spaceId}/task`, {
                        headers,
                        timeout: 15000
                    });
                    tasks = tasksResponse.data.tasks || [];
                }
            } catch (taskError) {
                log('warn', 'Could not fetch tasks/spaces', taskError.message);
            }
        }
        
        // Calculate workload metrics
        const workload = {
            totalTasks: tasks.length,
            completedTasks: tasks.filter(t => t.status?.status === 'complete').length,
            inProgressTasks: tasks.filter(t => t.status?.status === 'in progress').length,
            overdueTasks: tasks.filter(t => {
                if (!t.due_date) return false;
                return new Date(parseInt(t.due_date)) < new Date();
            }).length,
            completionRate: tasks.length > 0 ? 
                Math.round((tasks.filter(t => t.status?.status === 'complete').length / tasks.length) * 100) : 0
        };
        
        const dashboardData = {
            user: userResponse.data.user,
            teams: teamsResponse.data.teams || [],
            spaces: spaces,
            tasks: tasks.slice(0, 20), // Limit to 20 recent tasks
            workload: workload,
            employees: [], // Will be populated from team members if needed
            timestamp: new Date().toISOString(),
            authType: tokenData.tokenType
        };
        
        log('info', 'Dashboard data compiled successfully', {
            user: !!dashboardData.user,
            teams: dashboardData.teams.length,
            tasks: dashboardData.tasks.length,
            authType: tokenData.tokenType
        });
        
        res.json({
            success: true,
            data: dashboardData,
            source: `real_clickup_api_${tokenData.tokenType}`
        });
        
    } catch (error) {
        log('error', 'Dashboard data fetch failed', {
            error: error.message,
            response: error.response?.data
        });
        
        res.status(500).json({
            success: false,
            error: 'Failed to fetch dashboard data',
            details: error.response?.data || error.message
        });
    }
});

// Authentication status check
app.get('/api/v1/auth/status', (req, res) => {
    const sessionId = req.headers.authorization?.replace('Bearer ', '');
    const tokenData = clickupTokens.get(sessionId);
    
    res.json({
        authenticated: !!tokenData,
        authType: tokenData?.tokenType || null,
        session: sessionId ? 'valid' : 'invalid',
        timestamp: new Date().toISOString()
    });
});

// Logout endpoint
app.post('/api/v1/auth/logout', (req, res) => {
    const sessionId = req.headers.authorization?.replace('Bearer ', '');
    
    if (sessionId && clickupTokens.has(sessionId)) {
        clickupTokens.delete(sessionId);
        log('info', 'User logged out', { sessionId: sessionId.substring(0, 10) + '...' });
    }
    
    res.json({
        success: true,
        message: 'Logged out successfully'
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    log('error', 'Unhandled server error', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

// 404 handler
app.use((req, res) => {
    log('warn', '404 - Endpoint not found', { url: req.url, method: req.method });
    res.status(404).json({
        success: false,
        error: 'Endpoint not found'
    });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    log('info', '🚀 DUAL AUTH SERVER STARTED', {
        port: PORT,
        authModes: ['personal_token', 'oauth'],
        oauthReady: CLICKUP_CONFIG.redirectUri.startsWith('https'),
        personalTokenReady: !!CLICKUP_CONFIG.personalToken,
        time: new Date().toISOString()
    });
    
    console.log(`🚀 TaskFlow Pro Backend (DUAL AUTH) running on port ${PORT}`);
    console.log(`🔗 Health check: http://192.168.20.10:${PORT}/health`);
    console.log(`🔐 Auth Methods:`);
    console.log(`   ✅ Personal Token: POST /api/v1/auth/personal-token`);
    console.log(`   ${CLICKUP_CONFIG.redirectUri.startsWith('https') ? '✅' : '⚠️'} OAuth: GET /api/v1/auth/clickup/auth-url`);
    console.log(`🌐 Frontend: http://192.168.20.10:555`);
    console.log(`⚡ Ready for ClickUp integration with dual authentication!`);
});

module.exports = app;