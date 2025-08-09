/**
 * TaskFlow Pro - Complete Authentication Backend
 * Combines ClickUp integration with PostgreSQL authentication
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const axios = require('axios');

// Import authentication modules
const authRoutes = require('./auth/authRoutes');
const { ClickUpOAuth } = require('./auth/clickupOAuth');
const { JWTAuth, authenticateToken } = require('./auth/jwt');
const { AuthService } = require('./auth/authService');

const app = express();
const PORT = process.env.PORT || 7812;

// CORS configuration
app.use(cors({
    origin: [
        'http://192.168.20.10:8888',
        'http://localhost:8888',
        'http://127.0.0.1:8888'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
}));

// Basic middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Session configuration for OAuth state
app.use(session({
    secret: process.env.SESSION_SECRET || 'taskflow-session-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 10 * 60 * 1000 // 10 minutes for OAuth flow
    }
}));

// Rate limiting
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
        error: 'Too many requests from this IP, please try again later.'
    }
});

app.use('/api/', generalLimiter);

// Environment validation
const requiredEnvVars = [
    'JWT_SECRET',
    'DB_HOST',
    'DB_NAME',
    'DB_USER',
    'DB_PASSWORD',
    'CLICKUP_CLIENT_ID',
    'CLICKUP_CLIENT_SECRET'
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingEnvVars.length > 0) {
    console.error('❌ Missing required environment variables:', missingEnvVars);
    process.exit(1);
}

console.log('✅ Environment variables validated');

// ============================
// AUTHENTICATION ROUTES
// ============================

// Mount authentication routes
app.use('/api/auth', authRoutes);

// ============================
// CLICKUP OAUTH ROUTES
// ============================

/**
 * GET /auth/clickup
 * Initiate ClickUp OAuth flow (master user only)
 */
app.get('/auth/clickup', (req, res) => {
    try {
        // Generate state for CSRF protection
        const state = 'taskflow_' + Date.now() + Math.random().toString(36).substr(2);
        req.session.oauth_state = state;
        
        const authUrl = ClickUpOAuth.getAuthorizationUrl() + `&state=${state}`;
        
        console.log(`[OAUTH] Redirecting to ClickUp OAuth: ${authUrl}`);
        res.redirect(authUrl);
        
    } catch (error) {
        console.error('[OAUTH] Error initiating OAuth flow:', error);
        res.redirect('http://192.168.20.10:8888/?error=oauth_init_failed');
    }
});

/**
 * GET / (OAuth callback)
 * Handle ClickUp OAuth callback
 */
app.get('/', async (req, res) => {
    // Check if this is OAuth callback
    if (!req.query.code) {
        return res.json({
            service: 'TaskFlow Pro Authentication Backend',
            version: '2.0.0',
            features: [
                'PostgreSQL Database',
                'JWT + HttpOnly Cookies',
                'bcrypt Password Hashing',
                'Master User ClickUp OAuth',
                'Role-based Access Control'
            ],
            timestamp: new Date().toISOString(),
            status: 'Ready'
        });
    }

    const { code, state, error } = req.query;
    
    console.log(`[OAUTH] Callback received - Code: ${code ? 'YES' : 'NO'}, State: ${state}, Error: ${error || 'NONE'}`);
    
    if (error) {
        console.error(`[OAUTH] Authorization error: ${error}`);
        return res.redirect(`http://192.168.20.10:8888/?error=${encodeURIComponent(error)}`);
    }
    
    if (!code) {
        console.error('[OAUTH] No authorization code received');
        return res.redirect('http://192.168.20.10:8888/?error=no_authorization_code');
    }
    
    // Validate state parameter (CSRF protection)
    if (req.session.oauth_state && state !== req.session.oauth_state) {
        console.error(`[OAUTH] State mismatch: expected ${req.session.oauth_state}, got ${state}`);
        return res.redirect('http://192.168.20.10:8888/?error=invalid_state');
    }
    
    try {
        console.log('[OAUTH] Processing ClickUp OAuth callback...');
        
        // Handle OAuth callback
        const result = await ClickUpOAuth.handleCallback(code);
        
        if (!result.success) {
            console.error('[OAUTH] Callback processing failed:', result.error);
            return res.redirect(`http://192.168.20.10:8888/?error=${encodeURIComponent(result.error)}`);
        }
        
        const { jwt, user, clickupUser } = result;
        
        // Fix cross-domain cookie issue by setting domain properly
        const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax', // Changed from 'strict' to 'lax' for cross-port compatibility
            maxAge: 24 * 60 * 60 * 1000, // 24 hours
            path: '/',
            domain: '192.168.20.10' // Set domain to work across ports
        };
        
        console.log('[DEBUG COOKIE] Setting cookie with options:', cookieOptions);
        res.cookie('taskflow_token', jwt, cookieOptions);
        
        // Also send token in URL for frontend to handle if cookie fails
        const tokenParam = encodeURIComponent(jwt);
        
        // Clear OAuth state
        req.session.oauth_state = null;
        
        console.log(`[OAUTH] Master user login successful: ${user.email} (ClickUp: ${clickupUser.username})`);
        console.log(`[DEBUG] Redirecting with token length: ${jwt.length}`);
        
        // Redirect to dashboard with success and token
        res.redirect(`http://192.168.20.10:8888/?auth=success&user=${encodeURIComponent(user.email)}&role=${user.role}&token=${tokenParam}`);
        
    } catch (error) {
        console.error('[OAUTH] Callback error:', error);
        res.redirect(`http://192.168.20.10:8888/?error=${encodeURIComponent('oauth_callback_failed')}`);
    }
});

