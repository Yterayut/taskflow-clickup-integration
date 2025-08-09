// Dashboard Data Routes - Role-based data endpoints
const express = require('express');
const router = express.Router();

// Dashboard summary endpoint - role-based data
router.get('/summary/:role', async (req, res) => {
    try {
        const { role } = req.params;
        const userId = req.session.userId;
        
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Not authenticated'
            });
        }

        // Get role-based dashboard data
        const dashboardData = await getDashboardDataByRole(role, userId);
        
        res.json({
            success: true,
            data: dashboardData,
            role: role,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Dashboard data error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch dashboard data',
            error: error.message
        });
    }
});

// My tasks endpoint - user-specific tasks
router.get('/my-tasks/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const sessionUserId = req.session.userId;
        
        if (!sessionUserId) {
            return res.status(401).json({
                success: false,
                message: 'Not authenticated'
            });
        }

        // Get user-specific tasks
        const tasks = await getUserTasks(userId, sessionUserId);
        
        res.json({
            success: true,
            data: {
                tasks: tasks,
                total: tasks.length,
                completed: tasks.filter(t => t.status === 'completed').length,
                pending: tasks.filter(t => t.status === 'pending').length,
                overdue: tasks.filter(t => t.status === 'overdue').length
            },
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('My tasks error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user tasks',
            error: error.message
        });
    }
});

// Team overview endpoint - role-based team data
router.get('/team-overview/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const sessionUserId = req.session.userId;
        
        if (!sessionUserId) {
            return res.status(401).json({
                success: false,
                message: 'Not authenticated'
            });
        }

        // Get team data based on user role
        const teamData = await getTeamOverviewByRole(userId, sessionUserId);
        
        res.json({
            success: true,
            data: teamData,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Team overview error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch team overview',
            error: error.message
        });
    }
});

// Team ranking endpoint
router.get('/team-ranking', async (req, res) => {
    try {
        const sessionUserId = req.session.userId;
        
        if (!sessionUserId) {
            return res.status(401).json({
                success: false,
                message: 'Not authenticated'
            });
        }

        // Get team ranking data
        const rankingData = await getTeamRanking(sessionUserId);
        
        res.json({
            success: true,
            data: rankingData,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Team ranking error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch team ranking',
            error: error.message
        });
    }
});

// Helper functions
async function getDashboardDataByRole(role, userId) {
    // Implementation depends on role
    switch (role) {
        case 'Manager':
            return await getManagerDashboardData(userId);
        case 'Team Lead':
            return await getTeamLeadDashboardData(userId);
        case 'Employee':
            return await getEmployeeDashboardData(userId);
        default:
            return await getEmployeeDashboardData(userId);
    }
}

async function getManagerDashboardData(userId) {
    // Manager sees all system data
    return {
        kpi: {
            totalTasks: 150,
            completedTasks: 85,
            overdueTasks: 12,
            teamEfficiency: 78
        },
        team: {
            totalMembers: 15,
            activeProjects: 8,
            completionRate: 85
        },
        recent: {
            activities: [],
            notifications: []
        }
    };
}

async function getTeamLeadDashboardData(userId) {
    // Team Lead sees team-specific data
    return {
        kpi: {
            teamTasks: 45,
            completedTasks: 32,
            overdueTasks: 3,
            teamEfficiency: 85
        },
        team: {
            teamMembers: 8,
            activeProjects: 3,
            completionRate: 88
        },
        recent: {
            activities: [],
            notifications: []
        }
    };
}

async function getEmployeeDashboardData(userId) {
    // Employee sees personal data only
    return {
        kpi: {
            myTasks: 12,
            completedTasks: 8,
            overdueTasks: 1,
            efficiency: 82
        },
        personal: {
            upcomingDeadlines: [],
            recentActivities: []
        }
    };
}

async function getUserTasks(userId, sessionUserId) {
    // Get tasks for specific user
    // Implementation here would fetch from database/ClickUp
    return [
        {
            id: 'task_1',
            title: 'Complete project documentation',
            status: 'pending',
            priority: 'high',
            due_date: '2025-07-18',
            assignee: userId
        },
        {
            id: 'task_2',
            title: 'Review code changes',
            status: 'completed',
            priority: 'medium',
            due_date: '2025-07-16',
            assignee: userId
        }
    ];
}

async function getTeamOverviewByRole(userId, sessionUserId) {
    // Get team data based on user role
    return {
        team: {
            name: 'Development Team',
            members: 8,
            projects: 3,
            efficiency: 85
        },
        members: [
            {
                id: 'user_1',
                name: 'John Doe',
                role: 'Developer',
                tasks: 12,
                completed: 8,
                efficiency: 85
            }
        ]
    };
}

async function getTeamRanking(sessionUserId) {
    // Get team ranking data
    return {
        rankings: [
            {
                rank: 1,
                name: 'Alice Johnson',
                score: 95,
                tasks: 15,
                completed: 14,
                efficiency: 93
            },
            {
                rank: 2,
                name: 'Bob Smith',
                score: 88,
                tasks: 12,
                completed: 10,
                efficiency: 88
            }
        ]
    };
}

module.exports = router;