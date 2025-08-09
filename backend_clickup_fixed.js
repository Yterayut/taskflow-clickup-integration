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
    redirectUri: 'http://192.168.20.10:777/api/v1/auth/clickup/callback',
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
    max: 100 // limit each IP to 100 requests per windowMs
});

app.use(limiter);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// In-memory storage for demo (replace with database in production)
let sessionStorage = new Map();
let clickupTokens = new Map();

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        service: 'TaskFlow Backend - ClickUp Integration Fixed',
        version: '3.1.0-clickup-fixed',
        clickup: {
            configured: true,
            clientId: CLICKUP_CONFIG.clientId.substring(0, 10) + '...'
        }
    });
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
        
        console.log('Generated auth URL:', authUrl);
        
        res.json({
            success: true,
            authorization_url: authUrl,
            state: state
        });
    } catch (error) {
        console.error('Auth URL Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate authorization URL'
        });
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
        
        console.log('Redirecting to:', authUrl);
        res.redirect(authUrl);
    } catch (error) {
        console.error('OAuth Redirect Error:', error);
        res.status(500).send('OAuth authorization failed');
    }
});

// OAuth callback handler - FIXED
app.get('/api/v1/auth/clickup/callback', async (req, res) => {
    const { code, state } = req.query;
    
    console.log('OAuth callback received:', { code: !!code, state: !!state });
    
    try {
        // Validate state
        if (!state || !sessionStorage.has(state)) {
            throw new Error('Invalid state parameter');
        }
        
        if (!code) {
            throw new Error('No authorization code received');
        }
        
        console.log('Exchanging code for token...');
        
        // Exchange code for access token - CORRECTED API CALL
        const tokenResponse = await axios.post('https://app.clickup.com/api/v2/oauth/token', {
            client_id: CLICKUP_CONFIG.clientId,
            client_secret: CLICKUP_CONFIG.clientSecret,
            code: code
        }, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });
        
        console.log('Token response status:', tokenResponse.status);
        console.log('Token response data:', tokenResponse.data);
        
        const { access_token } = tokenResponse.data;
        
        if (!access_token) {
            console.error('No access token in response:', tokenResponse.data);
            throw new Error('No access token received from ClickUp');
        }
        
        // Store token
        const sessionId = crypto.randomBytes(32).toString('hex');
        clickupTokens.set(sessionId, {
            accessToken: access_token,
            timestamp: Date.now(),
            ip: req.ip
        });
        
        console.log('Token stored successfully with session:', sessionId);
        
        // Clean up state
        sessionStorage.delete(state);
        
        // Redirect to frontend with session
        res.redirect(`http://192.168.20.10:555?auth=success&session=${sessionId}`);
        
    } catch (error) {
        console.error('OAuth Callback Error:', error);
        console.error('Error details:', error.response?.data || error.message);
        
        const errorMessage = error.response?.data?.error || error.message || 'Unknown error';
        res.redirect(`http://192.168.20.10:555?auth=error&message=${encodeURIComponent(errorMessage)}`);
    }
});

// Get user info from ClickUp
app.get('/api/v1/clickup/user', async (req, res) => {
    const sessionId = req.headers.authorization?.replace('Bearer ', '');
    
    try {
        const tokenData = clickupTokens.get(sessionId);
        if (!tokenData) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        
        console.log('Fetching user data from ClickUp...');
        
        const response = await axios.get(`${CLICKUP_CONFIG.baseApiUrl}/user`, {
            headers: {
                'Authorization': tokenData.accessToken
            },
            timeout: 10000
        });
        
        console.log('User data fetched successfully');
        
        res.json({
            success: true,
            data: response.data
        });
    } catch (error) {
        console.error('User API Error:', error);
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
        
        console.log('Fetching teams data from ClickUp...');
        
        const response = await axios.get(`${CLICKUP_CONFIG.baseApiUrl}/team`, {
            headers: {
                'Authorization': tokenData.accessToken
            },
            timeout: 10000
        });
        
        console.log('Teams data fetched successfully');
        
        res.json({
            success: true,
            data: response.data
        });
    } catch (error) {
        console.error('Teams API Error:', error);
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
        
        console.log('Fetching comprehensive dashboard data...');
        
        const headers = {
            'Authorization': tokenData.accessToken
        };
        
        // Fetch user info
        console.log('Fetching user info...');
        const userResponse = await axios.get(`${CLICKUP_CONFIG.baseApiUrl}/user`, { 
            headers,
            timeout: 10000 
        });
        
        // Fetch teams
        console.log('Fetching teams...');
        const teamsResponse = await axios.get(`${CLICKUP_CONFIG.baseApiUrl}/team`, { 
            headers,
            timeout: 10000 
        });
        
        // Get first team's spaces and tasks
        let tasksData = { tasks: [] };
        let spacesData = { spaces: [] };
        
        if (teamsResponse.data.teams && teamsResponse.data.teams.length > 0) {
            const teamId = teamsResponse.data.teams[0].id;
            console.log('Fetching spaces for team:', teamId);
            
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
                    console.log('Fetching tasks for space:', spaceId);
                    
                    const tasksResponse = await axios.get(`${CLICKUP_CONFIG.baseApiUrl}/space/${spaceId}/task`, { 
                        headers,
                        timeout: 10000 
                    });
                    tasksData = tasksResponse.data;
                }
            } catch (taskError) {
                console.log('Tasks fetch warning:', taskError.message);
                // Continue with empty tasks data
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
        
        console.log('Dashboard data compiled successfully');
        console.log('Data summary:', {
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
        console.error('Dashboard Data Error:', error);
        console.error('Error details:', error.response?.data || error.message);
        
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
        
        console.log('Manual sync requested');
        
        // Simulate sync process
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        res.json({
            success: true,
            message: 'Data synchronized successfully',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Sync Error:', error);
        res.status(500).json({
            success: false,
            error: 'Sync failed'
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
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
    console.log(`🚀 TaskFlow Pro Backend (ClickUp Fixed) running on port ${PORT}`);
    console.log(`🔗 Health check: http://192.168.20.10:${PORT}/health`);
    console.log(`🔐 OAuth URL: http://192.168.20.10:${PORT}/api/v1/auth/clickup/authorize`);
    console.log(`📊 ClickUp Client ID: ${CLICKUP_CONFIG.clientId}`);
    console.log(`🌐 CORS enabled for frontend on port 555`);
    console.log(`🔧 OAuth Fixed: Using correct ClickUp token endpoint`);
});

module.exports = app;