// ============================
// CLICKUP API ROUTES
// ============================

/**
 * GET /api/v1/clickup-data
 * Get comprehensive ClickUp data using stored tokens
 */
app.get('/api/v1/clickup-data', authenticateToken, async (req, res) => {
    try {
        console.log('[CLICKUP] Fetching comprehensive ClickUp data...');
        
        // Get valid access token
        const tokenResult = await ClickUpOAuth.getValidAccessToken();
        
        if (!tokenResult.success) {
            return res.status(401).json({
                success: false,
                error: 'ClickUp not connected or tokens expired',
                message: 'Master user needs to login via ClickUp OAuth'
            });
        }
        
        const accessToken = tokenResult.accessToken;
        console.log('[CLICKUP] Using valid access token, length:', accessToken.length);
        
        // Helper function to call ClickUp API
        async function callClickUpAPI(endpoint) {
            const url = `https://api.clickup.com/api/v2${endpoint}`;
            console.log(`[CLICKUP API] Calling: ${endpoint}`);
            
            const response = await axios.get(url, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            });
            
            return response.data;
        }
        
        // Fetch comprehensive ClickUp data
        console.log('[CLICKUP] Step 1: Fetching teams...');
        const teamsData = await callClickUpAPI('/team');
        
        if (!teamsData.teams || teamsData.teams.length === 0) {
            return res.json({
                success: true,
                data: {
                    source: 'Real ClickUp Data - Production',
                    teams: [],
                    spaces: [],
                    folders: [],
                    lists: [],
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
        
        console.log(`[CLICKUP] Found ${teamsData.teams.length} teams`);
        
        // Initialize data structures
        let allSpaces = [];
        let allFolders = [];
        let allLists = [];
        let allTasks = [];
        
        // Process each team
        for (const team of teamsData.teams) {
            try {
                console.log(`[CLICKUP] Processing team: ${team.name} (${team.id})`);
                
                // Get spaces for this team
                const spacesData = await callClickUpAPI(`/team/${team.id}/space?archived=false`);
                console.log(`[CLICKUP] Found ${spacesData.spaces?.length || 0} spaces in team ${team.name}`);
                
                for (const space of spacesData.spaces || []) {
                    allSpaces.push({
                        ...space,
                        team_id: team.id,
                        team_name: team.name
                    });
                    
                    try {
                        // Get folders in this space
                        const foldersData = await callClickUpAPI(`/space/${space.id}/folder?archived=false`);
                        console.log(`[CLICKUP] Found ${foldersData.folders?.length || 0} folders in space ${space.name}`);
                        
                        for (const folder of foldersData.folders || []) {
                            allFolders.push({
                                ...folder,
                                space_id: space.id,
                                space_name: space.name,
                                team_id: team.id,
                                team_name: team.name
                            });
                            
                            try {
                                // Get lists in this folder
                                const folderListsData = await callClickUpAPI(`/folder/${folder.id}/list?archived=false`);
                                console.log(`[CLICKUP] Found ${folderListsData.lists?.length || 0} lists in folder ${folder.name}`);
                                
                                for (const list of folderListsData.lists || []) {
                                    allLists.push({
                                        ...list,
                                        folder_id: folder.id,
                                        folder_name: folder.name,
                                        space_id: space.id,
                                        space_name: space.name,
                                        team_id: team.id,
                                        team_name: team.name
                                    });
                                    
                                    // Get tasks from this list
                                    try {
                                        const tasksData = await callClickUpAPI(`/list/${list.id}/task?archived=false&include_closed=true&subtasks=true`);
                                        console.log(`[CLICKUP] Found ${tasksData.tasks?.length || 0} tasks in list ${list.name}`);
                                        
                                        for (const task of tasksData.tasks || []) {
                                            allTasks.push({
                                                ...task,
                                                list_id: list.id,
                                                list_name: list.name,
                                                folder_id: folder.id,
                                                folder_name: folder.name,
                                                space_id: space.id,
                                                space_name: space.name,
                                                team_id: team.id,
                                                team_name: team.name
                                            });
                                        }
                                    } catch (taskError) {
                                        console.warn(`[CLICKUP] Error fetching tasks for list ${list.name}:`, taskError.message);
                                    }
                                }
                            } catch (listError) {
                                console.warn(`[CLICKUP] Error fetching lists for folder ${folder.name}:`, listError.message);
                            }
                        }
                        
                        // Also get folderless lists (lists directly in space)
                        try {
                            const spaceListsData = await callClickUpAPI(`/space/${space.id}/list?archived=false`);
                            console.log(`[CLICKUP] Found ${spaceListsData.lists?.length || 0} folderless lists in space ${space.name}`);
                            
                            for (const list of spaceListsData.lists || []) {
                                allLists.push({
                                    ...list,
                                    folder_id: null,
                                    folder_name: 'No Folder',
                                    space_id: space.id,
                                    space_name: space.name,
                                    team_id: team.id,
                                    team_name: team.name
                                });
                                
                                // Get tasks from this folderless list
                                try {
                                    const tasksData = await callClickUpAPI(`/list/${list.id}/task?archived=false&include_closed=true&subtasks=true`);
                                    console.log(`[CLICKUP] Found ${tasksData.tasks?.length || 0} tasks in folderless list ${list.name}`);
                                    
                                    for (const task of tasksData.tasks || []) {
                                        allTasks.push({
                                            ...task,
                                            list_id: list.id,
                                            list_name: list.name,
                                            folder_id: null,
                                            folder_name: 'No Folder',
                                            space_id: space.id,
                                            space_name: space.name,
                                            team_id: team.id,
                                            team_name: team.name
                                        });
                                    }
                                } catch (taskError) {
                                    console.warn(`[CLICKUP] Error fetching tasks for folderless list ${list.name}:`, taskError.message);
                                }
                            }
                        } catch (spaceListError) {
                            console.warn(`[CLICKUP] Error fetching folderless lists for space ${space.name}:`, spaceListError.message);
                        }
                        
                    } catch (folderError) {
                        console.warn(`[CLICKUP] Error fetching folders for space ${space.name}:`, folderError.message);
                    }
                }
            } catch (teamError) {
                console.warn(`[CLICKUP] Error processing team ${team.name}:`, teamError.message);
            }
        }
        
        // Calculate workload statistics
        const completedTasks = allTasks.filter(task => task.status?.status === 'complete' || task.status?.status === 'closed').length;
        const inProgressTasks = allTasks.filter(task => task.status?.status === 'in progress' || task.status?.status === 'in_progress').length;
        const overdueTasks = allTasks.filter(task => {
            if (!task.due_date) return false;
            return new Date(parseInt(task.due_date)) < new Date() && task.status?.status !== 'complete' && task.status?.status !== 'closed';
        }).length;
        
        console.log(`[CLICKUP] Data summary:`, {
            teams: teamsData.teams.length,
            spaces: allSpaces.length,
            folders: allFolders.length,
            lists: allLists.length,
            tasks: allTasks.length,
            completed: completedTasks,
            inProgress: inProgressTasks,
            overdue: overdueTasks
        });
        
        // Return comprehensive data
        res.json({
            success: true,
            data: {
                source: 'Real ClickUp Data - Production',
                teams: teamsData.teams,
                spaces: allSpaces,
                folders: allFolders,
                lists: allLists,
                tasks: allTasks,
                workload: {
                    totalTasks: allTasks.length,
                    completedTasks,
                    inProgressTasks,
                    overdueTasks
                },
                fetched_at: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('[CLICKUP] Error fetching data:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch ClickUp data',
            details: error.message
        });
    }
});

/**
 * GET /api/v1/clickup-status
 * Check ClickUp connection status
 */
app.get('/api/v1/clickup-status', authenticateToken, async (req, res) => {
    try {
        const tokensResult = await AuthService.getClickUpTokens();
        
        res.json({
            success: true,
            connected: tokensResult.success,
            tokens: tokensResult.success ? {
                hasAccessToken: !!tokensResult.tokens.accessToken,
                hasRefreshToken: !!tokensResult.tokens.refreshToken,
                isExpired: tokensResult.tokens.isExpired,
                expiresAt: tokensResult.tokens.expiresAt,
                masterEmail: tokensResult.tokens.masterEmail
            } : null
        });
        
    } catch (error) {
        console.error('[CLICKUP] Status check error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to check ClickUp status'
        });
    }
});

// ============================
// LEGACY COMPATIBILITY ROUTES
// ============================

/**
 * POST /api/auth/login (Legacy route)
 * For backward compatibility with existing frontend
 */
app.post('/api/auth/login', async (req, res) => {
    // Forward to new auth routes
    req.url = '/login';
    authRoutes(req, res);
});

// ============================
// HEALTH CHECK
// ============================

app.get('/health', async (req, res) => {
    try {
        // Test database connection
        const { Database } = require('./database/config');
        await Database.query('SELECT 1');
        
        // Check ClickUp tokens
        const tokensResult = await AuthService.getClickUpTokens();
        
        res.json({
            status: 'OK',
            timestamp: new Date().toISOString(),
            service: 'TaskFlow Pro Authentication Service v2.0',
            version: '2.0.0',
            features: [
                'PostgreSQL Database',
                'JWT + HttpOnly Cookies',
                'bcrypt Password Hashing',
                'Master User ClickUp OAuth',
                'Role-based Access Control'
            ],
            database: 'Connected',
            clickup: tokensResult.success ? 'Connected' : 'Disconnected',
            environment: process.env.NODE_ENV || 'development'
        });
        
    } catch (error) {
        console.error('[HEALTH] Health check failed:', error);
        res.status(503).json({
            status: 'ERROR',
            timestamp: new Date().toISOString(),
            service: 'TaskFlow Pro Authentication Service v2.0',
            version: '2.0.0',
            features: [
                'PostgreSQL Database',
                'JWT + HttpOnly Cookies',
                'bcrypt Password Hashing',
                'Master User ClickUp OAuth',
                'Role-based Access Control'
            ],
            database: 'Disconnected',
            error: error.message
        });
    }
});

// ============================
// ERROR HANDLING
// ============================

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        path: req.path,
        method: req.method
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('[ERROR] Global error handler:', err);
    
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// ============================
// SERVER STARTUP
// ============================

app.listen(PORT, '0.0.0.0', () => {
    console.log('🚀 TaskFlow Pro Authentication Backend v2.0');
    console.log(`🔗 Server running on: http://0.0.0.0:${PORT}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
    console.log(`🔐 ClickUp OAuth: http://localhost:${PORT}/auth/clickup`);
    console.log('');
    console.log('🎯 Features:');
    console.log('   ✅ PostgreSQL Database with bcrypt password hashing');
    console.log('   ✅ JWT with HttpOnly Secure Cookies');
    console.log('   ✅ Master User ClickUp OAuth (yterayut@gmail.com only)');
    console.log('   ✅ Regular User Email/Password Authentication');
    console.log('   ✅ Role-based Access Control (master/user)');
    console.log('   ✅ Rate Limiting and Security Middleware');
    console.log('   ✅ CORS configured for frontend');
    console.log('');
    console.log('🔧 Environment:', process.env.NODE_ENV || 'development');
    console.log('🔧 Database:', process.env.DB_HOST, ':', process.env.DB_PORT);
    console.log('');
    console.log('📋 API Endpoints:');
    console.log('   POST /api/auth/login              - User login (email/password)');
    console.log('   POST /api/auth/logout             - User logout');
    console.log('   GET  /api/auth/verify             - Verify JWT token');
    console.log('   POST /api/auth/refresh            - Refresh JWT token');
    console.log('   GET  /api/auth/profile            - Get user profile');
    console.log('   POST /api/auth/change-password    - Change password');
    console.log('   GET  /auth/clickup                - ClickUp OAuth (master only)');
    console.log('   GET  /api/v1/clickup-data         - ClickUp API data');
    console.log('   GET  /api/v1/clickup-status       - ClickUp connection status');
    console.log('   GET  /health                      - Health check');
    console.log('');
    console.log('👤 Demo Accounts:');
    console.log('   Master: yterayut@gmail.com / 12345 (ClickUp OAuth)');
    console.log('   User: chaiwutwck@gmail.com / 12345 (Email/Password)');
    console.log('   User: Any other email from database / 12345');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🛑 SIGINT received, shutting down gracefully...');
    process.exit(0);
});

module.exports = app;