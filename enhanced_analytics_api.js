// Enhanced Analytics API Endpoints
// Add to backend_postgresql_only.js for advanced analytics

// Enhanced dashboard with trends and productivity metrics
app.get('/api/v2/dashboard/enhanced-analytics', async (req, res) => {
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

        // Member productivity (top 10)
        const memberProductivity = await pool.query(`
            SELECT 
                m.username,
                m.email,
                COUNT(ta.task_id) as total_assigned,
                COUNT(CASE WHEN t.status_name ILIKE '%complete%' OR t.status_name ILIKE '%done%' THEN 1 END) as completed,
                COUNT(CASE WHEN t.status_name ILIKE '%progress%' THEN 1 END) as in_progress,
                ROUND((COUNT(CASE WHEN t.status_name ILIKE '%complete%' OR t.status_name ILIKE '%done%' THEN 1 END) * 100.0 / NULLIF(COUNT(ta.task_id), 0)), 2) as completion_rate
            FROM clickup_members m
            LEFT JOIN clickup_task_assignments ta ON m.id = ta.member_id
            LEFT JOIN clickup_tasks t ON ta.task_id = t.id AND t.archived = false
            WHERE m.is_active = true
            GROUP BY m.id, m.username, m.email
            HAVING COUNT(ta.task_id) > 0
            ORDER BY completion_rate DESC, total_assigned DESC
            LIMIT 10
        `);

        // Recent task activity (last 30 days based on date_updated)
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
        const recentActivity = await pool.query(`
            SELECT 
                t.name,
                t.status_name,
                m.username as assigned_to,
                t.date_updated
            FROM clickup_tasks t
            LEFT JOIN clickup_task_assignments ta ON t.id = ta.task_id
            LEFT JOIN clickup_members m ON ta.member_id = m.id
            WHERE t.archived = false 
              AND t.date_updated > $1
            ORDER BY t.date_updated DESC
            LIMIT 15
        `, [thirtyDaysAgo]);

        // List/Project performance
        const listPerformance = await pool.query(`
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

        console.log(`[${new Date().toISOString()}] 📊 Enhanced Analytics - ${analytics.total_tasks} tasks, ${members.total_members} members`);

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
                
                // Trends and distributions
                statusTrends: statusTrends.rows,
                priorityDistribution: priorityDistribution.rows,
                memberProductivity: memberProductivity.rows,
                recentActivity: recentActivity.rows.map(activity => ({
                    ...activity,
                    date_updated: new Date(parseInt(activity.date_updated)).toISOString()
                })),
                listPerformance: listPerformance.rows,
                
                // Metadata
                dataSource: "Enhanced Real ClickUp Analytics (PostgreSQL)",
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

// Task trend analysis endpoint
app.get('/api/v2/analytics/task-trends', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, message: 'Not authenticated' });
        }

        // Task completion over time (based on date_updated)
        const trends = await pool.query(`
            SELECT 
                DATE(to_timestamp(date_updated::bigint / 1000)) as completion_date,
                COUNT(CASE WHEN status_name ILIKE '%complete%' OR status_name ILIKE '%done%' THEN 1 END) as completed_count,
                COUNT(*) as total_tasks
            FROM clickup_tasks
            WHERE archived = false 
              AND date_updated IS NOT NULL
              AND date_updated > $1
            GROUP BY DATE(to_timestamp(date_updated::bigint / 1000))
            ORDER BY completion_date DESC
            LIMIT 30
        `, [Date.now() - (30 * 24 * 60 * 60 * 1000)]);

        res.json({
            success: true,
            data: {
                trends: trends.rows,
                dataSource: "Task Trends Analysis (PostgreSQL)",
                period: "Last 30 days"
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

// Export this for integration
module.exports = {
    enhancedAnalyticsEndpoint: '/api/v2/dashboard/enhanced-analytics',
    taskTrendsEndpoint: '/api/v2/analytics/task-trends'
};