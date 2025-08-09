            id: 'qa',
            name: 'QA Team',
            lead: 'lead_4',
            members: ['emp_10', 'emp_11', 'emp_12'],
            totalTasks: 18,
            completedTasks: 14,
            overdueTasks: 2,
            efficiency: 78
        }
    },
    tasks: [
        {
            id: 'task_1',
            title: 'API Development for User Authentication',
            description: 'Develop secure authentication API with JWT tokens',
            assignee: 'employee_1',
            team: 'frontend',
            priority: 'high',
            status: 'in_progress',
            progress: 60,
            dueDate: '2025-06-25',
            estimatedHours: 16,
            spentHours: 8,
            project: 'User Management',
            tags: ['backend', 'security', 'api'],
            createdBy: 'teamlead_1',
            createdAt: '2025-06-19T10:00:00Z'
        },
        {
            id: 'task_2',
            title: 'Frontend Component Refactoring',
            description: 'Refactor React components for better performance',
            assignee: 'employee_1',
            team: 'frontend',
            priority: 'medium',
            status: 'in_progress',
            progress: 50,
            dueDate: '2025-06-22',
            estimatedHours: 8,
            spentHours: 4,
            project: 'Component Library',
            tags: ['frontend', 'react'],
            createdBy: 'teamlead_1',
            createdAt: '2025-06-18T14:00:00Z'
        },
        {
            id: 'task_3',
            title: 'Code Review - Payment Module',
            description: 'Review payment integration code for security',
            assignee: 'employee_1',
            team: 'frontend',
            priority: 'low',
            status: 'completed',
            progress: 100,
            dueDate: '2025-06-20',
            estimatedHours: 2,
            spentHours: 2,
            project: 'Payment System',
            tags: ['review', 'payment'],
            createdBy: 'teamlead_1',
            createdAt: '2025-06-17T09:00:00Z'
        }
    ],
    notifications: {
        manager_1: [
            { id: 1, type: 'warning', message: 'QA Team มีงานล้นเกินกำหนด (2 งาน)', timestamp: new Date() },
            { id: 2, type: 'success', message: 'Frontend Team ประสิทธิภาพเพิ่มขึ้น 15%', timestamp: new Date() },
            { id: 3, type: 'info', message: 'งบประมาณโครงการใหม่รออนุมัติ', timestamp: new Date() }
        ],
        teamlead_1: [
            { id: 1, type: 'warning', message: 'สมหญิงมีงานเกินกำหนด 1 งาน', timestamp: new Date() },
            { id: 2, type: 'success', message: 'กิตติพงษ์ส่งงาน Code Review แล้ว', timestamp: new Date() }
        ],
        employee_1: [
            { id: 1, type: 'info', message: 'งาน "API Development" ถูกอัพเดทโดย Team Lead', timestamp: new Date() },
            { id: 2, type: 'info', message: 'Daily Standup ในอีก 30 นาที', timestamp: new Date() }
        ]
    }
};

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        service: 'TaskFlow Pro Backend with Role-Based Access',
        port: PORT.toString(),
        timestamp: new Date().toISOString(),
        version: '3.0.0-taskflow-pro',
        features: ['Role-Based Access', 'Team Management', 'Task Assignment', 'Real-time Analytics'],
        redis: redisClient ? 'connected' : 'disabled',
        clickup: clickupService ? 'enabled' : 'disabled'
    });
});

// API v1 routes
app.get('/api/v1/health', (req, res) => {
    res.json({
        status: 'OK',
        service: 'TaskFlow Pro API v1',
        timestamp: new Date().toISOString(),
        authenticated: !!req.headers.authorization
    });
});

// Authentication Routes
app.post('/api/v1/auth/login', (req, res) => {
    const { role, email } = req.body;
    
    // Simple role-based authentication (replace with real auth in production)
    const user = roleBasedData.users.find(u => u.role === role || u.email === email);
    
    if (user) {
        // Generate simple token (use JWT in production)
        const token = Buffer.from(JSON.stringify({
            userId: user.id,
            role: user.role,
            timestamp: Date.now()
        })).toString('base64');
        
        res.json({
            success: true,
            user: {
                id: user.id,
                name: user.name,
                role: user.role,
                email: user.email,
                avatar: user.avatar,
                team: user.team,
                permissions: user.permissions
            },
            token
        });
    } else {
        res.status(401).json({
            success: false,
            message: 'Invalid credentials'
        });
    }
});

