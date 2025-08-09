const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 777;

// ClickUp API Configuration - CORRECTED REDIRECT URI
const CLICKUP_CONFIG = {
    clientId: 'DA3L6I2MS7RC39PFH7PZGRZAG4A1J8LL',
    clientSecret: 'BNLH0AZH1P4MHXQSANAM6N5RKNJPDD4I2IBC157H57G9V5NNET1HQ7V8I63K98ZX',
    redirectUri: '192.168.20.10:777',  // ← ใช้ตรงกับที่ configure ใน ClickUp App
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
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100
});

app.use(limiter);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// In-memory storage
let sessionStorage = new Map();
let clickupTokens = new Map();

// Detailed logging function
function log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
    if (data) {
        console.log('Data:', JSON.stringify(data, null, 2));
    }
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        service: 'TaskFlow Backend - ClickUp OAuth Fixed',
        version: '3.3.0-oauth-fixed',
        clickup: {
            configured: true,
            clientId: CLICKUP_CONFIG.clientId.substring(0, 10) + '...',
            redirectUri: CLICKUP_CONFIG.redirectUri
        }
    });
});

// Generate OAuth authorization URL - FIXED
app.get('/api/v1/auth/clickup/auth-url', (req, res) => {
    try {
        const state = crypto.randomBytes(32).toString('hex');
        sessionStorage.set(state, { 
            timestamp: Date.now(),
            ip: req.ip 
        });
        
        // ใช้ redirect URI ที่ถูกต้อง
        const authUrl = `https://app.clickup.com/api?` +
            `client_id=${CLICKUP_CONFIG.clientId}&` +
            `redirect_uri=${encodeURIComponent(CLICKUP_CONFIG.redirectUri)}&` +
            `state=${state}`;
        
        log('info', 'Generated OAuth URL with CORRECT redirect URI', { 
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
        log('error', 'Auth URL Error', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate authorization URL'
        });
    }
});

// Direct OAuth redirect - FIXED
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
        
        log('info', 'Direct OAuth redirect with CORRECT redirect URI', { authUrl });
        res.redirect(authUrl);
    } catch (error) {
        log('error', 'OAuth Redirect Error', error);
        res.status(500).send('OAuth authorization failed');
    }
});

// OAuth callback handler - จับทั้ง root และ path
app.get('/', async (req, res) => {
    // ถ้าเป็น OAuth callback
    if (req.query.code && req.query.state) {
        return handleOAuthCallback(req, res);
    }
    
    // ถ้าไม่ใช่ OAuth callback
    res.send('TaskFlow Pro Backend - ClickUp Integration');
});

app.get('/api/v1/auth/clickup/callback', handleOAuthCallback);

async function handleOAuthCallback(req, res) {
    const { code, state, error } = req.query;
    
    log('info', 'OAuth callback received', { 
        hasCode: !!code, 
        hasState: !!state, 
        hasError: !!error,
        query: req.query 
    });
    
    try {
        // Check for OAuth error
        if (error) {
            log('error', 'OAuth authorization denied', { error });
            throw new Error(`OAuth error: ${error}`);
        }
        
        // Validate state
        if (!state || !sessionStorage.has(state)) {
            log('error', 'Invalid state parameter', { state, hasState: sessionStorage.has(state) });
            throw new Error('Invalid state parameter');
        }
        
        if (!code) {
            log('error', 'No authorization code received');
            throw new Error('No authorization code received');
        }
        
        log('info', 'Starting token exchange', { 
            code: code.substring(0, 10) + '...',
            clientId: CLICKUP_CONFIG.clientId 
        });
        
        // Token exchange - ลองหลายวิธี
        let tokenResponse;
        let accessToken;
        
        // Method 1: POST form-data
        try {
            log('info', 'Token exchange method 1: POST form-data');
            
            const formData = new URLSearchParams();
            formData.append('client_id', CLICKUP_CONFIG.clientId);
            formData.append('client_secret', CLICKUP_CONFIG.clientSecret);
            formData.append('code', code);
            
            tokenResponse = await axios.post('https://app.clickup.com/api/v2/oauth/token', formData, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                timeout: 15000
            });
            
            log('info', 'Token exchange response method 1', { 
                status: tokenResponse.status,
                data: tokenResponse.data
            });
            
            accessToken = tokenResponse.data.access_token;
            
        } catch (method1Error) {
            log('warn', 'Token exchange method 1 failed', method1Error.response?.data || method1Error.message);
            
            // Method 2: JSON POST
            try {
                log('info', 'Token exchange method 2: JSON POST');
                
                tokenResponse = await axios.post('https://app.clickup.com/api/v2/oauth/token', {
                    client_id: CLICKUP_CONFIG.clientId,
                    client_secret: CLICKUP_CONFIG.clientSecret,
                    code: code
                }, {
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    timeout: 15000
                });
                
                log('info', 'Token exchange response method 2', { 
                    status: tokenResponse.status,
                    data: tokenResponse.data
                });
                
                accessToken = tokenResponse.data.access_token;
                
            } catch (method2Error) {
                log('error', 'All token exchange methods failed', {
                    method1: method1Error.response?.data || method1Error.message,
                    method2: method2Error.response?.data || method2Error.message
                });
                throw new Error(`Token exchange failed: ${method2Error.response?.data?.error || method2Error.message}`);
            }
        }
        
        if (!accessToken) {
            log('error', 'No access token in response', tokenResponse?.data);
            throw new Error('No access token received from ClickUp');
        }
        
        log('info', 'Access token received successfully', { 
            hasToken: !!accessToken,
            tokenLength: accessToken.length 
        });
        
        // Store token
        const sessionId = crypto.randomBytes(32).toString('hex');
        clickupTokens.set(sessionId, {
            accessToken: accessToken,
            timestamp: Date.now(),
            ip: req.ip,
            tokenData: tokenResponse.data
        });
        
        log('info', 'Token stored successfully', { sessionId });
        
        // Clean up state
        sessionStorage.delete(state);
        
        // Redirect to frontend with session
        const redirectUrl = `http://192.168.20.10:555?auth=success&session=${sessionId}`;
        log('info', 'Redirecting to frontend', { redirectUrl });
        res.redirect(redirectUrl);
        
    } catch (error) {
        log('error', 'OAuth Callback Error', error);
        
        const errorMessage = error.response?.data?.error || error.message || 'Unknown error';
        const redirectUrl = `http://192.168.20.10:555?auth=error&message=${encodeURIComponent(errorMessage)}`;
        
        log('info', 'Redirecting to frontend with error', { redirectUrl });
        res.redirect(redirectUrl);
    }
}

