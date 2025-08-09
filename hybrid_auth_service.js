const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 780;

// ClickUp OAuth Configuration
const CLICKUP_CONFIG = {
    clientId: 'DA3L6I2MS7RC39PFH7PZGRZAG4A1J8LL',
    clientSecret: 'BNLH0AZH1P4MHXQSANAM6N5RKNJPDD4I2IBC157H57G9V5NNET1HQ7V8I63K98ZX',
    redirectUri: 'http://192.168.20.10:8080',
    baseApiUrl: 'https://api.clickup.com/api/v2'
};

// Load user configuration
const usersConfigPath = path.join(__dirname, 'users_config.json');
const tokensFilePath = path.join(__dirname, 'user_tokens.json');

let usersConfig = {};
let userTokens = new Map();

// Load users configuration
try {
    const configData = fs.readFileSync(usersConfigPath, 'utf8');
    usersConfig = JSON.parse(configData);
    console.log(`Loaded ${usersConfig.users.length} users from configuration`);
} catch (error) {
    console.error('Error loading users configuration:', error.message);
    process.exit(1);
}

// Load stored tokens
function loadTokens() {
    try {
        if (fs.existsSync(tokensFilePath)) {
            const tokenData = fs.readFileSync(tokensFilePath, 'utf8');
            const tokenMap = JSON.parse(tokenData);
            userTokens = new Map(Object.entries(tokenMap));
            console.log(`Loaded ${userTokens.size} stored ClickUp tokens`);
        }
    } catch (error) {
        console.error('Error loading tokens:', error.message);
    }
}

// Save tokens to file
function saveTokens() {
    try {
        const tokenObject = Object.fromEntries(userTokens);
        fs.writeFileSync(tokensFilePath, JSON.stringify(tokenObject, null, 2));
        console.log('Tokens saved successfully');
    } catch (error) {
        console.error('Error saving tokens:', error.message);
    }
}

// Load tokens on startup
loadTokens();

// Middleware
app.use(cors({
    origin: ['http://192.168.20.10:8080', 'http://localhost:8080'],
    credentials: true
}));
app.use(express.json());

// In-memory session storage
let userSessions = new Map();

// Generate session ID
function generateSessionId() {
    return require('crypto').randomBytes(32).toString('hex');
}

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        service: 'TaskFlow Hybrid Auth Service',
        timestamp: new Date().toISOString(),
        version: '1.0.0-hybrid-auth',
        total_users: usersConfig.users.length,
        stored_tokens: userTokens.size,
        active_sessions: userSessions.size
    });
});

// Step 1: Initial ClickUp OAuth (for first-time setup)
app.get('/api/v1/auth/clickup/auth-url', (req, res) => {
    const state = require('crypto').randomBytes(32).toString('hex');
    const authUrl = `https://app.clickup.com/api?client_id=${CLICKUP_CONFIG.clientId}&redirect_uri=${encodeURIComponent(CLICKUP_CONFIG.redirectUri)}&state=${state}`;
    
    console.log('Generated ClickUp OAuth URL for initial setup');
    
    res.json({
        authorization_url: authUrl,
        state,
        message: 'First-time ClickUp authentication - redirect to authorization_url'
    });
});

// Step 2: ClickUp OAuth callback - store token and map to user
app.get('/api/v1/auth/clickup/callback', async (req, res) => {
    const { code, state } = req.query;
    
    if (!code) {
        return res.redirect(`http://192.168.20.10:8080/?auth=error&message=No authorization code`);
    }

    // Redirect to frontend with code for processing
    res.redirect(`http://192.168.20.10:8080/?code=${code}&state=${state}&setup=true`);
});

