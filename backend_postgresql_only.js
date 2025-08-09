// TaskFlow Pro - PostgreSQL Only Backend
// Version: v13.0.0-postgresql-only
// Date: 2025-08-09
// Complete PostgreSQL integration with optimized assignment queries

const express = require('express');
const session = require('express-session');
const cors = require('cors');
const bcrypt = require('bcrypt');
const { Client, Pool } = require('pg');
const axios = require('axios');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// PostgreSQL connection pool
const pool = new Pool({
    host: 'localhost',
    database: 'taskflow',
    user: 'postgres',
    password: '',  // Trust authentication
    port: 5432,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Test PostgreSQL connection
pool.connect((err, client, release) => {
    if (err) {
        console.error('❌ PostgreSQL connection failed:', err);
        process.exit(1);
    } else {
        console.log('✅ PostgreSQL connected successfully');
        release();
    }
});

// Socket.IO setup
const io = new Server(server, {
    cors: {
        origin: ["http://192.168.20.10:8888", "http://localhost:8888"],
        methods: ["GET", "POST"],
        credentials: true
    }
});

// Middleware
app.use(cors({
    origin: ['http://192.168.20.10:8888', 'http://localhost:8888'],
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: 'taskflow-pro-postgresql-only-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000
    }
}));

// ClickUp Token Configuration
let CLICKUP_TOKEN = null;

// Load ClickUp token
async function loadClickUpToken() {
    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', ['yterayut@gmail.com']);
        if (result.rows.length > 0 && result.rows[0].clickup_token) {
            CLICKUP_TOKEN = result.rows[0].clickup_token;
            console.log(`[${new Date().toISOString()}] ✅ Loaded ClickUp token for yterayut@gmail.com`);
            console.log(`[${new Date().toISOString()}] 🔑 Token format: ${CLICKUP_TOKEN.substring(0, 20)}...`);
            return true;
        }
    } catch (error) {
        console.error('❌ Error loading ClickUp token:', error);
    }
    return false;
}

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        const dbResult = await pool.query('SELECT COUNT(*) as task_count FROM clickup_tasks');
        const assignmentResult = await pool.query('SELECT COUNT(*) as assignment_count FROM clickup_task_assignments');
        const memberResult = await pool.query('SELECT COUNT(*) as member_count FROM clickup_members');
        
        res.json({
            status: 'healthy',
            version: 'v13.0.0-postgresql-only',
            database: 'PostgreSQL',
            clickup_integration: CLICKUP_TOKEN ? 'active' : 'inactive',
            tasks: parseInt(dbResult.rows[0].task_count),
            assignments: parseInt(assignmentResult.rows[0].assignment_count),
            members: parseInt(memberResult.rows[0].member_count),
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
});

// Authentication endpoints
app.post('/api/v2/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        // Check user in database
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        
        if (result.rows.length > 0) {
            const user = result.rows[0];
            const passwordMatch = await bcrypt.compare(password, user.password_hash);
            
            if (passwordMatch) {
                req.session.user = {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                    database: 'PostgreSQL'
                };

                console.log(`[${new Date().toISOString()}] ✅ Login successful: ${user.name} (${user.role}) via PostgreSQL`);

                res.json({
                    success: true,
                    message: 'Authentication successful',
                    user: req.session.user
                });
            } else {
                res.status(401).json({
                    success: false,
                    message: 'Invalid credentials'
                });
            }
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

// Dashboard analytics with real ClickUp data
app.get('/api/v2/dashboard/analytics', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, message: 'Not authenticated' });
        }

        const tasks = await pool.query('SELECT * FROM clickup_tasks WHERE archived = false');
        const members = await pool.query('SELECT * FROM clickup_members WHERE is_active = true');
        const assignments = await pool.query('SELECT COUNT(*) as count FROM clickup_task_assignments');
        
        if (tasks.rows.length === 0) {
            return res.json({
                success: true,
                data: {
                    message: "No real ClickUp data available",
                    dataSource: "Waiting for Real ClickUp Sync",
                    totalTasks: 0,
                    completedTasks: 0,
                    inProgressTasks: 0,
                    teamMembers: 0,
                    assignments: 0,
                    completionRate: 0
                }
            });
        }

        // Calculate analytics
        const totalTasks = tasks.rows.length;
        const completedTasks = tasks.rows.filter(task => 
            task.status_name && (task.status_name.toLowerCase().includes('complete') || 
            task.status_name.toLowerCase().includes('done'))
        ).length;
        const inProgressTasks = tasks.rows.filter(task => 
            task.status_name && task.status_name.toLowerCase().includes('progress')
        ).length;
        const teamMembers = members.rows.length;
        const totalAssignments = parseInt(assignments.rows[0].count);
        const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        console.log(`[${new Date().toISOString()}] 📊 Dashboard Analytics - Tasks: ${totalTasks}, Members: ${teamMembers}, Assignments: ${totalAssignments}`);

        res.json({
            success: true,
            data: {
                dataSource: "Real ClickUp Data (PostgreSQL)",
                totalTasks,
                completedTasks,
                inProgressTasks,
                teamMembers,
                assignments: totalAssignments,
                completionRate,
                lastSync: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Dashboard analytics error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load dashboard analytics',
            error: error.message
        });
    }
});

