const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = 778;

// ClickUp API Configuration
const CLICKUP_CONFIG = {
    clientId: 'DA3L6I2MS7RC39PFH7PZGRZAG4A1J8LL',
    clientSecret: 'BNLH0AZH1P4MHXQSANAM6N5RKNJPDD4I2IBC157H57G9V5NNET1HQ7V8I63K98ZX',
    redirectUri: 'http://192.168.20.10:8080',
    baseApiUrl: 'https://api.clickup.com/api/v2'
};

// Middleware
app.use(cors({
    origin: ['http://192.168.20.10:8080', 'http://localhost:8080'],
    credentials: true
}));
app.use(express.json());

// Token storage (in production, use Redis/Database)
let userTokens = new Map();

// Real ClickUp API Service
class ClickUpService {
    constructor() {
        this.baseURL = CLICKUP_CONFIG.baseApiUrl;
    }

    async makeRequest(endpoint, token, method = 'GET', data = null) {
        try {
            const config = {
                method,
                url: `${this.baseURL}${endpoint}`,
                headers: {
                    'Authorization': token,
                    'Content-Type': 'application/json'
                }
            };

            if (data && (method === 'POST' || method === 'PUT')) {
                config.data = data;
            }

            const response = await axios(config);
            return { success: true, data: response.data };
        } catch (error) {
            console.error(`ClickUp API Error (${endpoint}):`, error.response?.data || error.message);
            return { 
                success: false, 
                error: error.response?.data?.err || error.message,
                status: error.response?.status
            };
        }
    }

    async getUser(token) {
        return this.makeRequest('/user', token);
    }

    async getTeams(token) {
        return this.makeRequest('/team', token);
    }

    async getSpaces(teamId, token) {
        return this.makeRequest(`/team/${teamId}/space`, token);
    }

    async getFolders(spaceId, token) {
        return this.makeRequest(`/space/${spaceId}/folder`, token);
    }

    async getLists(folderId, token) {
        return this.makeRequest(`/folder/${folderId}/list`, token);
    }

    async getTasks(listId, token, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const endpoint = `/list/${listId}/task${queryString ? '?' + queryString : ''}`;
        return this.makeRequest(endpoint, token);
    }

    async getTasksFromTeam(teamId, token) {
        const params = {
            archived: false,
            include_closed: true,
            order_by: 'updated',
            reverse: true
        };
        const queryString = new URLSearchParams(params).toString();
        return this.makeRequest(`/team/${teamId}/task?${queryString}`, token);
    }
}

const clickupService = new ClickUpService();

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        service: 'Real ClickUp Service',
        timestamp: new Date().toISOString(),
        version: '1.0.0-real-api'
    });
});

// OAuth endpoints
app.get('/api/v1/auth/clickup/auth-url', (req, res) => {
    const state = require('crypto').randomBytes(32).toString('hex');
    console.log('DEBUG: redirectUri from config:', CLICKUP_CONFIG.redirectUri);
    const authUrl = `https://app.clickup.com/api?client_id=${CLICKUP_CONFIG.clientId}&redirect_uri=${encodeURIComponent(CLICKUP_CONFIG.redirectUri)}&state=${state}`;
    console.log('DEBUG: Generated auth URL:', authUrl);
    
    res.json({
        authorization_url: authUrl,
        state,
        message: 'Redirect to authorization_url for ClickUp authentication'
    });
});

app.get('/api/v1/auth/clickup/callback', async (req, res) => {
    // This handles the ClickUp redirect back to our server
    const { code, state } = req.query;
    
    if (!code) {
        return res.redirect(`http://192.168.20.10:8080/?auth=error&message=No authorization code`);
    }

    // For GET callback from ClickUp, redirect to frontend with code
    res.redirect(`http://192.168.20.10:8080/?code=${code}&state=${state}`);
});

app.post('/api/v1/auth/clickup/callback', async (req, res) => {
    // This handles the frontend POST request to exchange code for token
    const { code, state } = req.body;
    
    if (!code) {
        return res.status(400).json({ success: false, error: 'Authorization code required' });
    }

    try {
        console.log('Exchanging code for access token...');
        
        // Exchange code for access token
        const tokenResponse = await axios.post('https://api.clickup.com/api/v2/oauth/token', {
            client_id: CLICKUP_CONFIG.clientId,
            client_secret: CLICKUP_CONFIG.clientSecret,
            code,
            redirect_uri: CLICKUP_CONFIG.redirectUri
        });

        const { access_token } = tokenResponse.data;
        console.log('Access token received successfully');
        
        // Store token with session ID
        const sessionId = require('crypto').randomBytes(32).toString('hex');
        userTokens.set(sessionId, {
            accessToken: access_token,
            createdAt: new Date(),
            lastUsed: new Date()
        });

        res.json({ 
            success: true, 
            sessionId: sessionId,
            message: 'Authentication successful'
        });
    } catch (error) {
        console.error('OAuth callback error:', error.response?.data || error.message);
        res.status(400).json({ 
            success: false, 
            error: error.response?.data?.err || error.message 
        });
    }
});

