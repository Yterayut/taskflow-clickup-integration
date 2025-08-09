const express = require('express');
const cors = require('cors');
const axios = require('axios');
const session = require('express-session');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = 777;

// ClickUp OAuth Configuration
const CLICKUP_CONFIG = {
    CLIENT_ID: 'DA3L6I2MS7RC39PFH7PZGRZAG4A1J8LL',
    CLIENT_SECRET: 'BNLH0AZH1P4MHXQSANAM6N5RKNJPDD4I2IBC157H57G9V5NNET1HQ7V8I63K98ZX',
    REDIRECT_URI: 'http://192.168.20.10:777/auth/callback',
    BASE_URL: 'https://api.clickup.com/api/v2',
    AUTH_URL: 'https://app.clickup.com/api'
};

// User roles mapping based on ClickUp emails
const USER_ROLES = {
    'yterayut@gmail.com': 'Manager',
    'chaiwutwck@gmail.com': 'Team Lead',
    'atthakorn.na@ku.th': 'Employee',
    'sahassavas.rim@gmail.com': 'Employee',
    'primshi1719@gmail.com': 'Employee',
    'panuwantung@gmail.com': 'Employee',
    'jirapat.sripanya@gmail.com': 'Employee',
    'chutithep_ar@kkumail.com': 'Employee',
    'pongsanzakom@gmail.com': 'Employee',
    'nisareen.dk@gmail.com': 'Employee',
    'jthammakit2546@gmail.com': 'Employee'
};

// Performance scoring configuration
let performanceScoring = {
    taskCompletion: 10,
    earlyCompletionBonus: 5,
    qualityMultiplier: 1.5,
    lateCompletionPenalty: -3
};

// Session configuration
app.use(session({
    secret: 'taskflow-pro-clickup-integration-2025',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false,
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    }
}));

// Enable CORS
app.use(cors({
    origin: ['http://192.168.20.10:8888', 'http://localhost:8888'],
    credentials: true
}));
app.use(express.json());

// Persistent storage for ClickUp tokens
const TOKEN_STORAGE_FILE = path.join(__dirname, 'clickup_tokens.json');
let persistentTokens = new Map();

// Load stored tokens on startup
async function loadStoredTokens() {
    try {
        const data = await fs.readFile(TOKEN_STORAGE_FILE, 'utf8');
        const tokens = JSON.parse(data);
        persistentTokens = new Map(Object.entries(tokens));
        console.log(`🔑 Loaded ${persistentTokens.size} stored ClickUp tokens`);
    } catch (error) {
        console.log('📝 No existing token storage found, starting fresh');
        persistentTokens = new Map();
    }
}

// Save tokens to persistent storage
async function saveTokens() {
    try {
        const tokensObj = Object.fromEntries(persistentTokens);
        await fs.writeFile(TOKEN_STORAGE_FILE, JSON.stringify(tokensObj, null, 2));
        console.log(`💾 Saved ${persistentTokens.size} ClickUp tokens to storage`);
    } catch (error) {
        console.error('❌ Failed to save tokens:', error);
    }
}

// ClickUp API helper functions
async function makeClickUpRequest(endpoint, token, options = {}) {
    try {
        const response = await axios({
            method: options.method || 'GET',
            url: `${CLICKUP_CONFIG.BASE_URL}${endpoint}`,
            headers: {
                'Authorization': token,
                'Content-Type': 'application/json',
                ...options.headers
            },
            data: options.data,
            params: options.params
        });
        return response.data;
    } catch (error) {
        console.error(`❌ ClickUp API Error (${endpoint}):`, error.response?.data || error.message);
        throw error;
    }
}

// Get user info from ClickUp
async function getClickUpUser(token) {
    try {
        const user = await makeClickUpRequest('/user', token);
        return {
            id: user.user.id,
            username: user.user.username,
            email: user.user.email,
            profilePicture: user.user.profilePicture,
            initials: user.user.initials,
            color: user.user.color
        };
    } catch (error) {
        throw new Error('Failed to fetch user info from ClickUp');
    }
}

// Get teams from ClickUp
async function getClickUpTeams(token) {
    try {
        const response = await makeClickUpRequest('/team', token);
        return response.teams || [];
    } catch (error) {
        throw new Error('Failed to fetch teams from ClickUp');
    }
}

