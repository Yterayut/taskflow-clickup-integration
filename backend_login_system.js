const express = require('express');
const cors = require('cors');
const axios = require('axios');
const session = require('express-session');
const bcrypt = require('bcryptjs');

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

// User Database with predefined accounts
const USERS_DATABASE = {
    'yterayut@gmail.com': {
        id: 1,
        name: 'Teerayut Yeerahem',
        email: 'yterayut@gmail.com',
        role: 'Manager',
        department: 'Management',
        password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // 12345
        status: 'active',
        createdAt: '2025-01-01',
        avatar: null,
        performanceScore: 95
    },
    'chaiwutwck@gmail.com': {
        id: 2,
        name: 'Chaiwut Waichuengka',
        email: 'chaiwutwck@gmail.com',
        role: 'Team Lead',
        department: 'Development',
        password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // 12345
        status: 'active',
        createdAt: '2025-01-01',
        avatar: null,
        performanceScore: 92,
        teamMembers: [3, 4, 6, 7, 9, 11]
    },
    'atthakorn.na@ku.th': {
        id: 3,
        name: 'Athakorn NATUNG',
        email: 'atthakorn.na@ku.th',
        role: 'Employee',
        department: 'Development',
        password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // 12345
        status: 'active',
        createdAt: '2025-01-01',
        avatar: null,
        performanceScore: 88,
        teamLeadId: 2
    },
    'sahassavas.rim@gmail.com': {
        id: 4,
        name: 'Sahatsawat Rimphongern',
        email: 'sahassavas.rim@gmail.com',
        role: 'Employee',
        department: 'Development',
        password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // 12345
        status: 'active',
        createdAt: '2025-01-01',
        avatar: null,
        performanceScore: 91,
        teamLeadId: 2
    },
    'primshi1719@gmail.com': {
        id: 5,
        name: 'Matthanaporn Kaew-umpai',
        email: 'primshi1719@gmail.com',
        role: 'Employee',
        department: 'Design',
        password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // 12345
        status: 'active',
        createdAt: '2025-01-01',
        avatar: null,
        performanceScore: 94,
        teamLeadId: null
    },
    'panuwantung@gmail.com': {
        id: 6,
        name: 'PANUWAT PROMRAKSA',
        email: 'panuwantung@gmail.com',
        role: 'Employee',
        department: 'Development',
        password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // 12345
        status: 'active',
        createdAt: '2025-01-01',
        avatar: null,
        performanceScore: 86,
        teamLeadId: 2
    },
    'jirapat.sripanya@gmail.com': {
        id: 7,
        name: 'Jirapat Sripanya',
        email: 'jirapat.sripanya@gmail.com',
        role: 'Employee',
        department: 'Development',
        password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // 12345
        status: 'active',
        createdAt: '2025-01-01',
        avatar: null,
        performanceScore: 89,
        teamLeadId: 2
    },
    'chutithep_ar@kkumail.com': {
        id: 8,
        name: 'Chutithep Phakdeebut',
        email: 'chutithep_ar@kkumail.com',
        role: 'Employee',
        department: 'QA',
        password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // 12345
        status: 'active',
        createdAt: '2025-01-01',
        avatar: null,
        performanceScore: 93,
        teamLeadId: null
    },
    'pongsanzakom@gmail.com': {
        id: 9,
        name: 'Pong',
        email: 'pongsanzakom@gmail.com',
        role: 'Employee',
        department: 'Development',
        password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // 12345
        status: 'active',
        createdAt: '2025-01-01',
        avatar: null,
        performanceScore: 87,
        teamLeadId: 2
    },
    'nisareen.dk@gmail.com': {
        id: 10,
        name: 'Nisareen Daklee',
        email: 'nisareen.dk@gmail.com',
        role: 'Employee',
        department: 'Design',
        password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // 12345
        status: 'active',
        createdAt: '2025-01-01',
        avatar: null,
        performanceScore: 90,
        teamLeadId: null
    },
    'jthammakit2546@gmail.com': {
        id: 11,
        name: 'Thammakit Ch',
        email: 'jthammakit2546@gmail.com',
        role: 'Employee',
        department: 'Development',
        password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // 12345
        status: 'active',
        createdAt: '2025-01-01',
        avatar: null,
        performanceScore: 85,
        teamLeadId: 2
    }
};

