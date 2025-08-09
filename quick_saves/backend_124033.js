const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 7810;

// ClickUp OAuth Configuration - เฉพาะสำหรับ yterayut@gmail.com
const CLICKUP_CONFIG = {
    clientId: 'DA3L6I2MS7RC39PFH7PZGRZAG4A1J8LL',
    clientSecret: 'BNLH0AZH1P4MHXQSANAM6N5RKNJPDD4I2IBC157H57G9V5NNET1HQ7V8I63K98ZX',
    redirectUri: 'http://192.168.20.10:777/auth/callback',
    baseApiUrl: 'https://api.clickup.com/api/v2',
    masterUser: 'yterayut@gmail.com' // เฉพาะ user นี้ทำ ClickUp OAuth
};

// Load user configuration
const usersConfigPath = path.join(__dirname, 'users_config.json');
const masterTokenPath = path.join(__dirname, 'master_clickup_token.json');

let usersConfig = {};
let masterClickUpToken = null;

// NO CACHE - Removed all caching for accurate role-based filtering
// let clickUpDataCache = null;

// Load users configuration
try {
    const configData = fs.readFileSync(usersConfigPath, 'utf8');
    usersConfig = JSON.parse(configData);
    console.log(`Loaded ${usersConfig.users.length} users from configuration`);
} catch (error) {
    console.error('Error loading users configuration:', error.message);
    process.exit(1);
}

// Load master ClickUp token
function loadMasterToken() {
    try {
        if (fs.existsSync(masterTokenPath)) {
            const tokenData = fs.readFileSync(masterTokenPath, 'utf8');
            masterClickUpToken = JSON.parse(tokenData);
            console.log(`Master ClickUp token loaded for: ${masterClickUpToken.userEmail}`);
        }
    } catch (error) {
        console.error('Error loading master token:', error.message);
    }
}

// Save master token
function saveMasterToken(tokenData) {
    try {
        fs.writeFileSync(masterTokenPath, JSON.stringify(tokenData, null, 2));
        console.log('Master ClickUp token saved successfully');
    } catch (error) {
        console.error('Error saving master token:', error.message);
    }
}

// Load token on startup
loadMasterToken();

// Middleware
app.use(cors({
    origin: ['http://192.168.20.10:8888', 'http://localhost:8888'],
    credentials: true
}));
app.use(express.json());

// In-memory session storage
let userSessions = new Map();

function generateSessionId() {
    return require('crypto').randomBytes(32).toString('hex');
}

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        service: 'TaskFlow Master Auth Service',
        timestamp: new Date().toISOString(),
        version: '1.0.0-master-auth',
        total_users: usersConfig.users.length,
        master_token_status: masterClickUpToken ? 'Available' : 'Not Setup',
        active_sessions: userSessions.size
    });
});

// ClickUp OAuth - เฉพาะ yterayut@gmail.com
app.get('/api/v1/auth/clickup/auth-url', (req, res) => {
    if (masterClickUpToken) {
        return res.status(400).json({
            success: false,
            error: 'ClickUp integration already setup. Please login with email/password.',
            master_user: CLICKUP_CONFIG.masterUser
        });
    }

    const state = require('crypto').randomBytes(32).toString('hex');
    const authUrl = `https://app.clickup.com/api?client_id=${CLICKUP_CONFIG.clientId}&redirect_uri=${encodeURIComponent(CLICKUP_CONFIG.redirectUri)}&state=${state}`;
    
    console.log(`ClickUp OAuth URL generated for master setup`);
    
    res.json({
        authorization_url: authUrl,
        state,
        message: `ClickUp setup required for master user: ${CLICKUP_CONFIG.masterUser}`
    });
});

// ClickUp OAuth callback
app.get('/api/v1/auth/clickup/callback', async (req, res) => {
    const { code, state } = req.query;
    
    if (!code) {
        return res.redirect(`http://192.168.20.10:8888/?auth=error&message=No authorization code`);
    }

    res.redirect(`http://192.168.20.10:8888/?code=${code}&state=${state}&setup=master`);
});

