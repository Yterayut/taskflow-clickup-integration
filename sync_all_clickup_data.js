// Sync ALL ClickUp Data - Complete/In Progress/To Do
// Enhanced sync for all tasks and subtasks with all statuses
const axios = require('axios');
const { Client, Pool } = require('pg');

const pool = new Pool({
    host: 'localhost',
    database: 'taskflow',
    user: 'postgres',
    password: '',
    port: 5432,
});

const CLICKUP_TOKEN = 'pk_282686567_9YVTHM0C1HQJDMEUWZP8RTP48S4YV5HL';

async function syncAllClickUpData() {
    try {
        console.log('🚀 Starting complete ClickUp data sync...');
        
        // Get all teams
        const teamsResponse = await axios.get('https://api.clickup.com/api/v2/team', {
            headers: { 'Authorization': CLICKUP_TOKEN }
        });
        
        const teams = teamsResponse.data.teams;
        console.log(`📊 Found ${teams.length} teams`);
        
        for (const team of teams) {
            console.log(`\n🏢 Processing team: ${team.name} (${team.id})`);
            
            // Get all spaces for team
            const spacesResponse = await axios.get(`https://api.clickup.com/api/v2/team/${team.id}/space`, {
                headers: { 'Authorization': CLICKUP_TOKEN }
            });
            
            for (const space of spacesResponse.data.spaces) {
                console.log(`  🌐 Processing space: ${space.name} (${space.id})`);
                
                // Get all folders in space
                const foldersResponse = await axios.get(`https://api.clickup.com/api/v2/space/${space.id}/folder`, {
                    headers: { 'Authorization': CLICKUP_TOKEN }
                });
                
                // Get folderless lists
                const folderlessListsResponse = await axios.get(`https://api.clickup.com/api/v2/space/${space.id}/list`, {
                    headers: { 'Authorization': CLICKUP_TOKEN }
                });
                
                const allLists = [...folderlessListsResponse.data.lists];
                
                // Add lists from folders
                for (const folder of foldersResponse.data.folders) {
                    console.log(`    📁 Processing folder: ${folder.name}`);
                    allLists.push(...folder.lists);
                }
                
                console.log(`  📝 Found ${allLists.length} total lists in space`);
                
                // Process each list
                for (const list of allLists) {
                    console.log(`    📋 Processing list: ${list.name} (${list.id})`);
                    
                    // Get ALL tasks with all statuses - NO FILTERS
                    let page = 0;
                    let allTasks = [];
                    
                    while (true) {
                        console.log(`      🔄 Fetching page ${page}...`);
                        
                        const tasksResponse = await axios.get(`https://api.clickup.com/api/v2/list/${list.id}/task`, {
                            headers: { 'Authorization': CLICKUP_TOKEN },
                            params: {
                                page: page,
                                limit: 100,
                                include_closed: true,  // Include completed tasks
                                include_archived: false, // Exclude archived
                                subtasks: true,         // Include subtasks
                                include_markdown_description: true
                            }
                        });
                        
                        const tasks = tasksResponse.data.tasks;
                        if (tasks.length === 0) break;
                        
                        allTasks.push(...tasks);
                        console.log(`      ✅ Found ${tasks.length} tasks on page ${page}`);
                        
                        page++;
                        
                        // Safety limit
                        if (page > 10) break;
                    }
                    
                    console.log(`    📊 Total tasks in list "${list.name}": ${allTasks.length}`);
                    
                    // Save tasks to database
                    for (const task of allTasks) {
                        await saveTaskToDatabase(task, space, list);
                    }
                }
            }
        }
        
        // Final count
        const finalCount = await pool.query('SELECT COUNT(*) as count FROM clickup_tasks');
        const assignmentCount = await pool.query('SELECT COUNT(*) as count FROM clickup_task_assignments');
        
        console.log('\n✅ Complete sync finished!');
        console.log(`📋 Total tasks in database: ${finalCount.rows[0].count}`);
        console.log(`🎯 Total assignments: ${assignmentCount.rows[0].count}`);
        
    } catch (error) {
        console.error('❌ Sync error:', error.response?.data || error.message);
    }
}

async function saveTaskToDatabase(task, space, list) {
    try {
        // Insert/update task
        await pool.query(`
            INSERT INTO clickup_tasks (
                id, name, description, 
                status_id, status_name, status_color, status_type,
                priority_id, priority_name, priority_color,
                creator_id, parent,
                team_id, space_id, list_id, list_name, space_name,
                date_created, date_updated, date_closed, date_done, due_date, start_date,
                time_estimate, time_spent, points, url, text_content,
                watchers, tags, custom_fields, archived, synced_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
                $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, CURRENT_TIMESTAMP
            ) ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                description = EXCLUDED.description,
                status_name = EXCLUDED.status_name,
                status_color = EXCLUDED.status_color,
                priority_name = EXCLUDED.priority_name,
                priority_color = EXCLUDED.priority_color,
                date_updated = EXCLUDED.date_updated,
                synced_at = CURRENT_TIMESTAMP
        `, [
            task.id, task.name, task.description,
            task.status?.id, task.status?.status, task.status?.color, task.status?.type,
            task.priority?.id, task.priority?.priority, task.priority?.color,
            task.creator?.id ? parseInt(task.creator.id) : null,
            task.parent || null,
            task.team_id, space.id, list.id, list.name, space.name,
            parseInt(task.date_created), parseInt(task.date_updated), 
            task.date_closed ? parseInt(task.date_closed) : null,
            task.date_done ? parseInt(task.date_done) : null,
            task.due_date ? parseInt(task.due_date) : null,
            task.start_date ? parseInt(task.start_date) : null,
            task.time_estimate ? parseInt(task.time_estimate) : null,
            task.time_spent ? parseInt(task.time_spent) : null,
            task.points ? parseFloat(task.points) : null,
            task.url, task.text_content,
            task.watchers ? JSON.stringify(task.watchers) : null,
            task.tags ? JSON.stringify(task.tags) : null,
            task.custom_fields ? JSON.stringify(task.custom_fields) : null,
            task.archived || false
        ]);
        
        // Handle task assignments
        if (task.assignees && task.assignees.length > 0) {
            // Clear existing assignments for this task
            await pool.query('DELETE FROM clickup_task_assignments WHERE task_id = $1', [task.id]);
            
            // Insert new assignments
            for (const assignee of task.assignees) {
                await pool.query(
                    'INSERT INTO clickup_task_assignments (task_id, member_id, assigned_at) VALUES ($1, $2, CURRENT_TIMESTAMP) ON CONFLICT (task_id, member_id) DO NOTHING',
                    [task.id, parseInt(assignee.id)]
                );
            }
        }
        
        console.log(`      ✅ Saved task: "${task.name}" (Status: ${task.status?.status || 'none'}, Assignees: ${task.assignees?.length || 0})`);
        
    } catch (error) {
        console.log(`      ❌ Error saving task "${task.name}": ${error.message}`);
    }
}

// Run sync
syncAllClickUpData();