// User data routes
app.get('/api/v1/user/profile', authenticateToken, (req, res) => {
    const user = roleBasedData.users.find(u => u.id === req.user.userId);
    if (user) {
        res.json({
            success: true,
            user: {
                id: user.id,
                name: user.name,
                role: user.role,
                email: user.email,
                avatar: user.avatar,
                team: user.team,
                permissions: user.permissions
            }
        });
    } else {
        res.status(404).json({ success: false, message: 'User not found' });
    }
});

// Dashboard data routes
app.get('/api/v1/dashboard/kpis', authenticateToken, (req, res) => {
    const userRole = req.user.role;
    let kpis = {};
    
    switch (userRole) {
        case 'manager':
            kpis = {
                totalTasks: Object.values(roleBasedData.teams).reduce((sum, team) => sum + team.totalTasks, 0),
                completedToday: Object.values(roleBasedData.teams).reduce((sum, team) => sum + team.completedTasks, 0),
                overdue: Object.values(roleBasedData.teams).reduce((sum, team) => sum + team.overdueTasks, 0),
                efficiency: Math.round(Object.values(roleBasedData.teams).reduce((sum, team) => sum + team.efficiency, 0) / Object.keys(roleBasedData.teams).length),
                teamMembers: Object.values(roleBasedData.teams).reduce((sum, team) => sum + team.members.length, 0),
                projects: 5
            };
            break;
        case 'teamlead':
            const userTeam = roleBasedData.users.find(u => u.id === req.user.userId)?.team;
            const team = roleBasedData.teams[userTeam];
            if (team) {
                kpis = {
                    teamTasks: team.totalTasks,
                    completedToday: team.completedTasks,
                    overdue: team.overdueTasks,
                    teamEfficiency: team.efficiency
                };
            }
            break;
        case 'employee':
            const userTasks = roleBasedData.tasks.filter(t => t.assignee === req.user.userId);
            kpis = {
                completedToday: userTasks.filter(t => t.status === 'completed').length,
                inProgress: userTasks.filter(t => t.status === 'in_progress').length,
                overdue: userTasks.filter(t => t.status === 'overdue').length,
                efficiency: 95
            };
            break;
    }
    
    res.json({
        success: true,
        kpis
    });
});

// Team data routes
app.get('/api/v1/teams', authenticateToken, (req, res) => {
    const userRole = req.user.role;
    const userId = req.user.userId;
    
    let teams = [];
    
    switch (userRole) {
        case 'manager':
            // Manager can see all teams
            teams = Object.values(roleBasedData.teams);
            break;
        case 'teamlead':
            // Team lead can only see their own team
            const userTeam = roleBasedData.users.find(u => u.id === userId)?.team;
            if (userTeam && roleBasedData.teams[userTeam]) {
                teams = [roleBasedData.teams[userTeam]];
            }
            break;
        case 'employee':
            // Employee cannot see team data
            teams = [];
            break;
    }
    
    res.json({
        success: true,
        teams
    });
});

// Task data routes
app.get('/api/v1/tasks', authenticateToken, (req, res) => {
    const userRole = req.user.role;
    const userId = req.user.userId;
    
    let tasks = [];
    
    switch (userRole) {
        case 'manager':
            // Manager can see all tasks
            tasks = roleBasedData.tasks;
            break;
        case 'teamlead':
            // Team lead can see tasks in their team
            const userTeam = roleBasedData.users.find(u => u.id === userId)?.team;
            tasks = roleBasedData.tasks.filter(t => t.team === userTeam);
            break;
        case 'employee':
            // Employee can only see their own tasks
            tasks = roleBasedData.tasks.filter(t => t.assignee === userId);
            break;
    }
    
    res.json({
        success: true,
        tasks
    });
});