// Sample Tasks Database
const TASKS_DATABASE = {
    1: {
        id: 1,
        name: 'Implement User Authentication System',
        description: 'Create secure login system with role-based access control',
        assigneeId: 3,
        assigneeName: 'Athakorn NATUNG',
        projectId: 1,
        projectName: 'TaskFlow Pro',
        startDate: '2025-06-20',
        dueDate: '2025-06-25',
        priority: 'high',
        status: 'in-progress',
        progress: 75,
        estimatedHours: 40,
        actualHours: 30,
        tags: ['authentication', 'security', 'backend'],
        createdBy: 1,
        createdAt: '2025-06-20T09:00:00Z',
        updatedAt: '2025-06-23T10:30:00Z'
    },
    2: {
        id: 2,
        name: 'Design Dashboard UI Components',
        description: 'Create responsive dashboard components for all user roles',
        assigneeId: 5,
        assigneeName: 'Matthanaporn Kaew-umpai',
        projectId: 1,
        projectName: 'TaskFlow Pro',
        startDate: '2025-06-21',
        dueDate: '2025-06-28',
        priority: 'medium',
        status: 'todo',
        progress: 0,
        estimatedHours: 32,
        actualHours: 0,
        tags: ['ui', 'design', 'frontend'],
        createdBy: 1,
        createdAt: '2025-06-21T09:00:00Z',
        updatedAt: '2025-06-21T09:00:00Z'
    },
    3: {
        id: 3,
        name: 'API Integration Testing',
        description: 'Test all API endpoints and ensure proper error handling',
        assigneeId: 8,
        assigneeName: 'Chutithep Phakdeebut',
        projectId: 1,
        projectName: 'TaskFlow Pro',
        startDate: '2025-06-19',
        dueDate: '2025-06-24',
        priority: 'high',
        status: 'review',
        progress: 90,
        estimatedHours: 24,
        actualHours: 22,
        tags: ['testing', 'api', 'qa'],
        createdBy: 2,
        createdAt: '2025-06-19T09:00:00Z',
        updatedAt: '2025-06-23T14:15:00Z'
    },
    4: {
        id: 4,
        name: 'Database Schema Optimization',
        description: 'Optimize database queries and improve schema design',
        assigneeId: 7,
        assigneeName: 'Jirapat Sripanya',
        projectId: 1,
        projectName: 'TaskFlow Pro',
        startDate: '2025-06-18',
        dueDate: '2025-06-22',
        priority: 'medium',
        status: 'done',
        progress: 100,
        estimatedHours: 16,
        actualHours: 18,
        tags: ['database', 'optimization', 'backend'],
        createdBy: 1,
        createdAt: '2025-06-18T09:00:00Z',
        updatedAt: '2025-06-22T16:00:00Z'
    },
    5: {
        id: 5,
        name: 'Performance Monitoring Setup',
        description: 'Implement application performance monitoring and alerting',
        assigneeId: 6,
        assigneeName: 'PANUWAT PROMRAKSA',
        projectId: 1,
        projectName: 'TaskFlow Pro',
        startDate: '2025-06-22',
        dueDate: '2025-06-30',
        priority: 'low',
        status: 'todo',
        progress: 0,
        estimatedHours: 20,
        actualHours: 0,
        tags: ['monitoring', 'performance', 'devops'],
        createdBy: 2,
        createdAt: '2025-06-22T09:00:00Z',
        updatedAt: '2025-06-22T09:00:00Z'
    }
};

