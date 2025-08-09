const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 779;

// Load user configuration
const usersConfigPath = path.join(__dirname, 'users_config.json');
let usersConfig = {};

try {
    const configData = fs.readFileSync(usersConfigPath, 'utf8');
    usersConfig = JSON.parse(configData);
    console.log(`Loaded ${usersConfig.users.length} users from configuration`);
} catch (error) {
    console.error('Error loading users configuration:', error.message);
    process.exit(1);
}

// Middleware
app.use(cors({
    origin: ['http://192.168.20.10:8080', 'http://localhost:8080'],
    credentials: true
}));
app.use(express.json());

// In-memory session storage (in production, use Redis)
let userSessions = new Map();

// Generate session ID
function generateSessionId() {
    return require('crypto').randomBytes(32).toString('hex');
}

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        service: 'TaskFlow Auth Service',
        timestamp: new Date().toISOString(),
        version: '1.0.0-email-auth',
        total_users: usersConfig.users.length,
        active_sessions: userSessions.size
    });
});

// Login endpoint
app.post('/api/v1/auth/login', (req, res) => {
    const { email, password } = req.body;
    
    console.log(`[${new Date().toISOString()}] Login attempt for email: ${email}`);
    
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
    
    // Create session
    const sessionId = generateSessionId();
    const sessionData = {
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        permissions: user.permissions,
        loginTime: new Date().toISOString(),
        lastActivity: new Date().toISOString()
    };
    
    userSessions.set(sessionId, sessionData);
    
    console.log(`[${new Date().toISOString()}] Login successful for ${user.name} (${user.role})`);
    
    res.json({
        success: true,
        sessionId: sessionId,
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            permissions: user.permissions
        },
        message: 'Login successful'
    });
});

// Logout endpoint
app.post('/api/v1/auth/logout', (req, res) => {
    const sessionId = req.headers.authorization?.replace('Bearer ', '');
    
    if (sessionId && userSessions.has(sessionId)) {
        const sessionData = userSessions.get(sessionId);
        userSessions.delete(sessionId);
        console.log(`[${new Date().toISOString()}] User ${sessionData.name} logged out`);
    }
    
    res.json({
        success: true,
        message: 'Logged out successfully'
    });
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
            permissions: sessionData.permissions
        },
        session: {
            loginTime: sessionData.loginTime,
            lastActivity: sessionData.lastActivity
        }
    });
});

// Get user list (Manager only)
app.get('/api/v1/users', (req, res) => {
    const sessionId = req.headers.authorization?.replace('Bearer ', '');
    
    if (!sessionId || !userSessions.has(sessionId)) {
        return res.status(401).json({
            success: false,
            error: 'Authentication required'
        });
    }
    
    const sessionData = userSessions.get(sessionId);
    
    // Check if user is Manager
    if (sessionData.role !== 'Manager') {
        return res.status(403).json({
            success: false,
            error: 'Access denied. Manager role required.'
        });
    }
    
    // Return user list without passwords
    const userList = usersConfig.users.map(user => ({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        permissions: user.permissions
    }));
    
    res.json({
        success: true,
        users: userList,
        roles: usersConfig.roles
    });
});

// Dashboard data endpoint (role-based access)
app.get('/api/v1/dashboard', (req, res) => {
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
    
    // Generate role-based dashboard data
    const dashboardData = {
        user: {
            id: sessionData.userId,
            name: sessionData.name,
            role: sessionData.role,
            permissions: sessionData.permissions
        },
        kpis: {
            totalTasks: sessionData.role === 'Manager' ? 45 : sessionData.role === 'Team Lead' ? 28 : 12,
            completedTasks: sessionData.role === 'Manager' ? 32 : sessionData.role === 'Team Lead' ? 18 : 8,
            inProgressTasks: sessionData.role === 'Manager' ? 10 : sessionData.role === 'Team Lead' ? 8 : 3,
            overdueTasks: sessionData.role === 'Manager' ? 3 : sessionData.role === 'Team Lead' ? 2 : 1,
            teamMembers: sessionData.role === 'Manager' ? 11 : sessionData.role === 'Team Lead' ? 6 : 1
        },
        workload: {
            totalTasks: sessionData.role === 'Manager' ? 45 : sessionData.role === 'Team Lead' ? 28 : 12,
            completedTasks: sessionData.role === 'Manager' ? 32 : sessionData.role === 'Team Lead' ? 18 : 8,
            inProgressTasks: sessionData.role === 'Manager' ? 10 : sessionData.role === 'Team Lead' ? 8 : 3,
            overdueTasks: sessionData.role === 'Manager' ? 3 : sessionData.role === 'Team Lead' ? 2 : 1
        },
        recentActivities: [
            {
                id: 1,
                message: `Task updated by ${sessionData.name}`,
                time: new Date().toLocaleString(),
                user: sessionData.name,
                task_id: 'T001'
            },
            {
                id: 2,
                message: 'Team meeting scheduled',
                time: new Date(Date.now() - 1800000).toLocaleString(),
                user: 'System',
                task_id: 'T002'
            }
        ],
        teams: sessionData.role === 'Manager' ? [
            { id: 1, name: 'Development Team', members: 6, color: '#3498db' },
            { id: 2, name: 'Design Team', members: 3, color: '#e74c3c' },
            { id: 3, name: 'QA Team', members: 2, color: '#2ecc71' }
        ] : sessionData.role === 'Team Lead' ? [
            { id: 1, name: 'Development Team', members: 6, color: '#3498db' }
        ] : [],
        source: 'email-auth-system',
        timestamp: new Date().toISOString()
    };
    
    res.json({
        success: true,
        data: dashboardData
    });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 TaskFlow Auth Service running on port ${PORT}`);
    console.log(`🔗 Health check: http://192.168.20.10:${PORT}/health`);
    console.log(`🔐 Login endpoint: http://192.168.20.10:${PORT}/api/v1/auth/login`);
    console.log(`📊 Dashboard endpoint: http://192.168.20.10:${PORT}/api/v1/dashboard`);
    console.log(`👥 Users loaded: ${usersConfig.users.length}`);
    console.log(`📋 Roles available: ${Object.keys(usersConfig.roles).join(', ')}`);
});

module.exports = app;