// Complete ClickUp setup - เฉพาะ yterayut@gmail.com
app.post('/api/v1/auth/clickup/setup', async (req, res) => {
    const { code, email, password } = req.body;
    
    if (!code || !email || !password) {
        return res.status(400).json({ 
            success: false, 
            error: 'Authorization code, email and password required' 
        });
    }

    // ตรวจสอบว่าเป็น master user
    if (email !== CLICKUP_CONFIG.masterUser) {
        return res.status(403).json({ 
            success: false, 
            error: `ClickUp setup is only allowed for ${CLICKUP_CONFIG.masterUser}` 
        });
    }

    // ตรวจสอบ user credentials
    const user = usersConfig.users.find(u => u.email === email);
    if (!user || user.password !== password) {
        return res.status(401).json({ 
            success: false, 
            error: 'Invalid email or password' 
        });
    }

    if (masterClickUpToken) {
        return res.status(400).json({ 
            success: false, 
            error: 'ClickUp integration already setup' 
        });
    }

    try {
        console.log('Setting up master ClickUp token for:', email);
        
        // Exchange code for access token
        const tokenResponse = await axios.post('https://api.clickup.com/api/v2/oauth/token', {
            client_id: CLICKUP_CONFIG.clientId,
            client_secret: CLICKUP_CONFIG.clientSecret,
            code,
            redirect_uri: CLICKUP_CONFIG.redirectUri
        });

        const { access_token } = tokenResponse.data;
        
        // Get ClickUp user info
        const userResponse = await axios.get(`${CLICKUP_CONFIG.baseApiUrl}/user`, {
            headers: {
                'Authorization': access_token,
                'Content-Type': 'application/json'
            }
        });

        const clickupUser = userResponse.data.user;
        
        // Store master token
        masterClickUpToken = {
            accessToken: access_token,
            clickupUserId: clickupUser.id,
            clickupUsername: clickupUser.username,
            clickupEmail: clickupUser.email,
            userEmail: email,
            createdAt: new Date().toISOString(),
            lastUsed: new Date().toISOString()
        };

        saveMasterToken(masterClickUpToken);

        console.log(`Master ClickUp token setup complete for ${email} (ClickUp: ${clickupUser.username})`);

        res.json({ 
            success: true,
            message: 'ClickUp integration setup successful. All users can now access real ClickUp data.',
            master_user: email,
            clickup_user: clickupUser.username
        });
    } catch (error) {
        console.error('ClickUp setup error:', error.response?.data || error.message);
        res.status(400).json({ 
            success: false, 
            error: error.response?.data?.err || error.message 
        });
    }
});

// Email/Password login - สำหรับทุกคน
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

    // Check if master ClickUp token is available
    const hasClickUpData = masterClickUpToken !== null;
    
    // Create session
    const sessionId = generateSessionId();
    const sessionData = {
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        permissions: user.permissions,
        hasClickUpData: hasClickUpData,
        isMasterUser: email === CLICKUP_CONFIG.masterUser,
        loginTime: new Date().toISOString(),
        lastActivity: new Date().toISOString()
    };
    
    userSessions.set(sessionId, sessionData);
    
    console.log(`Login successful for ${user.name} (${user.role}) - ClickUp data: ${hasClickUpData ? 'Available' : 'Not Available'}`);
    
    res.json({
        success: true,
        sessionId: sessionId,
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            permissions: user.permissions,
            hasClickUpData: hasClickUpData,
            isMasterUser: sessionData.isMasterUser
        },
        message: hasClickUpData ? 'Login successful with ClickUp data access' : 'Login successful - ClickUp setup required by master user'
    });
});