// Enhanced Analytics API - Business Intelligence Dashboard
app.get('/api/v2/analytics/enhanced-dashboard', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, message: 'Not authenticated' });
        }

        // Get comprehensive analytics
        const tasksAnalytics = await pool.query(`
            SELECT 
                COUNT(*) as total_tasks,
                COUNT(CASE WHEN status_name ILIKE '%complete%' OR status_name ILIKE '%done%' THEN 1 END) as completed_tasks,
                COUNT(CASE WHEN status_name ILIKE '%progress%' THEN 1 END) as in_progress_tasks,
                COUNT(CASE WHEN status_name ILIKE '%to do%' OR status_name = '' OR status_name IS NULL THEN 1 END) as todo_tasks,
                COUNT(CASE WHEN parent IS NOT NULL THEN 1 END) as subtasks,
                COUNT(CASE WHEN parent IS NULL THEN 1 END) as main_tasks
            FROM clickup_tasks 
            WHERE archived = false
        `);

        const memberAnalytics = await pool.query(`
            SELECT 
                COUNT(*) as total_members,
                COUNT(CASE WHEN is_active = true THEN 1 END) as active_members
            FROM clickup_members
        `);

        const assignmentAnalytics = await pool.query(`
            SELECT COUNT(*) as total_assignments FROM clickup_task_assignments
        `);

        // Task completion trends by status
        const statusTrends = await pool.query(`
            SELECT 
                status_name,
                status_color,
                COUNT(*) as count,
                ROUND((COUNT(*) * 100.0 / (SELECT COUNT(*) FROM clickup_tasks WHERE archived = false)), 2) as percentage
            FROM clickup_tasks 
            WHERE archived = false AND status_name IS NOT NULL
            GROUP BY status_name, status_color
            ORDER BY count DESC
            LIMIT 10
        `);

        // Priority distribution
        const priorityDistribution = await pool.query(`
            SELECT 
                priority_name,
                priority_color,
                COUNT(*) as count,
                ROUND((COUNT(*) * 100.0 / (SELECT COUNT(*) FROM clickup_tasks WHERE archived = false AND priority_name IS NOT NULL)), 2) as percentage
            FROM clickup_tasks 
            WHERE archived = false AND priority_name IS NOT NULL
            GROUP BY priority_name, priority_color
            ORDER BY count DESC
        `);

        // Member productivity with ranking
        const memberProductivity = await pool.query(`
            SELECT 
                m.username,
                m.email,
                COUNT(ta.task_id) as total_assigned,
                COUNT(CASE WHEN t.status_name ILIKE '%complete%' OR t.status_name ILIKE '%done%' THEN 1 END) as completed,
                COUNT(CASE WHEN t.status_name ILIKE '%progress%' THEN 1 END) as in_progress,
                ROUND((COUNT(CASE WHEN t.status_name ILIKE '%complete%' OR t.status_name ILIKE '%done%' THEN 1 END) * 100.0 / NULLIF(COUNT(ta.task_id), 0)), 2) as completion_rate,
                ROW_NUMBER() OVER (ORDER BY 
                    ROUND((COUNT(CASE WHEN t.status_name ILIKE '%complete%' OR t.status_name ILIKE '%done%' THEN 1 END) * 100.0 / NULLIF(COUNT(ta.task_id), 0)), 2) DESC,
                    COUNT(ta.task_id) DESC
                ) as productivity_rank
            FROM clickup_members m
            LEFT JOIN clickup_task_assignments ta ON m.id = ta.member_id
            LEFT JOIN clickup_tasks t ON ta.task_id = t.id AND t.archived = false
            WHERE m.is_active = true
            GROUP BY m.id, m.username, m.email
            HAVING COUNT(ta.task_id) > 0
            ORDER BY productivity_rank
            LIMIT 15
        `);

        // Recent task activity (last 30 days based on date_updated)
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
        const recentActivity = await pool.query(`
            SELECT 
                t.name,
                t.status_name,
                t.priority_name,
                m.username as assigned_to,
                t.date_updated,
                t.list_name,
                t.url
            FROM clickup_tasks t
            LEFT JOIN clickup_task_assignments ta ON t.id = ta.task_id
            LEFT JOIN clickup_members m ON ta.member_id = m.id
            WHERE t.archived = false 
              AND t.date_updated > $1
            ORDER BY t.date_updated DESC
            LIMIT 20
        `, [thirtyDaysAgo]);

        // Project/Space performance
        const projectPerformance = await pool.query(`
            SELECT 
                s.name as space_name,
                s.color as space_color,
                COUNT(t.id) as total_tasks,
                COUNT(CASE WHEN t.status_name ILIKE '%complete%' OR t.status_name ILIKE '%done%' THEN 1 END) as completed_tasks,
                COUNT(CASE WHEN t.status_name ILIKE '%progress%' THEN 1 END) as in_progress_tasks,
                ROUND((COUNT(CASE WHEN t.status_name ILIKE '%complete%' OR t.status_name ILIKE '%done%' THEN 1 END) * 100.0 / NULLIF(COUNT(t.id), 0)), 2) as completion_rate
            FROM clickup_spaces s
            LEFT JOIN clickup_tasks t ON s.id = t.space_id AND t.archived = false
            GROUP BY s.id, s.name, s.color
            HAVING COUNT(t.id) > 0
            ORDER BY completion_rate DESC, total_tasks DESC
        `);

        const analytics = tasksAnalytics.rows[0];
        const members = memberAnalytics.rows[0];
        const assignments = assignmentAnalytics.rows[0];

        console.log(`[${new Date().toISOString()}] 📊 Enhanced Analytics - ${analytics.total_tasks} tasks, ${members.total_members} members, ${assignments.total_assignments} assignments`);

        res.json({
            success: true,
            data: {
                // Basic metrics
                totalTasks: parseInt(analytics.total_tasks),
                completedTasks: parseInt(analytics.completed_tasks),
                inProgressTasks: parseInt(analytics.in_progress_tasks),
                todoTasks: parseInt(analytics.todo_tasks),
                mainTasks: parseInt(analytics.main_tasks),
                subtasks: parseInt(analytics.subtasks),
                teamMembers: parseInt(members.active_members),
                totalAssignments: parseInt(assignments.total_assignments),
                
                // Calculated metrics
                completionRate: analytics.total_tasks > 0 ? 
                    Math.round((analytics.completed_tasks / analytics.total_tasks) * 100) : 0,
                
                // Advanced analytics
                statusTrends: statusTrends.rows,
                priorityDistribution: priorityDistribution.rows,
                memberProductivity: memberProductivity.rows,
                recentActivity: recentActivity.rows.map(activity => ({
                    ...activity,
                    date_updated: activity.date_updated ? new Date(parseInt(activity.date_updated)).toISOString() : null
                })),
                projectPerformance: projectPerformance.rows,
                
                // Metadata
                dataSource: "Enhanced ClickUp Analytics (PostgreSQL BI)",
                lastSync: new Date().toISOString(),
                generated_at: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Enhanced analytics error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load enhanced analytics',
            error: error.message
        });
    }
});

