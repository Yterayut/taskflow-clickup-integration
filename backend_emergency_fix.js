const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 777;

// ClickUp API Configuration - EMERGENCY FIX VERSION
const CLICKUP_CONFIG = {
    clientId: 'DA3L6I2MS7RC39PFH7PZGRZAG4A1J8LL',
    clientSecret: 'BNLH0AZH1P4MHXQSANAM6N5RKNJPDD4I2IBC157H57G9V5NNET1HQ7V8I63K98ZX',
    redirectUri: '192.168.20.10:777',
    baseApiUrl: 'https://api.clickup.com/api/v2'
};

// Middleware
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(cors({
    origin: [
        'http://192.168.20.10:555',
        'http://localhost:555',
        'http://localhost:3000'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
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
        service: 'TaskFlow Backend - EMERGENCY FIX',
        version: '6.0.0-emergency-fix',
        clickup: {
            configured: true,
            clientId: CLICKUP_CONFIG.clientId.substring(0, 10) + '...',
            redirectUri: CLICKUP_CONFIG.redirectUri
        }
    };
    
    log('info', 'Health check requested', health);
    res.json(health);
});

// Generate OAuth authorization URL
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
        
        log('info', 'OAuth URL generated', { 
            clientId: CLICKUP_CONFIG.clientId,
            redirectUri: CLICKUP_CONFIG.redirectUri,
            state: state,
            authUrl: authUrl
        });
        
        res.json({
            success: true,
            authorization_url: authUrl,
            state: state
        });
    } catch (error) {
        log('error', 'Auth URL generation failed', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate authorization URL'
        });
    }
});

// EMERGENCY FIX: Multiple token exchange methods
async function tryTokenExchange(code, attempt = 1) {
    const methods = [
        // Method 1: Standard form-encoded
        async () => {
            log('info', `Token exchange attempt ${attempt}: Standard form-encoded`);
            const formData = new URLSearchParams();
            formData.append('client_id', CLICKUP_CONFIG.clientId);
            formData.append('client_secret', CLICKUP_CONFIG.clientSecret);
            formData.append('code', code);
            
            return await axios.post('https://app.clickup.com/api/v2/oauth/token', formData, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'TaskFlow-Pro/6.0.0-Emergency'
                },
                timeout: 30000
            });
        },
        
        // Method 2: JSON format
        async () => {
            log('info', `Token exchange attempt ${attempt}: JSON format`);
            return await axios.post('https://app.clickup.com/api/v2/oauth/token', {
                client_id: CLICKUP_CONFIG.clientId,
                client_secret: CLICKUP_CONFIG.clientSecret,
                code: code
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'TaskFlow-Pro/6.0.0-Emergency'
                },
                timeout: 30000
            });
        },
        
        // Method 3: Alternative endpoint
        async () => {
            log('info', `Token exchange attempt ${attempt}: Alternative endpoint`);
            const formData = new URLSearchParams();
            formData.append('client_id', CLICKUP_CONFIG.clientId);
            formData.append('client_secret', CLICKUP_CONFIG.clientSecret);
            formData.append('code', code);
            
            return await axios.post('https://api.clickup.com/api/v2/oauth/token', formData, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'TaskFlow-Pro/6.0.0-Emergency'
                },
                timeout: 30000
            });
        },
        
        // Method 4: Basic auth header
        async () => {
            log('info', `Token exchange attempt ${attempt}: Basic auth header`);
            const credentials = Buffer.from(`${CLICKUP_CONFIG.clientId}:${CLICKUP_CONFIG.clientSecret}`).toString('base64');
            const formData = new URLSearchParams();
            formData.append('code', code);
            formData.append('grant_type', 'authorization_code');
            
            return await axios.post('https://app.clickup.com/api/v2/oauth/token', formData, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': `Basic ${credentials}`,
                    'User-Agent': 'TaskFlow-Pro/6.0.0-Emergency'
                },
                timeout: 30000
            });
        }
    ];
    
    for (let i = 0; i < methods.length; i++) {
        try {
            log('info', `Trying token exchange method ${i + 1}`);
            const response = await methods[i]();
            
            log('info', `Method ${i + 1} response:`, {
                status: response.status,
                statusText: response.statusText,
                dataType: typeof response.data,
                hasAccessToken: !!(response.data && response.data.access_token)
            });
            
            if (response.status === 200 && response.data && response.data.access_token) {
                log('info', `🎉 SUCCESS with method ${i + 1}!`);
                return response.data;
            }
        } catch (error) {
            log('error', `Method ${i + 1} failed:`, {
                message: error.message,
                status: error.response?.status,
                data: typeof error.response?.data === 'string' ? 
                    error.response.data.substring(0, 200) + '...' : 
                    error.response?.data
            });
        }
    }
    
    throw new Error('All token exchange methods failed');
}