// Create new task
app.post('/api/v1/tasks', authenticateToken, (req, res) => {
    const { title, description, assignee, priority, dueDate, estimatedHours, project, tags } = req.body;
    const userRole = req.user.role;
    const userId = req.user.userId;
    
    // Check permissions
    if (userRole === 'employee') {
        return res.status(403).json({
            success: false,
            message: 'Employees cannot create tasks'
        });
    }
    
    // Create new task
    const newTask = {
        id: `task_${Date.now()}`,
        title,
        description,
        assignee,
        team: userRole === 'teamlead' ? roleBasedData.users.find(u => u.id === userId)?.team : 'frontend', // Default team
        priority: priority || 'medium',
        status: 'todo',
        progress: 0,
        dueDate,
        estimatedHours: estimatedHours || 1,
        spentHours: 0,
        project: project || 'General',
        tags: tags || [],
        createdBy: userId,
        createdAt: new Date().toISOString()
    };
    
    roleBasedData.tasks.push(newTask);
    
    res.json({
        success: true,
        task: newTask,
        message: 'Task created successfully'
    });
});

// Update task
app.put('/api/v1/tasks/:taskId', authenticateToken, (req, res) => {
    const { taskId } = req.params;
    const updates = req.body;
    const userRole = req.user.role;
    const userId = req.user.userId;
    
    const taskIndex = roleBasedData.tasks.findIndex(t => t.id === taskId);
    
    if (taskIndex === -1) {
        return res.status(404).json({
            success: false,
            message: 'Task not found'
        });
    }
    
    const task = roleBasedData.tasks[taskIndex];
    
    // Check permissions
    if (userRole === 'employee' && task.assignee !== userId) {
        return res.status(403).json({
            success: false,
            message: 'You can only update your own tasks'
        });
    }
    
    if (userRole === 'teamlead') {
        const userTeam = roleBasedData.users.find(u => u.id === userId)?.team;
        if (task.team !== userTeam) {
            return res.status(403).json({
                success: false,
                message: 'You can only update tasks in your team'
            });
        }
    }
    
    // Update task
    roleBasedData.tasks[taskIndex] = { ...task, ...updates, updatedAt: new Date().toISOString() };
    
    res.json({
        success: true,
        task: roleBasedData.tasks[taskIndex],
        message: 'Task updated successfully'
    });
});

// Get notifications
app.get('/api/v1/notifications', authenticateToken, (req, res) => {
    const userId = req.user.userId;
    const notifications = roleBasedData.notifications[userId] || [];
    
    res.json({
        success: true,
        notifications
    });
});

// Mark notification as read
app.put('/api/v1/notifications/:notificationId/read', authenticateToken, (req, res) => {
    const { notificationId } = req.params;
    const userId = req.user.userId;
    
    if (roleBasedData.notifications[userId]) {
        const notification = roleBasedData.notifications[userId].find(n => n.id == notificationId);
        if (notification) {
            notification.read = true;
        }
    }
    
    res.json({
        success: true,
        message: 'Notification marked as read'
    });
});

// Analytics endpoint
app.get('/api/v1/analytics', authenticateToken, (req, res) => {
    const userRole = req.user.role;
    const userId = req.user.userId;
    
    let analytics = {};
    
    switch (userRole) {
        case 'manager':
            analytics = {
                totalTeams: Object.keys(roleBasedData.teams).length,
                totalEmployees: roleBasedData.users.filter(u => u.role === 'employee').length,
                totalTasks: roleBasedData.tasks.length,
                completionRate: Math.round((roleBasedData.tasks.filter(t => t.status === 'completed').length / roleBasedData.tasks.length) * 100),
                teamPerformance: Object.values(roleBasedData.teams).map(team => ({
                    name: team.name,
                    efficiency: team.efficiency,
                    completed: team.completedTasks,
                    total: team.totalTasks
                }))
            };
            break;
        case 'teamlead':
            const userTeam = roleBasedData.users.find(u => u.id === userId)?.team;
            const team = roleBasedData.teams[userTeam];
            const teamTasks = roleBasedData.tasks.filter(t => t.team === userTeam);
            analytics = {
                teamName: team?.name,
                teamMembers: team?.members.length,
                teamTasks: teamTasks.length,
                completionRate: Math.round((teamTasks.filter(t => t.status === 'completed').length / teamTasks.length) * 100),
                efficiency: team?.efficiency
            };
            break;
        case 'employee':
            const userTasks = roleBasedData.tasks.filter(t => t.assignee === userId);
            analytics = {
                totalTasks: userTasks.length,
                completedTasks: userTasks.filter(t => t.status === 'completed').length,
                efficiency: Math.round((userTasks.filter(t => t.status === 'completed').length / userTasks.length) * 100),
                averageHours: userTasks.reduce((sum, t) => sum + t.spentHours, 0) / userTasks.length
            };
            break;
    }
    
    res.json({
        success: true,
        analytics
    });
});

