const express = require('express');
const cors = require('cors');
const axios = require('axios');
const session = require('express-session');
const fs = require('fs');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');

// Database Services
const { PostgreSQLService } = require('./services/PostgreSQLService');
const Database = require('better-sqlite3');

// Import Real ClickUp Sync Service  
const { RealClickUpSyncService } = require('./services/RealClickUpSyncService');
const { TokenRefreshService } = require('./services/TokenRefreshService');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: ['http://192.168.20.10:8888', 'http://localhost:8888'],
        methods: ['GET', 'POST'],
        credentials: true
    }
});

const PORT = 7812;

// ClickUp OAuth Configuration
const CLICKUP_CONFIG = {
    CLIENT_ID: 'DA3L6I2MS7RC39PFH7PZGRZAG4A1J8LL',
    CLIENT_SECRET: 'BNLH0AZH1P4MHXQSANAM6N5RKNJPDD4I2IBC157H57G9V5NNET1HQ7V8I63K98ZX',
    REDIRECT_URI: 'http://192.168.20.10:7812/auth/callback',
    BASE_URL: 'https://api.clickup.com/api/v2',
    AUTH_URL: 'https://app.clickup.com/api'
};

// 🎯 PRODUCTION DATABASE - PostgreSQL with SQLite Fallback
const USE_POSTGRESQL = process.env.USE_POSTGRESQL !== 'false';
const SQLITE_PATH = path.join(__dirname, 'taskflow_production_real.db');

let db; // Database connection (PostgreSQL or SQLite)
let realClickUpSync;
let dbService; // Database service instance
let tokenRefreshService; // Token refresh service

// Global access token storage
let masterClickUpToken = null;

// Load master token if exists
try {
    const tokenPath = path.join(__dirname, 'master_clickup_token.json');
    if (fs.existsSync(tokenPath)) {
        const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
        masterClickUpToken = tokenData.accessToken || tokenData.access_token;
        
        if (masterClickUpToken) {
            if (masterClickUpToken.startsWith('Bearer ')) {
                masterClickUpToken = masterClickUpToken.replace('Bearer ', '');
            }
            
            console.log(`[${new Date().toISOString()}] ✅ Loaded ClickUp token for ${tokenData.userEmail || 'user'}`);
            console.log(`[${new Date().toISOString()}] 🔑 Token format: ${masterClickUpToken.substring(0, 20)}...`);
        } else {
            throw new Error('No valid token found in file');
        }
    } else {
        throw new Error('Token file not found');
    }
} catch (error) {
    console.warn(`[${new Date().toISOString()}] ❌ ClickUp token error: ${error.message}`);
    console.warn(`[${new Date().toISOString()}] 🚨 CRITICAL: ระบบจะไม่มีข้อมูลจริงจาก ClickUp!`);
    masterClickUpToken = null;
}