// OAuth callback handler - ROOT PATH
app.get('/', async (req, res) => {
    const { code, state, error } = req.query;
    
    log('info', '=== EMERGENCY OAUTH CALLBACK ===', {
        hasCode: !!code,
        hasState: !!state,
        hasError: !!error,
        fullQuery: req.query,
        timestamp: new Date().toISOString()
    });
    
    // ถ้าไม่มี code หรือ state แสดงว่าไม่ใช่ OAuth callback
    if (!code && !state) {
        log('info', 'Non-OAuth request to root path');
        return res.send(`
            <h1>🚀 TaskFlow Pro Backend - EMERGENCY FIX</h1>
            <p>✅ Server is running properly.</p>
            <p>📋 Version: 6.0.0-emergency-fix</p>
            <p>🕐 Time: ${new Date().toISOString()}</p>
            <p>🔧 ClickUp OAuth Integration: Emergency Fix Active</p>
            <p>🌐 Frontend URL: <a href="http://192.168.20.10:555" target="_blank">http://192.168.20.10:555</a></p>
            <hr>
            <h3>🔐 OAuth Testing</h3>
            <p><a href="/api/v1/auth/clickup/auth-url">Get ClickUp Auth URL (JSON)</a></p>
            <p><a href="/api/v1/auth/clickup/authorize">Direct ClickUp OAuth Redirect</a></p>
        `);
    }
    
    // OAuth callback processing
    try {
        log('info', 'Processing OAuth callback with EMERGENCY methods');
        
        // Check for OAuth error
        if (error) {
            log('error', 'OAuth authorization denied by user', { error });
            throw new Error(`OAuth error: ${error}`);
        }
        
        // Validate state
        if (!state || !sessionStorage.has(state)) {
            log('error', 'Invalid state parameter', { 
                state: state ? state.substring(0, 20) + '...' : 'null'
            });
            throw new Error('Invalid state parameter');
        }
        
        if (!code) {
            log('error', 'No authorization code received');
            throw new Error('No authorization code received');
        }
        
        // Check code age
        const now = Date.now();
        const stateData = sessionStorage.get(state);
        const codeAge = now - stateData.timestamp;
        
        log('info', 'Code age check', { 
            codeAgeMinutes: Math.round(codeAge / 60000),
            isExpired: codeAge > 10 * 60 * 1000
        });
        
        if (codeAge > 10 * 60 * 1000) {
            log('error', 'OAuth code has expired (>10 minutes old)');
            throw new Error('Authorization code has expired. Please try logging in again.');
        }
        
        log('info', '🚨 EMERGENCY TOKEN EXCHANGE - Trying multiple methods');
        
        // Try token exchange with multiple methods
        const tokenData = await tryTokenExchange(code);
        const accessToken = tokenData.access_token;
        
        log('info', '🎉 EMERGENCY TOKEN EXCHANGE SUCCESS!', { 
            hasToken: !!accessToken,
            tokenLength: accessToken.length,
            tokenStart: accessToken.substring(0, 10) + '...'
        });
        
        // Store token
        const sessionId = crypto.randomBytes(32).toString('hex');
        clickupTokens.set(sessionId, {
            accessToken: accessToken,
            timestamp: Date.now(),
            ip: req.ip,
            tokenData: tokenData
        });
        
        log('info', 'Token stored successfully', { 
            sessionId: sessionId.substring(0, 10) + '...',
            storedTokens: clickupTokens.size
        });
        
        // Clean up state
        sessionStorage.delete(state);
        
        // Redirect to frontend with session
        const redirectUrl = `http://192.168.20.10:555?auth=success&session=${sessionId}`;
        log('info', '🎯 EMERGENCY OAUTH SUCCESS - Redirecting to frontend', { redirectUrl });
        
        res.writeHead(302, {
            'Location': redirectUrl,
            'Cache-Control': 'no-cache'
        });
        res.end();
        
    } catch (error) {
        log('error', '❌ EMERGENCY OAUTH CALLBACK ERROR', {
            error: error.message,
            stack: error.stack
        });
        
        const errorMessage = error.message || 'Unknown OAuth error';
        const redirectUrl = `http://192.168.20.10:555?auth=error&message=${encodeURIComponent(errorMessage)}`;
        
        log('info', '🔄 EMERGENCY OAUTH ERROR - Redirecting to frontend with error', { redirectUrl });
        
        res.writeHead(302, {
            'Location': redirectUrl,
            'Cache-Control': 'no-cache'
        });
        res.end();
    }
});