// Step 3: Process ClickUp token and create user mapping
app.post('/api/v1/auth/clickup/setup', async (req, res) => {
    const { code, email } = req.body;
    
    if (!code || !email) {
        return res.status(400).json({ 
            success: false, 
            error: 'Authorization code and email required' 
        });
    }

    // Find user by email
    const user = usersConfig.users.find(u => u.email === email);
    if (!user) {
        return res.status(400).json({ 
            success: false, 
            error: 'Email not found in user database' 
        });
    }

    try {
        console.log('Processing ClickUp token setup for:', email);
        
        // Exchange code for access token
        const tokenResponse = await axios.post('https://api.clickup.com/api/v2/oauth/token', {
            client_id: CLICKUP_CONFIG.clientId,
            client_secret: CLICKUP_CONFIG.clientSecret,
            code,
            redirect_uri: CLICKUP_CONFIG.redirectUri
        });

        const { access_token } = tokenResponse.data;
        console.log('ClickUp access token received for:', email);
        
        // Get ClickUp user info to verify token
        const userResponse = await axios.get(`${CLICKUP_CONFIG.baseApiUrl}/user`, {
            headers: {
                'Authorization': access_token,
                'Content-Type': 'application/json'
            }
        });

        const clickupUser = userResponse.data.user;
        
        // Store token mapped to our user email
        userTokens.set(email, {
            accessToken: access_token,
            clickupUserId: clickupUser.id,
            clickupUsername: clickupUser.username,
            clickupEmail: clickupUser.email,
            createdAt: new Date().toISOString(),
            lastUsed: new Date().toISOString()
        });

        // Save tokens to file
        saveTokens();

        console.log(`ClickUp token stored for ${email} (ClickUp: ${clickupUser.username})`);

        res.json({ 
            success: true,
            message: 'ClickUp token stored successfully. You can now login with email/password.',
            user: {
                email: email,
                name: user.name,
                role: user.role,
                clickup_user: clickupUser.username
            }
        });
    } catch (error) {
        console.error('ClickUp setup error:', error.response?.data || error.message);
        res.status(400).json({ 
            success: false, 
            error: error.response?.data?.err || error.message 
        });
    }
});

// Step 4: Email/Password login (uses stored ClickUp token)
app.post('/api/v1/auth/login', (req, res) => {
    const { email, password } = req.body;
    
    console.log(`Login attempt for email: ${email}`);
    
    if (!email || !password) {
        return res.status(400).json({
            success: false,
            error: 'Email and password are required'
        });
    }
    
    // Find user by email
    const user = usersConfig.users.find(u => u.email === email);
    
    if (!user) {
        console.log(`Login failed: User not found for email ${email}`);
        return res.status(401).json({
            success: false,
            error: 'Invalid email or password'
        });
    }
    
    // Check password
    if (user.password !== password) {
        console.log(`Login failed: Invalid password for email ${email}`);
        return res.status(401).json({
            success: false,
            error: 'Invalid email or password'
        });
    }

    // Check if user has ClickUp token
    const hasClickUpToken = userTokens.has(email);
    
    // Create session
    const sessionId = generateSessionId();
    const sessionData = {
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        permissions: user.permissions,
        hasClickUpToken: hasClickUpToken,
        loginTime: new Date().toISOString(),
        lastActivity: new Date().toISOString()
    };
    
    userSessions.set(sessionId, sessionData);
    
    console.log(`Login successful for ${user.name} (${user.role}) - ClickUp token: ${hasClickUpToken ? 'Yes' : 'No'}`);
    
    res.json({
        success: true,
        sessionId: sessionId,
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            permissions: user.permissions,
            hasClickUpToken: hasClickUpToken
        },
        message: hasClickUpToken ? 'Login successful with ClickUp integration' : 'Login successful - ClickUp setup required'
    });
});

// Get authentication status
app.get('/api/v1/auth/status', (req, res) => {
    const sessionId = req.headers.authorization?.replace('Bearer ', '');
    
    if (!sessionId || !userSessions.has(sessionId)) {
        return res.json({
            authenticated: false,
            message: 'Not authenticated'
        });
    }
    
    const sessionData = userSessions.get(sessionId);
    
    // Update last activity
    sessionData.lastActivity = new Date().toISOString();
    userSessions.set(sessionId, sessionData);
    
    res.json({
        authenticated: true,
        user: {
            id: sessionData.userId,
            email: sessionData.email,
            name: sessionData.name,
            role: sessionData.role,
            permissions: sessionData.permissions,
            hasClickUpToken: sessionData.hasClickUpToken
        },
        session: {
            loginTime: sessionData.loginTime,
            lastActivity: sessionData.lastActivity
        }
    });
});