// Real ClickUp Data Endpoints
app.get('/api/v1/dashboard', async (req, res) => {
    const sessionId = req.headers.authorization?.replace('Bearer ', '');
    
    if (!sessionId || !userTokens.has(sessionId)) {
        return res.status(401).json({ 
            success: false, 
            error: 'Authentication required. Please connect with ClickUp first.' 
        });
    }

    const tokenData = userTokens.get(sessionId);
    const token = tokenData.accessToken;

    try {
        // Get user info
        const userResult = await clickupService.getUser(token);
        if (!userResult.success) {
            throw new Error('Failed to fetch user data');
        }

        // Get teams
        const teamsResult = await clickupService.getTeams(token);
        if (!teamsResult.success) {
            throw new Error('Failed to fetch teams data');
        }

        const teams = teamsResult.data.teams;
        let allTasks = [];
        
        // Get tasks from all teams
        for (const team of teams.slice(0, 2)) { // Limit to first 2 teams for performance
            const tasksResult = await clickupService.getTasksFromTeam(team.id, token);
            if (tasksResult.success && tasksResult.data.tasks) {
                allTasks = allTasks.concat(tasksResult.data.tasks);
            }
        }

        // Calculate real KPIs
        const totalTasks = allTasks.length;
        const completedTasks = allTasks.filter(task => task.status?.status === 'complete' || task.status?.status === 'closed').length;
        const inProgressTasks = allTasks.filter(task => task.status?.status !== 'complete' && task.status?.status !== 'closed' && task.status?.status !== 'Open').length;
        const overdueTasks = allTasks.filter(task => {
            const dueDate = task.due_date ? new Date(parseInt(task.due_date)) : null;
            return dueDate && dueDate < new Date() && task.status?.status !== 'complete';
        }).length;

        // Recent activities from tasks
        const recentActivities = allTasks
            .filter(task => task.date_updated)
            .sort((a, b) => parseInt(b.date_updated) - parseInt(a.date_updated))
            .slice(0, 5)
            .map((task, index) => ({
                id: index + 1,
                message: `Task updated: ${task.name}`,
                time: new Date(parseInt(task.date_updated)).toLocaleString(),
                user: task.assignees?.[0]?.username || 'Unknown',
                task_id: task.id
            }));

        const dashboardData = {
            kpis: {
                totalTasks,
                completedTasks,
                inProgressTasks,
                overdueTasks,
                teamMembers: teams.reduce((sum, team) => sum + (team.members?.length || 0), 0)
            },
            workload: {
                totalTasks,
                completedTasks,
                inProgressTasks,
                overdueTasks
            },
            recentActivities,
            teams: teams.map(team => ({
                id: team.id,
                name: team.name,
                members: team.members?.length || 0,
                color: team.color || '#3498db'
            })),
            user: {
                id: userResult.data.user.id,
                username: userResult.data.user.username,
                email: userResult.data.user.email
            },
            source: 'real-clickup-api',
            timestamp: new Date().toISOString()
        };

        res.json({
            success: true,
            data: dashboardData
        });

    } catch (error) {
        console.error('Dashboard error:', error.message);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            requiresAuth: true
        });
    }
});

// Sync endpoint (same as dashboard)
app.post('/api/v1/sync', async (req, res) => {
    const sessionId = req.headers.authorization?.replace('Bearer ', '');
    
    if (!sessionId || !userTokens.has(sessionId)) {
        return res.status(401).json({ 
            success: false, 
            error: 'Session expired or invalid. Please re-authenticate with ClickUp.' 
        });
    }

    // Just return success for sync (data is already real-time)
    res.json({
        success: true,
        message: 'Data synchronized successfully',
        timestamp: new Date().toISOString()
    });
});

app.get('/api/v1/test/clickup-data', async (req, res) => {
    const sessionId = req.headers.authorization?.replace('Bearer ', '');
    
    if (!sessionId || !userTokens.has(sessionId)) {
        return res.json({ 
            success: false, 
            error: 'No authentication token. Please authenticate with ClickUp first.',
            auth_url: '/api/v1/auth/clickup/auth-url'
        });
    }

    const tokenData = userTokens.get(sessionId);
    const token = tokenData.accessToken;

    try {
        const userResult = await clickupService.getUser(token);
        const teamsResult = await clickupService.getTeams(token);

        res.json({
            success: true,
            message: 'ClickUp API connection successful',
            data: {
                user: userResult.data?.user?.username || 'Unknown',
                teams_count: teamsResult.data?.teams?.length || 0,
                teams: teamsResult.data?.teams?.map(t => ({ id: t.id, name: t.name })) || []
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Real ClickUp Service running on port ${PORT}`);
    console.log(`🔗 Health check: http://192.168.20.10:${PORT}/health`);
    console.log(`🎯 Dashboard API: http://192.168.20.10:${PORT}/api/v1/dashboard`);
    console.log(`📊 Test API: http://192.168.20.10:${PORT}/api/v1/test/clickup-data`);
    console.log(`🔐 Auth URL: http://192.168.20.10:${PORT}/api/v1/auth/clickup/auth-url`);
});

module.exports = app;