// Get spaces from ClickUp
async function getClickUpSpaces(token, teamId) {
    try {
        const response = await makeClickUpRequest(`/team/${teamId}/space`, token);
        return response.spaces || [];
    } catch (error) {
        throw new Error('Failed to fetch spaces from ClickUp');
    }
}

// Get folders from ClickUp
async function getClickUpFolders(token, spaceId) {
    try {
        const response = await makeClickUpRequest(`/space/${spaceId}/folder`, token);
        return response.folders || [];
    } catch (error) {
        return []; // Some spaces might not have folders
    }
}

// Get lists from ClickUp
async function getClickUpLists(token, spaceId, folderId = null) {
    try {
        let endpoint;
        if (folderId) {
            endpoint = `/folder/${folderId}/list`;
        } else {
            endpoint = `/space/${spaceId}/list`;
        }
        
        const response = await makeClickUpRequest(endpoint, token);
        return response.lists || [];
    } catch (error) {
        return []; // Return empty array if no lists
    }
}

// Get tasks from ClickUp
async function getClickUpTasks(token, listId, options = {}) {
    try {
        const params = {
            archived: false,
            include_closed: true,
            ...options.params
        };
        
        const response = await makeClickUpRequest(`/list/${listId}/task`, token, { params });
        return response.tasks || [];
    } catch (error) {
        return []; // Return empty array if no tasks
    }
}

// Get all tasks for a team
async function getAllTeamTasks(token) {
    try {
        const teams = await getClickUpTeams(token);
        let allTasks = [];
        
        for (const team of teams) {
            const spaces = await getClickUpSpaces(token, team.id);
            
            for (const space of spaces) {
                // Get lists directly from space
                const spaceLists = await getClickUpLists(token, space.id);
                
                for (const list of spaceLists) {
                    const tasks = await getClickUpTasks(token, list.id);
                    allTasks = allTasks.concat(tasks.map(task => ({
                        ...task,
                        listName: list.name,
                        spaceName: space.name,
                        teamId: team.id
                    })));
                }
                
                // Get folders and their lists
                const folders = await getClickUpFolders(token, space.id);
                for (const folder of folders) {
                    const folderLists = await getClickUpLists(token, space.id, folder.id);
                    
                    for (const list of folderLists) {
                        const tasks = await getClickUpTasks(token, list.id);
                        allTasks = allTasks.concat(tasks.map(task => ({
                            ...task,
                            listName: list.name,
                            folderName: folder.name,
                            spaceName: space.name,
                            teamId: team.id
                        })));
                    }
                }
            }
        }
        
        return allTasks;
    } catch (error) {
        console.error('Failed to fetch all team tasks:', error);
        return [];
    }
}

// Get team members
async function getTeamMembers(token) {
    try {
        const teams = await getClickUpTeams(token);
        let allMembers = [];
        
        for (const team of teams) {
            if (team.members) {
                allMembers = allMembers.concat(team.members.map(member => ({
                    ...member.user,
                    teamId: team.id,
                    teamName: team.name,
                    role: getUserRole(member.user.email)
                })));
            }
        }
        
        // Remove duplicates based on user ID
        const uniqueMembers = allMembers.filter((member, index, self) => 
            index === self.findIndex(m => m.id === member.id)
        );
        
        return uniqueMembers;
    } catch (error) {
        console.error('Failed to fetch team members:', error);
        return [];
    }
}

// Determine user role based on email
function getUserRole(email) {
    return USER_ROLES[email] || 'Employee';
}

// Normalize ClickUp task data for frontend
function normalizeTaskData(clickupTask) {
    return {
        id: clickupTask.id,
        name: clickupTask.name,
        description: clickupTask.description || '',
        assignees: clickupTask.assignees?.map(a => ({
            id: a.id,
            username: a.username,
            email: a.email,
            profilePicture: a.profilePicture
        })) || [],
        assigneeName: clickupTask.assignees?.[0]?.username || 'Unassigned',
        assigneeEmail: clickupTask.assignees?.[0]?.email || '',
        startDate: clickupTask.start_date ? new Date(parseInt(clickupTask.start_date)).toISOString().split('T')[0] : null,
        dueDate: clickupTask.due_date ? new Date(parseInt(clickupTask.due_date)).toISOString().split('T')[0] : null,
        priority: clickupTask.priority?.priority?.toLowerCase() || 'normal',
        status: clickupTask.status?.status?.toLowerCase().replace(' ', '-') || 'todo',
        progress: calculateTaskProgress(clickupTask),
        tags: clickupTask.tags?.map(tag => tag.name) || [],
        listName: clickupTask.listName || '',
        spaceName: clickupTask.spaceName || '',
        folderName: clickupTask.folderName || '',
        url: clickupTask.url,
        createdAt: new Date(parseInt(clickupTask.date_created)).toISOString(),
        updatedAt: new Date(parseInt(clickupTask.date_updated)).toISOString(),
        timeEstimate: clickupTask.time_estimate ? Math.round(clickupTask.time_estimate / 3600000) : null, // Convert to hours
        timeSpent: clickupTask.time_spent ? Math.round(clickupTask.time_spent / 3600000) : null // Convert to hours
    };
}