// Database initialization
async function initializeDatabase() {
    try {
        if (USE_POSTGRESQL) {
            console.log(`[${new Date().toISOString()}] 🐘 Initializing PostgreSQL database...`);
            
            dbService = new PostgreSQLService();
            const connected = await dbService.connect();
            
            if (!connected) {
                console.log(`[${new Date().toISOString()}] 🔄 PostgreSQL failed, falling back to SQLite...`);
                throw new Error('PostgreSQL connection failed');
            }
            
            // Run migration if needed
            await dbService.migrate();
            
            // Migrate data from SQLite if exists
            if (fs.existsSync(SQLITE_PATH)) {
                console.log(`[${new Date().toISOString()}] 📊 Migrating existing SQLite data...`);
                await dbService.migrateDataFromSQLite(SQLITE_PATH);
            }
            
            db = dbService; // Use PostgreSQL service
            console.log(`[${new Date().toISOString()}] ✅ PostgreSQL database initialized successfully`);
            
        } else {
            throw new Error('PostgreSQL disabled, using SQLite');
        }
        
    } catch (error) {
        console.log(`[${new Date().toISOString()}] 🔄 Falling back to SQLite: ${error.message}`);
        
        // Fallback to SQLite
        db = new Database(SQLITE_PATH);
        
        // Ensure SQLite tables exist
        db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                password TEXT,
                role TEXT DEFAULT 'Employee',
                permissions TEXT DEFAULT '["dashboard","analytics"]',
                is_active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS clickup_tasks (
                id TEXT PRIMARY KEY,
                list_id TEXT,
                parent_id TEXT,
                name TEXT NOT NULL,
                description TEXT,
                status TEXT,
                priority INTEGER,
                assignees TEXT DEFAULT '[]',
                due_date DATETIME,
                time_estimate INTEGER,
                time_spent INTEGER DEFAULT 0,
                custom_fields TEXT DEFAULT '{}',
                tags TEXT DEFAULT '[]',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS clickup_members (
                id TEXT PRIMARY KEY,
                team_id TEXT,
                username TEXT,
                email TEXT,
                color TEXT,
                profile_picture TEXT,
                initials TEXT,
                role INTEGER DEFAULT 3,
                is_active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS clickup_teams (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                color TEXT,
                avatar TEXT,
                members TEXT DEFAULT '[]',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);
        
        console.log(`[${new Date().toISOString()}] ✅ SQLite database initialized`);
    }
    
    return db;
}

// Database abstraction layer
const DatabaseAdapter = {
    async query(sql, params = []) {
        if (dbService && dbService.isConnected) {
            // PostgreSQL
            const result = await dbService.query(sql, params);
            return result.rows;
        } else {
            // SQLite
            if (params.length === 0) {
                return db.prepare(sql).all();
            } else {
                return db.prepare(sql).all(params);
            }
        }
    },
    
    async run(sql, params = []) {
        if (dbService && dbService.isConnected) {
            // PostgreSQL
            return await dbService.query(sql, params);
        } else {
            // SQLite
            return db.prepare(sql).run(params);
        }
    },
    
    getType() {
        return (dbService && dbService.isConnected) ? 'PostgreSQL' : 'SQLite';
    },
    
    getStats() {
        if (dbService && dbService.isConnected) {
            return dbService.getStats();
        } else {
            // SQLite stats
            try {
                const tasks = db.prepare('SELECT COUNT(*) as count FROM clickup_tasks').get();
                const members = db.prepare('SELECT COUNT(*) as count FROM clickup_members').get();
                const users = db.prepare('SELECT COUNT(*) as count FROM users').get();
                return {
                    tasks: tasks.count,
                    members: members.count,
                    users: users.count
                };
            } catch (error) {
                return null;
            }
        }
    }
};

// Session configuration
app.use(session({
    secret: 'taskflow-pro-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { 
        secure: false,
        domain: '192.168.20.10'
    }
}));

app.use(cors({
    origin: ['http://192.168.20.10:8888', 'http://localhost:8888'],
    credentials: true
}));
app.use(express.json());

// Production storage
let connectedUsers = new Map();
let teamRooms = new Map();

// WebSocket handling
io.on('connection', (socket) => {
    console.log(`[${new Date().toISOString()}] WebSocket client connected: ${socket.id}`);
    
    socket.on('authenticate', (data) => {
        const { userId, userRole, userName } = data;
        connectedUsers.set(socket.id, { userId, userRole, userName, connectedAt: new Date().toISOString() });
        socket.join(`role_${userRole.toLowerCase()}`);
        
        io.to(`role_${userRole.toLowerCase()}`).emit('userJoined', {
            userId, userName, userRole, timestamp: new Date().toISOString()
        });
    });

    socket.on('disconnect', () => {
        const userData = connectedUsers.get(socket.id);
        if (userData) {
            io.to(`role_${userData.userRole.toLowerCase()}`).emit('userLeft', {
                userId: userData.userId,
                userName: userData.userName,
                timestamp: new Date().toISOString()
            });
            connectedUsers.delete(socket.id);
        }
        console.log(`[${new Date().toISOString()}] WebSocket client disconnected: ${socket.id}`);
    });
});

// Enhanced Health Check with PostgreSQL support
app.get('/health', async (req, res) => {
    try {
        const stats = await DatabaseAdapter.getStats();
        
        // Get token status
        let tokenStatus = { status: 'unavailable' };
        if (tokenRefreshService) {
            tokenStatus = await tokenRefreshService.getTokenStatus();
        }
        
        res.json({
            status: 'OK',
            timestamp: new Date().toISOString(),
            version: '11.0.0-postgresql-token-refresh',
            service: 'TaskFlow Backend - PostgreSQL + Token Refresh',
            database: {
                type: DatabaseAdapter.getType(),
                connected: true,
                stats: stats || {}
            },
            clickup: {
                token_available: !!masterClickUpToken,
                token_status: tokenStatus,
                sync_service: realClickUpSync ? 'active' : 'inactive'
            },
            websocket: {
                connected_users: connectedUsers.size,
                active_rooms: teamRooms.size
            },
            services: {
                token_refresh: tokenRefreshService ? 'active' : 'inactive',
                background_sync: realClickUpSync ? 'active' : 'inactive'
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'ERROR',
            error: error.message,
            database: DatabaseAdapter.getType()
        });
    }
});

// User configuration with fallback
const USERS_CONFIG = [
    { email: 'yterayut@gmail.com', name: 'Teerayut Yeerahem', role: 'Admin', permissions: ['all'] },
    { email: 'chaiwutwck@gmail.com', name: 'ชัยวุฒิ ไวเชิงค้า', role: 'Manager', permissions: ['dashboard','analytics','team','projects'] },
    { email: 'muttana@gmail.com', name: 'มัทนพร แก้วอำไพ', role: 'Employee', permissions: ['dashboard','analytics'] },
    { email: 'chutithep@gmail.com', name: 'Chutithep Phakdeebut', role: 'Employee', permissions: ['dashboard','analytics'] },
    { email: 'jirapat@gmail.com', name: 'Jirapat Sripanya', role: 'Employee', permissions: ['dashboard','analytics'] },
    { email: 'nisareen@gmail.com', name: 'Nisareen Daklee', role: 'Employee', permissions: ['dashboard','analytics'] },
    { email: 'panuwat@gmail.com', name: 'PANUWAT PROMRAKSA', role: 'Employee', permissions: ['dashboard','analytics'] },
    { email: 'thammakit@gmail.com', name: 'Thammakit Ch', role: 'Employee', permissions: ['dashboard','analytics'] },
    { email: 'pong@gmail.com', name: 'Pong', role: 'Employee', permissions: ['dashboard','analytics'] },
    { email: 'athakorn@gmail.com', name: 'Athakorn NATUNG', role: 'Employee', permissions: ['dashboard','analytics'] },
    { email: 'sahatsawat@gmail.com', name: 'Sahatsawat Rimphongern', role: 'Employee', permissions: ['dashboard','analytics'] }
];

// Enhanced authentication with PostgreSQL support
app.post('/api/v2/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email) {
            return res.status(400).json({ success: false, message: 'Email is required' });
        }

        // Try database authentication first
        let user = null;
        try {
            let users = [];
            if (USE_POSTGRESQL && dbService.query) {
                const result = await dbService.query('SELECT * FROM users WHERE email = $1 AND is_active = $2', [email, true]);
                users = result.rows || result;
            } else if (db) {
                // SQLite fallback
                users = db.prepare('SELECT * FROM users WHERE email = ? AND is_active = ?').all(email, 1);
            }
            
            if (users.length > 0) {
                const dbUser = users[0];
                
                // Validate password if provided in database
                if (password && dbUser.password) {
                    const bcrypt = require('bcrypt');
                    const passwordMatch = await bcrypt.compare(password, dbUser.password);
                    if (passwordMatch) {
                        user = dbUser;
                        console.log(`[${new Date().toISOString()}] ✅ Database login successful for ${email}`);
                    } else {
                        console.log(`[${new Date().toISOString()}] ❌ Password mismatch for ${email}`);
                        return res.status(401).json({ success: false, message: 'Invalid password' });
                    }
                } else {
                    // No password in database, use user
                    user = dbUser;
                }
            }
        } catch (error) {
            console.warn('Database query failed, using config fallback:', error.message);
        }

        // Fallback to configuration
        if (!user) {
            const configUser = USERS_CONFIG.find(u => u.email === email);
            if (configUser) {
                user = {
                    email: configUser.email,
                    name: configUser.name,
                    role: configUser.role,
                    permissions: configUser.permissions
                };
            }
        }

        if (user) {
            req.session.user = {
                email: user.email,
                name: user.name,
                role: user.role,
                permissions: Array.isArray(user.permissions) ? user.permissions : JSON.parse(user.permissions || '[]'),
                loginTime: new Date().toISOString(),
                database: DatabaseAdapter.getType()
            };

            console.log(`[${new Date().toISOString()}] ✅ Login successful: ${user.name} (${user.role}) via ${DatabaseAdapter.getType()}`);

            res.json({
                success: true,
                message: 'Authentication successful',
                user: req.session.user
            });
        } else {
            res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Authentication error',
            error: error.message
        });
    }
});

