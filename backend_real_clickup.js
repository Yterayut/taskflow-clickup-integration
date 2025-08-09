const express = require('express');
const cors = require('cors');
const axios = require('axios');
const session = require('express-session');

const app = express();
const PORT = 777;

// ClickUp OAuth Configuration - CORRECTED
const CLICKUP_CONFIG = {
    CLIENT_ID: 'DA3L6I2MS7RC39PFH7PZGRZAG4A1J8LL',
    CLIENT_SECRET: 'BNLH0AZH1P4MHXQSANAM6N5RKNJPDD4I2IBC157H57G9V5NNET1HQ7V8I63K98ZX',
    REDIRECT_URI: 'http://192.168.20.10:777/auth/callback', // Fixed: Using port 777
    BASE_URL: 'https://api.clickup.com/api/v2',
    AUTH_URL: 'https://app.clickup.com/api'
};

// Session configuration
app.use(session({
    secret: 'taskflow-pro-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

// Enable CORS
app.use(cors({
    origin: ['http://192.168.20.10:8888', 'http://localhost:8888'],
    credentials: true
}));
app.use(express.json());

// In-memory token storage
let userTokens = new Map();

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        service: 'TaskFlow Backend - Real ClickUp Only',
        version: '3.0.0-real-clickup',
        oauth_configured: true,
        redirect_uri: CLICKUP_CONFIG.REDIRECT_URI
    });
});

// OAuth Step 1: Redirect to ClickUp authorization
app.get('/auth/clickup', (req, res) => {
    const authUrl = `${CLICKUP_CONFIG.AUTH_URL}?client_id=${CLICKUP_CONFIG.CLIENT_ID}&redirect_uri=${encodeURIComponent(CLICKUP_CONFIG.REDIRECT_URI)}`;
    
    console.log(`[${new Date().toISOString()}] Redirecting to ClickUp OAuth: ${authUrl}`);
    res.redirect(authUrl);
});