// Task Completion Trends Analysis
app.get('/api/v2/analytics/task-trends', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, message: 'Not authenticated' });
        }

        const period = req.query.period || '30'; // days
        const daysAgo = Date.now() - (parseInt(period) * 24 * 60 * 60 * 1000);

        // Daily task completion trends
        const dailyTrends = await pool.query(`
            SELECT 
                DATE(to_timestamp(date_updated::bigint / 1000)) as completion_date,
                COUNT(CASE WHEN status_name ILIKE '%complete%' OR status_name ILIKE '%done%' THEN 1 END) as completed_count,
                COUNT(CASE WHEN status_name ILIKE '%progress%' THEN 1 END) as in_progress_count,
                COUNT(*) as total_updated
            FROM clickup_tasks
            WHERE archived = false 
              AND date_updated IS NOT NULL
              AND date_updated > $1
            GROUP BY DATE(to_timestamp(date_updated::bigint / 1000))
            ORDER BY completion_date DESC
            LIMIT 30
        `, [daysAgo]);

        // Weekly completion rate
        const weeklyTrends = await pool.query(`
            SELECT 
                DATE_TRUNC('week', to_timestamp(date_updated::bigint / 1000)) as week_start,
                COUNT(CASE WHEN status_name ILIKE '%complete%' OR status_name ILIKE '%done%' THEN 1 END) as completed_count,
                COUNT(*) as total_updated,
                ROUND((COUNT(CASE WHEN status_name ILIKE '%complete%' OR status_name ILIKE '%done%' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0)), 2) as completion_rate
            FROM clickup_tasks
            WHERE archived = false 
              AND date_updated IS NOT NULL
              AND date_updated > $1
            GROUP BY DATE_TRUNC('week', to_timestamp(date_updated::bigint / 1000))
            ORDER BY week_start DESC
            LIMIT 12
        `, [daysAgo]);

        console.log(`[${new Date().toISOString()}] 📈 Task Trends - ${dailyTrends.rows.length} daily entries, ${weeklyTrends.rows.length} weekly entries`);

        res.json({
            success: true,
            data: {
                dailyTrends: dailyTrends.rows,
                weeklyTrends: weeklyTrends.rows,
                period: `Last ${period} days`,
                dataSource: "Task Trends Analysis (PostgreSQL BI)",
                generated_at: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Task trends error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load task trends',
            error: error.message
        });
    }
});

