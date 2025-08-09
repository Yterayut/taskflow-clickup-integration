/**
 * SQLite Assignment Sync - Sync real ClickUp assignments to SQLite
 * Fixes the 0 assignments issue by syncing real data from ClickUp API
 */

const Database = require('better-sqlite3');

class SQLiteAssignmentSync {
    constructor(clickUpToken, dbPath) {
        this.clickUpToken = clickUpToken;
        this.baseUrl = 'https://api.clickup.com/api/v2';
        this.headers = {
            'Authorization': clickUpToken,
            'Content-Type': 'application/json'
        };
        
        // SQLite connection
        this.db = new Database(dbPath);
        
        console.log(`[${new Date().toISOString()}] 🔄 SQLite Assignment Sync initialized`);
    }

    /**
     * Fetch data from ClickUp API
     */
    async fetchClickUpData(endpoint) {
        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                headers: this.headers
            });

            if (!response.ok) {
                throw new Error(`ClickUp API error: ${response.status} ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`[${new Date().toISOString()}] ❌ ClickUp API fetch error:`, error.message);
            throw error;
        }
    }

    /**
     * Get team ID from existing data
     */
    getTeamId() {
        try {
            // Get team ID from existing members
            const member = this.db.prepare(`
                SELECT DISTINCT team_id 
                FROM clickup_members 
                WHERE team_id IS NOT NULL 
                LIMIT 1
            `).get();
            
            return member?.team_id || '90181167380'; // Default to known team ID
        } catch (error) {
            console.error('Error getting team ID:', error.message);
            return '90181167380'; // Fallback to known team ID
        }
    }

    /**
     * Sync assignments for all tasks
     */
    async syncAssignments() {
        try {
            const teamId = this.getTeamId();
            console.log(`[${new Date().toISOString()}] 📝 Syncing assignments for team ${teamId}...`);
            
            // Get tasks from ClickUp with assignments
            const data = await this.fetchClickUpData(`/team/${teamId}/task?page=0&order_by=updated&reverse=true&include_closed=true&subtasks=true`);
            
            if (!data.tasks || data.tasks.length === 0) {
                console.log(`[${new Date().toISOString()}] ⚠️ No tasks found for team ${teamId}`);
                return { tasks: 0, assignments: 0 };
            }

            let tasksWithAssignments = 0;
            let assignmentsCount = 0;
            
            // Prepare statements for performance
            const insertAssignment = this.db.prepare(`
                INSERT OR IGNORE INTO clickup_task_assignments (task_id, member_id, member_name, member_email, assigned_at) 
                VALUES (?, ?, ?, ?, datetime('now'))
            `);
            
            const deleteExistingAssignments = this.db.prepare(`
                DELETE FROM clickup_task_assignments WHERE task_id = ?
            `);
            
            const updateTaskAssignee = this.db.prepare(`
                UPDATE clickup_tasks 
                SET assignee_id = ?, assignee = ?, assignee_username = ?, assignee_email = ?, updated_at = datetime('now')
                WHERE id = ?
            `);

            // Process each task
            for (const task of data.tasks) {
                // Check if task exists in our database
                const existingTask = this.db.prepare('SELECT id FROM clickup_tasks WHERE id = ?').get(task.id);
                
                if (!existingTask) {
                    console.log(`⚠️ Task ${task.id} not found in local database, skipping assignments`);
                    continue;
                }

                // Clear existing assignments for this task
                deleteExistingAssignments.run(task.id);

                // Process assignments
                if (task.assignees && task.assignees.length > 0) {
                    tasksWithAssignments++;
                    
                    // For backward compatibility, set first assignee in main task table
                    const firstAssignee = task.assignees[0];
                    updateTaskAssignee.run(
                        firstAssignee.id,
                        firstAssignee.username,
                        firstAssignee.username,
                        firstAssignee.email,
                        task.id
                    );
                    
                    // Insert all assignees into assignments table
                    for (const assignee of task.assignees) {
                        insertAssignment.run(
                            task.id,
                            assignee.id,
                            assignee.username,
                            assignee.email
                        );
                        
                        assignmentsCount++;
                        
                        console.log(`✅ Assignment: "${task.name}" → ${assignee.username} (${assignee.id})`);
                    }
                }
            }

            console.log(`[${new Date().toISOString()}] ✅ Assignment sync completed:`);
            console.log(`[${new Date().toISOString()}] 📊 Tasks with assignments: ${tasksWithAssignments}`);
            console.log(`[${new Date().toISOString()}] 🎯 Total assignments: ${assignmentsCount}`);

            return { 
                tasks: tasksWithAssignments, 
                assignments: assignmentsCount,
                totalTasksProcessed: data.tasks.length
            };
            
        } catch (error) {
            console.error(`[${new Date().toISOString()}] ❌ Assignment sync error:`, error.message);
            return { tasks: 0, assignments: 0, error: error.message };
        }
    }

    /**
     * Get current assignment counts
     */
    getAssignmentCounts() {
        try {
            const counts = this.db.prepare(`
                SELECT 
                    COUNT(DISTINCT task_id) as tasks_with_assignments,
                    COUNT(*) as total_assignments
                FROM clickup_task_assignments
            `).get();
            
            const totalTasks = this.db.prepare('SELECT COUNT(*) as count FROM clickup_tasks').get();
            
            return {
                totalTasks: totalTasks.count,
                tasksWithAssignments: counts.tasks_with_assignments,
                totalAssignments: counts.total_assignments
            };
        } catch (error) {
            console.error('Error getting assignment counts:', error.message);
            return { totalTasks: 0, tasksWithAssignments: 0, totalAssignments: 0 };
        }
    }

    /**
     * Test assignment queries
     */
    testAssignmentQueries() {
        try {
            console.log('\n📊 Assignment Query Tests:');
            
            // Test 1: Basic assignments
            const assignments = this.db.prepare(`
                SELECT t.name, ta.member_name, ta.member_id 
                FROM clickup_tasks t
                JOIN clickup_task_assignments ta ON t.id = ta.task_id
                LIMIT 10
            `).all();
            
            console.log(`\n✅ Found ${assignments.length} assignments:`);
            assignments.forEach(a => {
                console.log(`   "${a.name}" → ${a.member_name} (${a.member_id})`);
            });
            
            // Test 2: Tasks with multiple assignees
            const multiAssignees = this.db.prepare(`
                SELECT t.name, COUNT(ta.member_id) as assignee_count,
                       GROUP_CONCAT(ta.member_name, ', ') as assignees
                FROM clickup_tasks t
                JOIN clickup_task_assignments ta ON t.id = ta.task_id
                GROUP BY t.id, t.name
                HAVING COUNT(ta.member_id) > 1
                LIMIT 5
            `).all();
            
            console.log(`\n✅ Tasks with multiple assignees (${multiAssignees.length}):`);
            multiAssignees.forEach(t => {
                console.log(`   "${t.name}" → ${t.assignee_count} people: ${t.assignees}`);
            });
            
            // Test 3: User-specific tasks
            const userTasks = this.db.prepare(`
                SELECT DISTINCT ta.member_id, ta.member_name, COUNT(ta.task_id) as task_count
                FROM clickup_task_assignments ta
                GROUP BY ta.member_id, ta.member_name
                ORDER BY task_count DESC
                LIMIT 10
            `).all();
            
            console.log(`\n✅ Tasks per user:`);
            userTasks.forEach(u => {
                console.log(`   ${u.member_name} (${u.member_id}): ${u.task_count} tasks`);
            });
            
        } catch (error) {
            console.error('Error testing assignment queries:', error.message);
        }
    }

    close() {
        this.db.close();
    }
}

module.exports = SQLiteAssignmentSync;

// CLI usage
if (require.main === module) {
    const run = async () => {
        const token = process.env.CLICKUP_TOKEN || 'pk_282686567_9YVTHM0C1HQJDMEUWZP8RTP48S4YV5HL';
        const dbPath = process.argv[2] || 'taskflow.db';
        
        const sync = new SQLiteAssignmentSync(token, dbPath);
        
        console.log('\n📊 Current assignment counts:');
        console.log(sync.getAssignmentCounts());
        
        console.log('\n🔄 Starting assignment sync...');
        const result = await sync.syncAssignments();
        
        console.log('\n📊 Updated assignment counts:');
        console.log(sync.getAssignmentCounts());
        
        console.log('\n🧪 Testing assignment queries...');
        sync.testAssignmentQueries();
        
        sync.close();
        
        if (result.error) {
            console.error('\n❌ Sync completed with errors');
            process.exit(1);
        } else {
            console.log('\n✅ Assignment sync completed successfully');
        }
    };
    
    run().catch(console.error);
}