// 🚀 NEW: Quick Stats API for faster dashboard loading
app.get('/api/v1/clickup/quick-stats', async (req, res) => {
    const sessionId = req.headers.authorization?.replace('Bearer ', '');
    
    if (!sessionId || !userSessions.has(sessionId)) {
        return res.status(401).json({
            success: false,
            error: 'Not authenticated'
        });
    }
    
    const sessionData = userSessions.get(sessionId);
    
    if (!masterClickUpToken) {
        return res.status(400).json({
            success: false,
            error: 'ClickUp integration not setup'
        });
    }
    
    try {
        // NO CACHE - Always generate fresh quick stats
        
        console.log('📊 Generating quick stats...');
        
        // Get minimal data for quick stats
        const teamsData = await callClickUpAPI('/team');
        const teams = teamsData.teams || [];
        
        // Quick calculation - get only first page of recent tasks
        let totalRecentTasks = 0;
        let completedRecentTasks = 0;
        let activeMembers = 0;
        
        const quickPromises = teams.slice(0, 3).map(async (team) => { // Limit to first 3 teams for speed
            try {
                const tasksData = await callClickUpAPI(`/team/${team.id}/task?archived=false&page=0&order_by=updated&reverse=true`);
                const tasks = tasksData.tasks || [];
                
                const completed = tasks.filter(task => 
                    task.status?.status === 'complete' || task.status?.status === 'closed'
                ).length;
                
                return {
                    totalTasks: tasks.length,
                    completedTasks: completed,
                    members: team.members?.length || 0
                };
            } catch (error) {
                return { totalTasks: 0, completedTasks: 0, members: 0 };
            }
        });
        
        const quickResults = await Promise.all(quickPromises);
        
        quickResults.forEach(result => {
            totalRecentTasks += result.totalTasks;
            completedRecentTasks += result.completedTasks;
            activeMembers += result.members;
        });
        
        let quickStats = {
            totalTasks: totalRecentTasks,
            completedTasks: completedRecentTasks,
            pendingTasks: totalRecentTasks - completedRecentTasks,
            teamSize: activeMembers,
            activeProjects: teams.length,
            completionRate: totalRecentTasks > 0 ? Math.round((completedRecentTasks / totalRecentTasks) * 100) : 0,
            timestamp: new Date().toISOString(),
            source: 'quick-stats-api'
        };
        
        // 🔐 Apply role-based filtering to quick stats
        const mockData = {
            tasks: [], // Quick stats doesn't need full task data
            subtasks: [],
            members: Array(activeMembers).fill({}), // Mock members for count
            teams: teams,
            totalTasks: totalRecentTasks,
            completedTasks: completedRecentTasks,
            pendingTasks: totalRecentTasks - completedRecentTasks,
            teamSize: activeMembers,
            activeProjects: teams.length
        };
        
        const filteredStats = filterDataByRole(mockData, sessionData.role, sessionData.email);
        
        // Update quick stats with filtered data
        quickStats = {
            ...quickStats,
            totalTasks: filteredStats.totalTasks || quickStats.totalTasks,
            completedTasks: filteredStats.completedTasks || quickStats.completedTasks,
            pendingTasks: filteredStats.pendingTasks || quickStats.pendingTasks,
            teamSize: filteredStats.teamSize || quickStats.teamSize,
            activeProjects: filteredStats.activeProjects || quickStats.activeProjects,
            role: sessionData.role, // Include role info for debugging
            userEmail: sessionData.email
        };
        
        // NO CACHE - Quick stats always fresh
        
        console.log(`⚡ Quick stats generated for ${sessionData.role}: ${quickStats.totalTasks} tasks, ${quickStats.completedTasks} completed`);
        
        res.json({
            success: true,
            ...quickStats
        });
        
    } catch (error) {
        console.error('Quick stats error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get quick stats'
        });
    }
});

// Check authentication status
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
            hasClickUpData: sessionData.hasClickUpData,
            isMasterUser: sessionData.isMasterUser
        },
        session: {
            loginTime: sessionData.loginTime,
            lastActivity: sessionData.lastActivity
        }
    });
});

// Helper function to make ClickUp API calls
async function callClickUpAPI(endpoint) {
    if (!masterClickUpToken) {
        throw new Error('ClickUp integration not setup');
    }

    try {
        console.log(`Making ClickUp API call to: ${endpoint}`);
        const response = await axios.get(`${CLICKUP_CONFIG.baseApiUrl}${endpoint}`, {
            headers: {
                'Authorization': masterClickUpToken.accessToken,
                'Content-Type': 'application/json'
            }
        });
        
        // Update last used time
        masterClickUpToken.lastUsed = new Date().toISOString();
        saveMasterToken(masterClickUpToken);
        
        console.log(`ClickUp API call successful: ${endpoint}`);
        return response.data;
    } catch (error) {
        console.error(`ClickUp API error for ${endpoint}:`, error.response?.data || error.message);
        throw error;
    }
}