// Member Productivity Analytics with Detailed Rankings
app.get('/api/v2/analytics/member-productivity', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, message: 'Not authenticated' });
        }

        // Detailed member productivity analysis
        const memberStats = await pool.query(`
            SELECT 
                m.id,
                m.username,
                m.email,
                m.role,
                COUNT(ta.task_id) as total_assigned,
                COUNT(CASE WHEN t.status_name ILIKE '%complete%' OR t.status_name ILIKE '%done%' THEN 1 END) as completed,
                COUNT(CASE WHEN t.status_name ILIKE '%progress%' THEN 1 END) as in_progress,
                COUNT(CASE WHEN t.status_name ILIKE '%to do%' OR t.status_name = '' OR t.status_name IS NULL THEN 1 END) as todo,
                ROUND((COUNT(CASE WHEN t.status_name ILIKE '%complete%' OR t.status_name ILIKE '%done%' THEN 1 END) * 100.0 / NULLIF(COUNT(ta.task_id), 0)), 2) as completion_rate,
                COUNT(CASE WHEN t.priority_name ILIKE '%urgent%' THEN 1 END) as urgent_tasks,
                COUNT(CASE WHEN t.priority_name ILIKE '%high%' THEN 1 END) as high_priority_tasks,
                AVG(CASE 
                    WHEN t.date_updated IS NOT NULL AND t.date_created IS NOT NULL 
                    THEN (t.date_updated - t.date_created) / 86400000.0 
                    ELSE NULL 
                END) as avg_task_duration_days
            FROM clickup_members m
            LEFT JOIN clickup_task_assignments ta ON m.id = ta.member_id
            LEFT JOIN clickup_tasks t ON ta.task_id = t.id AND t.archived = false
            WHERE m.is_active = true
            GROUP BY m.id, m.username, m.email, m.role
            ORDER BY completion_rate DESC, total_assigned DESC
        `);

        // Top performers (filter out undefined values)
        const topPerformers = memberStats.rows
            .filter(member => member && member.total_assigned && parseInt(member.total_assigned) > 0)
            .slice(0, 5);

        // Simple task count by member
        const taskDistribution = memberStats.rows.map(member => ({
            username: member.username,
            completed: parseInt(member.completed) || 0,
            in_progress: parseInt(member.in_progress) || 0,
            todo: parseInt(member.todo) || 0,
            total: parseInt(member.total_assigned) || 0
        }));

        console.log(`[${new Date().toISOString()}] 👥 Member Productivity - ${memberStats.rows.length} members analyzed`);

        res.json({
            success: true,
            data: {
                memberStats: memberStats.rows,
                topPerformers: topPerformers,
                taskDistribution: taskDistribution,
                totalMembers: memberStats.rows.length,
                activeMembers: memberStats.rows.filter(m => m.total_assigned > 0).length,
                dataSource: "Member Productivity Analytics (PostgreSQL BI)",
                generated_at: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Member productivity error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load member productivity analytics',
            error: error.message
        });
    }
});

