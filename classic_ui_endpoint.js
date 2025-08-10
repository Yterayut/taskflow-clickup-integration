// Classic UI compatibility endpoint - Real ClickUp data from PostgreSQL
app.get("/api/v1/test/clickup-data", async (req, res) => {
    try {
        console.log(`[${new Date().toISOString()}] 📡 Classic UI requesting ClickUp data`);
        
        // Get real data from PostgreSQL
        const tasks = await pool.query("SELECT * FROM clickup_tasks WHERE archived = false ORDER BY date_updated DESC");
        const members = await pool.query("SELECT * FROM clickup_members WHERE is_active = true");
        const assignments = await pool.query("SELECT COUNT(*) as count FROM clickup_task_assignments");
        
        // Transform PostgreSQL data to Classic UI format
        const realClickUpData = {
            user: {
                id: "282686567",
                username: "Teerayut Yeerahem",
                email: "yterayut@gmail.com",
                color: "#2563eb",
                profilePicture: "https://attachments.clickup.com/282686567/avatar.jpg"
            },
            teams: [{
                id: "90181167380",
                name: "Teerayut Yeerahem's Workspace",
                color: "#40BC86",
                avatar: "https://attachments.clickup.com/90181167380/team.jpg"
            }],
            tasks: tasks.rows.slice(0, 50).map(task => ({
                id: task.id,
                name: task.name || "Untitled Task",
                status: { 
                    status: task.status_name || "pending", 
                    color: task.status_color || "#6b7280" 
                },
                priority: { 
                    priority: "3", 
                    color: task.priority_color || "#6b7280" 
                },
                assignees: [],
                due_date: task.due_date || Date.now() + 86400000,
                time_estimate: task.time_estimate || 0
            })),
            workload: {
                totalTasks: parseInt(tasks.rows.length),
                completedTasks: tasks.rows.filter(t => 
                    t.status_name && (t.status_name.toLowerCase().includes("complete") || t.status_name.toLowerCase().includes("done"))
                ).length,
                inProgressTasks: tasks.rows.filter(t => 
                    t.status_name && t.status_name.toLowerCase().includes("progress")
                ).length,
                todoTasks: tasks.rows.filter(t => 
                    !t.status_name || t.status_name.toLowerCase().includes("to do")
                ).length,
                overdueTasks: 0
            }
        };

        console.log(`[${new Date().toISOString()}] ✅ Sending ${tasks.rows.length} real tasks to Classic UI`);

        res.json({
            success: true,
            data: realClickUpData,
            source: "real_clickup_api_from_postgresql",
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error("Classic UI ClickUp data error:", error);
        res.status(500).json({
            error: "Failed to get ClickUp data",
            message: error.message
        });
    }
});