// 🔐 Enhanced Role-Based Data Filtering using Real ClickUp Data
function filterDataByRole(data, role, userEmail) {
    console.log(`🔍 Filtering data for role: ${role}, user: ${userEmail}`);
    
    // Get user info from config
    const currentUser = usersConfig.users.find(u => u.email === userEmail);
    if (!currentUser) {
        console.warn(`User ${userEmail} not found in config`);
        return { ...data, tasks: [], subtasks: [], teams: [], members: [] };
    }

    if (role === 'Manager') {
        // 👨‍💼 Manager: เห็นข้อมูลทั้งหมด - ไม่กรองอะไร
        console.log(`👨‍💼 Manager access: Full data access for ${currentUser.name}`);
        return data;
        
    } else if (role === 'Team Lead') {
        // 👥 Team Lead: เห็นข้อมูลของ Employee ทุกคน (ไม่รวม Manager คนอื่น)
        console.log(`👥 Team Lead access: Employee data for ${currentUser.name}`);
        
        // Get all employee emails from config
        const employeeEmails = usersConfig.users
            .filter(u => u.role === 'Employee')
            .map(u => u.email.toLowerCase());
        
        // Get current user's own email for inclusion
        const teamLeadEmail = userEmail.toLowerCase();
        const allowedEmails = [...employeeEmails, teamLeadEmail];
        
        console.log(`👥 Team Lead can see data for: ${allowedEmails.join(', ')}`);
        
        // Filter tasks: assigned to employees/team lead OR unassigned
        const filteredTasks = (data.tasks || []).filter(task => {
            // If task has assignees, check if assigned to employees or team lead by email
            if (task.assignees && task.assignees.length > 0) {
                return task.assignees.some(assignee => 
                    assignee.email && allowedEmails.includes(assignee.email.toLowerCase())
                );
            }
            // Team Lead can see unassigned tasks (for assignment purposes)
            return true;
        });
        
        // Filter subtasks: assigned to employees/team lead OR unassigned
        const filteredSubtasks = (data.subtasks || []).filter(subtask => {
            // If subtask has assignees, check if assigned to employees or team lead by email
            if (subtask.assignees && subtask.assignees.length > 0) {
                return subtask.assignees.some(assignee => 
                    assignee.email && allowedEmails.includes(assignee.email.toLowerCase())
                );
            }
            // Team Lead can see unassigned subtasks
            return true;
        });
        
        // Keep all teams for team lead (they need to see team structure)
        const filteredData = {
            ...data,
            tasks: filteredTasks,
            subtasks: filteredSubtasks,
            // Recalculate totals based on filtered data
            totalTasks: filteredTasks.length + filteredSubtasks.length,
            completedTasks: [...filteredTasks, ...filteredSubtasks].filter(task => 
                task.status?.status === 'complete' || task.status?.status === 'closed'
            ).length,
            pendingTasks: [...filteredTasks, ...filteredSubtasks].filter(task => 
                task.status?.status !== 'complete' && task.status?.status !== 'closed'
            ).length
        };
        
        console.log(`👥 Team Lead filtered: ${filteredTasks.length} tasks, ${filteredSubtasks.length} subtasks`);
        return filteredData;
        
    } else if (role === 'Employee') {
        // 👤 Employee: เห็นเฉพาะข้อมูลที่ assign ให้ตัวเอง
        console.log(`👤 Employee access: Personal assigned tasks only for ${currentUser.name}`);
        console.log(`👤 Looking for tasks assigned to email: ${userEmail}`);
        
        const userEmailLower = userEmail.toLowerCase();
        
        // Debug: Check first few tasks for assignee structure
        console.log(`👤 Checking assignee structure for first task:`, data.tasks?.[0]?.assignees);
        
        // Filter tasks: ONLY assigned to this user by email (NOT unassigned)
        const filteredTasks = (data.tasks || []).filter(task => {
            // Debug each task assignment
            if (task.assignees && task.assignees.length > 0) {
                const hasEmail = task.assignees.some(assignee => 
                    assignee.email && assignee.email.toLowerCase() === userEmailLower
                );
                if (hasEmail) {
                    console.log(`👤 Found task assigned to user:`, task.name);
                }
                return hasEmail;
            }
            // Employee should NOT see unassigned tasks
            return false;
        });
        
        // Filter subtasks: ONLY assigned to this user by email (NOT unassigned)
        const filteredSubtasks = (data.subtasks || []).filter(subtask => {
            // Only show subtasks assigned to this specific user by email
            if (subtask.assignees && subtask.assignees.length > 0) {
                return subtask.assignees.some(assignee => 
                    assignee.email && assignee.email.toLowerCase() === userEmailLower
                );
            }
            // Employee should NOT see unassigned subtasks
            return false;
        });
        
        // Filter members to show only this user
        const filteredMembers = (data.members || []).filter(member => 
            member.email && member.email.toLowerCase() === userEmailLower
        );
        
        // Employee can see teams they're part of
        const filteredTeams = (data.teams || []).filter(team => {
            if (team.members && team.members.length > 0) {
                return team.members.some(member => 
                    member.email && member.email.toLowerCase() === userEmailLower
                );
            }
            return false;
        });
        
        const filteredData = {
            ...data,
            tasks: filteredTasks,
            subtasks: filteredSubtasks,
            members: filteredMembers,
            teams: filteredTeams,
            // Recalculate totals for personal data only
            totalTasks: filteredTasks.length + filteredSubtasks.length,
            completedTasks: [...filteredTasks, ...filteredSubtasks].filter(task => 
                task.status?.status === 'complete' || task.status?.status === 'closed'
            ).length,
            pendingTasks: [...filteredTasks, ...filteredSubtasks].filter(task => 
                task.status?.status !== 'complete' && task.status?.status !== 'closed'
            ).length,
            teamSize: filteredMembers.length,
            activeProjects: filteredTeams.length
        };
        
        console.log(`👤 Employee filtered: ${filteredTasks.length} tasks, ${filteredSubtasks.length} subtasks (assigned to user only)`);
        return filteredData;
    }
    
    // Default fallback - no access
    console.warn(`❌ Unknown role: ${role} - denying access`);
    return { ...data, tasks: [], subtasks: [], teams: [], members: [] };
}