// Priority Distribution Analysis
app.get('/api/v2/analytics/priority-analysis', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, message: 'Not authenticated' });
        }

        // Priority distribution across all tasks
        const priorityStats = await pool.query(`
            SELECT 
                COALESCE(priority_name, 'No Priority') as priority_name,
                priority_color,
                COUNT(*) as task_count,
                COUNT(CASE WHEN status_name ILIKE '%complete%' OR status_name ILIKE '%done%' THEN 1 END) as completed_count,
                COUNT(CASE WHEN status_name ILIKE '%progress%' THEN 1 END) as in_progress_count,
                ROUND((COUNT(CASE WHEN status_name ILIKE '%complete%' OR status_name ILIKE '%done%' THEN 1 END) * 100.0 / COUNT(*)), 2) as completion_rate,
                ROUND((COUNT(*) * 100.0 / (SELECT COUNT(*) FROM clickup_tasks WHERE archived = false)), 2) as distribution_percentage
            FROM clickup_tasks 
            WHERE archived = false
            GROUP BY priority_name, priority_color
            ORDER BY 
                CASE priority_name 
                    WHEN 'urgent' THEN 1 
                    WHEN 'high' THEN 2 
                    WHEN 'normal' THEN 3 
                    WHEN 'low' THEN 4 
                    ELSE 5 
                END
        `);

        // Priority trends by team member
        const memberPriorityStats = await pool.query(`
            SELECT 
                m.username,
                m.email,
                COUNT(CASE WHEN t.priority_name ILIKE '%urgent%' THEN 1 END) as urgent_tasks,
                COUNT(CASE WHEN t.priority_name ILIKE '%high%' THEN 1 END) as high_tasks,
                COUNT(CASE WHEN t.priority_name ILIKE '%normal%' THEN 1 END) as normal_tasks,
                COUNT(CASE WHEN t.priority_name ILIKE '%low%' THEN 1 END) as low_tasks,
                COUNT(CASE WHEN t.priority_name IS NULL OR t.priority_name = '' THEN 1 END) as no_priority_tasks
            FROM clickup_members m
            LEFT JOIN clickup_task_assignments ta ON m.id = ta.member_id
            LEFT JOIN clickup_tasks t ON ta.task_id = t.id AND t.archived = false
            WHERE m.is_active = true
            GROUP BY m.id, m.username, m.email
            HAVING COUNT(ta.task_id) > 0
            ORDER BY urgent_tasks DESC, high_tasks DESC
        `);

        console.log(`[${new Date().toISOString()}] 🎯 Priority Analysis - ${priorityStats.rows.length} priority levels, ${memberPriorityStats.rows.length} members`);

        res.json({
            success: true,
            data: {
                priorityDistribution: priorityStats.rows,
                memberPriorityWorkload: memberPriorityStats.rows,
                totalTasks: priorityStats.rows.reduce((sum, p) => sum + parseInt(p.task_count), 0),
                highPriorityTasks: priorityStats.rows
                    .filter(p => p.priority_name && (p.priority_name.includes('urgent') || p.priority_name.includes('high')))
                    .reduce((sum, p) => sum + parseInt(p.task_count), 0),
                dataSource: "Priority Distribution Analysis (PostgreSQL BI)",
                generated_at: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Priority analysis error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load priority analysis',
            error: error.message
        });
    }
});