// Legacy ClickUp routes (if available)
if (clickupService && authService) {
    // ClickUp OAuth2 Authentication Routes
    app.get('/api/v1/auth/clickup/authorize', async (req, res) => {
        try {
            const state = authService.generateOAuthState();
            await authService.storeOAuthState(state);
            
            const authUrl = clickupService.getAuthorizationUrl(state);
            
            res.json({
                authorization_url: authUrl,
                state: state,
                message: 'Redirect user to authorization_url to complete ClickUp authentication'
            });
        } catch (error) {
            console.error('ClickUp authorize error:', error);
            res.status(500).json({
                error: 'Failed to generate ClickUp authorization URL',
                details: error.message
            });
        }
    });

    // ClickUp OAuth callback
    app.get('/api/v1/auth/clickup/callback', async (req, res) => {
        try {
            const { code, state } = req.query;
            
            if (!code) {
                return res.status(400).json({
                    error: 'Missing authorization code'
                });
            }

            // Verify state
            const isValidState = await authService.verifyOAuthState(state);
            if (!isValidState) {
                return res.status(400).json({
                    error: 'Invalid or expired state parameter'
                });
            }

            // Exchange code for token
            const tokenData = await clickupService.exchangeCodeForToken(code);
            
            if (tokenData.access_token) {
                // Store the token securely
                await authService.storeAccessToken(tokenData.access_token);
                
                res.json({
                    success: true,
                    message: 'ClickUp authentication successful',
                    hasAccess: true
                });
            } else {
                throw new Error('No access token received');
            }
        } catch (error) {
            console.error('ClickUp callback error:', error);
            res.status(500).json({
                error: 'ClickUp authentication failed',
                details: error.message
            });
        }
    });

    // ClickUp data sync
    app.post('/api/v1/clickup/sync', async (req, res) => {
        try {
            const result = await dataSyncService.syncData();
            res.json({
                success: true,
                data: result,
                message: 'Data synchronized successfully'
            });
        } catch (error) {
            console.error('Sync error:', error);
            res.status(500).json({
                error: 'Failed to sync data',
                details: error.message
            });
        }
    });
}

// Authentication middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    
    if (!token) {
        return res.sendStatus(401);
    }
    
    try {
        // Decode simple token (use JWT verification in production)
        const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
        
        // Check if token is expired (24 hours)
        if (Date.now() - decoded.timestamp > 24 * 60 * 60 * 1000) {
            return res.sendStatus(403);
        }
        
        req.user = decoded;
        next();
    } catch (error) {
        return res.sendStatus(403);
    }
}

// Serve TaskFlow Pro interface
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index_taskflow_pro.html'));
});

// Serve original interface (backup)
app.get('/legacy', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Endpoint not found',
        message: 'The requested resource does not exist',
        timestamp: new Date().toISOString()
    });
});

// Error handler
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({
        error: 'Internal server error',
        message: error.message,
        timestamp: new Date().toISOString()
    });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log('🚀 TaskFlow Pro Backend Server Starting...');
    console.log(`📡 Server running on: http://0.0.0.0:${PORT}`);
    console.log(`🌐 TaskFlow Pro Interface: http://localhost:${PORT}/`);
    console.log(`🔙 Legacy Interface: http://localhost:${PORT}/legacy`);
    console.log(`🔗 Health Check: http://localhost:${PORT}/health`);
    console.log(`📚 API Documentation: http://localhost:${PORT}/api/v1/health`);
    console.log('⚡ Features: Role-Based Access, Team Management, Task Assignment');
    console.log(`🔧 Redis: ${redisClient ? 'Connected' : 'Disabled'}`);
    console.log(`🔗 ClickUp: ${clickupService ? 'Enabled' : 'Disabled'}`);
    console.log('✅ Server ready for connections!');
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down server gracefully...');
    
    if (redisClient) {
        try {
            await redisClient.disconnect();
            console.log('✅ Redis connection closed');
        } catch (error) {
            console.error('❌ Error closing Redis connection:', error);
        }
    }
    
    console.log('👋 Server shutdown complete');
    process.exit(0);
});

module.exports = app;