// Enhanced dashboard analytics - REAL CLICKUP DATA ONLY
app.get('/api/v2/dashboard/analytics', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, message: 'Not authenticated' });
        }

        try {
            // Get ONLY real ClickUp data from database
            const tasks = await DatabaseAdapter.query('SELECT * FROM clickup_tasks');
            const members = await DatabaseAdapter.query('SELECT * FROM clickup_members');
            
            if (tasks.length === 0 && members.length === 0) {
                return res.json({
                    success: true,
                    data: {
                        message: "No real ClickUp data available",
                        dataSource: "Waiting for Real ClickUp Sync",
                        totalTasks: 0,
                        completedTasks: 0,
                        inProgressTasks: 0,
                        teamMembers: 0,
                        completionRate: 0,
                        performance: 'N/A',
                        recentActivities: [],
                        database: DatabaseAdapter.getType(),
                        lastUpdate: new Date().toISOString(),
                        sync_status: "Database empty - sync required"
                    }
                });
            }

            // Calculate real statistics from ClickUp data
            const mainTasks = tasks.filter(t => !t.parent_id || t.parent_id === '' || t.parent_id === null);
            const completedTasks = tasks.filter(t => t.status === 'complete' || t.status === 'closed');
            const inProgressTasks = tasks.filter(t => t.status === 'in progress' || t.status === 'in_progress');
            const overdueTasks = tasks.filter(t => {
                return t.due_date && new Date(t.due_date) < new Date() && 
                       t.status !== 'complete' && t.status !== 'closed';
            });

            const completionRate = tasks.length > 0 
                ? Math.round((completedTasks.length / tasks.length) * 100) 
                : 0;

            // Performance grade based on completion rate
            let performance = 'C';
            if (completionRate >= 90) performance = 'A+';
            else if (completionRate >= 80) performance = 'A';
            else if (completionRate >= 70) performance = 'B+';
            else if (completionRate >= 60) performance = 'B';

            // Real recent activities from ClickUp tasks
            const recentTasks = tasks
                .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
                .slice(0, 5);

            const analytics = {
                overview: {
                    total_tasks: tasks.length,
                    main_tasks: mainTasks.length,
                    subtasks: tasks.length - mainTasks.length,
                    completed_tasks: completedTasks.length,
                    in_progress_tasks: inProgressTasks.length,
                    overdue_tasks: overdueTasks.length
                },
                team_performance: {
                    active_members: members.length,
                    completion_rate: completionRate,
                    performance_grade: performance
                },
                recent_activity: recentTasks.map(task => ({
                    message: `${task.name.substring(0, 50)}${task.name.length > 50 ? '...' : ''}`,
                    timestamp: task.updated_at,
                    type: 'task_updated',
                    user: members.find(m => m.id === task.assignee_id)?.username || 'Unknown'
                })),
                data_source: 'Real ClickUp Data',
                database: DatabaseAdapter.getType(),
                last_update: new Date().toISOString(),
                members: members.map(m => ({
                    name: m.username,
                    email: m.email,
                    tasks_assigned: tasks.filter(t => t.assignee_id === m.id).length
                }))
            };

            res.json({
                success: true,
                data: analytics
            });

        } catch (error) {
            console.error('Database query error:', error.message);
            res.json({
                success: false,
                data: null,
                message: "Database error - cannot retrieve real ClickUp data",
                database: DatabaseAdapter.getType(),
                error: error.message
            });
        }

    } catch (error) {
        console.error('Analytics error:', error);
        res.status(500).json({
            success: false,
            message: 'Analytics error',
            error: error.message
        });
    }
});