// Project Status Analytics
app.get('/api/v2/analytics/project-status', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, message: 'Not authenticated' });
        }

        // Project/Space analytics
        const projectStats = await pool.query(`
            SELECT 
                COALESCE(space_name, 'Unknown Project') as project_name,
                COUNT(*) as total_tasks,
                COUNT(CASE WHEN status_name ILIKE '%complete%' OR status_name ILIKE '%done%' THEN 1 END) as completed,
                COUNT(CASE WHEN status_name ILIKE '%progress%' THEN 1 END) as in_progress,
                COUNT(CASE WHEN status_name NOT ILIKE '%complete%' AND status_name NOT ILIKE '%done%' AND status_name NOT ILIKE '%progress%' THEN 1 END) as pending,
                ROUND((COUNT(CASE WHEN status_name ILIKE '%complete%' OR status_name ILIKE '%done%' THEN 1 END) * 100.0 / COUNT(*)), 2) as completion_rate,
                COUNT(CASE WHEN priority_name ILIKE '%urgent%' OR priority_name ILIKE '%high%' THEN 1 END) as high_priority_tasks,
                COUNT(DISTINCT list_name) as lists_count
            FROM clickup_tasks 
            WHERE archived = false
            GROUP BY space_name
            ORDER BY completion_rate DESC, total_tasks DESC
        `);

        // List-level analytics
        const listStats = await pool.query(`
            SELECT 
                COALESCE(list_name, 'Unknown List') as list_name,
                COALESCE(space_name, 'Unknown Project') as project_name,
                COUNT(*) as total_tasks,
                COUNT(CASE WHEN status_name ILIKE '%complete%' OR status_name ILIKE '%done%' THEN 1 END) as completed,
                COUNT(CASE WHEN status_name ILIKE '%progress%' THEN 1 END) as in_progress,
                ROUND((COUNT(CASE WHEN status_name ILIKE '%complete%' OR status_name ILIKE '%done%' THEN 1 END) * 100.0 / COUNT(*)), 2) as completion_rate
            FROM clickup_tasks 
            WHERE archived = false
            GROUP BY list_name, space_name
            HAVING COUNT(*) >= 3
            ORDER BY completion_rate DESC, total_tasks DESC
            LIMIT 20
        `);

        console.log(`[${new Date().toISOString()}] 📊 Project Status - ${projectStats.rows.length} projects, ${listStats.rows.length} active lists`);

        res.json({
            success: true,
            data: {
                projectStatus: projectStats.rows,
                listStatus: listStats.rows,
                totalProjects: projectStats.rows.length,
                totalLists: listStats.rows.length,
                highPerformingProjects: projectStats.rows.filter(p => p.completion_rate >= 70).length,
                dataSource: "Project Status Analytics (PostgreSQL BI)",
                generated_at: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Project status error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load project status analytics',
            error: error.message
        });
    }
});

