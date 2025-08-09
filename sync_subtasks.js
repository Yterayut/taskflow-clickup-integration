#!/usr/bin/env node
/**
 * Sync ClickUp Subtasks
 * Fetch subtasks for each main task
 */

const sqlite3 = require('sqlite3').verbose();

// ClickUp API Configuration
const CLICKUP_TOKEN = 'pk_282686567_9YVTHM0C1HQJDMEUWZP8RTP48S4YV5HL';
const CLICKUP_API_BASE = 'https://api.clickup.com/api/v2';

// Database connection
const db = new sqlite3.Database('./taskflow_production_real.db');

// Fetch from ClickUp API
async function fetchClickUpData(endpoint) {
    const fetch = (await import('node-fetch')).default;
    
    try {
        console.log(`📡 Fetching: ${endpoint}`);
        const response = await fetch(`${CLICKUP_API_BASE}${endpoint}`, {
            headers: {
                'Authorization': CLICKUP_TOKEN,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Error ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error(`❌ Error fetching ${endpoint}:`, error.message);
        throw error;
    }
}

// Sync subtasks for a specific task
async function syncSubtasks(taskId, parentTaskName) {
    try {
        const data = await fetchClickUpData(`/task/${taskId}`);
        const task = data;
        
        if (task.subtasks && task.subtasks.length > 0) {
            console.log(`  🔗 Found ${task.subtasks.length} subtasks for "${parentTaskName}"`);
            
            for (const subtask of task.subtasks) {
                const assignee = subtask.assignees?.[0];
                
                await new Promise((resolve, reject) => {
                    db.run(
                        'INSERT OR REPLACE INTO clickup_tasks (id, name, status, orderindex, date_created, date_updated, date_closed, assignee, assignee_id, assignee_username, assignee_email, priority, due_date, description, list_id, space_id, parent_id, url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                        [
                            subtask.id,
                            subtask.name,
                            subtask.status?.status || 'Open',
                            subtask.orderindex || '',
                            subtask.date_created ? parseInt(subtask.date_created) : null,
                            subtask.date_updated ? parseInt(subtask.date_updated) : null,
                            subtask.date_closed ? parseInt(subtask.date_closed) : null,
                            assignee?.username || null,
                            assignee?.id || null,
                            assignee?.username || null,
                            assignee?.email || null,
                            subtask.priority?.priority || null,
                            subtask.due_date || null,
                            subtask.description || null,
                            subtask.list?.id || null,
                            subtask.space?.id || null,
                            taskId, // parent_id
                            subtask.url || null
                        ],
                        (err) => err ? reject(err) : resolve()
                    );
                });
                
                console.log(`    ✅ Subtask: "${subtask.name}"`);
            }
            
            return task.subtasks.length;
        } else {
            return 0;
        }
    } catch (error) {
        console.error(`❌ Error syncing subtasks for task ${taskId}:`, error);
        return 0;
    }
}

// Main function
async function main() {
    console.log('🚀 Starting Subtasks Sync...');
    
    try {
        // Get all main tasks (parent_id IS NULL)
        const mainTasks = await new Promise((resolve, reject) => {
            db.all(
                'SELECT id, name FROM clickup_tasks WHERE parent_id IS NULL OR parent_id = ""',
                (err, rows) => err ? reject(err) : resolve(rows)
            );
        });
        
        console.log(`📋 Found ${mainTasks.length} main tasks to check for subtasks`);
        
        let totalSubtasks = 0;
        
        // For each main task, fetch and sync subtasks
        for (const task of mainTasks) {
            console.log(`🔍 Checking subtasks for: "${task.name}" (ID: ${task.id})`);
            const subtaskCount = await syncSubtasks(task.id, task.name);
            totalSubtasks += subtaskCount;
        }
        
        // Final statistics
        const stats = await new Promise((resolve, reject) => {
            db.get(
                'SELECT COUNT(*) as total_tasks, COUNT(CASE WHEN parent_id IS NULL OR parent_id = "" THEN 1 END) as main_tasks, COUNT(CASE WHEN parent_id IS NOT NULL AND parent_id != "" THEN 1 END) as sub_tasks FROM clickup_tasks',
                (err, row) => err ? reject(err) : resolve(row)
            );
        });
        
        console.log('\n📊 SUBTASKS SYNC COMPLETE - STATISTICS:');
        console.log(`✅ Total Tasks: ${stats.total_tasks}`);
        console.log(`📋 Main Tasks: ${stats.main_tasks}`);
        console.log(`🔗 Sub Tasks: ${stats.sub_tasks}`);
        console.log(`📥 New Subtasks Added: ${totalSubtasks}`);
        
        if (stats.sub_tasks > 0) {
            console.log('\n🎉 SUCCESS: Subtasks synced successfully!');
        } else {
            console.log('\n📝 No subtasks found in ClickUp tasks');
        }
        
    } catch (error) {
        console.error('❌ SUBTASKS SYNC FAILED:', error);
        process.exit(1);
    } finally {
        db.close();
    }
}

// Run the sync
main();