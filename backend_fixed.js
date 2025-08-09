const express = require('express');
const cors = require('cors');
const axios = require('axios');
const session = require('express-session');

const app = express();
const PORT = 777;

// ClickUp OAuth Configuration
const CLICKUP_CONFIG = {
    CLIENT_ID: 'DA3L6I2MS7RC39PFH7PZGRZAG4A1J8LL',
    CLIENT_SECRET: 'BNLH0AZH1P4MHXQSANAM6N5RKNJPDD4I2IBC157H57G9V5NNET1HQ7V8I63K98ZX',
    REDIRECT_URI: 'http://192.168.20.10:8080/auth/callback',
    BASE_URL: 'https://api.clickup.com/api/v2',
    AUTH_URL: 'https://app.clickup.com/api'
};

// Session configuration
app.use(session({
    secret: 'taskflow-pro-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true in production with HTTPS
}));

// Enable CORS for all origins
app.use(cors({
    origin: ['http://192.168.20.10:8888', 'http://localhost:8888', 'http://192.168.20.10:8080'],
    credentials: true
}));
app.use(express.json());

// In-memory token storage (use database in production)
let userTokens = new Map();

// Mock data for fallback
const MOCK_DATA = {
    success: true,
    data: {
        source: 'Mock Data (ClickUp Integration Ready)',
        user: {
            id: 'user-001',
            username: 'TaskFlow Manager',
            email: 'manager@taskflow.com',
            profilePicture: null
        },
        teams: [
            {
                id: 'team-001',
                name: 'Development Team',
                color: '#2563eb'
            },
            {
                id: 'team-002', 
                name: 'Design Team',
                color: '#059669'
            }
        ],
        tasks: [
            {
                id: 'task-001',
                name: 'ออกแบบระบบ Dashboard',
                status: { status: 'in progress', color: '#f59e0b' },
                priority: { priority: 'high' },
                assignees: [
                    { id: 'emp-001', username: 'กิตติพงษ์ สมศรี', email: 'kitt@company.com' }
                ],
                due_date: Date.now() + (7 * 24 * 60 * 60 * 1000),
                folder: 'Development',
                list: 'Sprint Tasks',
                team: 'Development Team'
            },
            {
                id: 'task-002',
                name: 'พัฒนา API Authentication',
                status: { status: 'complete', color: '#059669' },
                priority: { priority: 'high' },
                assignees: [
                    { id: 'emp-002', username: 'นภัสสร จันทร์เพ็ญ', email: 'naphat@company.com' }
                ],
                due_date: Date.now() - (2 * 24 * 60 * 60 * 1000),
                folder: 'Development',
                list: 'Sprint Tasks',
                team: 'Development Team'
            },
            {
                id: 'task-003',
                name: 'ทดสอบระบบ Login',
                status: { status: 'in progress', color: '#f59e0b' },
                priority: { priority: 'medium' },
                assignees: [
                    { id: 'emp-003', username: 'สมชาย วงษ์ใหญ่', email: 'somchai@company.com' }
                ],
                due_date: Date.now() + (3 * 24 * 60 * 60 * 1000),
                folder: 'QA',
                list: 'Testing',
                team: 'Development Team'
            },
            {
                id: 'task-004',
                name: 'สร้างฐานข้อมูล Users',
                status: { status: 'complete', color: '#059669' },
                priority: { priority: 'high' },
                assignees: [
                    { id: 'emp-004', username: 'อรุณ ใจดี', email: 'arun@company.com' }
                ],
                due_date: Date.now() - (5 * 24 * 60 * 60 * 1000),
                folder: 'Development',
                list: 'Backend',
                team: 'Development Team'
            },
            {
                id: 'task-005',
                name: 'อัพเดท UI/UX Design',
                status: { status: 'to do', color: '#6b7280' },
                priority: { priority: 'medium' },
                assignees: [
                    { id: 'emp-005', username: 'มานี เก่งมาก', email: 'manee@company.com' }
                ],
                due_date: Date.now() + (10 * 24 * 60 * 60 * 1000),
                folder: 'Design',
                list: 'UI Tasks',
                team: 'Design Team'
            },
            {
                id: 'task-006',
                name: 'เขียนเอกสาร API',
                status: { status: 'to do', color: '#6b7280' },
                priority: { priority: 'low' },
                assignees: [
                    { id: 'emp-006', username: 'วิภา ช่วยเหลือ', email: 'wippa@company.com' }
                ],
                due_date: Date.now() + (14 * 24 * 60 * 60 * 1000),
                folder: 'Documentation',
                list: 'Docs',
                team: 'Development Team'
            },
            {
                id: 'task-007',
                name: 'ทดสอบระบบ Task Management',
                status: { status: 'in progress', color: '#f59e0b' },
                priority: { priority: 'medium' },
                assignees: [
                    { id: 'emp-001', username: 'กิตติพงษ์ สมศรี', email: 'kitt@company.com' }
                ],
                due_date: Date.now() + (5 * 24 * 60 * 60 * 1000),
                folder: 'QA',
                list: 'Testing',
                team: 'Development Team'
            },
            {
                id: 'task-008',
                name: 'สร้างระบบ Notification',
                status: { status: 'to do', color: '#6b7280' },
                priority: { priority: 'low' },
                assignees: [
                    { id: 'emp-003', username: 'สมชาย วงษ์ใหญ่', email: 'somchai@company.com' }
                ],
                due_date: Date.now() + (21 * 24 * 60 * 60 * 1000),
                folder: 'Development',
                list: 'Backlog',
                team: 'Development Team'
            }
        ],
        workload: {
            totalTasks: 8,
            completedTasks: 2,
            inProgressTasks: 3,
            overdueTasks: 1
        },
        fetched_at: new Date().toISOString()
    }
};

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        service: 'TaskFlow Backend - ClickUp Integration Fixed',
        version: '2.1.0-fixed',
        oauth_configured: true
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
    
    if (!code) {
        console.error('No authorization code received');
        return res.status(400).json({ error: 'No authorization code received' });
    }

    try {
        console.log(`[${new Date().toISOString()}] Exchanging authorization code for access token`);
        
        // Exchange authorization code for access token
        const tokenResponse = await axios.post(`${CLICKUP_CONFIG.BASE_URL}/oauth/token`, {
            client_id: CLICKUP_CONFIG.CLIENT_ID,
            client_secret: CLICKUP_CONFIG.CLIENT_SECRET,
            code: code
        });

        const { access_token } = tokenResponse.data;
        
        if (!access_token) {
            throw new Error('No access token received from ClickUp');
        }

        // Get user info to use as key
        const userResponse = await axios.get(`${CLICKUP_CONFIG.BASE_URL}/user`, {
            headers: {
                'Authorization': access_token,
                'Content-Type': 'application/json'
            }
        });

        const userId = userResponse.data.user.id;
        
        // Store token (use database in production)
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
        res.status(500).json({
            error: 'Authentication failed',
            details: error.response?.data || error.message
        });
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
        const response = await axios.get(`${CLICKUP_CONFIG.BASE_URL}${endpoint}`, {
            headers: {
                'Authorization': tokenData.access_token,
                'Content-Type': 'application/json'
            }
        });
        
        return response.data;
    } catch (error) {
        console.error(`ClickUp API error for ${endpoint}:`, error.response?.data || error.message);
        throw error;
    }
}