// Recent Activity Timeline
app.get('/api/v2/analytics/recent-activity', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, message: 'Not authenticated' });
        }

        const limit = parseInt(req.query.limit) || 50;
        const days = parseInt(req.query.days) || 7;
        const daysAgo = Date.now() - (days * 24 * 60 * 60 * 1000);

        // Recent task activities
        const recentActivities = await pool.query(`
            SELECT 
                t.id as task_id,
                t.name as task_name,
                t.status_name,
                t.priority_name,
                t.list_name,
                t.space_name,
                t.url,
                t.date_updated,
                t.date_created,
                m.username as assigned_to,
                m.email as assignee_email,
                CASE 
                    WHEN t.date_updated > t.date_created + 3600000 THEN 'updated'
                    ELSE 'created'
                END as activity_type
            FROM clickup_tasks t
            LEFT JOIN clickup_task_assignments ta ON t.id = ta.task_id
            LEFT JOIN clickup_members m ON ta.member_id = m.id
            WHERE t.archived = false 
              AND (t.date_updated > $1 OR t.date_created > $1)
            ORDER BY 
                CASE 
                    WHEN t.date_updated > t.date_created THEN t.date_updated
                    ELSE t.date_created
                END DESC
            LIMIT $2
        `, [daysAgo, limit]);

        // Activity summary
        const activitySummary = await pool.query(`
            SELECT 
                COUNT(*) as total_activities,
                COUNT(CASE WHEN date_updated > $1 THEN 1 END) as recent_updates,
                COUNT(CASE WHEN date_created > $1 THEN 1 END) as recent_creations,
                COUNT(DISTINCT CASE WHEN ta.member_id IS NOT NULL THEN ta.member_id END) as active_members
            FROM clickup_tasks t
            LEFT JOIN clickup_task_assignments ta ON t.id = ta.task_id
            WHERE t.archived = false
        `, [daysAgo]);

        console.log(`[${new Date().toISOString()}] ⏰ Recent Activity - ${recentActivities.rows.length} activities in last ${days} days`);

        res.json({
            success: true,
            data: {
                activities: recentActivities.rows.map(activity => ({
                    ...activity,
                    date_updated: activity.date_updated ? new Date(parseInt(activity.date_updated)).toISOString() : null,
                    date_created: activity.date_created ? new Date(parseInt(activity.date_created)).toISOString() : null
                })),
                summary: activitySummary.rows[0],
                period: `Last ${days} days`,
                limit: limit,
                dataSource: "Recent Activity Timeline (PostgreSQL BI)",
                generated_at: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Recent activity error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load recent activity',
            error: error.message
        });
    }
});

// My Tasks endpoint with assignment table
app.get('/api/v2/tasks/my-tasks', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, message: 'Not authenticated' });
        }

        const userEmail = req.session.user.email;
        console.log(`[${new Date().toISOString()}] 📋 Getting tasks for user: ${userEmail}`);
        
        // Get user's member ID
        const memberResult = await pool.query('SELECT id FROM clickup_members WHERE email = $1', [userEmail]);
        
        if (memberResult.rows.length === 0) {
            return res.json({
                success: true,
                tasks: [],
                message: `User ${userEmail} not found in ClickUp members`,
                data_source: "Real ClickUp Data (PostgreSQL) - User not in system"
            });
        }
        
        const userMemberId = memberResult.rows[0].id;
        console.log(`[${new Date().toISOString()}] 📋 User member ID: ${userMemberId}`);
        
        // Get tasks assigned to this user using assignment table
        const tasksResult = await pool.query(`
            SELECT DISTINCT
                t.id, t.name, t.description, 
                t.status_name as status, 
                t.priority_name as priority, 
                t.due_date, t.parent,
                t.list_name, t.space_name, t.url,
                m.username as assigned_to,
                t.date_created, t.date_updated
            FROM clickup_tasks t
            JOIN clickup_task_assignments ta ON t.id = ta.task_id
            JOIN clickup_members m ON ta.member_id = m.id
            WHERE ta.member_id = $1 
              AND t.archived = false
            ORDER BY t.date_updated DESC
        `, [userMemberId]);
        
        const tasks = tasksResult.rows;
        console.log(`[${new Date().toISOString()}] 📋 Found ${tasks.length} assigned tasks for ${userEmail}`);

        // Separate main tasks and subtasks
        const mainTasks = tasks.filter(task => !task.parent);
        const subTasks = tasks.filter(task => task.parent);

        res.json({
            success: true,
            tasks: tasks,
            mainTasks: mainTasks,
            subTasks: subTasks,
            totalTasks: tasks.length,
            user: userEmail,
            data_source: "Real ClickUp Data (PostgreSQL) - Assignment Table",
            message: `Found ${tasks.length} tasks assigned to ${userEmail}`
        });

    } catch (error) {
        console.error('My tasks error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load user tasks',
            error: error.message
        });
    }
});