// Direct OAuth redirect
app.get('/api/v1/auth/clickup/authorize', (req, res) => {
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
        
        log('info', 'Direct OAuth redirect', { authUrl });
        res.redirect(authUrl);
    } catch (error) {
        log('error', 'OAuth Redirect Error', error);
        res.status(500).send('OAuth authorization failed');
    }
});

// Get comprehensive ClickUp data for dashboard
app.get('/api/v1/clickup/dashboard-data', async (req, res) => {
    const sessionId = req.headers.authorization?.replace('Bearer ', '');
    
    log('info', 'Dashboard data requested', { sessionId: sessionId ? sessionId.substring(0, 10) + '...' : 'none' });
    
    try {
        const tokenData = clickupTokens.get(sessionId);
        if (!tokenData) {
            log('error', 'Unauthorized dashboard request - no token found');
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        
        log('info', 'Token found, fetching ClickUp data');
        
        const headers = {
            'Authorization': tokenData.accessToken.startsWith('Bearer ') ? tokenData.accessToken : `Bearer ${tokenData.accessToken}`
        };
        
        // Fetch user info
        log('info', 'Fetching user info from ClickUp API');
        const userResponse = await axios.get(`${CLICKUP_CONFIG.baseApiUrl}/user`, { 
            headers,
            timeout: 15000 
        });
        
        // Fetch teams
        log('info', 'Fetching teams from ClickUp API');
        const teamsResponse = await axios.get(`${CLICKUP_CONFIG.baseApiUrl}/team`, { 
            headers,
            timeout: 15000 
        });
        
        log('info', 'ClickUp API calls successful', {
            userFetched: !!userResponse.data.user,
            teamsFetched: teamsResponse.data.teams?.length || 0
        });
        
        // Process and transform data
        const dashboardData = {
            user: userResponse.data.user,
            teams: teamsResponse.data.teams || [],
            tasks: [],
            workload: {
                totalTasks: 0,
                completedTasks: 0,
                inProgressTasks: 0,
                overdueTasks: 0,
                completionRate: 0
            },
            employees: [],
            timestamp: new Date().toISOString()
        };
        
        log('info', 'Dashboard data compiled successfully', {
            user: !!dashboardData.user,
            teams: dashboardData.teams.length
        });
        
        res.json({
            success: true,
            data: dashboardData,
            source: 'real_clickup_api_emergency_fix'
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
    
    log('info', 'Auth status check', {
        hasSession: !!sessionId,
        hasToken: !!tokenData
    });
    
    res.json({
        authenticated: !!tokenData,
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

// Debug endpoints
app.get('/api/v1/debug/logs', (req, res) => {
    res.json({
        message: 'Check server console for detailed logs',
        activeSessions: clickupTokens.size,
        sessionStates: sessionStorage.size
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
    log('info', '🚨 EMERGENCY SERVER STARTED - TaskFlow Pro Backend EMERGENCY FIX', {
        port: PORT,
        clientId: CLICKUP_CONFIG.clientId,
        redirectUri: CLICKUP_CONFIG.redirectUri,
        time: new Date().toISOString()
    });
    
    console.log(`🚨 TaskFlow Pro Backend (EMERGENCY FIX) running on port ${PORT}`);
    console.log(`🔗 Health check: http://192.168.20.10:${PORT}/health`);
    console.log(`🔐 OAuth URL: http://192.168.20.10:${PORT}/api/v1/auth/clickup/authorize`);
    console.log(`🌐 CORS enabled for frontend on port 555`);
    console.log(`🚨 EMERGENCY FIX: Multiple token exchange methods active`);
    console.log(`⚡ Ready for ClickUp OAuth integration with emergency protocols!`);
});

module.exports = app;