// Calculate task progress percentage
function calculateTaskProgress(task) {
    if (task.status?.status?.toLowerCase() === 'complete' || 
        task.status?.status?.toLowerCase() === 'closed' ||
        task.status?.status?.toLowerCase() === 'done') {
        return 100;
    }
    
    // If task has subtasks, calculate based on completed subtasks
    if (task.subtasks && task.subtasks.length > 0) {
        const completedSubtasks = task.subtasks.filter(st => 
            st.status?.status?.toLowerCase() === 'complete' ||
            st.status?.status?.toLowerCase() === 'closed'
        );
        return Math.round((completedSubtasks.length / task.subtasks.length) * 100);
    }
    
    // Default progress based on status
    const statusProgress = {
        'todo': 0,
        'open': 0,
        'in progress': 50,
        'in-progress': 50,
        'review': 80,
        'testing': 85,
        'complete': 100,
        'closed': 100,
        'done': 100
    };
    
    return statusProgress[task.status?.status?.toLowerCase()] || 0;
}

// Authentication middleware
function requireAuth(req, res, next) {
    if (!req.session.userId || !req.session.clickupToken) {
        return res.status(401).json({
            success: false,
            error: 'Authentication required',
            needsClickUpAuth: true
        });
    }
    next();
}

// Role-based authorization middleware
function requireRole(roles) {
    return (req, res, next) => {
        if (!req.session.userRole || !roles.includes(req.session.userRole)) {
            return res.status(403).json({
                success: false,
                error: 'Insufficient permissions'
            });
        }
        next();
    };
}

// Initialize token storage
loadStoredTokens();

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        service: 'TaskFlow Backend - ClickUp Integration',
        version: '7.0.0-clickup-integration',
        features: [
            'ClickUp OAuth Integration',
            'Persistent Token Storage',
            'Real ClickUp Data',
            'Role-based Access Control',
            'Task Management',
            'Team Analytics',
            'Performance Tracking'
        ],
        storedTokens: persistentTokens.size,
        activeSessions: req.session ? 1 : 0
    });
});

// Authentication Routes

