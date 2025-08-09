const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 777;

// ClickUp API Configuration - ใช้ค่าเดียวกับที่เคยทำงานได้
const CLICKUP_CONFIG = {
    clientId: 'DA3L6I2MS7RC39PFH7PZGRZAG4A1J8LL',
    clientSecret: 'BNLH0AZH1P4MHXQSANAM6N5RKNJPDD4I2IBC157H57G9V5NNET1HQ7V8I63K98ZX',
    redirectUri: 'http://192.168.20.10:777/api/v1/auth/clickup/callback', // เหมือนเดิมที่เคยใช้
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
        service: 'TaskFlow Backend - Production OAuth',
        version: '8.0.0-production-oauth',
        clickup: {
            configured: true,
            clientId: CLICKUP_CONFIG.clientId.substring(0, 10) + '...',
            redirectUri: CLICKUP_CONFIG.redirectUri
        }
    };
    
    log('info', 'Health check requested', health);
    res.json(health);
});

// Generate OAuth authorization URL - ตรงกับ log เก่า
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
            authorization_url: authUrl,
            state: state,
            message: 'Redirect user to authorization_url to complete ClickUp authentication'
        });
    } catch (error) {
        log('error', 'Auth URL generation failed', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate authorization URL'
        });
    }
});

// Direct OAuth redirect - ตรงกับ log เก่า
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