// Auth verification
app.get('/api/v2/auth/verify', (req, res) => {
    if (req.session.user) {
        res.json({
            success: true,
            user: req.session.user
        });
    } else {
        res.status(401).json({
            success: false,
            message: 'Not authenticated'
        });
    }
});

// Logout endpoint
app.post('/api/v2/auth/logout', (req, res) => {
    if (req.session.user) {
        const userName = req.session.user.name;
        req.session.destroy((err) => {
            if (err) {
                console.error('Logout error:', err);
                return res.status(500).json({ success: false, message: 'Logout failed' });
            }
            
            console.log(`[${new Date().toISOString()}] 👋 Logout successful: ${userName}`);
            res.json({ success: true, message: 'Logged out successfully' });
        });
    } else {
        res.status(401).json({ success: false, message: 'Not authenticated' });
    }
});

// Component-specific endpoints - REAL DATA ONLY
app.get('/api/v2/tasks/my-tasks', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, message: 'Not authenticated' });
        }

        // Get real ClickUp tasks for current user
        const userEmail = req.session.user.email;
        
        try {
            console.log(`[${new Date().toISOString()}] 📋 Looking for user: ${userEmail}`);
            
            // Get user's member ID from database  
            let userMember;
            if (USE_POSTGRESQL && dbService.query) {
                const result = await dbService.query('SELECT id FROM clickup_members WHERE email = $1', [userEmail]);
                userMember = result.rows || result;
            } else {
                // SQLite fallback
                userMember = db.prepare('SELECT id FROM clickup_members WHERE email = ?').all(userEmail);
            }
            
            console.log(`[${new Date().toISOString()}] 📋 Found user members:`, userMember.length);
            
            if (userMember.length === 0) {
                return res.json({
                    success: true,
                    tasks: [],
                    message: `User ${userEmail} not found in ClickUp members - no tasks assigned`,
                    data_source: "Real ClickUp Data - User not in system"
                });
            }
            
            const userMemberId = userMember[0].id;
            console.log(`[${new Date().toISOString()}] 📋 User member ID: ${userMemberId}`);
            
            // Get tasks assigned to this user using the new assignment table structure
            let tasks = [];
            
            if (USE_POSTGRESQL && dbService.query) {
                // PostgreSQL query with joins
                const result = await dbService.query(`
                    SELECT DISTINCT
                        t.id, t.name, t.description, 
                        t.status_name as status, 
                        t.priority_name as priority, 
                        t.due_date, t.parent,
                        t.list_name, t.space_name, t.url,
                        ta.member_name as assigned_to
                    FROM clickup_tasks t
                    JOIN clickup_task_assignments ta ON t.id = ta.task_id
                    WHERE ta.member_id = $1
                    ORDER BY t.date_updated DESC
                `, [userMemberId.toString()]);
                tasks = result.rows || result;
            } else {
                // SQLite fallback with joins
                tasks = db.prepare(`
                    SELECT DISTINCT
                        t.id, t.name, t.description, 
                        t.status, 
                        t.priority, 
                        t.due_date, t.parent_id,
                        ta.member_name as assigned_to,
                        'Real ClickUp Assignment' as data_source
                    FROM clickup_tasks t
                    JOIN clickup_task_assignments ta ON t.id = ta.task_id
                    WHERE ta.member_id = ?
                    ORDER BY t.date_updated DESC
                `).all(userMemberId.toString());
            }
            
            console.log(`[${new Date().toISOString()}] 📋 Found ${tasks.length} real assigned tasks for user ${userEmail} (ID: ${userMemberId})`);

            res.json({
                success: true,
                tasks: tasks,
                total_count: tasks.length,
                user_email: userEmail,
                data_source: "Real ClickUp Data",
                last_sync: new Date().toISOString()
            });
        } catch (dbError) {
            console.warn('Database error, no real data available:', dbError.message);
            res.json({
                success: false,
                tasks: [],
                total_count: 0,
                user_email: userEmail,
                message: "Database error - cannot retrieve real ClickUp data",
                error: dbError.message
            });
        }

    } catch (error) {
        console.error('My tasks error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching tasks',
            error: error.message
        });
    }
});

