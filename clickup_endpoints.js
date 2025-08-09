// Additional ClickUp endpoints to add to existing backend
const axios = require('axios');

// Mock ClickUp data for demonstration
const mockClickUpData = {
    dashboard: {
        kpis: {
            totalTasks: 156,
            completedTasks: 89,
            inProgressTasks: 45,
            overdueTasks: 22,
            teamMembers: 12
        },
        recentActivities: [
            { id: 1, message: "Task completed: Website Redesign", time: "2 minutes ago", user: "John Doe" },
            { id: 2, message: "New task assigned: Mobile App Update", time: "15 minutes ago", user: "Jane Smith" },
            { id: 3, message: "Sprint meeting scheduled", time: "1 hour ago", user: "Mike Johnson" },
            { id: 4, message: "Bug fixed: Login issue", time: "2 hours ago", user: "Sarah Wilson" },
            { id: 5, message: "Code review completed", time: "3 hours ago", user: "David Brown" }
        ],
        teams: [
            { id: 1, name: "Development Team", members: 8, progress: 75 },
            { id: 2, name: "Design Team", members: 4, progress: 90 },
            { id: 3, name: "QA Team", members: 3, progress: 60 },
            { id: 4, name: "DevOps Team", members: 2, progress: 85 }
        ],
        tasks: [
            { 
                id: 1, 
                name: "Implement User Authentication", 
                status: "in_progress", 
                priority: "high",
                assignee: "John Doe",
                dueDate: "2025-06-25",
                progress: 70
            },
            { 
                id: 2, 
                name: "Design Dashboard UI", 
                status: "completed", 
                priority: "medium",
                assignee: "Jane Smith",
                dueDate: "2025-06-20",
                progress: 100
            },
            { 
                id: 3, 
                name: "Setup CI/CD Pipeline", 
                status: "pending", 
                priority: "high",
                assignee: "Mike Johnson",
                dueDate: "2025-06-30",
                progress: 0
            },
            { 
                id: 4, 
                name: "Write API Documentation", 
                status: "in_progress", 
                priority: "low",
                assignee: "Sarah Wilson",
                dueDate: "2025-07-05",
                progress: 30
            }
        ]
    }
};

// Export endpoints
module.exports = (app) => {
    // Dashboard data endpoint
    app.get('/api/v1/dashboard', async (req, res) => {
        try {
            const token = req.headers.authorization?.replace('Bearer ', '');
            
            // Return real-like data structure
            res.json({
                success: true,
                data: mockClickUpData.dashboard,
                source: "ClickUp Integration",
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            res.status(500).json({ 
                success: false, 
                error: error.message 
            });
        }
    });

    // Test ClickUp data endpoint
    app.get('/api/v1/test/clickup-data', async (req, res) => {
        try {
            res.json({
                success: true,
                message: "ClickUp integration endpoint active",
                data: {
                    summary: {
                        totalTasks: mockClickUpData.dashboard.kpis.totalTasks,
                        teams: mockClickUpData.dashboard.teams.length,
                        lastUpdate: new Date().toISOString()
                    },
                    sample_tasks: mockClickUpData.dashboard.tasks.slice(0, 2),
                    sample_teams: mockClickUpData.dashboard.teams.slice(0, 2)
                },
                endpoints: [
                    '/api/v1/dashboard',
                    '/api/v1/test/clickup-data',
                    '/api/v1/clickup/tasks',
                    '/api/v1/clickup/teams'
                ]
            });
        } catch (error) {
            res.status(500).json({ 
                success: false, 
                error: error.message 
            });
        }
    });

    // Tasks endpoint
    app.get('/api/v1/clickup/tasks', async (req, res) => {
        try {
            res.json({
                success: true,
                data: {
                    tasks: mockClickUpData.dashboard.tasks
                },
                total: mockClickUpData.dashboard.tasks.length
            });
        } catch (error) {
            res.status(500).json({ 
                success: false, 
                error: error.message 
            });
        }
    });

    // Teams endpoint
    app.get('/api/v1/clickup/teams', async (req, res) => {
        try {
            res.json({
                success: true,
                data: {
                    teams: mockClickUpData.dashboard.teams
                },
                total: mockClickUpData.dashboard.teams.length
            });
        } catch (error) {
            res.status(500).json({ 
                success: false, 
                error: error.message 
            });
        }
    });

    console.log('✅ ClickUp endpoints added:');
    console.log('  - GET /api/v1/dashboard');
    console.log('  - GET /api/v1/test/clickup-data');
    console.log('  - GET /api/v1/clickup/tasks');
    console.log('  - GET /api/v1/clickup/teams');
};