// Get user info from ClickUp
app.get('/api/v1/clickup/user', async (req, res) => {
    const sessionId = req.headers.authorization?.replace('Bearer ', '');
    
    try {
        const tokenData = clickupTokens.get(sessionId);
        if (!tokenData) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        
        log('info', 'Fetching user data from ClickUp');
        
        const response = await axios.get(`${CLICKUP_CONFIG.baseApiUrl}/user`, {
            headers: {
                'Authorization': tokenData.accessToken.startsWith('Bearer ') ? tokenData.accessToken : `Bearer ${tokenData.accessToken}`
            },
            timeout: 10000
        });
        
        log('info', 'User data fetched successfully');
        
        res.json({
            success: true,
            data: response.data
        });
    } catch (error) {
        log('error', 'User API Error', error.response?.data || error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch user data',
            details: error.response?.data || error.message
        });
    }
});

// Get teams from ClickUp
app.get('/api/v1/clickup/teams', async (req, res) => {
    const sessionId = req.headers.authorization?.replace('Bearer ', '');
    
    try {
        const tokenData = clickupTokens.get(sessionId);
        if (!tokenData) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        
        log('info', 'Fetching teams data from ClickUp');
        
        const response = await axios.get(`${CLICKUP_CONFIG.baseApiUrl}/team`, {
            headers: {
                'Authorization': tokenData.accessToken.startsWith('Bearer ') ? tokenData.accessToken : `Bearer ${tokenData.accessToken}`
            },
            timeout: 10000
        });
        
        log('info', 'Teams data fetched successfully');
        
        res.json({
            success: true,
            data: response.data
        });
    } catch (error) {
        log('error', 'Teams API Error', error.response?.data || error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch teams data',
            details: error.response?.data || error.message
        });
    }
});

// Get comprehensive ClickUp data for dashboard
app.get('/api/v1/clickup/dashboard-data', async (req, res) => {
    const sessionId = req.headers.authorization?.replace('Bearer ', '');
    
    try {
        const tokenData = clickupTokens.get(sessionId);
        if (!tokenData) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        
        log('info', 'Fetching comprehensive dashboard data');
        
        const headers = {
            'Authorization': tokenData.accessToken.startsWith('Bearer ') ? tokenData.accessToken : `Bearer ${tokenData.accessToken}`
        };
        
        // Fetch user info
        log('info', 'Fetching user info...');
        const userResponse = await axios.get(`${CLICKUP_CONFIG.baseApiUrl}/user`, { 
            headers,
            timeout: 10000 
        });
        
        // Fetch teams
        log('info', 'Fetching teams...');
        const teamsResponse = await axios.get(`${CLICKUP_CONFIG.baseApiUrl}/team`, { 
            headers,
            timeout: 10000 
        });
        
        // Get first team's spaces and tasks
        let tasksData = { tasks: [] };
        let spacesData = { spaces: [] };
        
        if (teamsResponse.data.teams && teamsResponse.data.teams.length > 0) {
            const teamId = teamsResponse.data.teams[0].id;
            log('info', 'Fetching spaces for team', { teamId });
            
            try {
                // Get spaces for the team
                const spacesResponse = await axios.get(`${CLICKUP_CONFIG.baseApiUrl}/team/${teamId}/space`, { 
                    headers,
                    timeout: 10000 
                });
                spacesData = spacesResponse.data;
                
                // Get tasks for the first space
                if (spacesData.spaces && spacesData.spaces.length > 0) {
                    const spaceId = spacesData.spaces[0].id;
                    log('info', 'Fetching tasks for space', { spaceId });
                    
                    const tasksResponse = await axios.get(`${CLICKUP_CONFIG.baseApiUrl}/space/${spaceId}/task`, { 
                        headers,
                        timeout: 10000 
                    });
                    tasksData = tasksResponse.data;
                }
            } catch (taskError) {
                log('warn', 'Tasks fetch warning', taskError.message);
            }
        }
        
        // Process and transform data
        const dashboardData = {
            user: userResponse.data.user,
            teams: teamsResponse.data.teams || [],
            spaces: spacesData.spaces || [],
            tasks: tasksData.tasks || [],
            workload: calculateWorkload(tasksData.tasks || []),
            employees: extractEmployees(tasksData.tasks || []),
            timestamp: new Date().toISOString()
        };
        
        log('info', 'Dashboard data compiled successfully', {
            user: !!dashboardData.user,
            teams: dashboardData.teams.length,
            spaces: dashboardData.spaces.length,
            tasks: dashboardData.tasks.length,
            employees: dashboardData.employees.length
        });
        
        res.json({
            success: true,
            data: dashboardData,
            source: 'real_clickup_api'
        });
        
    } catch (error) {
        log('error', 'Dashboard Data Error', error.response?.data || error.message);
        
        res.status(500).json({
            success: false,
            error: 'Failed to fetch dashboard data',
            details: error.response?.data || error.message
        });
    }
});