app.get('/api/v2/team/overview', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, message: 'Not authenticated' });
        }

        try {
            // Real team data from ClickUp
            const members = await DatabaseAdapter.query('SELECT * FROM clickup_members');
            const tasks = await DatabaseAdapter.query('SELECT status_name as status, assignee_id FROM clickup_tasks');
            
            // Calculate real team performance
            const teamStats = {
                total_members: members.length,
                active_members: members.filter(m => m.is_active).length,
                total_tasks: tasks.length,
                completed_tasks: tasks.filter(t => t.status === 'complete' || t.status === 'closed').length,
                in_progress_tasks: tasks.filter(t => t.status === 'in progress').length,
                members: members.map(m => ({
                    id: m.id,
                    name: m.username,
                    email: m.email,
                    color: m.color,
                    initials: m.initials,
                    role: m.role,
                    tasks_assigned: tasks.filter(t => t.assignee_id === m.id).length
                }))
            };

            // Transform for frontend compatibility
            const teams = [{
                team_name: "Teerayut Yeerahem's Workspace",
                member_count: teamStats.active_members,
                total_tasks: teamStats.total_tasks,
                completed_tasks: teamStats.completed_tasks,
                members: teamStats.members
            }];
            
            res.json({
                success: true,
                teams: teams,
                data_source: "Real ClickUp Data",
                last_sync: new Date().toISOString()
            });
        } catch (dbError) {
            console.warn('Database error, no real team data:', dbError.message);
            res.json({
                success: false,
                teams: [],
                message: "Database error - cannot retrieve real ClickUp team data",
                error: "Database not populated with real ClickUp data"
            });
        }

    } catch (error) {
        console.error('Team overview error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching team data',
            error: error.message
        });
    }
});

