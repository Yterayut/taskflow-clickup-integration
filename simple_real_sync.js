/**
 * Simple Real ClickUp Data Sync
 * Focus on essential data only - tasks and assignments
 */

const { Pool } = require('pg');

// PostgreSQL connection config
const dbConfig = {
    host: 'localhost',
    port: 5432,
    database: 'taskflow_pro',
    user: 'postgres',
    password: '',
    ssl: false
};

const CLICKUP_TOKEN = 'pk_282686567_9YVTHM0C1HQJDMEUWZP8RTP48S4YV5HL';
const TEAM_ID = '90181167380';

async function syncRealClickUpData() {
    const db = new Pool(dbConfig);
    
    try {
        console.log('[REAL SYNC] Starting ClickUp real data sync...');
        
        // 1. Get real tasks from ClickUp API
        const response = await fetch(`https://api.clickup.com/api/v2/team/${TEAM_ID}/task?page=0&order_by=updated&reverse=true&include_closed=true&subtasks=true`, {
            headers: {
                'Authorization': CLICKUP_TOKEN,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`ClickUp API error: ${response.status}`);
        }

        const data = await response.json();
        
        if (!data.tasks || data.tasks.length === 0) {
            console.log('[REAL SYNC] No tasks found');
            return;
        }

        console.log(`[REAL SYNC] Found ${data.tasks.length} real tasks from ClickUp`);

        // 2. Clear task assignments first
        await db.query('DELETE FROM clickup_task_assignments');
        
        let tasksUpdated = 0;
        let assignmentsCreated = 0;

        // 3. Update existing tasks with real assignee data
        for (const task of data.tasks) {
            // Update task with parent info for subtasks
            await db.query(`
                UPDATE clickup_tasks 
                SET 
                    parent = $2,
                    updated_at = CURRENT_TIMESTAMP,
                    synced_at = CURRENT_TIMESTAMP
                WHERE id = $1
            `, [task.id, task.parent || null]);

            tasksUpdated++;

            // 4. Create real assignments
            if (task.assignees && task.assignees.length > 0) {
                for (const assignee of task.assignees) {
                    // First ensure the member exists
                    await db.query(`
                        INSERT INTO clickup_members (id, username, email, color, initials, profile_picture, is_active, synced_at) 
                        VALUES ($1, $2, $3, $4, $5, $6, true, CURRENT_TIMESTAMP)
                        ON CONFLICT (id) DO UPDATE SET
                            username = EXCLUDED.username,
                            email = EXCLUDED.email,
                            color = EXCLUDED.color,
                            initials = EXCLUDED.initials,
                            profile_picture = EXCLUDED.profile_picture,
                            synced_at = CURRENT_TIMESTAMP
                    `, [
                        assignee.id,
                        assignee.username,
                        assignee.email,
                        assignee.color,
                        assignee.initials,
                        assignee.profilePicture
                    ]);

                    // Then create the assignment
                    await db.query(`
                        INSERT INTO clickup_task_assignments (task_id, member_id, assigned_at) 
                        VALUES ($1, $2, CURRENT_TIMESTAMP)
                        ON CONFLICT (task_id, member_id) DO NOTHING
                    `, [task.id, assignee.id]);
                    
                    assignmentsCreated++;
                    
                    console.log(`[REAL SYNC] Assigned task "${task.name}" to ${assignee.username}`);
                }
            } else {
                console.log(`[REAL SYNC] Task "${task.name}" has no assignees (real data)`);
            }
        }

        // 5. Get final counts
        const tasksResult = await db.query('SELECT COUNT(*) as count FROM clickup_tasks');
        const membersResult = await db.query('SELECT COUNT(*) as count FROM clickup_members WHERE synced_at >= NOW() - INTERVAL \'1 minute\'');
        const assignmentsResult = await db.query('SELECT COUNT(*) as count FROM clickup_task_assignments');

        console.log('[REAL SYNC] ✅ Sync completed successfully!');
        console.log(`[REAL SYNC] 📝 Tasks in database: ${tasksResult.rows[0].count}`);
        console.log(`[REAL SYNC] 👥 Members synced: ${membersResult.rows[0].count}`);
        console.log(`[REAL SYNC] 🎯 Real assignments: ${assignmentsResult.rows[0].count}`);
        console.log(`[REAL SYNC] 🔄 Tasks updated: ${tasksUpdated}`);
        
    } catch (error) {
        console.error('[REAL SYNC] ❌ Error:', error.message);
    } finally {
        await db.end();
    }
}

syncRealClickUpData();