// Session configuration
app.use(session({
    secret: 'taskflow-pro-login-secret-key-2025',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Enable CORS
app.use(cors({
    origin: ['http://192.168.20.10:8888', 'http://localhost:8888'],
    credentials: true
}));
app.use(express.json());

// In-memory storage
let userTokens = new Map();
let activeSessions = new Map();
let performanceScoring = {
    taskCompletion: 10,
    earlyCompletionBonus: 5,
    qualityMultiplier: 1.5,
    lateCompletionPenalty: -3
};

// Helper function to get user without password
function getUserSafe(user) {
    const { password, ...safeUser } = user;
    return safeUser;
}

// Authentication middleware
function requireAuth(req, res, next) {
    if (!req.session.userId || !USERS_DATABASE[req.session.userEmail]) {
        return res.status(401).json({
            success: false,
            error: 'Authentication required'
        });
    }
    
    req.user = getUserSafe(USERS_DATABASE[req.session.userEmail]);
    next();
}

// Role-based authorization middleware
function requireRole(roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }
        
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                error: 'Insufficient permissions'
            });
        }
        
        next();
    };
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        service: 'TaskFlow Backend - Login System',
        version: '6.0.0-login-system',
        features: [
            'Email/Password Authentication',
            'Role-based Access Control',
            'Employee Management',
            'Task Management',
            'Performance Tracking',
            'Team Analytics',
            'Dark Mode Support'
        ],
        activeUsers: activeSessions.size,
        totalUsers: Object.keys(USERS_DATABASE).length
    });
});

// Authentication Routes