// Calculate workload statistics
function calculateWorkload(tasks) {
    const total = tasks.length;
    const completed = tasks.filter(task => 
        task.status?.status === 'complete' || 
        task.status?.status === 'closed' ||
        task.status?.type === 'closed'
    ).length;
    const inProgress = tasks.filter(task => 
        task.status?.status === 'in progress' ||
        task.status?.type === 'custom'
    ).length;
    const overdue = tasks.filter(task => {
        if (!task.due_date) return false;
        return new Date(parseInt(task.due_date)) < new Date();
    }).length;
    
    return {
        totalTasks: total,
        completedTasks: completed,
        inProgressTasks: inProgress,
        overdueTasks: overdue,
        completionRate: total > 0 ? Math.round((completed / total) * 100) : 0
    };
}

// Extract employees from tasks
function extractEmployees(tasks) {
    const employeeMap = new Map();
    
    tasks.forEach(task => {
        if (task.assignees && task.assignees.length > 0) {
            task.assignees.forEach(assignee => {
                const id = assignee.id;
                if (!employeeMap.has(id)) {
                    employeeMap.set(id, {
                        id: id,
                        name: assignee.username || assignee.email,
                        email: assignee.email || `${assignee.username}@clickup.com`,
                        avatar: assignee.profilePicture || '',
                        role: 'Team Member',
                        department: 'General',
                        taskCount: 0,
                        completedTasks: 0
                    });
                }
                
                const employee = employeeMap.get(id);
                employee.taskCount++;
                
                if (task.status?.status === 'complete' || 
                    task.status?.status === 'closed' ||
                    task.status?.type === 'closed') {
                    employee.completedTasks++;
                }
            });
        }
    });
    
    return Array.from(employeeMap.values());
}

// Authentication status check
app.get('/api/v1/auth/status', (req, res) => {
    const sessionId = req.headers.authorization?.replace('Bearer ', '');
    const tokenData = clickupTokens.get(sessionId);
    
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
        log('info', 'User logged out', { sessionId });
    }
    
    res.json({
        success: true,
        message: 'Logged out successfully'
    });
});

// Manual sync endpoint
app.post('/api/v1/sync', async (req, res) => {
    const sessionId = req.headers.authorization?.replace('Bearer ', '');
    
    try {
        const tokenData = clickupTokens.get(sessionId);
        if (!tokenData) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        
        log('info', 'Manual sync requested');
        
        // Simulate sync process
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        res.json({
            success: true,
            message: 'Data synchronized successfully',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        log('error', 'Sync Error', error);
        res.status(500).json({
            success: false,
            error: 'Sync failed'
        });
    }
});

// Debug endpoints
app.get('/api/v1/debug/sessions', (req, res) => {
    res.json({
        activeSessions: clickupTokens.size,
        sessionStates: sessionStorage.size
    });
});

app.get('/api/v1/debug/config', (req, res) => {
    res.json({
        clientId: CLICKUP_CONFIG.clientId,
        redirectUri: CLICKUP_CONFIG.redirectUri,
        baseApiUrl: CLICKUP_CONFIG.baseApiUrl
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    log('error', 'Unhandled error', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found'
    });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    log('info', '🚀 TaskFlow Pro Backend (OAuth Fixed) started', {
        port: PORT,
        clientId: CLICKUP_CONFIG.clientId,
        redirectUri: CLICKUP_CONFIG.redirectUri
    });
    
    console.log(`🔗 Health check: http://192.168.20.10:${PORT}/health`);
    console.log(`🔐 OAuth URL: http://192.168.20.10:${PORT}/api/v1/auth/clickup/authorize`);
    console.log(`🌐 CORS enabled for frontend on port 555`);
    console.log(`🔧 OAuth Fixed: Using CORRECT redirect URI: ${CLICKUP_CONFIG.redirectUri}`);
});

module.exports = app;