// Dashboard data (uses stored ClickUp token if available)
app.get('/api/v1/dashboard', async (req, res) => {
    const sessionId = req.headers.authorization?.replace('Bearer ', '');
    
    if (!sessionId || !userSessions.has(sessionId)) {
        return res.status(401).json({
            success: false,
            error: 'Authentication required'
        });
    }
    
    const sessionData = userSessions.get(sessionId);
    const userEmail = sessionData.email;
    
    // Update last activity
    sessionData.lastActivity = new Date().toISOString();
    userSessions.set(sessionId, sessionData);
    
    let dashboardData = {
        user: {
            id: sessionData.userId,
            name: sessionData.name,
            role: sessionData.role,
            permissions: sessionData.permissions,
            hasClickUpToken: sessionData.hasClickUpToken
        },
        source: sessionData.hasClickUpToken ? 'clickup-integration' : 'demo-data',
        timestamp: new Date().toISOString()
    };

    // If user has ClickUp token, fetch real data
    if (userTokens.has(userEmail)) {
        try {
            const tokenData = userTokens.get(userEmail);
            
            // Update token last used time
            tokenData.lastUsed = new Date().toISOString();
            userTokens.set(userEmail, tokenData);
            saveTokens();
            
            // Fetch real ClickUp data
            const teamsResponse = await axios.get(`${CLICKUP_CONFIG.baseApiUrl}/team`, {
                headers: {
                    'Authorization': tokenData.accessToken,
                    'Content-Type': 'application/json'
                }
            });

            const teams = teamsResponse.data.teams || [];
            let allTasks = [];
            
            // Get tasks from first team (for performance)
            if (teams.length > 0) {
                try {
                    const tasksResponse = await axios.get(`${CLICKUP_CONFIG.baseApiUrl}/team/${teams[0].id}/task?archived=false&include_closed=true`, {
                        headers: {
                            'Authorization': tokenData.accessToken,
                            'Content-Type': 'application/json'
                        }
                    });
                    allTasks = tasksResponse.data.tasks || [];
                } catch (taskError) {
                    console.warn('Could not fetch tasks:', taskError.message);
                }
            }

            // Calculate real KPIs
            const totalTasks = allTasks.length;
            const completedTasks = allTasks.filter(task => 
                task.status?.status === 'complete' || task.status?.status === 'closed'
            ).length;
            const inProgressTasks = allTasks.filter(task => 
                task.status?.status !== 'complete' && 
                task.status?.status !== 'closed' && 
                task.status?.status !== 'Open'
            ).length;
            const overdueTasks = allTasks.filter(task => {
                const dueDate = task.due_date ? new Date(parseInt(task.due_date)) : null;
                return dueDate && dueDate < new Date() && task.status?.status !== 'complete';
            }).length;

            dashboardData.kpis = {
                totalTasks,
                completedTasks,
                inProgressTasks,
                overdueTasks,
                teamMembers: teams.reduce((sum, team) => sum + (team.members?.length || 0), 0)
            };

            dashboardData.workload = {
                totalTasks,
                completedTasks,
                inProgressTasks,
                overdueTasks
            };

            dashboardData.recentActivities = allTasks
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

            dashboardData.teams = teams.map(team => ({
                id: team.id,
                name: team.name,
                members: team.members?.length || 0,
                color: team.color || '#3498db'
            }));

            console.log(`Real ClickUp data loaded for ${sessionData.name}: ${totalTasks} tasks from ${teams.length} teams`);

        } catch (error) {
            console.error('ClickUp API error:', error.response?.data || error.message);
            
            // Fall back to demo data if ClickUp API fails
            dashboardData.source = 'demo-data-fallback';
            dashboardData.error = 'ClickUp API temporarily unavailable';
        }
    }

    // If no ClickUp integration or API failed, use role-based demo data
    if (dashboardData.source !== 'clickup-integration') {
        dashboardData.kpis = {
            totalTasks: sessionData.role === 'Manager' ? 45 : sessionData.role === 'Team Lead' ? 28 : 12,
            completedTasks: sessionData.role === 'Manager' ? 32 : sessionData.role === 'Team Lead' ? 18 : 8,
            inProgressTasks: sessionData.role === 'Manager' ? 10 : sessionData.role === 'Team Lead' ? 8 : 3,
            overdueTasks: sessionData.role === 'Manager' ? 3 : sessionData.role === 'Team Lead' ? 2 : 1,
            teamMembers: sessionData.role === 'Manager' ? 11 : sessionData.role === 'Team Lead' ? 6 : 1
        };

        dashboardData.workload = { ...dashboardData.kpis };

        dashboardData.recentActivities = [
            {
                id: 1,
                message: `Task updated by ${sessionData.name}`,
                time: new Date().toLocaleString(),
                user: sessionData.name,
                task_id: 'T001'
            },
            {
                id: 2,
                message: 'New project created',
                time: new Date(Date.now() - 1800000).toLocaleString(),
                user: 'System',
                task_id: 'T002'
            }
        ];

        dashboardData.teams = sessionData.role === 'Manager' ? [
            { id: 1, name: 'Development Team', members: 6, color: '#3498db' },
            { id: 2, name: 'Design Team', members: 3, color: '#e74c3c' },
            { id: 3, name: 'QA Team', members: 2, color: '#2ecc71' }
        ] : sessionData.role === 'Team Lead' ? [
            { id: 1, name: 'Development Team', members: 6, color: '#3498db' }
        ] : [];
    }
    
    res.json({
        success: true,
        data: dashboardData
    });
});