app.get('/api/v2/projects', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, message: 'Not authenticated' });
        }

        try {
            // Real project data from ClickUp spaces and lists
            const spaces = await DatabaseAdapter.query('SELECT * FROM clickup_spaces');
            const lists = await DatabaseAdapter.query('SELECT * FROM clickup_lists');
            const tasks = await DatabaseAdapter.query('SELECT list_id, status_name as status FROM clickup_tasks');

            const projects = spaces.map(space => {
                const spaceLists = lists.filter(l => l.space_id === space.id);
                const spaceTasks = tasks.filter(t => spaceLists.some(l => l.id === t.list_id));
                
                return {
                    id: space.id,
                    name: space.name,
                    color: space.color,
                    lists: spaceLists.map(list => ({
                        id: list.id,
                        name: list.name,
                        task_count: spaceTasks.filter(t => t.list_id === list.id).length,
                        completed_tasks: spaceTasks.filter(t => 
                            t.list_id === list.id && 
                            (t.status === 'complete' || t.status === 'closed')
                        ).length
                    })),
                    total_tasks: spaceTasks.length,
                    completed_tasks: spaceTasks.filter(t => t.status === 'complete' || t.status === 'closed').length,
                    completion_rate: spaceTasks.length > 0 
                        ? Math.round((spaceTasks.filter(t => t.status === 'complete' || t.status === 'closed').length / spaceTasks.length) * 100)
                        : 0
                };
            });

            // Transform projects for frontend compatibility
            const transformedProjects = projects.map(project => ({
                name: project.name,
                color: project.color || '#3b82f6',
                list_count: project.lists.length,
                task_count: project.total_tasks,
                completed_count: project.completed_tasks,
                completion_rate: project.completion_rate
            }));
            
            res.json({
                success: true,
                projects: transformedProjects,
                total_projects: transformedProjects.length,
                data_source: "Real ClickUp Data",
                last_sync: new Date().toISOString()
            });
        } catch (dbError) {
            console.warn('Database error, no real project data:', dbError.message);
            res.json({
                success: false,
                projects: [],
                message: "Database error - cannot retrieve real ClickUp project data",
                error: "Database not populated with real ClickUp data"
            });
        }

    } catch (error) {
        console.error('Projects error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching projects',
            error: error.message
        });
    }
});