// Login with email and password (ClickUp integration)
app.post('/api/auth/login', async (req, res) => {
    console.log(`[${new Date().toISOString()}] Login attempt for: ${req.body.email}`);
    
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email and password are required'
            });
        }
        
        // Check if user has a role mapping
        const userRole = getUserRole(email);
        if (!userRole) {
            return res.status(401).json({
                success: false,
                error: 'User not found in system'
            });
        }
        
        // For demo, accept password "12345"
        if (password !== '12345') {
            return res.status(401).json({
                success: false,
                error: 'Invalid password'
            });
        }
        
        // Check if user has stored ClickUp token
        const storedToken = persistentTokens.get(email);
        
        if (storedToken) {
            try {
                // Verify token is still valid
                const clickupUser = await getClickUpUser(storedToken);
                
                // Create session
                req.session.userId = clickupUser.id;
                req.session.userEmail = email;
                req.session.userRole = userRole;
                req.session.clickupToken = storedToken;
                req.session.clickupUser = clickupUser;
                
                console.log(`[${new Date().toISOString()}] Login successful with stored token: ${clickupUser.username}`);
                
                return res.json({
                    success: true,
                    user: {
                        id: clickupUser.id,
                        name: clickupUser.username,
                        email: email,
                        role: userRole,
                        profilePicture: clickupUser.profilePicture,
                        initials: clickupUser.initials
                    },
                    hasClickUpToken: true,
                    message: 'Login successful'
                });
                
            } catch (error) {
                // Token is invalid, remove it
                persistentTokens.delete(email);
                await saveTokens();
                console.log(`[${new Date().toISOString()}] Stored token invalid, removed for: ${email}`);
            }
        }
        
        // No valid token, user needs to connect ClickUp
        req.session.pendingEmail = email;
        req.session.pendingRole = userRole;
        
        res.json({
            success: true,
            user: {
                email: email,
                role: userRole
            },
            hasClickUpToken: false,
            needsClickUpAuth: true,
            message: 'Please connect your ClickUp account'
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// ClickUp OAuth initiation
app.get('/auth/clickup', (req, res) => {
    const state = req.session.pendingEmail || 'no-email';
    const authUrl = `${CLICKUP_CONFIG.AUTH_URL}?client_id=${CLICKUP_CONFIG.CLIENT_ID}&redirect_uri=${encodeURIComponent(CLICKUP_CONFIG.REDIRECT_URI)}&state=${state}`;
    
    console.log(`[${new Date().toISOString()}] Redirecting to ClickUp OAuth: ${authUrl}`);
    res.redirect(authUrl);
});

// ClickUp OAuth callback
app.get('/auth/callback', async (req, res) => {
    const { code, state } = req.query;
    
    console.log(`[${new Date().toISOString()}] OAuth callback - Code: ${code ? 'YES' : 'NO'}, State: ${state}`);
    
    if (!code) {
        console.error('No authorization code received');
        return res.redirect('http://192.168.20.10:8888?error=no_code');
    }

    try {
        // Exchange code for token
        const tokenData = {
            client_id: CLICKUP_CONFIG.CLIENT_ID,
            client_secret: CLICKUP_CONFIG.CLIENT_SECRET,
            code: code
        };
        
        const tokenResponse = await axios.post(`${CLICKUP_CONFIG.BASE_URL}/oauth/token`, tokenData, {
            headers: { 'Content-Type': 'application/json' }
        });

        const { access_token } = tokenResponse.data;
        
        if (!access_token) {
            throw new Error('No access token received from ClickUp');
        }
        
        // Get user info
        const clickupUser = await getClickUpUser(access_token);
        const userEmail = state !== 'no-email' ? state : clickupUser.email;
        const userRole = getUserRole(userEmail);
        
        if (!userRole) {
            throw new Error('User email not found in system mapping');
        }
        
        // Store token persistently
        persistentTokens.set(userEmail, access_token);
        await saveTokens();
        
        // Create session
        req.session.userId = clickupUser.id;
        req.session.userEmail = userEmail;
        req.session.userRole = userRole;
        req.session.clickupToken = access_token;
        req.session.clickupUser = clickupUser;
        
        // Clear pending data
        delete req.session.pendingEmail;
        delete req.session.pendingRole;
        
        console.log(`[${new Date().toISOString()}] ClickUp OAuth successful: ${clickupUser.username} (${userRole})`);
        
        // Redirect to frontend
        res.redirect('http://192.168.20.10:8888?auth=success');
        
    } catch (error) {
        console.error('OAuth callback error:', error);
        res.redirect('http://192.168.20.10:8888?error=oauth_failed');
    }
});

// Get current authenticated user
app.get('/api/auth/me', requireAuth, (req, res) => {
    res.json({
        success: true,
        user: {
            id: req.session.userId,
            name: req.session.clickupUser.username,
            email: req.session.userEmail,
            role: req.session.userRole,
            profilePicture: req.session.clickupUser.profilePicture,
            initials: req.session.clickupUser.initials
        }
    });
});

// Logout
app.post('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({
                success: false,
                error: 'Failed to logout'
            });
        }
        
        res.json({
            success: true,
            message: 'Logout successful'
        });
    });
});

// ClickUp Data Routes

