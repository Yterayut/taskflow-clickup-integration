/**
 * Dashboard API Routes
 * Role-based dashboard configuration and data endpoints
 */
const express = require('express');
const router = express.Router();

/**
 * Get dashboard configuration for authenticated user
 * Returns role-based navigation, capabilities, and default component
 */
router.get('/config', async (req, res) => {
    try {
        if (!req.user || !req.user.userId) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required - user not found in request'
            });
        }
        
        const userId = req.user.userId;
        const authService = req.app.get('authService');
        
        const config = await authService.getDashboardConfig(userId);
        
        res.json({
            success: true,
            data: config
        });
    } catch (error) {
        console.error('Dashboard config error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get dashboard configuration'
        });
    }
});

/**
 * Get role-filtered tasks for current user
 * Filters tasks based on user role and permissions
 */
router.get('/tasks', async (req, res) => {
    try {
        const userId = req.user.userId;
        const userRole = req.user.role;
        const clickupService = req.app.get('clickupService');
        
        let tasks;
        
        switch (userRole) {
            case 'master':
            case 'manager':
                // Manager sees all tasks
                tasks = await clickupService.getAllTasks();
                break;
                
            case 'team_lead':
                // Team Lead sees team tasks
                tasks = await clickupService.getTeamTasks(userId);
                break;
                
            case 'employee':
                // Employee sees only assigned tasks
                tasks = await clickupService.getAssignedTasks(userId);
                break;
                
            default:
                tasks = [];
        }
        
        res.json({
            success: true,
            data: {
                tasks,
                count: tasks.length,
                role: userRole
            }
        });
    } catch (error) {
        console.error('Dashboard tasks error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get tasks'
        });
    }
});

/**
 * Get role-filtered team members
 * Returns team members based on user permissions
 */
router.get('/team-members', async (req, res) => {
    try {
        const userId = req.user.userId;
        const userRole = req.user.role;
        const userService = req.app.get('userService');
        
        let teamMembers;
        
        switch (userRole) {
            case 'master':
            case 'manager':
                // Manager sees all employees
                teamMembers = await userService.getAllEmployees();
                break;
                
            case 'team_lead':
                // Team Lead sees team members only
                teamMembers = await userService.getTeamMembers(userId);
                break;
                
            case 'employee':
                // Employee sees only self
                teamMembers = await userService.getEmployeeProfile(userId);
                break;
                
            default:
                teamMembers = [];
        }
        
        res.json({
            success: true,
            data: {
                teamMembers,
                count: Array.isArray(teamMembers) ? teamMembers.length : 1,
                role: userRole
            }
        });
    } catch (error) {
        console.error('Dashboard team members error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get team members'
        });
    }
});

/**
 * Get role-based analytics data
 * Returns analytics appropriate for user role
 */
router.get('/analytics', async (req, res) => {
    try {
        const userId = req.user.userId;
        const userRole = req.user.role;
        const analyticsService = req.app.get('analyticsService');
        
        let analytics;
        
        switch (userRole) {
            case 'master':
            case 'manager':
                // Manager sees all analytics
                analytics = await analyticsService.getFullAnalytics();
                break;
                
            case 'team_lead':
                // Team Lead sees team analytics
                analytics = await analyticsService.getTeamAnalytics(userId);
                break;
                
            case 'employee':
                // Employee sees personal analytics
                analytics = await analyticsService.getPersonalAnalytics(userId);
                break;
                
            default:
                analytics = {};
        }
        
        res.json({
            success: true,
            data: analytics
        });
    } catch (error) {
        console.error('Dashboard analytics error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get analytics'
        });
    }
});

/**
 * Get component permissions for current user
 * Returns which components the user can access
 */
router.get('/permissions', async (req, res) => {
    try {
        const userId = req.user.userId;
        const authService = req.app.get('authService');
        
        const profile = await authService.getUserProfile(userId);
        
        res.json({
            success: true,
            data: {
                capabilities: profile.capabilities,
                navigation: profile.navigation,
                role: profile.user.role,
                displayName: profile.displayName
            }
        });
    } catch (error) {
        console.error('Dashboard permissions error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get permissions'
        });
    }
});

module.exports = router;