// OAuth callback handler - ตำแหน่งเดียวกับ log เก่า
app.get('/api/v1/auth/clickup/callback', async (req, res) => {
    const { code, state, error } = req.query;
    
    log('info', '=== OAUTH CALLBACK RECEIVED ===', {
        hasCode: !!code,
        hasState: !!state,
        hasError: !!error,
        fullQuery: req.query,
        url: req.url,
        method: req.method,
        timestamp: new Date().toISOString()
    });
    
    try {
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
        
        log('info', 'Starting token exchange process', { 
            code: code.substring(0, 20) + '...',
            clientId: CLICKUP_CONFIG.clientId 
        });
        
        // Token exchange - ใช้ method เดียวกับ log เก่า (JSON format)
        const tokenResponse = await axios.post('https://api.clickup.com/api/v2/oauth/token', {
            client_id: CLICKUP_CONFIG.clientId,
            client_secret: CLICKUP_CONFIG.clientSecret,
            code: code
        }, {
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'TaskFlow-Pro/8.0.0-ProductionOAuth'
            },
            timeout: 30000,
            validateStatus: function (status) {
                return status < 500;
            }
        });
        
        log('info', 'Token exchange response received', { 
            status: tokenResponse.status,
            statusText: tokenResponse.statusText,
            headers: tokenResponse.headers,
            dataType: typeof tokenResponse.data,
            dataKeys: typeof tokenResponse.data === 'object' ? Object.keys(tokenResponse.data) : 'not-object'
        });
        
        if (tokenResponse.status !== 200) {
            log('error', 'Token exchange failed - non-200 status', {
                status: tokenResponse.status,
                statusText: tokenResponse.statusText,
                data: tokenResponse.data
            });
            throw new Error(`Token exchange failed: HTTP ${tokenResponse.status} - ${JSON.stringify(tokenResponse.data)}`);
        }
        
        const accessToken = tokenResponse.data.access_token;
        
        if (!accessToken) {
            log('error', 'No access token received after successful response', tokenResponse.data);
            throw new Error('No access token received from ClickUp');
        }
        
        log('info', '🎉 ACCESS TOKEN SUCCESS!', { 
            hasToken: !!accessToken,
            tokenLength: accessToken.length,
            tokenStart: accessToken.substring(0, 10) + '...'
        });
        
        // Get user info from ClickUp using the access token
        const userResponse = await axios.get(`${CLICKUP_CONFIG.baseApiUrl}/user`, {
            headers: {
                'Authorization': accessToken.startsWith('Bearer ') ? accessToken : `Bearer ${accessToken}`
            },
            timeout: 15000
        });
        
        log('info', 'User info retrieved', {
            username: userResponse.data.user.username,
            email: userResponse.data.user.email
        });
        
        // Store token and user data
        const sessionId = crypto.randomBytes(32).toString('hex');
        clickupTokens.set(sessionId, {
            accessToken: accessToken,
            timestamp: Date.now(),
            ip: req.ip,
            tokenData: tokenResponse.data,
            user: userResponse.data.user
        });
        
        log('info', 'Token stored successfully', { 
            sessionId: sessionId.substring(0, 10) + '...',
            storedTokens: clickupTokens.size
        });
        
        // Clean up state
        sessionStorage.delete(state);
        
        // Redirect to frontend with session - ตรงกับ log เก่า
        const redirectUrl = `http://192.168.20.10:555?auth=success&token=${sessionId}`;
        log('info', '🎯 OAUTH SUCCESS - Redirecting to frontend', { redirectUrl });
        
        res.writeHead(302, {
            'Location': redirectUrl,
            'Cache-Control': 'no-cache'
        });
        res.end();
        
    } catch (error) {
        log('error', '❌ OAUTH CALLBACK ERROR', {
            error: error.message,
            stack: error.stack,
            response: error.response ? {
                status: error.response.status,
                data: error.response.data
            } : 'no-response'
        });
        
        const errorMessage = error.response?.data?.error || error.message || 'Unknown OAuth error';
        const redirectUrl = `http://192.168.20.10:555?auth=error&message=${encodeURIComponent(errorMessage)}`;
        
        log('info', '🔄 OAUTH ERROR - Redirecting to frontend with error', { redirectUrl });
        
        res.writeHead(302, {
            'Location': redirectUrl,
            'Cache-Control': 'no-cache'
        });
        res.end();
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
        
        // Get tasks from all teams
        let allTasks = [];
        const teams = teamsResponse.data.teams || [];
        
        for (const team of teams) {
            try {
                // Get team tasks
                const teamTasksResponse = await axios.get(`${CLICKUP_CONFIG.baseApiUrl}/team/${team.id}/task?archived=false&subtasks=true&include_closed=true`, {
                    headers,
                    timeout: 15000
                });
                allTasks = allTasks.concat(teamTasksResponse.data.tasks || []);
                
                // Get spaces and their tasks
                const spacesResponse = await axios.get(`${CLICKUP_CONFIG.baseApiUrl}/team/${team.id}/space?archived=false`, {
                    headers,
                    timeout: 15000
                });
                
                for (const space of spacesResponse.data.spaces || []) {
                    try {
                        const spaceTasksResponse = await axios.get(`${CLICKUP_CONFIG.baseApiUrl}/space/${space.id}/task?archived=false&subtasks=true&include_closed=true`, {
                            headers,
                            timeout: 15000
                        });
                        allTasks = allTasks.concat(spaceTasksResponse.data.tasks || []);
                    } catch (spaceError) {
                        log('warn', `Failed to get tasks for space ${space.name}`, spaceError.message);
                    }
                }
            } catch (teamError) {
                log('warn', `Failed to get tasks for team ${team.name}`, teamError.message);
            }
        }
        
        // Remove duplicate tasks
        const uniqueTasks = [];
        const seenIds = new Set();
        for (const task of allTasks) {
            if (!seenIds.has(task.id)) {
                seenIds.add(task.id);
                uniqueTasks.push(task);
            }
        }
        
        // Calculate workload metrics
        const workload = {
            totalTasks: uniqueTasks.length,
            completedTasks: uniqueTasks.filter(t => {
                const status = t.status?.status?.toLowerCase() || '';
                return status.includes('complete') || status.includes('done') || status.includes('closed');
            }).length,
            inProgressTasks: uniqueTasks.filter(t => {
                const status = t.status?.status?.toLowerCase() || '';
                return status.includes('progress') || status.includes('doing') || status.includes('active');
            }).length,
            overdueTasks: uniqueTasks.filter(t => {
                if (!t.due_date) return false;
                return new Date(parseInt(t.due_date)) < new Date();
            }).length
        };
        
        workload.completionRate = workload.totalTasks > 0 ? 
            Math.round((workload.completedTasks / workload.totalTasks) * 100) : 0;
        
        // Process and transform data
        const dashboardData = {
            user: userResponse.data.user,
            teams: teams,
            tasks: uniqueTasks.slice(0, 50), // Limit to 50 recent tasks
            workload: workload,
            employees: [], // Will be populated if team members are fetched
            timestamp: new Date().toISOString()
        };
        
        log('info', 'ClickUp API calls successful', {
            userFetched: !!dashboardData.user,
            teamsFetched: dashboardData.teams.length,
            tasksFetched: dashboardData.tasks.length
        });
        
        res.json({
            success: true,
            data: dashboardData,
            source: 'real_clickup_api_production'
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
        user: tokenData?.user || null,
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

// Root path handler - แสดงข้อมูล server
app.get('/', (req, res) => {
    log('info', 'Root path accessed');
    res.send(`
        <h1>🚀 TaskFlow Pro Backend - Production OAuth</h1>
        <p>✅ Server is running properly.</p>
        <p>📋 Version: 8.0.0-production-oauth</p>
        <p>🕐 Time: ${new Date().toISOString()}</p>
        <p>🔧 ClickUp OAuth Integration: Production Ready</p>
        <p>🌐 Frontend URL: <a href="http://192.168.20.10:555" target="_blank">http://192.168.20.10:555</a></p>
        <hr>
        <h3>🔐 OAuth Testing</h3>
        <p><a href="/api/v1/auth/clickup/auth-url">Get ClickUp Auth URL (JSON)</a></p>
        <p><a href="/api/v1/auth/clickup/authorize">Direct ClickUp OAuth Redirect</a></p>
        <hr>
        <h3>📊 System Status</h3>
        <p>Active Sessions: ${clickupTokens.size}</p>
        <p>OAuth States: ${sessionStorage.size}</p>
        <p>Redirect URI: ${CLICKUP_CONFIG.redirectUri}</p>
    `);
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
    log('info', '🚀 PRODUCTION OAUTH SERVER STARTED', {
        port: PORT,
        clientId: CLICKUP_CONFIG.clientId,
        redirectUri: CLICKUP_CONFIG.redirectUri,
        time: new Date().toISOString()
    });
    
    console.log(`🚀 TaskFlow Pro Backend (Production OAuth) running on port ${PORT}`);
    console.log(`🔗 Health check: http://192.168.20.10:${PORT}/health`);
    console.log(`🔐 OAuth URL: http://192.168.20.10:${PORT}/api/v1/auth/clickup/authorize`);
    console.log(`🌐 CORS enabled for frontend on port 555`);
    console.log(`🔧 OAuth Config: ${CLICKUP_CONFIG.redirectUri}`);
    console.log(`⚡ Ready for ClickUp OAuth integration (Production Mode)!`);
});

module.exports = app;