// Get all tasks
app.get('/api/tasks', requireAuth, async (req, res) => {
    try {
        const { status, priority, assignee, search } = req.query;
        
        console.log(`[${new Date().toISOString()}] Fetching tasks for: ${req.session.userEmail} (${req.session.userRole})`);
        
        const allTasks = await getAllTeamTasks(req.session.clickupToken);
        let tasks = allTasks.map(normalizeTaskData);
        
        // Filter based on user role
        if (req.session.userRole === 'Employee') {
            // Employees only see their own tasks
            tasks = tasks.filter(task => 
                task.assigneeEmail === req.session.userEmail ||
                task.assignees.some(a => a.email === req.session.userEmail)
            );
        } else if (req.session.userRole === 'Team Lead') {
            // Team Lead sees tasks of team members (you may want to implement team mapping)
            // For now, show all tasks - can be refined based on team structure
        }
        // Manager sees all tasks
        
        // Apply filters
        if (status) {
            tasks = tasks.filter(task => task.status === status);
        }
        
        if (priority && priority !== 'normal') {
            tasks = tasks.filter(task => task.priority === priority);
        }
        
        if (assignee) {
            const assigneeLower = assignee.toLowerCase();
            tasks = tasks.filter(task => 
                task.assigneeName.toLowerCase().includes(assigneeLower) ||
                task.assigneeEmail.toLowerCase().includes(assigneeLower)
            );
        }
        
        if (search) {
            const searchLower = search.toLowerCase();
            tasks = tasks.filter(task =>
                task.name.toLowerCase().includes(searchLower) ||
                task.description.toLowerCase().includes(searchLower) ||
                task.assigneeName.toLowerCase().includes(searchLower) ||
                task.tags.some(tag => tag.toLowerCase().includes(searchLower))
            );
        }
        
        // Sort by creation date (newest first) by default
        tasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        console.log(`[${new Date().toISOString()}] Returning ${tasks.length} tasks`);
        
        res.json({
            success: true,
            data: tasks,
            total: tasks.length,
            filters: { status, priority, assignee, search }
        });
        
    } catch (error) {
        console.error('Failed to fetch tasks:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch tasks from ClickUp'
        });
    }
});

// Get team members
app.get('/api/users/team', requireAuth, async (req, res) => {
    try {
        console.log(`[${new Date().toISOString()}] Fetching team members for: ${req.session.userEmail}`);
        
        const teamMembers = await getTeamMembers(req.session.clickupToken);
        
        // Filter based on role if needed
        let filteredMembers = teamMembers;
        
        if (req.session.userRole === 'Team Lead') {
            // For now, show all team members - can be refined based on team structure
            filteredMembers = teamMembers.filter(member => member.role === 'Employee');
        }
        
        const normalizedMembers = filteredMembers.map(member => ({
            id: member.id,
            name: member.username,
            email: member.email,
            role: member.role,
            profilePicture: member.profilePicture,
            initials: member.initials,
            color: member.color,
            status: 'active' // ClickUp doesn't have explicit status
        }));
        
        res.json({
            success: true,
            data: normalizedMembers,
            total: normalizedMembers.length
        });
        
    } catch (error) {
        console.error('Failed to fetch team members:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch team members from ClickUp'
        });
    }
});

// Get performance analytics
app.get('/api/analytics/leaderboard', requireAuth, requireRole(['Manager', 'Team Lead']), async (req, res) => {
    try {
        console.log(`[${new Date().toISOString()}] Generating performance leaderboard`);
        
        const allTasks = await getAllTeamTasks(req.session.clickupToken);
        const teamMembers = await getTeamMembers(req.session.clickupToken);
        
        // Calculate performance for each team member
        const leaderboard = teamMembers
            .filter(member => member.role === 'Employee')
            .map(member => {
                const memberTasks = allTasks.filter(task => 
                    task.assignees && task.assignees.some(a => a.id === member.id)
                );
                
                const completedTasks = memberTasks.filter(task => {
                    const normalizedTask = normalizeTaskData(task);
                    return normalizedTask.progress === 100;
                });
                
                const totalTasks = memberTasks.length;
                const completionRate = totalTasks > 0 ? (completedTasks.length / totalTasks) * 100 : 0;
                
                // Calculate performance score
                let score = completedTasks.length * performanceScoring.taskCompletion;
                
                // Add early completion bonus
                const earlyCompletions = completedTasks.filter(task => {
                    if (!task.due_date || !task.date_done) return false;
                    return parseInt(task.date_done) < parseInt(task.due_date);
                });
                score += earlyCompletions.length * performanceScoring.earlyCompletionBonus;
                
                // Apply quality multiplier (for now, use completion rate as quality indicator)
                if (completionRate > 90) {
                    score *= performanceScoring.qualityMultiplier;
                }
                
                return {
                    userId: member.id,
                    name: member.username,
                    email: member.email,
                    profilePicture: member.profilePicture,
                    score: Math.round(score),
                    tasksCompleted: completedTasks.length,
                    totalTasks: totalTasks,
                    completionRate: Math.round(completionRate)
                };
            })
            .sort((a, b) => b.score - a.score);
        
        res.json({
            success: true,
            data: leaderboard,
            total: leaderboard.length
        });
        
    } catch (error) {
        console.error('Failed to generate leaderboard:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate performance leaderboard'
        });
    }
});

