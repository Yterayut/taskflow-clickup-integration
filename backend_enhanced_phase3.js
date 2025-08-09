/**
 * TaskFlow Pro v3.0 - Enhanced Backend with Real-time Capabilities
 * Phase 3 Implementation: Live Updates + Advanced Analytics + WebSocket Integration
 * Multi-Persona Ultra-Think Implementation
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');

// Enhanced infrastructure imports (simplified for Phase 3 deployment)
// const { getDatabase } = require('./infrastructure/database/DatabaseClient');
// const { PostgresUserRepository } = require('./infrastructure/repositories/PostgresUserRepository');
// const { PostgresClickUpTokenRepository } = require('./infrastructure/repositories/PostgresClickUpTokenRepository');
// const { ClickUpOAuthAdapter } = require('./infrastructure/adapters/ClickUpOAuthAdapter');
// const { JWTService } = require('./infrastructure/adapters/JWTService');

// Simple WebSocket implementation for Phase 3
class SimpleRealtimeService {
    constructor(config = {}) {
        this.config = config;
        this.wss = null;
        this.clients = new Map();
        this.isRunning = false;
    }
    
    async start() {
        const WebSocket = require('ws');
        this.wss = new WebSocket.Server({ port: this.config.port || 7813 });
        
        this.wss.on('connection', (ws, request) => {
            const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            this.clients.set(clientId, { ws, connected: true });
            
            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    this.handleMessage(clientId, message);
                } catch (error) {
                    console.error('[WebSocket] Message parse error:', error);
                }
            });
            
            ws.on('close', () => {
                this.clients.delete(clientId);
            });
            
            // Send welcome message
            ws.send(JSON.stringify({
                type: 'welcome',
                data: { clientId, timestamp: new Date().toISOString() }
            }));
        });
        
        this.isRunning = true;
        console.log(`[WebSocket] Service started on port ${this.config.port || 7813}`);
    }
    
    handleMessage(clientId, message) {
        console.log(`[WebSocket] Message from ${clientId}:`, message.type);
        
        // Handle specific message types
        switch (message.type) {
            case 'heartbeat':
                this.sendToClient(clientId, 'heartbeat-response', { timestamp: new Date().toISOString() });
                break;
            case 'subscribe-analytics':
                this.sendToClient(clientId, 'analytics-update', analyticsEngine.getMetrics());
                break;
            default:
                // Echo message to all clients for demonstration
                this.broadcast(message.type, message.data);
        }
    }
    
    sendToClient(clientId, type, data) {
        const client = this.clients.get(clientId);
        if (client && client.ws && client.ws.readyState === 1) {
            try {
                client.ws.send(JSON.stringify({
                    type,
                    data,
                    timestamp: new Date().toISOString()
                }));
            } catch (error) {
                console.error(`[WebSocket] Send error to ${clientId}:`, error);
                this.clients.delete(clientId);
            }
        }
    }
    
    broadcast(type, data) {
        const message = JSON.stringify({
            type,
            data,
            timestamp: new Date().toISOString()
        });
        
        this.clients.forEach((client, clientId) => {
            if (client.ws && client.ws.readyState === 1) {
                try {
                    client.ws.send(message);
                } catch (error) {
                    console.error(`[WebSocket] Send error to ${clientId}:`, error);
                    this.clients.delete(clientId);
                }
            }
        });
    }
    
    getConnectionCount() {
        return this.clients.size;
    }
    
    async stop() {
        if (this.wss) {
            this.wss.close();
        }
        this.isRunning = false;
    }
}

// Simple Email Service placeholder
class SimpleEmailService {
    constructor() {
        this.enabled = false;
    }
    
    async sendEmail(to, subject, body) {
        console.log(`[Email] Would send to ${to}: ${subject}`);
        return { success: true, messageId: `mock_${Date.now()}` };
    }
}

// Application services (simplified for Phase 3 deployment)
// const { AuthenticationService } = require('./application/services/AuthenticationService');
// const { TaskManagementApplicationService } = require('./application/services/TaskManagementApplicationService');

// Temporary in-memory implementation for Phase 3
class SimpleTaskManagementService {
    constructor() {
        this.tasks = new Map();
    }
    
    async getTasks(userRole, userId) {
        const allTasks = Array.from(this.tasks.values());
        if (userRole === 'Master' || userRole === 'Manager') {
            return allTasks;
        }
        return allTasks.filter(task => task.assignee === userId);
    }
    
    async createTask(taskData) {
        const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const task = {
            ...taskData,
            id: taskId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        this.tasks.set(taskId, task);
        return task;
    }
    
    async updateTask(taskId, updates) {
        const task = this.tasks.get(taskId);
        if (task) {
            const updatedTask = {
                ...task,
                ...updates,
                updatedAt: new Date().toISOString()
            };
            this.tasks.set(taskId, updatedTask);
            return updatedTask;
        }
        return null;
    }
}

const taskManagementService = new SimpleTaskManagementService();

// Load user configuration
let usersConfig;
try {
    usersConfig = JSON.parse(fs.readFileSync('users_config.json', 'utf8'));
} catch (error) {
    console.warn('[CONFIG] users_config.json not found, using fallback configuration');
    usersConfig = { users: [] };
}

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 7812;
const WS_PORT = process.env.WS_PORT || 7813;

// ClickUp OAuth Configuration
const CLICKUP_CONFIG = {
    CLIENT_ID: process.env.CLICKUP_CLIENT_ID || 'F9M7XRHB7T6Q78ZVL5077IT2HM89KTK5',
    CLIENT_SECRET: process.env.CLICKUP_CLIENT_SECRET || 'M8W2S8R6YK386H0VV10ZFM1H67PCR3SMC5GU5U0QV6S94EI80FWF9AQL83YUI19J',
    REDIRECT_URI: process.env.CLICKUP_REDIRECT_URI || 'http://192.168.20.10:7810/',
    BASE_URL: 'https://api.clickup.com/api/v2',
    AUTH_URL: 'https://app.clickup.com/api'
};

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'taskflow-pro-phase3-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false, // Set to true for HTTPS in production
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        httpOnly: true
    }
}));

// Enhanced CORS configuration for real-time
app.use(cors({
    origin: [
        'http://192.168.20.10:8888',
        'http://localhost:8888',
        'http://localhost:3000',
        'http://localhost:5173'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
}));

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false
});

app.use('/api/', limiter);

// In-memory storage with real-time capabilities
let userTokens = new Map();
let employeeDatabase = new Map();
let taskDatabase = new Map();
let realtimeClients = new Map();
let analyticsData = {
    totalTasks: 0,
    completedTasks: 0,
    activeUsers: 0,
    dailyActivity: {},
    teamPerformance: {}
};

// Initialize services
let realtimeService;
let emailService = new SimpleEmailService();

class Phase3AnalyticsEngine {
    constructor() {
        this.metrics = {
            tasks: { created: 0, completed: 0, inProgress: 0 },
            users: { active: 0, total: 0 },
            teams: {},
            performance: {},
            realtime: { connections: 0, messages: 0 }
        };
        this.updateInterval = null;
    }

    startTracking() {
        this.updateInterval = setInterval(() => {
            this.updateMetrics();
            this.broadcastAnalytics();
        }, 30000); // Update every 30 seconds
    }

    updateMetrics() {
        // Calculate real-time metrics
        this.metrics.tasks.total = taskDatabase.size;
        this.metrics.users.active = realtimeClients.size;
        this.metrics.users.total = usersConfig.users.length;
        this.metrics.realtime.connections = realtimeService ? realtimeService.getConnectionCount() : 0;
        
        // Update team performance
        this.updateTeamPerformance();
    }

    updateTeamPerformance() {
        const teams = new Map();
        
        for (const [taskId, task] of taskDatabase) {
            if (task.team && task.assignee) {
                if (!teams.has(task.team)) {
                    teams.set(task.team, {
                        totalTasks: 0,
                        completedTasks: 0,
                        members: new Set()
                    });
                }
                
                const teamData = teams.get(task.team);
                teamData.totalTasks++;
                teamData.members.add(task.assignee);
                
                if (task.status === 'completed') {
                    teamData.completedTasks++;
                }
            }
        }
        
        // Calculate performance scores
        for (const [teamName, data] of teams) {
            const completionRate = data.totalTasks > 0 ? (data.completedTasks / data.totalTasks * 100) : 0;
            this.metrics.teams[teamName] = {
                completionRate: Math.round(completionRate),
                totalTasks: data.totalTasks,
                completedTasks: data.completedTasks,
                memberCount: data.members.size,
                performance: this.calculatePerformanceGrade(completionRate)
            };
        }
    }

    calculatePerformanceGrade(completionRate) {
        if (completionRate >= 90) return 'A+';
        if (completionRate >= 80) return 'A';
        if (completionRate >= 70) return 'B+';
        if (completionRate >= 60) return 'B';
        if (completionRate >= 50) return 'C';
        return 'D';
    }

    broadcastAnalytics() {
        if (realtimeService) {
            realtimeService.broadcast('analytics-update', {
                metrics: this.metrics,
                timestamp: new Date().toISOString()
            });
        }
    }

    getMetrics() {
        return this.metrics;
    }
}

const analyticsEngine = new Phase3AnalyticsEngine();

// Real-time notification system
class NotificationSystem {
    static sendTaskUpdate(taskId, action, task, userId) {
        const notification = {
            type: 'task-update',
            taskId,
            action, // 'created', 'updated', 'completed', 'assigned'
            task,
            userId,
            timestamp: new Date().toISOString()
        };
        
        if (realtimeService) {
            realtimeService.broadcast('task-notification', notification);
        }
        
        console.log(`[REALTIME] Task notification sent: ${action} for task ${taskId}`);
    }
    
    static sendUserActivity(userId, action, data) {
        const notification = {
            type: 'user-activity',
            userId,
            action,
            data,
            timestamp: new Date().toISOString()
        };
        
        if (realtimeService) {
            realtimeService.broadcast('user-activity', notification);
        }
    }
    
    static sendSystemAlert(level, message, data) {
        const alert = {
            type: 'system-alert',
            level, // 'info', 'warning', 'error', 'success'
            message,
            data,
            timestamp: new Date().toISOString()
        };
        
        if (realtimeService) {
            realtimeService.broadcast('system-alert', alert);
        }
    }
}

// Authentication middleware
function authenticateToken(req, res, next) {
    const token = req.cookies.authToken || req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }
    
    // For development, accept simple token format
    const userData = userTokens.get(token);
    if (!userData) {
        return res.status(403).json({ error: 'Invalid or expired token' });
    }
    
    req.user = userData;
    next();
}

// Enhanced authentication endpoints
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        console.log(`[AUTH] Login attempt for email: ${email}`);
        
        // Find user in users_config
        const user = usersConfig.users.find(u => 
            u.email.toLowerCase() === email.toLowerCase() && u.password === password
        );
        
        if (!user) {
            console.log(`[AUTH] Login failed for email: ${email} - Invalid credentials`);
            return res.status(401).json({ 
                success: false, 
                error: 'Invalid email or password' 
            });
        }
        
        // Generate session token
        const token = `token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Store user session with enhanced data
        const userData = {
            id: user.id || email,
            email: user.email,
            name: user.name || email.split('@')[0],
            role: user.role || 'Employee',
            permissions: user.permissions || [],
            loginTime: new Date().toISOString(),
            lastActivity: new Date().toISOString()
        };
        
        userTokens.set(token, userData);
        
        // Set secure cookie
        res.cookie('authToken', token, {
            httpOnly: true,
            secure: false, // Set to true for HTTPS
            maxAge: 24 * 60 * 60 * 1000, // 24 hours
            sameSite: 'lax'
        });
        
        // Send user activity notification
        NotificationSystem.sendUserActivity(userData.id, 'login', userData);
        
        console.log(`[AUTH] Login successful for: ${user.email} (Role: ${user.role})`);
        
        res.json({
            success: true,
            user: userData,
            message: 'Login successful'
        });
        
    } catch (error) {
        console.error('[AUTH] Login error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error' 
        });
    }
});

// Get current user info
app.get('/api/v2/auth/me', authenticateToken, (req, res) => {
    // Update last activity
    const token = req.cookies.authToken;
    if (token && userTokens.has(token)) {
        const userData = userTokens.get(token);
        userData.lastActivity = new Date().toISOString();
        userTokens.set(token, userData);
    }
    
    res.json({
        success: true,
        user: req.user
    });
});

// Logout endpoint
app.post('/api/v2/auth/logout', authenticateToken, (req, res) => {
    const token = req.cookies.authToken;
    
    if (token) {
        // Send logout notification
        NotificationSystem.sendUserActivity(req.user.id, 'logout', req.user);
        
        userTokens.delete(token);
        res.clearCookie('authToken');
    }
    
    res.json({ success: true, message: 'Logged out successfully' });
});

// Enhanced task management with real-time updates
app.get('/api/tasks', authenticateToken, (req, res) => {
    try {
        const userRole = req.user.role;
        const userId = req.user.id;
        
        let tasks = [];
        
        for (const [taskId, task] of taskDatabase) {
            // Role-based task filtering
            if (userRole === 'Master' || userRole === 'Manager') {
                tasks.push({ id: taskId, ...task });
            } else if (userRole === 'Team Lead' && (task.team === req.user.team || task.assignee === userId)) {
                tasks.push({ id: taskId, ...task });
            } else if (task.assignee === userId) {
                tasks.push({ id: taskId, ...task });
            }
        }
        
        res.json({
            success: true,
            tasks,
            count: tasks.length,
            userRole
        });
        
    } catch (error) {
        console.error('[TASKS] Error fetching tasks:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch tasks' });
    }
});

// Create new task with real-time notification
app.post('/api/tasks', authenticateToken, (req, res) => {
    try {
        const { title, description, assignee, priority, team, dueDate } = req.body;
        
        if (!title) {
            return res.status(400).json({ success: false, error: 'Task title is required' });
        }
        
        const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const task = {
            title,
            description: description || '',
            assignee: assignee || req.user.id,
            creator: req.user.id,
            priority: priority || 'Medium',
            team: team || req.user.team || 'General',
            status: 'pending',
            dueDate: dueDate || null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        taskDatabase.set(taskId, task);
        
        // Send real-time notification
        NotificationSystem.sendTaskUpdate(taskId, 'created', task, req.user.id);
        
        console.log(`[TASKS] New task created: ${taskId} by ${req.user.email}`);
        
        res.json({
            success: true,
            task: { id: taskId, ...task },
            message: 'Task created successfully'
        });
        
    } catch (error) {
        console.error('[TASKS] Error creating task:', error);
        res.status(500).json({ success: false, error: 'Failed to create task' });
    }
});

// Update task with real-time notification
app.put('/api/tasks/:taskId', authenticateToken, (req, res) => {
    try {
        const { taskId } = req.params;
        const updates = req.body;
        
        if (!taskDatabase.has(taskId)) {
            return res.status(404).json({ success: false, error: 'Task not found' });
        }
        
        const task = taskDatabase.get(taskId);
        const updatedTask = {
            ...task,
            ...updates,
            updatedAt: new Date().toISOString(),
            lastUpdatedBy: req.user.id
        };
        
        taskDatabase.set(taskId, updatedTask);
        
        // Determine action type
        let action = 'updated';
        if (updates.status === 'completed' && task.status !== 'completed') {
            action = 'completed';
        } else if (updates.assignee !== task.assignee) {
            action = 'assigned';
        }
        
        // Send real-time notification
        NotificationSystem.sendTaskUpdate(taskId, action, updatedTask, req.user.id);
        
        console.log(`[TASKS] Task ${action}: ${taskId} by ${req.user.email}`);
        
        res.json({
            success: true,
            task: { id: taskId, ...updatedTask },
            message: `Task ${action} successfully`
        });
        
    } catch (error) {
        console.error('[TASKS] Error updating task:', error);
        res.status(500).json({ success: false, error: 'Failed to update task' });
    }
});

// Real-time analytics endpoint
app.get('/api/v2/analytics/metrics', authenticateToken, (req, res) => {
    try {
        const metrics = analyticsEngine.getMetrics();
        
        res.json({
            success: true,
            metrics,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('[ANALYTICS] Error fetching metrics:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch analytics' });
    }
});

// Team performance analytics
app.get('/api/v2/analytics/teams', authenticateToken, (req, res) => {
    try {
        const teamMetrics = analyticsEngine.getMetrics().teams;
        
        res.json({
            success: true,
            teams: teamMetrics,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('[ANALYTICS] Error fetching team analytics:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch team analytics' });
    }
});

// Real-time service endpoints
app.get('/api/v2/realtime/status', (req, res) => {
    res.json({
        success: true,
        status: realtimeService ? 'active' : 'inactive',
        connections: realtimeService ? realtimeService.getConnectionCount() : 0,
        port: WS_PORT
    });
});

// Health check with enhanced information
app.get('/health', (req, res) => {
    const health = {
        status: 'OK',
        timestamp: new Date().toISOString(),
        service: 'TaskFlow Backend - Phase 3 Enhanced',
        version: '3.0.0-realtime',
        features: [
            'Real-time WebSocket Communication',
            'Advanced Analytics Engine',
            'Live Task Updates',
            'Team Performance Tracking',
            'Enhanced Security',
            'Multi-role Access Control'
        ],
        connections: {
            websocket: realtimeService ? realtimeService.getConnectionCount() : 0,
            active_sessions: userTokens.size
        },
        analytics: analyticsEngine.getMetrics(),
        uptime: process.uptime()
    };
    
    res.json(health);
});

// Initialize and start services
async function initializeServices() {
    try {
        console.log('[INIT] Initializing Phase 3 enhanced services...');
        
        // Initialize real-time service
        realtimeService = new SimpleRealtimeService({
            port: WS_PORT,
            heartbeatInterval: 30000,
            maxConnections: 1000
        });
        
        await realtimeService.start();
        console.log(`[REALTIME] WebSocket service started on port ${WS_PORT}`);
        
        // Initialize email service (placeholder)
        emailService = new SimpleEmailService();
        console.log('[EMAIL] Email service initialized (placeholder)');
        
        // Start analytics tracking
        try {
            analyticsEngine.startTracking();
            console.log('[ANALYTICS] Analytics engine started');
        } catch (error) {
            console.log('[ANALYTICS] Analytics engine initialization skipped:', error.message);
        }
        
        // Send system startup notification
        setTimeout(() => {
            NotificationSystem.sendSystemAlert('success', 'TaskFlow Pro Phase 3 system started', {
                version: '3.0.0-realtime',
                features: ['WebSocket', 'Analytics', 'Real-time Updates']
            });
        }, 2000);
        
    } catch (error) {
        console.error('[INIT] Error initializing services:', error);
    }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('[SHUTDOWN] Received SIGTERM, shutting down gracefully');
    
    if (realtimeService) {
        await realtimeService.stop();
    }
    
    if (analyticsEngine.updateInterval) {
        clearInterval(analyticsEngine.updateInterval);
    }
    
    server.close(() => {
        console.log('[SHUTDOWN] HTTP server closed');
        process.exit(0);
    });
});

// Start the server
server.listen(PORT, () => {
    console.log(``);
    console.log(`🚀 TaskFlow Pro Phase 3 Enhanced Backend`);
    console.log(`=====================================`);
    console.log(`📡 HTTP Server: http://localhost:${PORT}`);
    console.log(`🔌 WebSocket: ws://localhost:${WS_PORT}`);
    console.log(`⚡ Real-time Features: ENABLED`);
    console.log(`📊 Analytics Engine: ACTIVE`);
    console.log(`🎯 Version: 3.0.0-realtime`);
    console.log(`=====================================`);
    console.log(``);
    
    // Initialize services after server start
    initializeServices();
});

module.exports = { app, server, realtimeService, analyticsEngine, NotificationSystem };