// Logout
app.post('/api/v1/auth/logout', (req, res) => {
    const sessionId = req.headers.authorization?.replace('Bearer ', '');
    
    if (sessionId && userSessions.has(sessionId)) {
        const sessionData = userSessions.get(sessionId);
        userSessions.delete(sessionId);
        console.log(`User ${sessionData.name} logged out`);
    }
    
    res.json({
        success: true,
        message: 'Logged out successfully'
    });
});

// Get stored tokens info (Manager only)
app.get('/api/v1/auth/tokens', (req, res) => {
    const sessionId = req.headers.authorization?.replace('Bearer ', '');
    
    if (!sessionId || !userSessions.has(sessionId)) {
        return res.status(401).json({
            success: false,
            error: 'Authentication required'
        });
    }
    
    const sessionData = userSessions.get(sessionId);
    
    if (sessionData.role !== 'Manager') {
        return res.status(403).json({
            success: false,
            error: 'Access denied. Manager role required.'
        });
    }
    
    const tokenInfo = Array.from(userTokens.entries()).map(([email, tokenData]) => ({
        email,
        clickupUsername: tokenData.clickupUsername,
        createdAt: tokenData.createdAt,
        lastUsed: tokenData.lastUsed
    }));
    
    res.json({
        success: true,
        tokens: tokenInfo,
        total: tokenInfo.length
    });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 TaskFlow Hybrid Auth Service running on port ${PORT}`);
    console.log(`🔗 Health check: http://192.168.20.10:${PORT}/health`);
    console.log(`🔐 Email/Password login: http://192.168.20.10:${PORT}/api/v1/auth/login`);
    console.log(`📊 Dashboard endpoint: http://192.168.20.10:${PORT}/api/v1/dashboard`);
    console.log(`🎯 ClickUp OAuth setup: http://192.168.20.10:${PORT}/api/v1/auth/clickup/auth-url`);
    console.log(`👥 Users configured: ${usersConfig.users.length}`);
    console.log(`🎫 ClickUp tokens stored: ${userTokens.size}`);
});

module.exports = app;