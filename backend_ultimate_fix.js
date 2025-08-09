const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 777;

// ClickUp API Configuration
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
    
    // Also log to a file-like output for debugging
    if (level === 'error') {
        console.error(`ERROR: ${message}`, data);
    }
}

// Health check endpoint
app.get('/health', (req, res) => {
    const health = {
        status: 'OK',
        timestamp: new Date().toISOString(),
        service: 'TaskFlow Backend - Ultimate ClickUp Fix',
        version: '4.0.0-ultimate-fix',
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

// OAuth callback handler - ROOT PATH
app.get('/', async (req, res) => {
    const { code, state, error } = req.query;
    
    log('info', '=== ROOT PATH CALLBACK RECEIVED ===', {
        hasCode: !!code,
        hasState: !!state,
        hasError: !!error,
        fullQuery: req.query,
        url: req.url,
        method: req.method,
        headers: req.headers,
        userAgent: req.get('User-Agent')
    });
    
    // ถ้าไม่มี code หรือ state แสดงว่าไม่ใช่ OAuth callback
    if (!code && !state) {
        log('info', 'Non-OAuth request to root path');
        return res.send(`
            <h1>TaskFlow Pro Backend - Ultimate ClickUp Fix</h1>
            <p>Server is running properly.</p>
            <p>Version: 4.0.0-ultimate-fix</p>
            <p>Time: ${new Date().toISOString()}</p>
            <p>OAuth Test: <a href="/api/v1/auth/clickup/auth-url">Get Auth URL</a></p>
        `);
    }
    
    // OAuth callback processing
    try {
        log('info', 'Processing OAuth callback', {
            code: code ? code.substring(0, 20) + '...' : 'missing',
            state: state ? state.substring(0, 20) + '...' : 'missing'
        });
        
        // Check for OAuth error
        if (error) {
            log('error', 'OAuth authorization denied by user', { error });
            throw new Error(`OAuth error: ${error}`);
        }
        
        // Validate state
        if (!state || !sessionStorage.has(state)) {
            log('error', 'Invalid state parameter', { 
                state: state ? state.substring(0, 20) + '...' : 'null',
                hasState: sessionStorage.has(state),
                availableStates: Array.from(sessionStorage.keys()).map(s => s.substring(0, 20) + '...')
            });
            throw new Error('Invalid state parameter');
        }
        
        if (!code) {
            log('error', 'No authorization code received');
            throw new Error('No authorization code received');
        }
        
        log('info', 'Starting token exchange process', { 
            code: code.substring(0, 20) + '...',
            clientId: CLICKUP_CONFIG.clientId 
        });
        
        // Token exchange - ลองหลายวิธี
        let tokenResponse = null;
        let accessToken = null;
        let lastError = null;
        
        // Method 1: Form data (standard OAuth2)
        try {
            log('info', 'Attempting token exchange: Method 1 - Form data');
            
            const formData = new URLSearchParams();
            formData.append('client_id', CLICKUP_CONFIG.clientId);
            formData.append('client_secret', CLICKUP_CONFIG.clientSecret);
            formData.append('code', code);
            
            log('info', 'Sending token request to ClickUp', {
                url: 'https://app.clickup.com/api/v2/oauth/token',
                method: 'POST',
                contentType: 'application/x-www-form-urlencoded',
                formDataKeys: Array.from(formData.keys())
            });
            
            tokenResponse = await axios.post('https://app.clickup.com/api/v2/oauth/token', formData, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'TaskFlow-Pro/4.0.0'
                },
                timeout: 30000,
                validateStatus: function (status) {
                    return status < 500; // Accept any status code less than 500
                }
            });
            
            log('info', 'Token exchange response received', { 
                status: tokenResponse.status,
                statusText: tokenResponse.statusText,
                headers: tokenResponse.headers,
                dataType: typeof tokenResponse.data,
                dataKeys: typeof tokenResponse.data === 'object' ? Object.keys(tokenResponse.data) : 'not-object'
            });
            
            if (tokenResponse.status === 200 && tokenResponse.data) {
                accessToken = tokenResponse.data.access_token;
                log('info', 'Method 1 SUCCESS - Access token extracted', {
                    hasAccessToken: !!accessToken,
                    tokenLength: accessToken ? accessToken.length : 0,
                    responseData: tokenResponse.data
                });
            } else {
                throw new Error(`HTTP ${tokenResponse.status}: ${JSON.stringify(tokenResponse.data)}`);
            }
            
        } catch (method1Error) {
            lastError = method1Error;
            log('error', 'Method 1 FAILED', {
                error: method1Error.message,
                response: method1Error.response ? {
                    status: method1Error.response.status,
                    data: method1Error.response.data
                } : 'no-response'
            });
            
            // Method 2: JSON payload
            try {
                log('info', 'Attempting token exchange: Method 2 - JSON payload');
                
                const payload = {
                    client_id: CLICKUP_CONFIG.clientId,
                    client_secret: CLICKUP_CONFIG.clientSecret,
                    code: code
                };
                
                tokenResponse = await axios.post('https://app.clickup.com/api/v2/oauth/token', payload, {
                    headers: {
                        'Content-Type': 'application/json',
                        'User-Agent': 'TaskFlow-Pro/4.0.0'
                    },
                    timeout: 30000,
                    validateStatus: function (status) {
                        return status < 500;
                    }
                });
                
                log('info', 'Method 2 response received', { 
                    status: tokenResponse.status,
                    data: tokenResponse.data
                });
                
                if (tokenResponse.status === 200 && tokenResponse.data) {
                    accessToken = tokenResponse.data.access_token;
                    log('info', 'Method 2 SUCCESS - Access token extracted', {
                        hasAccessToken: !!accessToken,
                        responseData: tokenResponse.data
                    });
                } else {
                    throw new Error(`HTTP ${tokenResponse.status}: ${JSON.stringify(tokenResponse.data)}`);
                }
                
            } catch (method2Error) {
                lastError = method2Error;
                log('error', 'Method 2 FAILED', {
                    error: method2Error.message,
                    response: method2Error.response ? {
                        status: method2Error.response.status,
                        data: method2Error.response.data
                    } : 'no-response'
                });
                
                // Method 3: Alternative endpoint
                try {
                    log('info', 'Attempting token exchange: Method 3 - Alternative endpoint');
                    
                    const formData = new URLSearchParams();
                    formData.append('client_id', CLICKUP_CONFIG.clientId);
                    formData.append('client_secret', CLICKUP_CONFIG.clientSecret);
                    formData.append('code', code);
                    formData.append('grant_type', 'authorization_code');
                    
                    tokenResponse = await axios.post('https://api.clickup.com/api/v2/oauth/token', formData, {
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                            'User-Agent': 'TaskFlow-Pro/4.0.0'
                        },
                        timeout: 30000,
                        validateStatus: function (status) {
                            return status < 500;
                        }
                    });
                    
                    log('info', 'Method 3 response received', { 
                        status: tokenResponse.status,
                        data: tokenResponse.data
                    });
                    
                    if (tokenResponse.status === 200 && tokenResponse.data) {
                        accessToken = tokenResponse.data.access_token;
                        log('info', 'Method 3 SUCCESS - Access token extracted', {
                            hasAccessToken: !!accessToken,
                            responseData: tokenResponse.data
                        });
                    } else {
                        throw new Error(`HTTP ${tokenResponse.status}: ${JSON.stringify(tokenResponse.data)}`);
                    }
                    
                } catch (method3Error) {
                    lastError = method3Error;
                    log('error', 'Method 3 FAILED', {
                        error: method3Error.message,
                        response: method3Error.response ? {
                            status: method3Error.response.status,
                            data: method3Error.response.data
                        } : 'no-response'
                    });
                    
                    log('error', 'ALL TOKEN EXCHANGE METHODS FAILED', {
                        method1: method1Error.message,
                        method2: method2Error.message,
                        method3: method3Error.message
                    });
                    
                    throw new Error(`All token exchange methods failed. Last error: ${lastError.message}`);
                }
            }
        }
        
        // Validate access token
        if (!accessToken) {
            log('error', 'No access token received after successful response', tokenResponse?.data);
            throw new Error('No access token received from ClickUp');
        }
        
        log('info', 'ACCESS TOKEN SUCCESS!', { 
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
            tokenData: tokenResponse.data
        });
        
        log('info', 'Token stored successfully', { 
            sessionId: sessionId.substring(0, 10) + '...',
            storedTokens: clickupTokens.size
        });
        
        // Clean up state
        sessionStorage.delete(state);
        
        // Redirect to frontend with session
        const redirectUrl = `http://192.168.20.10:555?auth=success&session=${sessionId}`;
        log('info', 'OAUTH SUCCESS - Redirecting to frontend', { redirectUrl });
        
        res.redirect(redirectUrl);
        
    } catch (error) {
        log('error', 'OAUTH CALLBACK ERROR', {
            error: error.message,
            stack: error.stack,
            response: error.response ? {
                status: error.response.status,
                data: error.response.data
            } : 'no-response'
        });
        
        const errorMessage = error.response?.data?.error || error.message || 'Unknown OAuth error';
        const redirectUrl = `http://192.168.20.10:555?auth=error&message=${encodeURIComponent(errorMessage)}`;
        
        log('info', 'OAUTH ERROR - Redirecting to frontend with error', { redirectUrl });
        res.redirect(redirectUrl);
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
            tasks: [], // Will be populated if needed
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
            source: 'real_clickup_api'
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
    log('info', 'SERVER STARTED - TaskFlow Pro Backend Ultimate Fix', {
        port: PORT,
        clientId: CLICKUP_CONFIG.clientId,
        redirectUri: CLICKUP_CONFIG.redirectUri,
        time: new Date().toISOString()
    });
    
    console.log(`🚀 TaskFlow Pro Backend (Ultimate Fix) running on port ${PORT}`);
    console.log(`🔗 Health check: http://192.168.20.10:${PORT}/health`);
    console.log(`🔐 OAuth URL: http://192.168.20.10:${PORT}/api/v1/auth/clickup/authorize`);
    console.log(`🌐 CORS enabled for frontend on port 555`);
    console.log(`🔧 Enhanced logging enabled - check console for detailed OAuth flow`);
});

module.exports = app;