// Token management endpoints
app.get('/api/v2/admin/token/status', async (req, res) => {
    try {
        if (!req.session.user || req.session.user.role !== 'Admin') {
            return res.status(403).json({ success: false, message: 'Admin access required' });
        }

        const tokenStatus = tokenRefreshService ? await tokenRefreshService.getTokenStatus() : null;
        
        res.json({
            success: true,
            token_status: tokenStatus,
            refresh_service: tokenRefreshService ? 'active' : 'inactive'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.post('/api/v2/admin/token/auto-refresh', async (req, res) => {
    try {
        if (!req.session.user || req.session.user.role !== 'Admin') {
            return res.status(403).json({ success: false, message: 'Admin access required' });
        }

        if (tokenRefreshService) {
            // Trigger immediate auto refresh check
            const result = await tokenRefreshService.checkAndRefreshToken();
            
            res.json({
                success: true,
                auto_refresh_triggered: true,
                token_valid: result,
                message: result ? 'Auto refresh completed - token is valid' : 'Auto refresh detected expired token - manual intervention needed',
                refresh_interval: '24 hours',
                next_auto_check: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
            });
        } else {
            res.status(503).json({
                success: false,
                message: 'Auto token refresh service not available'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Auto refresh status endpoint
app.get('/api/v2/admin/token/auto-refresh/status', async (req, res) => {
    try {
        if (!req.session.user || req.session.user.role !== 'Admin') {
            return res.status(403).json({ success: false, message: 'Admin access required' });
        }

        const tokenStatus = tokenRefreshService ? await tokenRefreshService.getTokenStatus() : null;
        
        res.json({
            success: true,
            auto_refresh_active: tokenRefreshService ? true : false,
            refresh_interval: '24 hours (86400000ms)',
            token_status: tokenStatus,
            service_uptime: tokenRefreshService ? 'Active since server start' : 'Inactive',
            last_auto_check: tokenStatus?.lastUsed || 'Never',
            next_scheduled_check: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Initialize database and start server
async function startServer() {
    try {
        // Initialize database
        await initializeDatabase();
        
        // Initialize Token Refresh Service
        console.log(`[${new Date().toISOString()}] 🔑 Initializing Token Refresh Service...`);
        tokenRefreshService = new TokenRefreshService();
        tokenRefreshService.startAutoRefresh();

        // Initialize ClickUp sync service
        if (masterClickUpToken) {
            console.log(`[${new Date().toISOString()}] 🚀 Initializing Real ClickUp Sync Service...`);
            realClickUpSync = new RealClickUpSyncService(db, {});
            realClickUpSync.setAccessToken(masterClickUpToken);
            
            // Start background sync
            setTimeout(() => {
                if (realClickUpSync.startRealTimeSync) {
                    realClickUpSync.startRealTimeSync();
                } else if (realClickUpSync.startBackgroundSync) {
                    realClickUpSync.startBackgroundSync();
                }
                console.log(`[${new Date().toISOString()}] 🔄 Background sync started`);
            }, 5000);
        }

        // Start server
        server.listen(PORT, () => {
            console.log(`[${new Date().toISOString()}] 🚀 TaskFlow Pro PostgreSQL Enhanced Server started on port ${PORT}`);
            console.log(`[${new Date().toISOString()}] 🐘 Database: ${DatabaseAdapter.getType()}`);
            console.log(`[${new Date().toISOString()}] 🔗 Health check: http://192.168.20.10:${PORT}/health`);
            console.log(`[${new Date().toISOString()}] 🎯 Ready for production with enhanced database support!`);
        });

    } catch (error) {
        console.error('Server startup error:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Graceful shutdown initiated...');
    
    // Stop token refresh service
    if (tokenRefreshService) {
        tokenRefreshService.stopAutoRefresh();
    }
    
    // Stop database connections
    if (dbService && dbService.isConnected) {
        await dbService.disconnect();
    }
    
    if (db && db.close) {
        db.close();
    }
    
    console.log('✅ Shutdown complete');
    process.exit(0);
});

// Start the server
startServer();