// Get real ClickUp data
app.get('/api/v1/clickup-data', async (req, res) => {
    try {
        const userId = req.session.userId;
        
        if (!userId || !userTokens.has(userId)) {
            return res.status(401).json({
                success: false,
                error: 'Not authenticated',
                auth_url: '/auth/clickup'
            });
        }

        console.log(`[${new Date().toISOString()}] Fetching real ClickUp data for user: ${userId}`);

        // Get user's teams/workspaces
        const teamsData = await callClickUpAPI('/team', userId);
        
        // Get tasks from all teams
        let allTasks = [];
        let workloadStats = {
            totalTasks: 0,
            completedTasks: 0,
            inProgressTasks: 0,
            overdueTasks: 0
        };

        // Simplified approach - just get teams and basic structure
        for (const team of teamsData.teams) {
            try {
                // Get spaces for this team
                const spacesData = await callClickUpAPI(`/team/${team.id}/space`, userId);
                
                for (const space of spacesData.spaces) {
                    try {
                        // Get lists directly from space (simplified)
                        const spaceListsData = await callClickUpAPI(`/space/${space.id}/list`, userId);
                        
                        for (const list of spaceListsData.lists) {
                            try {
                                const tasksData = await callClickUpAPI(`/list/${list.id}/task`, userId);
                                
                                for (const task of tasksData.tasks) {
                                    workloadStats.totalTasks++;
                                    
                                    const status = task.status?.status?.toLowerCase() || '';
                                    if (status === 'complete' || status === 'closed') {
                                        workloadStats.completedTasks++;
                                    } else if (status === 'in progress') {
                                        workloadStats.inProgressTasks++;
                                    }
                                    
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
                                        folder: 'Direct',
                                        list: list.name,
                                        team: team.name
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

        console.log(`[${new Date().toISOString()}] Successfully fetched ${allTasks.length} tasks from ${teamsData.teams.length} teams`);
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
                error: 'Authentication expired',
                auth_url: '/auth/clickup'
            });
        }
        
        res.status(500).json({
            success: false,
            error: 'Failed to fetch ClickUp data',
            details: error.response?.data || error.message
        });
    }
});

// Mock data endpoint for testing and fallback
app.get('/api/v1/test/clickup-data', (req, res) => {
    console.log(`[${new Date().toISOString()}] Serving mock ClickUp data`);
    res.json(MOCK_DATA);
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 TaskFlow Backend (ClickUp Integration Fixed) running on port ${PORT}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
    console.log(`🔐 ClickUp OAuth: http://localhost:${PORT}/auth/clickup`);
    console.log(`📊 Real ClickUp Data: http://localhost:${PORT}/api/v1/clickup-data`);
    console.log(`🧪 Mock ClickUp Data: http://localhost:${PORT}/api/v1/test/clickup-data`);
    console.log(`⚡ Ready to integrate with real ClickUp data!`);
    console.log(`📋 OAuth Config:`);
    console.log(`   Client ID: ${CLICKUP_CONFIG.CLIENT_ID}`);
    console.log(`   Redirect URI: ${CLICKUP_CONFIG.REDIRECT_URI}`);
});

module.exports = app;