// OAuth Step 2: Handle callback and exchange code for token
app.get('/auth/callback', async (req, res) => {
    const { code } = req.query;
    
    console.log(`[${new Date().toISOString()}] Received callback with code: ${code ? 'YES' : 'NO'}`);
    
    if (!code) {
        console.error('No authorization code received');
        return res.redirect('http://192.168.20.10:8888?error=no_code');
    }

    try {
        console.log(`[${new Date().toISOString()}] Exchanging authorization code for access token`);
        
        // Exchange authorization code for access token
        const tokenData = {
            client_id: CLICKUP_CONFIG.CLIENT_ID,
            client_secret: CLICKUP_CONFIG.CLIENT_SECRET,
            code: code
        };
        
        console.log('Token exchange request:', { client_id: tokenData.client_id, code: tokenData.code });
        
        const tokenResponse = await axios.post(`${CLICKUP_CONFIG.BASE_URL}/oauth/token`, tokenData, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        console.log('Token response status:', tokenResponse.status);
        console.log('Token response data:', tokenResponse.data);

        const { access_token } = tokenResponse.data;
        
        if (!access_token) {
            throw new Error('No access token received from ClickUp');
        }

        // Get user info
        const userResponse = await axios.get(`${CLICKUP_CONFIG.BASE_URL}/user`, {
            headers: {
                'Authorization': access_token,
                'Content-Type': 'application/json'
            }
        });

        console.log('User data received:', userResponse.data);

        const userId = userResponse.data.user.id;
        
        // Store token
        userTokens.set(userId, {
            access_token,
            user_id: userId,
            user_data: userResponse.data.user,
            created_at: new Date().toISOString()
        });

        // Store user ID in session
        req.session.userId = userId;

        console.log(`[${new Date().toISOString()}] Successfully authenticated user: ${userId}`);
        
        // Redirect to frontend with success
        res.redirect('http://192.168.20.10:8888?auth=success');

    } catch (error) {
        console.error('OAuth callback error:', error.response?.data || error.message);
        console.error('Full error:', error);
        
        const errorMsg = error.response?.data?.err || error.message;
        res.redirect(`http://192.168.20.10:8888?error=${encodeURIComponent(errorMsg)}`);
    }
});

// Get authentication status
app.get('/auth/status', (req, res) => {
    const userId = req.session.userId;
    const isAuthenticated = userId && userTokens.has(userId);
    
    if (isAuthenticated) {
        const tokenData = userTokens.get(userId);
        res.json({
            authenticated: true,
            user: tokenData.user_data,
            auth_time: tokenData.created_at
        });
    } else {
        res.json({
            authenticated: false,
            auth_url: '/auth/clickup'
        });
    }
});

// Logout endpoint
app.post('/auth/logout', (req, res) => {
    const userId = req.session.userId;
    
    if (userId && userTokens.has(userId)) {
        userTokens.delete(userId);
        console.log(`[${new Date().toISOString()}] User ${userId} logged out`);
    }
    
    req.session.destroy();
    res.json({ success: true, message: 'Logged out successfully' });
});

// Helper function to make authenticated ClickUp API calls
async function callClickUpAPI(endpoint, userId) {
    const tokenData = userTokens.get(userId);
    
    if (!tokenData) {
        throw new Error('User not authenticated');
    }

    try {
        console.log(`Making ClickUp API call to: ${endpoint}`);
        const response = await axios.get(`${CLICKUP_CONFIG.BASE_URL}${endpoint}`, {
            headers: {
                'Authorization': tokenData.access_token,
                'Content-Type': 'application/json'
            }
        });
        
        console.log(`ClickUp API call successful: ${endpoint}`);
        return response.data;
    } catch (error) {
        console.error(`ClickUp API error for ${endpoint}:`, error.response?.data || error.message);
        throw error;
    }
}

// Get REAL ClickUp data ONLY
app.get('/api/v1/clickup-data', async (req, res) => {
    try {
        const userId = req.session.userId;
        
        if (!userId || !userTokens.has(userId)) {
            return res.status(401).json({
                success: false,
                error: 'Not authenticated with ClickUp',
                message: 'Please connect your ClickUp account first',
                auth_url: '/auth/clickup'
            });
        }

        console.log(`[${new Date().toISOString()}] Fetching REAL ClickUp data for user: ${userId}`);

        // Get user's teams/workspaces
        const teamsData = await callClickUpAPI('/team', userId);
        console.log('Teams data:', teamsData);
        
        if (!teamsData.teams || teamsData.teams.length === 0) {
            return res.json({
                success: true,
                data: {
                    source: 'Real ClickUp Data',
                    user: userTokens.get(userId).user_data,
                    teams: [],
                    tasks: [],
                    workload: {
                        totalTasks: 0,
                        completedTasks: 0,
                        inProgressTasks: 0,
                        overdueTasks: 0
                    },
                    message: 'No teams found in your ClickUp workspace',
                    fetched_at: new Date().toISOString()
                }
            });
        }

        // Get tasks from all teams
        let allTasks = [];
        let workloadStats = {
            totalTasks: 0,
            completedTasks: 0,
            inProgressTasks: 0,
            overdueTasks: 0
        };

        // Get tasks from each team
        for (const team of teamsData.teams) {
            try {
                console.log(`Processing team: ${team.name} (${team.id})`);
                
                // Get spaces for this team
                const spacesData = await callClickUpAPI(`/team/${team.id}/space`, userId);
                console.log(`Found ${spacesData.spaces.length} spaces in team ${team.name}`);
                
                for (const space of spacesData.spaces) {
                    try {
                        console.log(`Processing space: ${space.name} (${space.id})`);
                        
                        // Get lists directly from space
                        const spaceListsData = await callClickUpAPI(`/space/${space.id}/list`, userId);
                        console.log(`Found ${spaceListsData.lists.length} lists in space ${space.name}`);
                        
                        for (const list of spaceListsData.lists) {
                            try {
                                console.log(`Processing list: ${list.name} (${list.id})`);
                                
                                const tasksData = await callClickUpAPI(`/list/${list.id}/task`, userId);
                                console.log(`Found ${tasksData.tasks.length} tasks in list ${list.name}`);
                                
                                for (const task of tasksData.tasks) {
                                    workloadStats.totalTasks++;
                                    
                                    const status = task.status?.status?.toLowerCase() || '';
                                    if (status === 'complete' || status === 'closed' || status === 'done') {
                                        workloadStats.completedTasks++;
                                    } else if (status.includes('progress') || status === 'in progress') {
                                        workloadStats.inProgressTasks++;
                                    }
                                    
                                    // Check if overdue
                                    if (task.due_date && new Date(parseInt(task.due_date)) < new Date()) {
                                        workloadStats.overdueTasks++;
                                    }
                                    
                                    allTasks.push({
                                        id: task.id,
                                        name: task.name,
                                        status: task.status,
                                        priority: task.priority,
                                        assignees: task.assignees,
                                        due_date: task.due_date,
                                        folder: space.name,
                                        list: list.name,
                                        team: team.name,
                                        url: task.url
                                    });
                                }
                            } catch (listError) {
                                console.warn(`Could not fetch tasks for list ${list.id}:`, listError.message);
                            }
                        }
                        
                    } catch (spaceError) {
                        console.warn(`Could not fetch lists for space ${space.id}:`, spaceError.message);
                    }
                }
            } catch (teamError) {
                console.warn(`Could not fetch spaces for team ${team.id}:`, teamError.message);
            }
        }

        const userData = userTokens.get(userId);
        
        const responseData = {
            success: true,
            data: {
                source: 'Real ClickUp Data',
                user: userData.user_data,
                teams: teamsData.teams,
                tasks: allTasks,
                workload: workloadStats,
                fetched_at: new Date().toISOString()
            }
        };

        console.log(`[${new Date().toISOString()}] Successfully fetched ${allTasks.length} real tasks from ${teamsData.teams.length} teams`);
        res.json(responseData);

    } catch (error) {
        console.error('Error fetching ClickUp data:', error.response?.data || error.message);
        
        if (error.response?.status === 401) {
            // Token expired or invalid
            const userId = req.session.userId;
            if (userId) {
                userTokens.delete(userId);
            }
            req.session.destroy();
            
            return res.status(401).json({
                success: false,
                error: 'ClickUp authentication expired',
                message: 'Please reconnect your ClickUp account',
                auth_url: '/auth/clickup'
            });
        }
        
        res.status(500).json({
            success: false,
            error: 'Failed to fetch ClickUp data',
            message: error.response?.data?.err || error.message,
            details: error.response?.data
        });
    }
});

// NO MOCK DATA - Only real ClickUp data
app.get('/api/v1/test/clickup-data', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Mock data disabled',
        message: 'This system only works with real ClickUp data. Please connect your ClickUp account.',
        auth_url: '/auth/clickup'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 TaskFlow Backend (REAL ClickUp ONLY) running on port ${PORT}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
    console.log(`🔐 ClickUp OAuth: http://localhost:${PORT}/auth/clickup`);
    console.log(`📊 REAL ClickUp Data: http://localhost:${PORT}/api/v1/clickup-data`);
    console.log(`❌ Mock data: DISABLED - Real ClickUp only!`);
    console.log(`📋 OAuth Config:`);
    console.log(`   Client ID: ${CLICKUP_CONFIG.CLIENT_ID}`);
    console.log(`   Redirect URI: ${CLICKUP_CONFIG.REDIRECT_URI} (CORRECTED)`);
});

module.exports = app;