// Team overview endpoint
app.get('/api/v2/team/overview', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, message: 'Not authenticated' });
        }

        // Get team members with their task assignments
        const teamResult = await pool.query(`
            SELECT 
                m.id, m.username, m.email, m.role,
                COUNT(ta.task_id) as assigned_tasks,
                COUNT(CASE WHEN t.status_name ILIKE '%complete%' OR t.status_name ILIKE '%done%' THEN 1 END) as completed_tasks
            FROM clickup_members m
            LEFT JOIN clickup_task_assignments ta ON m.id = ta.member_id
            LEFT JOIN clickup_tasks t ON ta.task_id = t.id AND t.archived = false
            WHERE m.is_active = true
            GROUP BY m.id, m.username, m.email, m.role
            ORDER BY assigned_tasks DESC
        `);

        console.log(`[${new Date().toISOString()}] 👥 Team overview - ${teamResult.rows.length} active members`);

        res.json({
            success: true,
            team: teamResult.rows,
            totalMembers: teamResult.rows.length,
            data_source: "Real ClickUp Data (PostgreSQL) - Team Performance",
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Team overview error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load team overview',
            error: error.message
        });
    }
});

// Projects endpoint
app.get('/api/v2/projects', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, message: 'Not authenticated' });
        }

        // Get projects (spaces) with task counts
        const projectsResult = await pool.query(`
            SELECT 
                s.id, s.name, s.color,
                COUNT(t.id) as total_tasks,
                COUNT(CASE WHEN t.status_name ILIKE '%complete%' OR t.status_name ILIKE '%done%' THEN 1 END) as completed_tasks,
                COUNT(CASE WHEN t.status_name ILIKE '%progress%' THEN 1 END) as in_progress_tasks
            FROM clickup_spaces s
            LEFT JOIN clickup_tasks t ON s.id = t.space_id AND t.archived = false
            GROUP BY s.id, s.name, s.color
            ORDER BY total_tasks DESC
        `);

        console.log(`[${new Date().toISOString()}] 🎯 Projects - ${projectsResult.rows.length} spaces/projects`);

        res.json({
            success: true,
            projects: projectsResult.rows,
            totalProjects: projectsResult.rows.length,
            data_source: "Real ClickUp Data (PostgreSQL) - Project Analytics",
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Projects error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load projects',
            error: error.message
        });
    }
});

// Logout endpoint
app.post('/api/v2/auth/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: 'Logout failed'
            });
        }
        res.clearCookie('connect.sid');
        res.json({
            success: true,
            message: 'Logged out successfully'
        });
    });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log(`[${new Date().toISOString()}] 🔌 Socket.IO client connected: ${socket.id}`);
    
    socket.on('disconnect', () => {
        console.log(`[${new Date().toISOString()}] 🔌 Socket.IO client disconnected: ${socket.id}`);
    });
});

// Initialize and start server
async function startServer() {
    try {
        // Load ClickUp token
        await loadClickUpToken();
        
        const PORT = process.env.PORT || 7812;
        server.listen(PORT, () => {
            console.log(`[${new Date().toISOString()}] 🚀 TaskFlow Pro PostgreSQL-Only Backend v13.0.0`);
            console.log(`[${new Date().toISOString()}] 🌐 Server running on port ${PORT}`);
            console.log(`[${new Date().toISOString()}] 🐘 Database: PostgreSQL Only`);
            console.log(`[${new Date().toISOString()}] 🔌 WebSocket: Ready`);
            console.log(`[${new Date().toISOString()}] 🔑 ClickUp Integration: ${CLICKUP_TOKEN ? 'Active' : 'Inactive'}`);
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

startServer();