// Dashboard data - ข้อมูลจาก ClickUp จริงเท่านั้น
app.get('/api/v1/dashboard', async (req, res) => {
    const sessionId = req.headers.authorization?.replace('Bearer ', '');
    
    if (!sessionId || !userSessions.has(sessionId)) {
        return res.status(401).json({
            success: false,
            error: 'Authentication required'
        });
    }
    
    const sessionData = userSessions.get(sessionId);
    
    // Update last activity
    sessionData.lastActivity = new Date().toISOString();
    userSessions.set(sessionId, sessionData);
    
    // ตรวจสอบว่ามี ClickUp token หรือไม่
    if (!masterClickUpToken) {
        return res.status(400).json({
            success: false,
            error: 'ClickUp integration not setup. Please ask master user to setup ClickUp integration.',
            master_user: CLICKUP_CONFIG.masterUser,
            requiresSetup: true
        });
    }

    try {
        console.log(`Loading ClickUp data for ${sessionData.name} (${sessionData.role})`);
        
        // NO CACHE - Always fetch fresh data for accurate role filtering
        
        console.log('📡 Fetching fresh ClickUp data...');
        
        // 🚀 NO CACHE: Always fetch fresh teams data
        console.log('📡 Fetching fresh teams data...');
        const teamsData = await callClickUpAPI('/team');
        const teams = teamsData.teams || [];
        
        let allTasks = [];
        let allSubtasks = [];
        let allMembers = [];
        
        // 🚀 OPTIMIZED: Limit data fetching based on needs
        const MAX_TASKS_PER_TEAM = 200; // Limit เพื่อป้องกัน memory overflow
        const MAX_PAGES_PER_TEAM = 3;   // จำกัด pagination
        
        // Parallel API calls for better performance - OPTIMIZED with limits
        const teamPromises = teams.map(async (team) => {
            try {
                // Get team members (cache with teams data)
                let teamMembers = [];
                if (clickUpDataCache.teamsData) {
                    // Members are often included in team data
                    teamMembers = team.members || [];
                } 
                
                // If no members in team data, fetch separately
                if (teamMembers.length === 0) {
                    const teamMembersData = await callClickUpAPI(`/team/${team.id}`).catch(e => ({ team: { members: [] } }));
                    teamMembers = teamMembersData.team?.members || [];
                }
                
                // 🚀 OPTIMIZED: Get recent tasks only with strict limits
                let allTeamTasks = [];
                let page = 0;
                let hasMore = true;
                
                while (hasMore && page < MAX_PAGES_PER_TEAM) {
                    try {
                        // Add date filter for recent tasks only (last 30 days)
                        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
                        const tasksData = await callClickUpAPI(
                            `/team/${team.id}/task?archived=false&include_closed=true&page=${page}&order_by=updated&reverse=true&date_updated_gt=${thirtyDaysAgo}`
                        );
                        const pageTasks = tasksData.tasks || [];
                        
                        if (pageTasks.length > 0 && allTeamTasks.length < MAX_TASKS_PER_TEAM) {
                            const remainingSlots = MAX_TASKS_PER_TEAM - allTeamTasks.length;
                            const tasksToAdd = pageTasks.slice(0, remainingSlots);
                            allTeamTasks = allTeamTasks.concat(tasksToAdd);
                            page++;
                            
                            // Stop if we've reached our limit or got less than expected
                            if (pageTasks.length < 50 || allTeamTasks.length >= MAX_TASKS_PER_TEAM) {
                                hasMore = false;
                            }
                        } else {
                            hasMore = false;
                        }
                    } catch (pageError) {
                        console.warn(`Error fetching page ${page} for team ${team.id}:`, pageError.message);
                        hasMore = false;
                    }
                }
                
                console.log(`Team ${team.id}: Found ${allTeamTasks.length} recent tasks (limit: ${MAX_TASKS_PER_TEAM})`);
                
                // 🚀 OPTIMIZED: Get subtasks only for recent/important tasks
                const importantTasks = allTeamTasks.filter(task => 
                    task.status?.status !== 'complete' || 
                    (task.date_updated && Date.now() - parseInt(task.date_updated) < 7 * 24 * 60 * 60 * 1000) // Updated within 7 days
                ).slice(0, 50); // Max 50 tasks for subtask fetching
                
                const subtaskPromises = importantTasks.map(task => 
                    callClickUpAPI(`/task/${task.id}?include_subtasks=true`)
                        .then(data => data.subtasks || [])
                        .catch(() => [])
                );
                
                const subtasksArrays = await Promise.all(subtaskPromises);
                const teamSubtasks = subtasksArrays.flat();
                
                console.log(`Team ${team.id}: Found ${teamSubtasks.length} subtasks from ${importantTasks.length} important tasks`);
                
                return {
                    members: teamMembers,
                    tasks: allTeamTasks,
                    subtasks: teamSubtasks
                };
            } catch (error) {
                console.warn(`Error fetching data for team ${team.id}:`, error.message);
                return { members: [], tasks: [], subtasks: [] };
            }
        });
        
        // Execute all team data fetching in parallel
        const teamResults = await Promise.all(teamPromises);
        
        // 🚀 OPTIMIZED: Combine results with memory-efficient approach
        teamResults.forEach(result => {
            allMembers = allMembers.concat(result.members);
            allTasks = allTasks.concat(result.tasks);
            allSubtasks = allSubtasks.concat(result.subtasks);
        });
        
        // Remove duplicates from team members (more efficient)
        const memberMap = new Map();
        allMembers.forEach(member => {
            if (member.id) memberMap.set(member.id, member);
        });
        const uniqueMembers = Array.from(memberMap.values());
        
        // Combine tasks and subtasks for total count
        const allTasksAndSubtasks = [...allTasks, ...allSubtasks];
        console.log(`✅ OPTIMIZED: Fetched ${allTasks.length} main tasks + ${allSubtasks.length} subtasks = ${allTasksAndSubtasks.length} total (limited) in ${teams.length} teams`);

        // Calculate real KPIs from ALL ClickUp data (tasks + subtasks)
        const totalTasksAndSubtasks = allTasksAndSubtasks.length;
        const completedTasksAndSubtasks = allTasksAndSubtasks.filter(task => 
            task.status?.status === 'complete' || task.status?.status === 'closed'
        ).length;
        const inProgressTasksAndSubtasks = allTasksAndSubtasks.filter(task => 
            task.status?.status === 'in progress' || task.status?.status === 'in review'
        ).length;
        const todoTasksAndSubtasks = allTasksAndSubtasks.filter(task => 
            task.status?.status === 'to do' || task.status?.status === 'Open'
        ).length;
        const overdueTasks = allTasksAndSubtasks.filter(task => {
            const dueDate = task.due_date ? new Date(parseInt(task.due_date)) : null;
            return dueDate && dueDate < new Date() && task.status?.status !== 'complete';
        }).length;

        // Prepare full ClickUp data with ALL tasks + subtasks
        const fullClickUpData = {
            totalTasks: totalTasksAndSubtasks,
            completedTasks: completedTasksAndSubtasks,
            pendingTasks: totalTasksAndSubtasks - completedTasksAndSubtasks,
            inProgressTasks: inProgressTasksAndSubtasks,
            todoTasks: todoTasksAndSubtasks,
            overdueTasks,
            teamSize: uniqueMembers.length,
            taskChange: `+${allSubtasks.length}`,
            completedChange: `+${completedTasksAndSubtasks}`,
            pendingChange: `+${todoTasksAndSubtasks}`,
            teamChange: `+0`,
            activeProjects: teams.length,
            mainTasks: allTasks.length,
            subtasks: allSubtasks.length,
            tasks: allTasksAndSubtasks.map(task => ({
                id: task.id,
                name: task.name,
                status: task.status?.status || 'pending',
                priority: task.priority?.priority || 'medium',
                assignee: task.assignees?.[0]?.username || 'Unassigned',
                assigneeEmail: task.assignees?.[0]?.email || null,
                due_date: task.due_date,
                url: task.url,
                isSubtask: allSubtasks.some(st => st.id === task.id)
            })),
            team: uniqueMembers.map(member => ({
                id: member.id,
                username: member.username,
                email: member.email,
                role: member.role || 'Member',
                taskCount: allTasksAndSubtasks.filter(task => 
                    task.assignees?.some(assignee => assignee.id === member.id)
                ).length
            })),
            workload: {
                totalTasks: totalTasksAndSubtasks,
                completedTasks: completedTasksAndSubtasks,
                inProgressTasks: inProgressTasksAndSubtasks,
                overdueTasks
            },
            recentActivities: allTasks
                .filter(task => task.date_updated)
                .sort((a, b) => parseInt(b.date_updated) - parseInt(a.date_updated))
                .slice(0, 10)
                .map((task, index) => ({
                    id: index + 1,
                    message: `Task updated: ${task.name}`,
                    time: new Date(parseInt(task.date_updated)).toLocaleString(),
                    user: task.assignees?.[0]?.username || 'Unknown',
                    task_id: task.id
                })),
            teams: teams.map(team => ({
                id: team.id,
                name: team.name,
                members: team.members?.length || 0,
                color: team.color || '#3498db'
            }))
        };

        // NO CACHE - Data is always fresh

        // Apply role-based filtering BEFORE mapping to final structure
        const preFilteredData = {
            tasks: allTasks,
            subtasks: allSubtasks,
            members: uniqueMembers,
            teams: teams,
            totalTasks: totalTasksAndSubtasks,
            completedTasks: completedTasksAndSubtasks,
            pendingTasks: totalTasksAndSubtasks - completedTasksAndSubtasks,
            teamSize: uniqueMembers.length,
            activeProjects: teams.length
        };
        
        const filteredRawData = filterDataByRole(preFilteredData, sessionData.role, sessionData.email);
        
        // Now build final structure with filtered data
        const filteredTasksAndSubtasks = [...(filteredRawData.tasks || []), ...(filteredRawData.subtasks || [])];
        const filteredTotalTasks = filteredTasksAndSubtasks.length;
        const filteredCompletedTasks = filteredTasksAndSubtasks.filter(task => 
            task.status?.status === 'complete' || task.status?.status === 'closed'
        ).length;

        console.log(`✅ Real ClickUp data loaded for ${sessionData.name} (${sessionData.role}): ${filteredTotalTasks} tasks visible`);

        // Build final response with filtered data
        const finalResponse = {
            totalTasks: filteredTotalTasks,
            completedTasks: filteredCompletedTasks,
            pendingTasks: filteredTotalTasks - filteredCompletedTasks,
            inProgressTasks: filteredTasksAndSubtasks.filter(task => 
                task.status?.status === 'in progress' || task.status?.status === 'in review'
            ).length,
            todoTasks: filteredTasksAndSubtasks.filter(task => 
                task.status?.status === 'to do' || task.status?.status === 'Open'
            ).length,
            overdueTasks: filteredTasksAndSubtasks.filter(task => {
                const dueDate = task.due_date ? new Date(parseInt(task.due_date)) : null;
                return dueDate && dueDate < new Date() && task.status?.status !== 'complete';
            }).length,
            teamSize: filteredRawData.teamSize || uniqueMembers.length,
            taskChange: `+${filteredRawData.subtasks?.length || 0}`,
            completedChange: `+${filteredCompletedTasks}`,
            pendingChange: `+${filteredTotalTasks - filteredCompletedTasks}`,
            teamChange: `+0`,
            activeProjects: filteredRawData.activeProjects || teams.length,
            mainTasks: filteredRawData.tasks?.length || 0,
            subtasks: filteredRawData.subtasks?.length || 0,
            tasks: filteredTasksAndSubtasks.map(task => ({
                id: task.id,
                name: task.name,
                status: task.status?.status || 'pending',
                priority: task.priority?.priority || 'medium',
                assignee: task.assignees?.[0]?.username || 'Unassigned',
                assigneeEmail: task.assignees?.[0]?.email || null,
                due_date: task.due_date,
                url: task.url,
                isSubtask: (filteredRawData.subtasks || []).some(st => st.id === task.id)
            })),
            team: uniqueMembers.map(member => ({
                role: 'Member',
                taskCount: filteredTasksAndSubtasks.filter(task => 
                    task.assignees?.some(a => a.id === member.id)
                ).length
            })),
            workload: {
                totalTasks: filteredTotalTasks,
                completedTasks: filteredCompletedTasks,
                inProgressTasks: filteredTasksAndSubtasks.filter(task => 
                    task.status?.status === 'in progress' || task.status?.status === 'in review'
                ).length,
                overdueTasks: filteredTasksAndSubtasks.filter(task => {
                    const dueDate = task.due_date ? new Date(parseInt(task.due_date)) : null;
                    return dueDate && dueDate < new Date() && task.status?.status !== 'complete';
                }).length
            },
            recentActivities: filteredTasksAndSubtasks.slice(0, 10).map((task, index) => ({
                id: index + 1,
                message: `Task updated: ${task.name}`,
                time: task.date_updated ? new Date(parseInt(task.date_updated)).toLocaleString() : new Date().toLocaleString(),
                user: task.assignees?.[0]?.username || 'Unknown',
                task_id: task.id
            })),
            teams: teams.map(team => ({
                id: team.id,
                name: team.name,
                members: team.members?.length || 0,
                color: team.color || '#40BC86'
            }))
        };

        res.json({
            success: true,
            user: {
                id: sessionData.userId,
                name: sessionData.name,
                role: sessionData.role,
                permissions: sessionData.permissions,
                hasClickUpData: true
            },
            ...finalResponse,
            source: 'fresh-no-cache',
            filtered_by_role: sessionData.role,
            master_user: CLICKUP_CONFIG.masterUser,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('ClickUp API error:', error.response?.data || error.message);
        
        res.status(500).json({
            success: false,
            error: 'Failed to fetch ClickUp data',
            message: error.response?.data?.err || error.message,
            requiresAuth: error.response?.status === 401
        });
    }
});

// Manual cache refresh endpoint
app.post('/api/v1/cache/refresh', async (req, res) => {
    const sessionId = req.headers.authorization?.replace('Bearer ', '');
    
    if (!sessionId || !userSessions.has(sessionId)) {
        return res.status(401).json({
            success: false,
            error: 'Authentication required'
        });
    }
    
    try {
        console.log('🔄 Manual cache refresh requested');
        clickUpDataCache.data = null;
        clickUpDataCache.timestamp = null;
        
        res.json({
            success: true,
            message: 'Cache cleared. Next dashboard request will fetch fresh data.',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to refresh cache'
        });
    }
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

// Master user status (for debugging)
app.get('/api/v1/master/status', (req, res) => {
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
    
    res.json({
        success: true,
        master_user: CLICKUP_CONFIG.masterUser,
        token_status: masterClickUpToken ? 'Available' : 'Not Setup',
        token_info: masterClickUpToken ? {
            clickup_user: masterClickUpToken.clickupUsername,
            created_at: masterClickUpToken.createdAt,
            last_used: masterClickUpToken.lastUsed
        } : null
    });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 TaskFlow Master Auth Service running on port ${PORT}`);
    console.log(`🔗 Health check: http://192.168.20.10:${PORT}/health`);
    console.log(`🔐 Email/Password login: http://192.168.20.10:${PORT}/api/v1/auth/login`);
    console.log(`📊 Dashboard endpoint: http://192.168.20.10:${PORT}/api/v1/dashboard`);
    console.log(`🎯 ClickUp setup (master only): http://192.168.20.10:${PORT}/api/v1/auth/clickup/auth-url`);
    console.log(`👑 Master user: ${CLICKUP_CONFIG.masterUser}`);
    console.log(`👥 Total users: ${usersConfig.users.length}`);
    console.log(`🎫 Master ClickUp token: ${masterClickUpToken ? 'Available' : 'Not Setup'}`);
    console.log(`📋 Data source: Real ClickUp data only (no demo/mock data)`);
});

module.exports = app;