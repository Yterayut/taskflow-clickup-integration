const express = require('express');
const cors = require('cors');
const axios = require('axios');
const session = require('express-session');

const app = express();
const PORT = 777;

// ClickUp API Configuration
const CLICKUP_CONFIG = {
    CLIENT_ID: 'DA3L6I2MS7RC39PFH7PZGRZAG4A1J8LL',
    CLIENT_SECRET: 'BNLH0AZH1P4MHXQSANAM6N5RKNJPDD4I2IBC157H57G9V5NNET1HQ7V8I63K98ZX',
    REDIRECT_URI: 'http://192.168.20.10:777/auth/clickup/callback',
    BASE_URL: 'https://api.clickup.com/api/v2',
    AUTH_URL: 'https://app.clickup.com/api'
};

// Store access tokens and user data
let userSessions = new Map();
let clickupCache = {
    teams: [],
    users: [],
    tasks: [],
    lastUpdate: null
};

// Middleware
app.use(cors({
    origin: ['http://192.168.20.10:8888', 'http://localhost:8888'],
    credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use(session({
    secret: 'TaskFlow-ClickUp-Session-2025',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// ClickUp API Helper Functions
async function makeClickUpRequest(endpoint, accessToken, method = 'GET', data = null) {
    try {
        const config = {
            method,
            url: `${CLICKUP_CONFIG.BASE_URL}${endpoint}`,
            headers: {
                'Authorization': `Bearer ${accessToken}`,
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

async function fetchClickUpTeams(accessToken) {
    const result = await makeClickUpRequest('/team', accessToken);
    if (result.success) {
        clickupCache.teams = result.data.teams || [];
        return result.data.teams || [];
    }
    return [];
}

async function fetchClickUpUsers(accessToken, teamId) {
    const result = await makeClickUpRequest(`/team/${teamId}/member`, accessToken);
    if (result.success) {
        const users = result.data.members || [];
        clickupCache.users = users;
        return users;
    }
    return [];
}

async function fetchClickUpTasks(accessToken, teamId) {
    try {
        // Get all spaces for the team
        const spacesResult = await makeClickUpRequest(`/team/${teamId}/space`, accessToken);
        if (!spacesResult.success) return [];

        let allTasks = [];
        
        for (const space of spacesResult.data.spaces || []) {
            // Get folders in each space
            const foldersResult = await makeClickUpRequest(`/space/${space.id}/folder`, accessToken);
            
            if (foldersResult.success) {
                for (const folder of foldersResult.data.folders || []) {
                    // Get lists in each folder
                    const listsResult = await makeClickUpRequest(`/folder/${folder.id}/list`, accessToken);
                    
                    if (listsResult.success) {
                        for (const list of listsResult.data.lists || []) {
                            // Get tasks in each list
                            const tasksResult = await makeClickUpRequest(`/list/${list.id}/task`, accessToken);
                            
                            if (tasksResult.success) {
                                const tasks = tasksResult.data.tasks || [];
                                allTasks = allTasks.concat(tasks.map(task => ({
                                    ...task,
                                    space_name: space.name,
                                    folder_name: folder.name,
                                    list_name: list.name
                                })));
                            }
                        }
                    }
                }
            }
            
            // Also get tasks directly from space (folderless lists)
            const spaceListsResult = await makeClickUpRequest(`/space/${space.id}/list`, accessToken);
            if (spaceListsResult.success) {
                for (const list of spaceListsResult.data.lists || []) {
                    const tasksResult = await makeClickUpRequest(`/list/${list.id}/task`, accessToken);
                    
                    if (tasksResult.success) {
                        const tasks = tasksResult.data.tasks || [];
                        allTasks = allTasks.concat(tasks.map(task => ({
                            ...task,
                            space_name: space.name,
                            folder_name: null,
                            list_name: list.name
                        })));
                    }
                }
            }
        }
        
        clickupCache.tasks = allTasks;
        clickupCache.lastUpdate = new Date();
        return allTasks;
    } catch (error) {
        console.error('Error fetching ClickUp tasks:', error);
        return [];
    }
}

// Authentication Routes
app.get('/auth/clickup', (req, res) => {
    const authUrl = `${CLICKUP_CONFIG.AUTH_URL}?client_id=${CLICKUP_CONFIG.CLIENT_ID}&redirect_uri=${encodeURIComponent(CLICKUP_CONFIG.REDIRECT_URI)}`;
    res.redirect(authUrl);
});

app.get('/auth/clickup/callback', async (req, res) => {
    const { code } = req.query;
    
    if (!code) {
        return res.status(400).json({ error: 'Authorization code not provided' });
    }
    
    try {
        // Exchange code for access token
        console.log('Exchanging code for token...');
        console.log('Request payload:', {
            client_id: CLICKUP_CONFIG.CLIENT_ID,
            client_secret: CLICKUP_CONFIG.CLIENT_SECRET ? 'Present' : 'Missing',
            code: code
        });
        
        const tokenResponse = await axios.post('https://api.clickup.com/api/v2/oauth/token', {
            client_id: CLICKUP_CONFIG.CLIENT_ID,
            client_secret: CLICKUP_CONFIG.CLIENT_SECRET,
            code: code
        });
        
        console.log('Token response status:', tokenResponse.status);
        console.log('Token response data:', tokenResponse.data);
        
        const accessToken = tokenResponse.data.access_token;
        console.log('Token received:', accessToken ? 'Yes' : 'No');
        
        if (!accessToken) {
            throw new Error('No access token received from ClickUp');
        }
        
        // Get authorized teams first (recommended by ClickUp docs)
        console.log('Fetching authorized teams...');
        const teamsResult = await makeClickUpRequest('/team', accessToken);
        console.log('Teams result:', teamsResult);
        
        if (!teamsResult.success) {
            throw new Error(`Failed to get authorized teams: ${teamsResult.error}`);
        }
        
        // Get user info
        console.log('Fetching user info...');
        const userResult = await makeClickUpRequest('/user', accessToken);
        console.log('User result:', userResult);
        
        if (!userResult.success) {
            throw new Error(`Failed to get user info: ${userResult.error}`);
        }
        
        const user = userResult.data.user;
        const authorizedTeams = teamsResult.data.teams || [];
        
        // Store session
        req.session.accessToken = accessToken;
        req.session.user = user;
        req.session.authorizedTeams = authorizedTeams;
        req.session.authenticated = true;
        
        userSessions.set(req.sessionID, {
            accessToken,
            user,
            authorizedTeams,
            authenticatedAt: new Date()
        });
        
        // Redirect to dashboard
        res.redirect('http://192.168.20.10:8888');
        
    } catch (error) {
        console.error('OAuth callback error:', error);
        console.error('Error response data:', error.response?.data);
        console.error('Error response status:', error.response?.status);
        res.status(500).json({ 
            error: 'Authentication failed', 
            details: error.message,
            clickupError: error.response?.data,
            status: error.response?.status
        });
    }
});

// API Routes
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        service: 'TaskFlow Backend - ClickUp Integration Only',
        version: '1.0.0-clickup-only',
        features: [
            'ClickUp OAuth Authentication',
            'Real ClickUp Data Only',
            'Team Management',
            'Task Management',
            'Performance Tracking'
        ],
        clickupCache: {
            teams: clickupCache.teams.length,
            users: clickupCache.users.length,
            tasks: clickupCache.tasks.length,
            lastUpdate: clickupCache.lastUpdate
        }
    });
});

app.get('/auth/status', (req, res) => {
    if (req.session.authenticated && req.session.accessToken) {
        res.json({
            authenticated: true,
            user: req.session.user,
            hasAccessToken: !!req.session.accessToken
        });
    } else {
        res.json({
            authenticated: false,
            auth_url: '/auth/clickup'
        });
    }
});

// Middleware to check authentication
function requireAuth(req, res, next) {
    if (!req.session.authenticated || !req.session.accessToken) {
        return res.status(401).json({ 
            success: false, 
            error: 'Not authenticated. Please authenticate with ClickUp first.',
            auth_url: '/auth/clickup'
        });
    }
    next();
}

// API Endpoints - All data from ClickUp only
app.get('/api/v1/teams', requireAuth, async (req, res) => {
    try {
        const teams = await fetchClickUpTeams(req.session.accessToken);
        res.json({ success: true, data: teams });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/v1/employees', requireAuth, async (req, res) => {
    try {
        const teams = await fetchClickUpTeams(req.session.accessToken);
        let allUsers = [];
        
        for (const team of teams) {
            const users = await fetchClickUpUsers(req.session.accessToken, team.id);
            allUsers = allUsers.concat(users.map(user => ({
                id: user.user.id,
                name: user.user.username || user.user.email,
                email: user.user.email,
                role: user.user.role || 'Employee',
                department: team.name,
                status: 'active',
                avatar: user.user.profilePicture,
                joinDate: new Date(parseInt(user.user.date_joined || Date.now())).toISOString().split('T')[0],
                phone: user.user.phone || '',
                location: user.user.location || '',
                performanceScore: 0 // Will be calculated based on tasks
            })));
        }
        
        res.json({ success: true, data: allUsers });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/v1/tasks', requireAuth, async (req, res) => {
    try {
        const teams = await fetchClickUpTeams(req.session.accessToken);
        let allTasks = [];
        
        for (const team of teams) {
            const tasks = await fetchClickUpTasks(req.session.accessToken, team.id);
            allTasks = allTasks.concat(tasks.map(task => ({
                id: task.id,
                name: task.name,
                description: task.description || '',
                status: task.status.status || 'Open',
                priority: task.priority ? task.priority.priority : 'Normal',
                assignee: task.assignees.length > 0 ? {
                    id: task.assignees[0].id,
                    name: task.assignees[0].username,
                    email: task.assignees[0].email
                } : null,
                startDate: task.start_date ? new Date(parseInt(task.start_date)).toISOString().split('T')[0] : null,
                dueDate: task.due_date ? new Date(parseInt(task.due_date)).toISOString().split('T')[0] : null,
                createdDate: new Date(parseInt(task.date_created)).toISOString().split('T')[0],
                updatedDate: new Date(parseInt(task.date_updated)).toISOString().split('T')[0],
                project: {
                    space: task.space_name,
                    folder: task.folder_name,
                    list: task.list_name
                },
                url: task.url,
                timeSpent: task.time_spent || 0,
                timeEstimate: task.time_estimate || 0
            })));
        }
        
        res.json({ success: true, data: allTasks });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/v1/performance', requireAuth, async (req, res) => {
    try {
        const teams = await fetchClickUpTeams(req.session.accessToken);
        let performanceData = [];
        
        for (const team of teams) {
            const users = await fetchClickUpUsers(req.session.accessToken, team.id);
            const tasks = await fetchClickUpTasks(req.session.accessToken, team.id);
            
            for (const member of users) {
                const userTasks = tasks.filter(task => 
                    task.assignees && task.assignees.some(assignee => assignee.id === member.user.id)
                );
                
                const completedTasks = userTasks.filter(task => 
                    task.status && task.status.status.toLowerCase().includes('complete')
                );
                
                const totalTasks = userTasks.length;
                const completedCount = completedTasks.length;
                const completionRate = totalTasks > 0 ? (completedCount / totalTasks) * 100 : 0;
                
                const taskScore = totalTasks * 5;
                const completionScore = completedCount * 10;
                const efficiencyBonus = completionRate > 80 ? 50 : 0;
                const totalScore = taskScore + completionScore + efficiencyBonus;
                
                performanceData.push({
                    id: member.user.id,
                    name: member.user.username || member.user.email,
                    email: member.user.email,
                    totalTasks,
                    completedTasks: completedCount,
                    completionRate: Math.round(completionRate),
                    score: totalScore,
                    rank: 0, // Will be calculated after sorting
                    avatar: member.user.profilePicture,
                    department: team.name
                });
            }
        }
        
        // Sort by score and assign ranks
        performanceData.sort((a, b) => b.score - a.score);
        performanceData.forEach((user, index) => {
            user.rank = index + 1;
        });
        
        res.json({ success: true, data: performanceData });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create new task in ClickUp
app.post('/api/v1/tasks', requireAuth, async (req, res) => {
    try {
        const { name, description, assignee, dueDate, priority, listId } = req.body;
        
        if (!listId) {
            return res.status(400).json({ success: false, error: 'List ID is required to create a task' });
        }
        
        const taskData = {
            name,
            description: description || '',
            assignees: assignee ? [assignee] : [],
            due_date: dueDate ? new Date(dueDate).getTime() : null,
            priority: priority ? { priority: priority } : null
        };
        
        const result = await makeClickUpRequest(`/list/${listId}/task`, req.session.accessToken, 'POST', taskData);
        
        if (result.success) {
            res.json({ success: true, data: result.data });
        } else {
            res.status(400).json({ success: false, error: result.error });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update task in ClickUp
app.put('/api/v1/tasks/:taskId', requireAuth, async (req, res) => {
    try {
        const { taskId } = req.params;
        const updateData = req.body;
        
        const result = await makeClickUpRequest(`/task/${taskId}`, req.session.accessToken, 'PUT', updateData);
        
        if (result.success) {
            res.json({ success: true, data: result.data });
        } else {
            res.status(400).json({ success: false, error: result.error });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get ClickUp lists for task creation
app.get('/api/v1/lists', requireAuth, async (req, res) => {
    try {
        const teams = await fetchClickUpTeams(req.session.accessToken);
        let allLists = [];
        
        for (const team of teams) {
            const spacesResult = await makeClickUpRequest(`/team/${team.id}/space`, req.session.accessToken);
            
            if (spacesResult.success) {
                for (const space of spacesResult.data.spaces || []) {
                    // Get lists directly from space
                    const spaceListsResult = await makeClickUpRequest(`/space/${space.id}/list`, req.session.accessToken);
                    if (spaceListsResult.success) {
                        allLists = allLists.concat(spaceListsResult.data.lists.map(list => ({
                            ...list,
                            space_name: space.name,
                            team_name: team.name
                        })));
                    }
                    
                    // Get lists from folders
                    const foldersResult = await makeClickUpRequest(`/space/${space.id}/folder`, req.session.accessToken);
                    if (foldersResult.success) {
                        for (const folder of foldersResult.data.folders || []) {
                            const folderListsResult = await makeClickUpRequest(`/folder/${folder.id}/list`, req.session.accessToken);
                            if (folderListsResult.success) {
                                allLists = allLists.concat(folderListsResult.data.lists.map(list => ({
                                    ...list,
                                    space_name: space.name,
                                    folder_name: folder.name,
                                    team_name: team.name
                                })));
                            }
                        }
                    }
                }
            }
        }
        
        res.json({ success: true, data: allLists });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Manual data refresh
app.post('/api/v1/refresh', requireAuth, async (req, res) => {
    try {
        const teams = await fetchClickUpTeams(req.session.accessToken);
        
        // Refresh all data
        for (const team of teams) {
            await fetchClickUpUsers(req.session.accessToken, team.id);
            await fetchClickUpTasks(req.session.accessToken, team.id);
        }
        
        res.json({ 
            success: true, 
            message: 'Data refreshed successfully',
            timestamp: new Date().toISOString(),
            cache: {
                teams: clickupCache.teams.length,
                users: clickupCache.users.length,
                tasks: clickupCache.tasks.length
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Logout
app.post('/auth/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true, message: 'Logged out successfully' });
});

// Auto-refresh ClickUp data every 30 minutes
setInterval(async () => {
    console.log('Auto-refreshing ClickUp data...');
    
    for (const [sessionId, sessionData] of userSessions.entries()) {
        try {
            const teams = await fetchClickUpTeams(sessionData.accessToken);
            for (const team of teams) {
                await fetchClickUpUsers(sessionData.accessToken, team.id);
                await fetchClickUpTasks(sessionData.accessToken, team.id);
            }
        } catch (error) {
            console.error('Auto-refresh error for session:', sessionId, error);
        }
    }
    
    console.log('Auto-refresh completed at:', new Date().toISOString());
}, 30 * 60 * 1000); // 30 minutes

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 TaskFlow ClickUp-Only Backend running on port ${PORT}`);
    console.log(`📋 Version: 1.0.0-clickup-only`);
    console.log(`🔗 Auth URL: http://192.168.20.10:${PORT}/auth/clickup`);
    console.log(`🏥 Health Check: http://192.168.20.10:${PORT}/health`);
});