// Get team analytics
app.get('/api/analytics/team', requireAuth, requireRole(['Manager', 'Team Lead']), async (req, res) => {
    try {
        console.log(`[${new Date().toISOString()}] Generating team analytics`);
        
        const allTasks = await getAllTeamTasks(req.session.clickupToken);
        const teamMembers = await getTeamMembers(req.session.clickupToken);
        
        const normalizedTasks = allTasks.map(normalizeTaskData);
        
        const totalTasks = normalizedTasks.length;
        const completedTasks = normalizedTasks.filter(task => task.progress === 100).length;
        const inProgressTasks = normalizedTasks.filter(task => task.progress > 0 && task.progress < 100).length;
        const pendingTasks = normalizedTasks.filter(task => task.progress === 0).length;
        
        // Calculate overdue tasks
        const now = new Date();
        const overdueTasks = normalizedTasks.filter(task => {
            if (!task.dueDate || task.progress === 100) return false;
            return new Date(task.dueDate) < now;
        }).length;
        
        const activeEmployees = teamMembers.filter(member => member.role === 'Employee').length;
        const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
        
        // Calculate average task duration
        const completedTasksWithTime = normalizedTasks.filter(task => 
            task.progress === 100 && task.timeSpent
        );
        const avgTaskDuration = completedTasksWithTime.length > 0 
            ? Math.round(completedTasksWithTime.reduce((sum, task) => sum + task.timeSpent, 0) / completedTasksWithTime.length)
            : 0;
        
        res.json({
            success: true,
            data: {
                totalTasks,
                completedTasks,
                inProgressTasks,
                pendingTasks,
                overdueTasks,
                activeEmployees,
                completionRate,
                avgTaskDuration,
                teamPerformance: Math.max(completionRate - (overdueTasks * 5), 0)
            }
        });
        
    } catch (error) {
        console.error('Failed to generate team analytics:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate team analytics'
        });
    }
});

// Performance scoring configuration
app.get('/api/settings/scoring', requireAuth, requireRole(['Manager']), (req, res) => {
    res.json({
        success: true,
        data: performanceScoring
    });
});

app.put('/api/settings/scoring', requireAuth, requireRole(['Manager']), (req, res) => {
    const { taskCompletion, earlyCompletionBonus, qualityMultiplier, lateCompletionPenalty } = req.body;
    
    if (taskCompletion !== undefined) performanceScoring.taskCompletion = taskCompletion;
    if (earlyCompletionBonus !== undefined) performanceScoring.earlyCompletionBonus = earlyCompletionBonus;
    if (qualityMultiplier !== undefined) performanceScoring.qualityMultiplier = qualityMultiplier;
    if (lateCompletionPenalty !== undefined) performanceScoring.lateCompletionPenalty = lateCompletionPenalty;
    
    console.log(`[${new Date().toISOString()}] Performance scoring updated by ${req.session.userEmail}`);
    
    res.json({
        success: true,
        data: performanceScoring,
        message: 'Scoring configuration updated'
    });
});

// System status
app.get('/api/system/status', requireAuth, (req, res) => {
    res.json({
        success: true,
        data: {
            lastUpdate: new Date().toISOString(),
            clickupConnected: !!req.session.clickupToken,
            storedTokens: persistentTokens.size,
            userRole: req.session.userRole,
            systemHealth: 'healthy',
            uptime: process.uptime()
        }
    });
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('🛑 Shutting down gracefully...');
    await saveTokens();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('🛑 Shutting down gracefully...');
    await saveTokens();
    process.exit(0);
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 TaskFlow Pro Backend (ClickUp Integration) is running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🔐 Login API: http://localhost:${PORT}/api/auth/login`);
    console.log(`🔗 ClickUp OAuth: http://localhost:${PORT}/auth/clickup`);
    console.log(`👥 Users API: http://localhost:${PORT}/api/users/team`);
    console.log(`📋 Tasks API: http://localhost:${PORT}/api/tasks`);
    console.log(`📈 Analytics API: http://localhost:${PORT}/api/analytics/leaderboard`);
    console.log('');
    console.log('User Role Mapping:');
    Object.entries(USER_ROLES).forEach(([email, role]) => {
        console.log(`${role}: ${email}`);
    });
    console.log('');
    console.log(`📅 Started at: ${new Date().toISOString()}`);
});

module.exports = app;