// Login endpoint
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
        
        const user = USERS_DATABASE[email.toLowerCase()];
        
        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Invalid email or password'
            });
        }
        
        // For demo purposes, allow both hashed and plain "12345" password
        const isValidPassword = password === '12345' || await bcrypt.compare(password, user.password);
        
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                error: 'Invalid email or password'
            });
        }
        
        if (user.status !== 'active') {
            return res.status(401).json({
                success: false,
                error: 'Account is not active'
            });
        }
        
        // Create session
        req.session.userId = user.id;
        req.session.userEmail = user.email;
        req.session.userRole = user.role;
        
        // Track active session
        activeSessions.set(user.id, {
            userId: user.id,
            email: user.email,
            loginTime: new Date().toISOString(),
            lastActivity: new Date().toISOString()
        });
        
        console.log(`[${new Date().toISOString()}] Successful login for: ${user.name} (${user.role})`);
        
        res.json({
            success: true,
            user: getUserSafe(user),
            message: 'Login successful'
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Logout endpoint
app.post('/api/auth/logout', requireAuth, (req, res) => {
    const userId = req.session.userId;
    
    // Remove from active sessions
    activeSessions.delete(userId);
    
    // Destroy session
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
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

// Get current user
app.get('/api/auth/me', requireAuth, (req, res) => {
    // Update last activity
    const session = activeSessions.get(req.user.id);
    if (session) {
        session.lastActivity = new Date().toISOString();
    }
    
    res.json({
        success: true,
        user: req.user
    });
});

// User Management Routes

// Get all users (Manager only)
app.get('/api/users', requireAuth, requireRole(['Manager']), (req, res) => {
    const users = Object.values(USERS_DATABASE).map(getUserSafe);
    
    res.json({
        success: true,
        data: users,
        total: users.length
    });
});

// Get team members (Team Lead and Manager)
app.get('/api/users/team', requireAuth, requireRole(['Manager', 'Team Lead']), (req, res) => {
    let teamMembers = [];
    
    if (req.user.role === 'Manager') {
        // Manager can see all users
        teamMembers = Object.values(USERS_DATABASE).map(getUserSafe);
    } else if (req.user.role === 'Team Lead') {
        // Team Lead can see their team members
        const currentUser = USERS_DATABASE[req.user.email];
        if (currentUser.teamMembers) {
            teamMembers = currentUser.teamMembers.map(memberId => {
                const member = Object.values(USERS_DATABASE).find(u => u.id === memberId);
                return member ? getUserSafe(member) : null;
            }).filter(Boolean);
        }
    }
    
    res.json({
        success: true,
        data: teamMembers,
        total: teamMembers.length
    });
});

// Get user profile
app.get('/api/users/profile', requireAuth, (req, res) => {
    res.json({
        success: true,
        data: req.user
    });
});

// Task Management Routes

// Get all tasks
app.get('/api/tasks', requireAuth, (req, res) => {
    const { status, priority, assignee, search } = req.query;
    let tasks = Object.values(TASKS_DATABASE);
    
    // Filter based on user role
    if (req.user.role === 'Employee') {
        // Employees only see their own tasks
        tasks = tasks.filter(task => task.assigneeId === req.user.id);
    } else if (req.user.role === 'Team Lead') {
        // Team Lead sees tasks of their team members
        const currentUser = USERS_DATABASE[req.user.email];
        const teamMemberIds = currentUser.teamMembers || [];
        tasks = tasks.filter(task => 
            teamMemberIds.includes(task.assigneeId) || task.assigneeId === req.user.id
        );
    }
    // Manager sees all tasks
    
    // Apply filters
    if (status) {
        tasks = tasks.filter(task => task.status === status);
    }
    
    if (priority) {
        tasks = tasks.filter(task => task.priority === priority);
    }
    
    if (assignee) {
        tasks = tasks.filter(task => 
            task.assigneeName.toLowerCase().includes(assignee.toLowerCase())
        );
    }
    
    if (search) {
        const searchLower = search.toLowerCase();
        tasks = tasks.filter(task =>
            task.name.toLowerCase().includes(searchLower) ||
            task.description.toLowerCase().includes(searchLower) ||
            task.assigneeName.toLowerCase().includes(searchLower)
        );
    }
    
    // Sort by creation date (newest first) by default
    tasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json({
        success: true,
        data: tasks,
        total: tasks.length,
        filters: { status, priority, assignee, search }
    });
});

// Get task by ID
app.get('/api/tasks/:id', requireAuth, (req, res) => {
    const taskId = parseInt(req.params.id);
    const task = TASKS_DATABASE[taskId];
    
    if (!task) {
        return res.status(404).json({
            success: false,
            error: 'Task not found'
        });
    }
    
    // Check permissions
    if (req.user.role === 'Employee' && task.assigneeId !== req.user.id) {
        return res.status(403).json({
            success: false,
            error: 'Access denied'
        });
    }
    
    res.json({
        success: true,
        data: task
    });
});

// Update task status
app.put('/api/tasks/:id/status', requireAuth, (req, res) => {
    const taskId = parseInt(req.params.id);
    const { status, progress } = req.body;
    const task = TASKS_DATABASE[taskId];
    
    if (!task) {
        return res.status(404).json({
            success: false,
            error: 'Task not found'
        });
    }
    
    // Check permissions
    if (req.user.role === 'Employee' && task.assigneeId !== req.user.id) {
        return res.status(403).json({
            success: false,
            error: 'Can only update your own tasks'
        });
    }
    
    // Update task
    task.status = status;
    if (progress !== undefined) {
        task.progress = progress;
    }
    task.updatedAt = new Date().toISOString();
    
    console.log(`[${new Date().toISOString()}] Task ${taskId} status updated to: ${status} by ${req.user.name}`);
    
    res.json({
        success: true,
        data: task,
        message: 'Task status updated'
    });
});

// Performance and Analytics Routes

// Get performance leaderboard
app.get('/api/analytics/leaderboard', requireAuth, requireRole(['Manager', 'Team Lead']), (req, res) => {
    let users = Object.values(USERS_DATABASE);
    
    // Filter employees only for leaderboard
    users = users.filter(user => user.role === 'Employee');
    
    // If Team Lead, filter to their team members
    if (req.user.role === 'Team Lead') {
        const currentUser = USERS_DATABASE[req.user.email];
        const teamMemberIds = currentUser.teamMembers || [];
        users = users.filter(user => teamMemberIds.includes(user.id));
    }
    
    // Calculate performance scores
    const leaderboard = users.map(user => {
        const userTasks = Object.values(TASKS_DATABASE).filter(task => task.assigneeId === user.id);
        const completedTasks = userTasks.filter(task => task.status === 'done');
        
        // Simple performance calculation
        let score = user.performanceScore || 0;
        score += completedTasks.length * performanceScoring.taskCompletion;
        
        return {
            userId: user.id,
            name: user.name,
            department: user.department,
            score: Math.round(score),
            tasksCompleted: completedTasks.length,
            totalTasks: userTasks.length,
            completionRate: userTasks.length > 0 ? Math.round((completedTasks.length / userTasks.length) * 100) : 0
        };
    });
    
    // Sort by score (highest first)
    leaderboard.sort((a, b) => b.score - a.score);
    
    res.json({
        success: true,
        data: leaderboard,
        total: leaderboard.length
    });
});

// Get team analytics
app.get('/api/analytics/team', requireAuth, requireRole(['Manager', 'Team Lead']), (req, res) => {
    let tasks = Object.values(TASKS_DATABASE);
    let users = Object.values(USERS_DATABASE);
    
    // Filter based on role
    if (req.user.role === 'Team Lead') {
        const currentUser = USERS_DATABASE[req.user.email];
        const teamMemberIds = currentUser.teamMembers || [];
        tasks = tasks.filter(task => teamMemberIds.includes(task.assigneeId));
        users = users.filter(user => teamMemberIds.includes(user.id));
    }
    
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(task => task.status === 'done').length;
    const inProgressTasks = tasks.filter(task => task.status === 'in-progress').length;
    const pendingTasks = tasks.filter(task => task.status === 'todo').length;
    const overdueTasks = tasks.filter(task => {
        return task.status !== 'done' && new Date(task.dueDate) < new Date();
    }).length;
    
    const activeEmployees = users.filter(user => user.role === 'Employee' && user.status === 'active').length;
    const avgCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    
    // Calculate average task duration
    const completedTasksWithDuration = tasks.filter(task => task.status === 'done' && task.actualHours);
    const avgTaskDuration = completedTasksWithDuration.length > 0 
        ? Math.round(completedTasksWithDuration.reduce((sum, task) => sum + task.actualHours, 0) / completedTasksWithDuration.length)
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
            completionRate: avgCompletionRate,
            avgTaskDuration,
            teamPerformance: Math.max(avgCompletionRate - (overdueTasks * 5), 0)
        }
    });
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
    
    console.log(`[${new Date().toISOString()}] Performance scoring updated by ${req.user.name}`);
    
    res.json({
        success: true,
        data: performanceScoring,
        message: 'Scoring configuration updated'
    });
});

// Legacy ClickUp OAuth routes (kept for compatibility)
app.get('/auth/clickup', (req, res) => {
    const authUrl = `${CLICKUP_CONFIG.AUTH_URL}?client_id=${CLICKUP_CONFIG.CLIENT_ID}&redirect_uri=${encodeURIComponent(CLICKUP_CONFIG.REDIRECT_URI)}`;
    console.log(`[${new Date().toISOString()}] Redirecting to ClickUp OAuth: ${authUrl}`);
    res.redirect(authUrl);
});

app.get('/auth/callback', async (req, res) => {
    // Redirect to main application
    res.redirect('http://192.168.20.10:8888?auth=clickup_callback');
});

// Trigger manual update endpoint
app.post('/api/system/update', requireAuth, requireRole(['Manager', 'Team Lead']), (req, res) => {
    console.log(`[${new Date().toISOString()}] Manual system update triggered by: ${req.user.name}`);
    
    res.json({
        success: true,
        message: 'System update triggered',
        timestamp: new Date().toISOString(),
        triggeredBy: req.user.name
    });
});

// Auto-update status endpoint
app.get('/api/system/status', requireAuth, (req, res) => {
    res.json({
        success: true,
        data: {
            lastUpdate: new Date().toISOString(),
            autoUpdateEnabled: true,
            updateInterval: 30, // minutes
            systemHealth: 'healthy',
            activeUsers: activeSessions.size,
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

// Start server
app.listen(PORT, () => {
    console.log(`🚀 TaskFlow Pro Backend (Login System) is running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🔐 Login API: http://localhost:${PORT}/api/auth/login`);
    console.log(`👥 Users API: http://localhost:${PORT}/api/users`);
    console.log(`📋 Tasks API: http://localhost:${PORT}/api/tasks`);
    console.log(`📈 Analytics API: http://localhost:${PORT}/api/analytics/leaderboard`);
    console.log(`⚙️  Settings API: http://localhost:${PORT}/api/settings/scoring`);
    console.log('');
    console.log('Demo Accounts:');
    console.log('Manager: yterayut@gmail.com / 12345');
    console.log('Team Lead: chaiwutwck@gmail.com / 12345');
    console.log('Employee: atthakorn.na@ku.th / 12345');
    console.log('');
    console.log(`📅 Started at: ${new Date().toISOString()}`);
});

module.exports = app;